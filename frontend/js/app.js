// Frutiger Messenger - Frontend Application
const app = {
    // Конфигурация
    config: {
        API_URL: 'https://frutiger-messenger.onrender.com',
        WS_URL: 'wss://frutiger-messenger.onrender.com',
        defaultChannelId: 1
    },
    
    // Состояние приложения
    state: {
        token: localStorage.getItem('frutiger_token'),
        user: JSON.parse(localStorage.getItem('frutiger_user')) || null,
        socket: null,
        currentChannelId: 1,
        onlineUsers: 1,
        theme: localStorage.getItem('frutiger_theme') || 'light'
    },
    
    // Инициализация
    init: function() {
        console.log('🚀 Frutiger Messenger initializing...');
        
        // Устанавливаем тему
        this.setTheme(this.state.theme);
        
        // Назначаем обработчики событий
        this.setupEventListeners();
        
        // Проверяем авторизацию
        if (this.state.token && this.state.user) {
            this.startApp();
        } else {
            this.showAuthScreen();
        }
    },
    
    // Настройка обработчиков событий
    setupEventListeners: function() {
        // Кнопка входа
        document.getElementById('login-btn')?.addEventListener('click', () => this.login());
        
        // Enter в форме авторизации
        document.getElementById('password-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        // Кнопки тем
        document.getElementById('theme-light-btn')?.addEventListener('click', () => this.setTheme('light'));
        document.getElementById('theme-dark-btn')?.addEventListener('click', () => this.setTheme('dark'));
        document.getElementById('theme-classic-btn')?.addEventListener('click', () => this.setTheme('classic'));
        
        // Кнопка переключения темы в чате
        document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());
        
        // Кнопка отправки сообщения
        document.getElementById('send-btn')?.addEventListener('click', () => this.sendMessage());
        
        // Enter для отправки сообщения
        document.getElementById('message-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Кнопка выхода
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        
        // Кнопка эмодзи
        document.getElementById('emoji-btn')?.addEventListener('click', () => this.toggleEmoji());
    },
    
    // Показать экран авторизации
    showAuthScreen: function() {
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        if (authScreen) authScreen.style.display = 'block';
        if (appContainer) appContainer.style.display = 'none';
    },
    
    // Показать основной интерфейс
    showAppInterface: function() {
        const authScreen = document.getElementById('auth-screen');
        const appContainer = document.getElementById('app-container');
        if (authScreen) authScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';
    },
    
    // Авторизация
    login: async function() {
        const username = document.getElementById('username-input').value.trim();
        const email = document.getElementById('email-input').value.trim();
        const password = document.getElementById('password-input').value;
        
        if (!username || !email || !password) {
            alert('Пожалуйста, заполните все поля');
            return;
        }
        
        try {
            // Пытаемся зарегистрироваться
            await fetch(`${this.config.API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            // Пробуем войти
            const loginResponse = await fetch(`${this.config.API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (!loginResponse.ok) {
                throw new Error('Ошибка авторизации');
            }
            
            const data = await loginResponse.json();
            
            // Сохраняем данные
            this.state.token = data.token;
            this.state.user = data.user;
            
            localStorage.setItem('frutiger_token', data.token);
            localStorage.setItem('frutiger_user', JSON.stringify(data.user));
            
            // Запускаем приложение
            this.startApp();
            
        } catch (error) {
            console.error('Login error:', error);
            alert('Ошибка: ' + (error.message || 'Проверьте подключение к интернету'));
        }
    },
    
    // Запуск приложения после авторизации
    startApp: function() {
        this.showAppInterface();
        this.updateUserInfo();
        this.connectWebSocket();
        this.joinChannel(this.state.currentChannelId);
    },
    
    // Подключение к WebSocket
    connectWebSocket: function() {
        const wsUrl = this.config.API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
        this.state.socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            auth: {
                token: this.state.token
            }
        });
        
        this.state.socket.on('connect', () => {
            console.log('✅ WebSocket connected');
            this.updateOnlineStatus(true);
        });
        
        this.state.socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
            this.updateOnlineStatus(false);
        });
        
        this.state.socket.on('history', (messages) => {
            this.loadMessages(messages);
        });
        
        this.state.socket.on('new_message', (message) => {
            this.addMessage(message);
        });
        
        this.state.socket.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    },
    
    // Присоединиться к каналу
    joinChannel: function(channelId) {
        if (this.state.socket && this.state.socket.connected) {
            this.state.socket.emit('join_channel', channelId);
            this.state.currentChannelId = channelId;
            console.log(`📨 Joined channel ${channelId}`);
        }
    },
    
    // Отправить сообщение
    sendMessage: function() {
        const input = document.getElementById('message-input');
        const content = input.value.trim();
        
        if (!content || !this.state.user || !this.state.socket) {
            return;
        }
        
        const messageData = {
            channelId: this.state.currentChannelId,
            userId: this.state.user.id,
            username: this.state.user.username,
            content: content
        };
        
        this.state.socket.emit('send_message', messageData);
        input.value = '';
        input.focus();
    },
    
    // Загрузить сообщения
    loadMessages: function(messages) {
        const messagesList = document.getElementById('messages-list');
        if (!messagesList) return;
        
        messagesList.innerHTML = '';
        
        if (messages && messages.length > 0) {
            messages.forEach(message => {
                this.addMessageToDOM(message);
            });
            this.scrollToBottom();
        } else {
            const welcomeMessage = {
                id: 0,
                username: 'Система',
                content: 'Добро пожаловать в Frutiger Messenger! Напишите первое сообщение.',
                created_at: new Date().toISOString()
            };
            this.addMessageToDOM(welcomeMessage);
        }
    },
    
    // Добавить новое сообщение
    addMessage: function(message) {
        this.addMessageToDOM(message);
        this.scrollToBottom();
    },
    
    // Добавить сообщение в DOM
    addMessageToDOM: function(message) {
        const messagesList = document.getElementById('messages-list');
        if (!messagesList) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        const time = message.created_at ? 
            new Date(message.created_at).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : 'только что';
        
        const avatarLetter = message.username ? message.username.charAt(0).toUpperCase() : '?';
        
        messageElement.innerHTML = `
            <div class="message-avatar">${avatarLetter}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${message.username || 'Неизвестный'}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${this.escapeHtml(message.content)}</div>
            </div>
        `;
        
        messagesList.appendChild(messageElement);
    },
    
    // Обновить информацию о пользователе
    updateUserInfo: function() {
        if (this.state.user) {
            const usernameElement = document.getElementById('current-username');
            const avatarIcon = document.getElementById('avatar-icon');
            
            if (usernameElement) usernameElement.textContent = this.state.user.username;
            if (avatarIcon && this.state.user.username) {
                avatarIcon.textContent = this.state.user.username.charAt(0).toUpperCase();
            }
        }
    },
    
    // Обновить статус онлайн
    updateOnlineStatus: function(isOnline) {
        const statusElement = document.getElementById('user-status');
        const onlineCountElement = document.getElementById('online-count');
        
        if (statusElement) {
            statusElement.textContent = isOnline ? '● онлайн' : '○ оффлайн';
            statusElement.style.color = isOnline ? '#00C2C7' : '#FF6B6B';
        }
        
        if (onlineCountElement) {
            const count = isOnline ? Math.floor(Math.random() * 5) + 1 : 0;
            onlineCountElement.textContent = `${count} онлайн`;
        }
    },
    
    // Прокрутить вниз
    scrollToBottom: function() {
        const messagesList = document.getElementById('messages-list');
        if (messagesList) {
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    },
    
    // Установить тему
    setTheme: function(theme) {
        document.body.setAttribute('data-theme', theme);
        this.state.theme = theme;
        localStorage.setItem('frutiger_theme', theme);
        this.showNotification(`Тема: ${theme === 'light' ? 'Светлая' : theme === 'dark' ? 'Темная' : 'Классика'}`);
    },
    
    // Переключить тему
    toggleTheme: function() {
        const themes = ['light', 'dark', 'classic'];
        const currentIndex = themes.indexOf(this.state.theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        const nextTheme = themes[nextIndex];
        this.setTheme(nextTheme);
    },
    
    // Показать уведомление
    showNotification: function(message) {
        // Удаляем старое уведомление если есть
        const oldNotification = document.getElementById('frutiger-notification');
        if (oldNotification) oldNotification.remove();
        
        // Создаем новое уведомление
        const notification = document.createElement('div');
        notification.id = 'frutiger-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 194, 199, 0.9);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            padding: 15px 20px;
            color: white;
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },
    
    // Выход
    logout: function() {
        if (confirm('Выйти из аккаунта?')) {
            if (this.state.socket) this.state.socket.disconnect();
            
            localStorage.removeItem('frutiger_token');
            localStorage.removeItem('frutiger_user');
            localStorage.removeItem('frutiger_theme');
            
            this.state.token = null;
            this.state.user = null;
            this.state.socket = null;
            
            this.showAuthScreen();
            this.showNotification('Вы вышли из аккаунта');
        }
    },
    
    // Экранирование HTML
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Переключить эмоджи
    toggleEmoji: function() {
        this.showNotification('Эмоджи будут добавлены в следующем обновлении!');
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем стили для анимаций
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Запускаем приложение
    app.init();
    window.app = app;
});