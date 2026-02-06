const { Pool } = require('pg');
require('dotenv').config();

// Проверяем есть ли DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL not set. Using local test mode.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://test:test@localhost/test',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const initDb = async () => {
  const sql = `
    -- Удаляем старые таблицы если есть
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS channels;
    DROP TABLE IF EXISTS servers;
    DROP TABLE IF EXISTS users;

    -- Создаем таблицу пользователей
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      theme TEXT DEFAULT 'light',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Создаем таблицу серверов (пока один общий)
    CREATE TABLE servers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Семейный чат',
      owner_id INTEGER REFERENCES users(id),
      invite_code TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Создаем каналы (пока один общий)
    CREATE TABLE channels (
      id SERIAL PRIMARY KEY,
      server_id INTEGER REFERENCES servers(id) DEFAULT 1,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Создаем таблицу сообщений
    CREATE TABLE messages (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER REFERENCES channels(id) DEFAULT 1,
      user_id INTEGER REFERENCES users(id),
      username TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Вставляем дефолтный сервер и канал
    INSERT INTO servers (id, name) VALUES (1, 'Семейный чат') ON CONFLICT (id) DO NOTHING;
    INSERT INTO channels (id, server_id, name) VALUES (1, 1, 'general') ON CONFLICT (id) DO NOTHING;
  `;
  
  try {
    await pool.query(sql);
    console.log("✅ Database tables initialized successfully");
  } catch (err) {
    console.error("❌ Database initialization error:", err.message);
  }
};

// Если файл запущен напрямую, инициализируем БД
if (require.main === module) {
  initDb().then(() => {
    console.log("Database setup complete");
    process.exit(0);
  }).catch(err => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
}

module.exports = pool;