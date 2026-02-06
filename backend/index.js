const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./database');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'frutiger_secret_2026';

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email, hash]
    );
    res.json(result.rows[0]);
  } catch (e) { 
    console.error("Registration error:", e);
    res.status(400).json({ error: "User exists or invalid data" }); 
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user && await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username,
          avatar_url: user.avatar_url,
          theme: user.theme
        } 
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Test Route ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Frutiger Messenger is running' });
});

// --- Socket.io Realtime ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_channel', async (channelId) => {
    socket.join(`chan_${channelId}`);
    // Загрузка истории
    try {
      const history = await pool.query(
        'SELECT * FROM messages WHERE channel_id = $1 ORDER BY created_at ASC LIMIT 50',
        [channelId]
      );
      socket.emit('history', history.rows);
    } catch (e) {
      console.error("Error loading history:", e);
    }
  });

  socket.on('send_message', async (data) => {
    const { channelId, userId, username, content } = data;
    try {
      const result = await pool.query(
        'INSERT INTO messages (channel_id, user_id, username, content) VALUES ($1, $2, $3, $4) RETURNING *',
        [channelId, userId, username, content]
      );
      io.to(`chan_${channelId}`).emit('new_message', result.rows[0]);
    } catch (e) {
      console.error("Error sending message:", e);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Frutiger Messenger backend running on port ${PORT}`);
  console.log(`📡 WebSocket ready at ws://localhost:${PORT}`);
});