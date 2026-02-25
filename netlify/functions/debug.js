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
        'Access-Control-Allow-Origin': '*'
    };

    try {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM addresses ORDER BY created_at DESC');
        const count = await db.get('SELECT COUNT(*) as count FROM addresses');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                total: count.count,
                addresses: rows
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};