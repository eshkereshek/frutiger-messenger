const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Инициализация БД
async function initDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                avatar_color TEXT DEFAULT '#00C2C7'
            );
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                username TEXT,
                avatar_color TEXT,
                text TEXT,
                channel_key TEXT,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log("БД Frutiger-DB готова");
    } catch (err) { console.error("Ошибка БД:", err); }
}
initDb();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// РЕГИСТРАЦИЯ
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: "Заполните все поля" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.json({ success: true });
    } catch (err) {
        console.error("Ошибка регистрации:", err.code);
        // Код ошибки 23505 — это уникальное нарушение (ник занят) в PostgreSQL
        const msg = err.code === '23505' ? "Этот никнейм уже занят" : "Ошибка базы данных";
        res.status(400).json({ success: false, error: msg });
    }
});

// ЛОГИН
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) return res.json({ success: true, user: { name: user.username, color: user.avatar_color } });
        }
        res.status(401).json({ success: false, error: "Неверный ник или пароль" });
    } catch (err) { res.status(500).json({ success: false, error: "Ошибка сервера" }); }
});

app.get('/api/messages/:channelKey', async (req, res) => {
    const result = await pool.query('SELECT username as user, avatar_color as "avatarColor", text, channel_key as "serverChannel", TO_CHAR(timestamp, \'HH24:MI\') as timestamp FROM messages WHERE channel_key = $1 ORDER BY id ASC LIMIT 50', [req.params.channelKey]);
    res.json(result.rows);
});

io.on('connection', (socket) => {
    socket.on('chat message', async (msg) => {
        await pool.query('INSERT INTO messages (username, avatar_color, text, channel_key) VALUES ($1, $2, $3, $4)', [msg.user, msg.avatarColor, msg.text, msg.serverChannel]);
        msg.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.emit('chat message', msg);
    });
});

server.listen(process.env.PORT || 10000);