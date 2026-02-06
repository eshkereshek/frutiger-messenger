// URL бэкенда (как указано в задании)
const API_URL = 'https://frutiger-messenger.onrender.com';
const WS_URL = 'wss://frutiger-messenger.onrender.com';

// Управление состоянием
const state = {
    token: localStorage.getItem('token') || null,
    username: localStorage.getItem('username') || null,
    theme: localStorage.getItem('theme') || 'light',
    socket: null
};

// Темы
const themes = ['light', 'dark', 'classic'];

const app = {
    // Инициализация
    init: () => {
        app.applyTheme(state.theme);
        
        if (state.token) {
            app.showChat();
        } else {
            app.showAuth();
        }

        // Enter для отправки
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') app.sendMessage();
        });
    },

    // --- ТЕМЫ ---
    toggleTheme: () => {
        const currentIndex = themes.indexOf(state.theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        state.theme = themes[nextIndex];
        
        localStorage.setItem('theme', state.theme);
        app.applyTheme(state.theme);
    },

    applyTheme: (themeName) => {
        document.body.setAttribute('data-theme', themeName);
        // Обновляем иконку кнопки темы для наглядности
        const btn = document.getElementById('theme-toggle-btn');
        if(btn) btn.innerHTML = themeName === 'light' ? '☀️' : (themeName === 'dark' ? '🌙' : '🖥️');
    },

    // --- АВТОРИЗАЦИЯ ---
    login: async () => {
        const usernameInput = document.getElementById('username-input');
        const passwordInput = document.getElementById('password-input');
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const errorDiv = document.getElementById('auth-error');

        if (!username || !password) {
            errorDiv.innerText = "Введите имя и пароль!";
            return;
        }

        try {
            // Попытка входа (или регистрации, если бэкенд позволяет это одной ручкой)
            // ПРИМЕЧАНИЕ: Поскольку мы не видим код бэкенда, используем стандартный flow
            // Пробуем /register, если user exists -> /login
            
            let response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            // Если 404 или 401, пробуем регистрацию (эмуляция логики "вход/регистрация одной кнопкой")
            if (!response.ok) {
                 response = await fetch(`${API_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
            }

            const data = await response.json();

            if (response.ok) {
                // Успех
                state.token = data.token || 'mock_token'; // Если бэкенд не вернул токен, ставим заглушку
                state.username = username;
                
                localStorage.setItem('token', state.token);
                localStorage.setItem('username', state.username);
                
                app.showChat();
            } else {
                errorDiv.innerText = data.message || "Ошибка входа";
            }
        } catch (err) {
            console.error(err);
            errorDiv.innerText = "Ошибка соединения с сервером";
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        state.token = null;
        if (state.socket) state.socket.disconnect();
        window.location.reload();
    },

    // --- ИНТЕРФЕЙС ---
    showAuth: () => {
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('app-container').style.display = 'none';
    },

    showChat: () => {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('app-container').style.display = 'grid'; // Grid layout
        
        // Установка данных пользователя
        document.getElementById('current-username').innerText = state.username;
        document.getElementById('current-user-avatar').innerText = state.username[0].toUpperCase();

        app.connectSocket();
    },

    // --- WEBSOCKET ---
    connectSocket: () => {
        state.socket = io(WS_URL, {
            query: { token: state.token }
        });

        state.socket.on('connect', () => {
            console.log('Connected to WebSocket');
            app.addSystemMessage('🟢 Вы подключились к серверу');
            app.updateMembersList(true); // Добавить себя
        });

        // Слушаем входящие сообщения
        // Имя события 'chat message' или просто 'message' зависит от бэкенда. 
        // Ставлю наиболее вероятные, если бэкенд стандартный.
        state.socket.on('message', (msg) => {
            app.renderMessage(msg);
        });
        
        // Для совместимости с разными туториалами socket.io
        state.socket.on('chat message', (msg) => {
            app.renderMessage(msg);
        });
    },

    sendMessage: () => {
        const input = document.getElementById('message-input');
        const text = input.value.trim();

        if (text && state.socket) {
            const messageData = {
                user: state.username,
                text: text,
                time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            };

            // Отправляем на сервер
            state.socket.emit('chat message', messageData); 
            // Иногда сервер не возвращает сообщение отправителю (echo), поэтому рендерим сами сразу
            // Если ваш сервер делает broadcast всем (включая отправителя), эту строку можно убрать:
            // app.renderMessage(messageData, true); 

            input.value = '';
        }
    },

    // --- РЕНДЕРИНГ ---
    renderMessage: (msg, isOwnForce = false) => {
        const list = document.getElementById('messages-list');
        const isOwn = isOwnForce || (msg.user === state.username);
        
        const div = document.createElement('div');
        div.className = `message ${isOwn ? 'own' : ''}`;
        
        // Аватар
        const initial = msg.user ? msg.user[0].toUpperCase() : '?';
        
        div.innerHTML = `
            <div class="message-avatar">${initial}</div>
            <div class="message-content">
                <div class="message-header">
                    <strong>${msg.user || 'Anon'}</strong> 
                    <span>${msg.time || ''}</span>
                </div>
                <div>${msg.text}</div>
            </div>
        `;

        list.appendChild(div);
        list.scrollTop = list.scrollHeight; // Автопрокрутка
    },

    addSystemMessage: (text) => {
        const list = document.getElementById('messages-list');
        const div = document.createElement('div');
        div.style.textAlign = 'center';
        div.style.color = 'var(--text-muted)';
        div.style.fontSize = '0.8rem';
        div.style.margin = '10px 0';
        div.innerText = text;
        list.appendChild(div);
    },
    
    updateMembersList: () => {
        // Фейковая генерация списка для визуализации (так как бэкенд может не отдавать список)
        const list = document.getElementById('members-list');
        list.innerHTML = '';
        
        const users = [state.username, 'Admin', 'FrutigerLover', 'AeroBoy'];
        document.getElementById('online-count').innerText = users.length;

        users.forEach(u => {
            const item = document.createElement('div');
            item.className = 'member-item';
            item.innerHTML = `
                <div class="member-status"></div>
                <span>${u}</span>
            `;
            list.appendChild(item);
        });
    }
};

// Запуск при загрузке
document.addEventListener('DOMContentLoaded', app.init);