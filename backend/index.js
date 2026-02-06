const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'frutiger_secret_99';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Эндпоинты ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

app.post('/api/register', async (req, res) => {
    // В реальности здесь будет запрос к database.js
    const { username } = req.body;
    const token = jwt.sign({ username }, JWT_SECRET);
    res.json({ success: true, token, username });
});

app.post('/api/login', (req, res) => {
    const { username } = req.body;
    const token = jwt.sign({ username }, JWT_SECRET);
    res.json({ success: true, token, username });
});

// --- WebSocket Логика ---

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('message', (data) => {
        // Рассылаем всем сообщение
        io.emit('message', {
            text: data.text,
            user: data.user,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// SPA Routing: Все запросы, которые не API, отдают index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Frutiger Server running on port ${PORT}`);
});