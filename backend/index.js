const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Подключение к PostgreSQL (frutiger-db)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Создание таблицы, если её нет
async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            username TEXT,
            avatar_color TEXT,
            text TEXT,
            channel_key TEXT,
            timestamp TIMESTAMPTZ DEFAULT NOW()
        );
    `);
}
initDb();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Получение истории сообщений
app.get('/api/messages/:channelKey', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT username as user, avatar_color as "avatarColor", text, channel_key as "serverChannel", TO_CHAR(timestamp, \'HH24:MI\') as timestamp FROM messages WHERE channel_key = $1 ORDER BY id ASC LIMIT 50',
            [req.params.channelKey]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

io.on('connection', (socket) => {
    socket.on('chat message', async (msg) => {
        try {
            await pool.query(
                'INSERT INTO messages (username, avatar_color, text, channel_key) VALUES ($1, $2, $3, $4)',
                [msg.user, msg.avatarColor, msg.text, msg.serverChannel]
            );
            msg.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            io.emit('chat message', msg);
        } catch (err) { console.error(err); }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Aero Chat Server on ${PORT}`));