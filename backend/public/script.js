const socket = io();

const MOCK_DATA = {
    servers: [
        { id: 1, name: "Aero Central", iconClass: "fa-solid fa-cloud", channels: [{ id: "gen1", name: "общий" }, { id: "ann1", name: "новости" }] },
        { id: 2, name: "Gaming Lounge", iconClass: "fa-solid fa-gamepad", channels: [{ id: "game1", name: "игры" }] }
    ],
    members: [{ name: "Админ", status: "online", color: "#FF6B6B" }, { name: "Юзер", status: "online", color: "#00C2C7" }]
};

let state = {
    currentUser: {
        name: localStorage.getItem('aero_username') || null,
        theme: localStorage.getItem('aero_theme') || 'light',
        accentColor: localStorage.getItem('aero_accent') || '#00C2C7'
    },
    activeServerId: 1,
    activeChannelId: 'gen1',
    messages: {}
};

document.addEventListener('DOMContentLoaded', () => {
    applySettings();
    if (!state.currentUser.name) {
        document.getElementById('login-modal').classList.remove('hidden');
    } else {
        renderApp();
    }
    setupEventListeners();
});

async function renderApp() {
    updateUserInfo();
    renderServers();
    renderChannels();
    renderMembers();
    await loadHistory();
}

async function loadHistory() {
    const key = `${state.activeServerId}-${state.activeChannelId}`;
    try {
        const res = await fetch(`/api/messages/${key}`);
        state.messages[key] = await res.json();
        renderMessages();
    } catch (e) { console.error("History fetch error:", e); }
}

function renderMessages() {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    const key = `${state.activeServerId}-${state.activeChannelId}`;
    (state.messages[key] || []).forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `
            <div class="message-avatar" style="background: ${msg.avatarColor}">${msg.user[0].toUpperCase()}</div>
            <div class="message-content">
                <div class="message-header"><span class="msg-author">${msg.user}</span><span class="msg-time">${msg.timestamp}</span></div>
                <div class="msg-text">${msg.text}</div>
            </div>`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    socket.emit('chat message', {
        user: state.currentUser.name,
        avatarColor: state.currentUser.accentColor,
        text: text,
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

// UI и события (твоя оригинальная логика)
function updateUserInfo() {
    document.getElementById('current-username').textContent = state.currentUser.name;
    const avatar = document.getElementById('current-user-avatar');
    avatar.style.background = state.currentUser.accentColor;
    avatar.textContent = state.currentUser.name[0].toUpperCase();
}

function renderServers() {
    const list = document.getElementById('servers-list');
    list.innerHTML = '';
    MOCK_DATA.servers.forEach(s => {
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
    const server = MOCK_DATA.servers.find(s => s.id === state.activeServerId);
    document.getElementById('server-name').textContent = server.name;
    server.channels.forEach(c => {
        const div = document.createElement('div');
        div.className = `channel-item ${c.id === state.activeChannelId ? 'active' : ''}`;
        div.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${c.name}`;
        div.onclick = () => { state.activeChannelId = c.id; renderApp(); };
        list.appendChild(div);
    });
}

function applySettings() {
    document.documentElement.setAttribute('data-theme', state.currentUser.theme);
    document.documentElement.style.setProperty('--accent-color', state.currentUser.accentColor);
}

function setupEventListeners() {
    document.getElementById('login-btn').onclick = () => {
        const val = document.getElementById('login-input').value.trim();
        if (val) {
            state.currentUser.name = val;
            localStorage.setItem('aero_username', val);
            document.getElementById('login-modal').classList.add('hidden');
            renderApp();
        }
    };
    document.getElementById('message-input').onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
}

function renderMembers() {
    const list = document.getElementById('members-list');
    list.innerHTML = '';
    MOCK_DATA.members.forEach(m => {
        const li = document.createElement('li');
        li.className = 'member-item';
        li.innerHTML = `<div class="user-avatar" style="background: ${m.color}">${m.name[0]}</div><span>${m.name}</span>`;
        list.appendChild(li);
    });
}