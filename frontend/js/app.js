// Frutiger Messenger - Frontend Application
const app = {
    // Конфигурация
    config: {
        // API_URL будет заменен после деплоя
        API_URL: 'https://pagrysha-messenger.onrender.com',
        WS_URL: 'ws://pagrysha-messenger.onrender.com',
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
        
        // Проверяем авторизацию
        if (this.state.token && this.state.user) {
            this.startApp();
        } else {
            this.showAuthScreen();
        }
        
        // Назначаем обработчики
        this.setupEventListeners();
    },
    
    // Настройка обработчиков событий
    setupEventListeners: function() {
        // Enter для отправки сообщения
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
        
        // Enter в форме авторизации
        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'password' && e.key === 'Enter') {
                this.login();
            }
        });
    },
    
    // Показать экран авторизации
    showAuthScreen: function() {
        document.getElementById('auth-screen').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
    },
    
    // Показать основной интерфейс
    showAppInterface: function() {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
    },
    
    // Авторизация
    login: async function() {
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !email || !password) {
            alert('Пожалуйста, заполните все поля');
            return;
        }
        
        try {
            // Пытаемся зарегистрироваться
            const registerResponse = await fetch(`${this.config.API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            // Даже если регистрация не удалась (пользователь существует), пробуем войти
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
        
        // Обновляем информацию о пользователе
        this.updateUserInfo();
        
        // Подключаемся к WebSocket
        this.connectWebSocket();
        
        // Присоединяемся к каналу
        this.joinChannel(this.state.currentChannelId);
    },
    
    // Подключение к WebSocket
    connectWebSocket: function() {
        // Используем правильный URL для WebSocket
        const wsUrl = this.config.API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
        this.state.socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            auth: {
                token: this.state.token
            }
        });
        
        // Обработчики WebSocket
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
            
            // Прокрутить вниз
            this.scrollToBottom();
        } else {
            // Показать приветственное сообщение
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
        
        // Форматируем время
        const time = message.created_at ? 
            new Date(message.created_at).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : 'только что';
        
        // Создаем аватар на основе имени
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
            // Имя пользователя
            const usernameElement = document.getElementById('current-username');
            if (usernameElement) {
                usernameElement.textContent = this.state.user.username;
            }
            
            // Аватар
            const avatarIcon = document.getElementById('avatar-icon');
            if (avatarIcon && this.state.user.username) {
                avatarIcon.textContent = this.state.user.username.charAt(0).toUpperCase();
            }
        }
    },
    
    // Обновить статус онлайн
    updateOnlineStatus: function(isOnline) {
        const statusElement = document.getElementById('user-status');
        if (statusElement) {
            statusElement.textContent = isOnline ? '● онлайн' : '○ оффлайн';
            statusElement.style.color = isOnline ? '#00C2C7' : '#FF6B6B';
        }
        
        // Обновить счетчик онлайн (упрощенно)
        const onlineCountElement = document.getElementById('online-count');
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
    },
    
    // Переключить тему
    toggleTheme: function() {
        const themes = ['light', 'dark', 'classic'];
        const currentIndex = themes.indexOf(this.state.theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        const nextTheme = themes[nextIndex];
        
        this.setTheme(nextTheme);
        
        // Показать уведомление
        const themeNames = {
            'light': 'Светлая',
            'dark': 'Темная', 
            'classic': 'Классика'
        };
        
        this.showNotification(`Тема изменена: ${themeNames[nextTheme]}`);
    },
    
    // Показать уведомление
    showNotification: function(message) {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border: var(--glass-border);
            border-radius: 10px;
            padding: 15px 20px;
            color: var(--text);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
        
        // Добавляем CSS для анимации
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
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
        }
    },
    
    // Выход
    logout: function() {
        if (confirm('Выйти из аккаунта?')) {
            // Закрываем WebSocket
            if (this.state.socket) {
                this.state.socket.disconnect();
            }
            
            // Очищаем localStorage
            localStorage.removeItem('frutiger_token');
            localStorage.removeItem('frutiger_user');
            
            // Сбрасываем состояние
            this.state.token = null;
            this.state.user = null;
            this.state.socket = null;
            
            // Показываем экран авторизации
            this.showAuthScreen();
            
            // Очищаем поля
            document.getElementById('username').value = '';
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';
            
            this.showNotification('Вы вышли из аккаунта');
        }
    },
    
    // Экранирование HTML
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Переключить эмоджи (заглушка)
    toggleEmoji: function() {
        this.showNotification('Эмоджи будут добавлены в следующем обновлении!');
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    app.init();
    
    // Делаем app глобальной для HTML onclick атрибутов
    window.app = app;
    
    // Для тестирования
    console.log('Frutiger Messenger loaded!');
    console.log('App state:', app.state);
});