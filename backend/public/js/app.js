const socket = io(); // Автоматически подключается к тому же хосту
let currentUser = null;

const themes = ['light', 'dark', 'classic'];
let currentThemeIdx = 0;

// Элементы
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('login-btn');
const usernameInput = document.getElementById('username-input');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesList = document.getElementById('messages-list');
const themeBtn = document.getElementById('theme-toggle-btn');

// Логика входа
loginBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    if (!username) return;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });

    const data = await res.json();
    if (data.success) {
        currentUser = username;
        authScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        document.getElementById('user-badge').innerText = username;
    }
};

// Отправка сообщения
sendBtn.onclick = () => {
    const text = messageInput.value.trim();
    if (text && currentUser) {
        socket.emit('message', { text, user: currentUser });
        messageInput.value = '';
    }
};

// Получение сообщения
socket.on('message', (data) => {
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<strong>${data.user}</strong> <small>${data.time}</small><br>${data.text}`;
    messagesList.appendChild(div);
    messagesList.scrollTop = messagesList.scrollHeight;
});

// Смена темы
themeBtn.onclick = () => {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    const newTheme = themes[currentThemeIdx];
    document.body.setAttribute('data-theme', newTheme);
};