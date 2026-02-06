const socket = io();
let state = {
    currentUser: JSON.parse(localStorage.getItem('aero_user')) || null,
    theme: localStorage.getItem('aero_theme') || 'light',
    accentColor: localStorage.getItem('aero_accent') || '#00C2C7',
    activeServerId: 1,
    activeChannelId: 'gen1',
    messages: {}
};

// Константы для интерфейса
const APP_DATA = {
    servers: [
        { id: 1, name: "Aero Central", iconClass: "fa-solid fa-cloud", channels: [{ id: "gen1", name: "общий" }, { id: "ann1", name: "новости" }] },
        { id: 2, name: "Gaming Lounge", iconClass: "fa-solid fa-gamepad", channels: [{ id: "game1", name: "игры" }] }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    applySettings();
    initEventListeners();
    if (!state.currentUser) {
        document.getElementById('login-modal').classList.remove('hidden');
    } else {
        renderApp();
    }
});

// --- АВТОРИЗАЦИЯ ---
async function handleAuth(type) {
    const username = document.getElementById('login-input').value;
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('auth-error');

    try {
        const res = await fetch(`/api/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
            if (type === 'login') {
                state.currentUser = data.user;
                localStorage.setItem('aero_user', JSON.stringify(data.user));
                document.getElementById('login-modal').classList.add('hidden');
                renderApp();
            } else {
                alert("Успешная регистрация! Теперь войдите.");
            }
        } else {
            errorEl.textContent = data.error;
        }
    } catch (e) { errorEl.textContent = "Ошибка связи с сервером"; }
}

// --- РЕНДЕРИНГ ---
async function renderApp() {
    updateUserPanel();
    renderServers();
    renderChannels();
    await loadHistory();
}

async function loadHistory() {
    const key = `${state.activeServerId}-${state.activeChannelId}`;
    const res = await fetch(`/api/messages/${key}`);
    state.messages[key] = await res.json();
    renderMessages();
}

function renderMessages() {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    const key = `${state.activeServerId}-${state.activeChannelId}`;
    (state.messages[key] || []).forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `
            <div class="message-avatar" style="background: ${msg.avatarColor}">${msg.user[0]}</div>
            <div class="message-content">
                <div class="message-header"><strong>${msg.user}</strong> <small>${msg.timestamp}</small></div>
                <div class="msg-text">${msg.text}</div>
            </div>`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

// --- ОБРАБОТЧИКИ ---
function initEventListeners() {
    // Сообщения
    document.getElementById('message-input').onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    
    // Вход/Регистрация
    document.getElementById('login-btn').onclick = () => handleAuth('login');
    document.getElementById('show-reg-btn').onclick = () => handleAuth('register');

    // Модалки
    document.querySelector('.fa-gear').onclick = () => document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('close-settings').onclick = () => document.getElementById('settings-modal').classList.add('hidden');

    // Темы
    document.getElementById('theme-select').onchange = (e) => {
        state.theme = e.target.value;
        localStorage.setItem('aero_theme', state.theme);
        applySettings();
    };

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.onclick = () => {
            state.accentColor = opt.dataset.color;
            localStorage.setItem('aero_accent', state.accentColor);
            applySettings();
            updateUserPanel();
        };
    });
}

function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input.value.trim() || !state.currentUser) return;

    socket.emit('chat message', {
        user: state.currentUser.name,
        avatarColor: state.accentColor,
        text: input.value,
        serverChannel: `${state.activeServerId}-${state.activeChannelId}`
    });
    input.value = '';
}

socket.on('chat message', (msg) => {
    const currentKey = `${state.activeServerId}-${state.activeChannelId}`;
    if (msg.serverChannel === currentKey) {
        if (!state.messages[currentKey]) state.messages[currentKey] = [];
        state.messages[currentKey].push(msg);
        renderMessages();
    }
});

function applySettings() {
    document.documentElement.setAttribute('data-theme', state.theme);
    document.documentElement.style.setProperty('--accent-color', state.accentColor);
    document.getElementById('theme-select').value = state.theme;
}

function updateUserPanel() {
    if (!state.currentUser) return;
    document.getElementById('current-username').textContent = state.currentUser.name;
    const av = document.getElementById('current-user-avatar');
    av.style.background = state.accentColor;
    av.textContent = state.currentUser.name[0].toUpperCase();
}

function renderServers() {
    const list = document.getElementById('servers-list');
    list.innerHTML = '';
    APP_DATA.servers.forEach(s => {
        const div = document.createElement('div');
        div.className = `server-icon ${s.id === state.activeServerId ? 'active' : ''}`;
        div.innerHTML = `<i class="${s.iconClass}"></i>`;
        div.onclick = () => { state.activeServerId = s.id; state.activeChannelId = s.channels[0].id; renderApp(); };
        list.appendChild(div);
    });
}

function renderChannels() {
    const list = document.getElementById('channels-list');
    list.innerHTML = '';
    const server = APP_DATA.servers.find(s => s.id === state.activeServerId);
    document.getElementById('server-name').textContent = server.name;
    server.channels.forEach(c => {
        const div = document.createElement('div');
        div.className = `channel-item ${c.id === state.activeChannelId ? 'active' : ''}`;
        div.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${c.name}`;
        div.onclick = () => { state.activeChannelId = c.id; renderApp(); };
        list.appendChild(div);
    });
}