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

// 1. ПОРТ - Открываем сразу, чтобы Render не ругался на таймаут
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

// 2. НАСТРОЙКИ БД
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 3. ИНИЦИАЛИЗАЦИЯ (С автоматической починкой структуры)
async function initDb() {
    try {
        console.log("🛠 Проверка структуры таблиц...");
        
        // РАСКОММЕНТИРОВАНО ДЛЯ ИСПРАВЛЕНИЯ ОШИБКИ 42703
        // После успешного входа эти две строки лучше закомментировать обратно
        await pool.query('DROP TABLE IF EXISTS messages CASCADE;');
        await pool.query('DROP TABLE IF EXISTS users CASCADE;');

        await pool.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                avatar_color TEXT DEFAULT '#00C2C7'
            );
        `);

        await pool.query(`
            CREATE TABLE messages (
                id SERIAL PRIMARY KEY,
                username TEXT,
                avatar_color TEXT,
                text TEXT,
                channel_key TEXT,
                timestamp TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log("✅ База данных готова (таблицы пересозданы)");
    } catch (err) {
        console.error("❌ Ошибка БД:", err.message);
    }
}
initDb();

// 4. МИДДЛВЕРЫ
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 5. API ЭНДПОИНТЫ
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: "Заполните все поля" });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.json({ success: true });
    } catch (err) {
        const msg = err.code === '23505' ? "Никнейм занят" : "Ошибка: " + err.code;
        res.status(400).json({ success: false, error: msg });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                return res.json({ 
                    success: true, 
                    user: { name: user.username, color: user.avatar_color } 
                });
            }
        }
        res.status(401).json({ success: false, error: "Неверный логин или пароль" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Ошибка сервера" });
    }
});

app.get('/api/messages/:channelKey', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT username as user, avatar_color as "avatarColor", text, 
            channel_key as "serverChannel", TO_CHAR(timestamp, 'HH24:MI') as timestamp 
            FROM messages WHERE channel_key = $1 ORDER BY id ASC LIMIT 100`, 
            [req.params.channelKey]
        );
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

// 6. SOCKET.IO
io.on('connection', (socket) => {
    socket.on('chat message', async (msg) => {
        try {
            await pool.query(
                'INSERT INTO messages (username, avatar_color, text, channel_key) VALUES ($1, $2, $3, $4)', 
                [msg.user, msg.avatarColor, msg.text, msg.serverChannel]
            );
            msg.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            io.emit('chat message', msg);
        } catch (err) {
            console.error("Ошибка при сохранении сообщения:", err.message);
        }
    });
});