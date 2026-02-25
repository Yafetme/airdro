const { Database } = require('sqlite3');
const { open } = require('sqlite');

let db = null;

async function getDb() {
    if (!db) {
        db = await open({
            filename: '/tmp/database.sqlite',
            driver: Database
        });
    }
    return db;
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const db = await getDb();
        const rows = await db.all('SELECT address FROM addresses ORDER BY created_at DESC');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(rows.map(row => row.address))
        };
    } catch (err) {
        console.error('Error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Could not read data' })
        };
    }
};