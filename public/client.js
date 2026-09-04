const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const loginError = document.getElementById('login-error');
const myUsernameEl = document.getElementById('my-username');
const userListEl = document.getElementById('user-list');
const noChat = document.getElementById('no-chat');
const activeChat = document.getElementById('active-chat');
const chatWithEl = document.getElementById('chat-with');
const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

let myUsername = '';
let currentRoom = null;
let currentPartner = null;
let typingTimeout = null;

// ========== LOGIN ==========
function joinChat() {
  const username = usernameInput.value.trim();
  if (!username) {
    loginError.textContent = 'Please enter a username';
    return;
  }
  loginError.textContent = '';
  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining...';
  socket.emit('join', username);
}

joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinChat();
});

socket.on('username-error', (msg) => {
  loginError.textContent = msg;
  joinBtn.disabled = false;
  joinBtn.textContent = 'Join';
});

socket.on('join-success', (username) => {
  myUsername = username;
  myUsernameEl.textContent = myUsername;
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  usernameInput.value = '';
});

socket.on('user-list', (users) => {
  renderUserList(users);
});

// ========== USER LIST ==========
function renderUserList(users) {
  const others = users.filter(u => u !== myUsername);

  if (others.length === 0) {
    userListEl.innerHTML = `<li class="empty">No one else is online</li>`;
    return;
  }

  userListEl.innerHTML = others.map(user => `
    <li data-username="${user}" class="${currentPartner === user ? 'active' : ''}">
      <div class="avatar">${user.charAt(0).toUpperCase()}</div>
      <span class="name">${user}</span>
    </li>
  `).join('');

  // Add click listeners
  document.querySelectorAll('#user-list li[data-username]').forEach(li => {
    li.addEventListener('click', () => {
      const target = li.dataset.username;
      startChatWith(target);
    });
  });
}

// ========== START CHAT ==========
function startChatWith(username) {
  if (username === currentPartner) return;

  currentPartner = username;
  socket.emit('start-chat', username);

  // Update UI
  noChat.classList.add('hidden');
  activeChat.classList.remove('hidden');
  chatWithEl.textContent = username;
  messagesEl.innerHTML = ''; // clear previous messages
  typingIndicator.classList.add('hidden');

  // Highlight selected user
  document.querySelectorAll('#user-list li').forEach(li => {
    li.classList.toggle('active', li.dataset.username === username);
  });

  messageInput.focus();
}

socket.on('chat-started', ({ with: partner, room }) => {
  currentRoom = room;
  currentPartner = partner;
});

socket.on('chat-request', ({ from, room }) => {
  // Auto-join when someone starts a chat with us
  currentRoom = room;
  currentPartner = from;

  noChat.classList.add('hidden');
  activeChat.classList.remove('hidden');
  chatWithEl.textContent = from;
  messagesEl.innerHTML = '';
  typingIndicator.classList.add('hidden');

  socket.emit('join-room', room);

  // Highlight
  document.querySelectorAll('#user-list li').forEach(li => {
    li.classList.toggle('active', li.dataset.username === from);
  });
});

// ========== MESSAGES ==========
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentRoom || !currentPartner) return;

  socket.emit('private-message', {
    room: currentRoom,
    message: text,
    to: currentPartner
  });

  messageInput.value = '';
  stopTyping();
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

socket.on('private-message', (data) => {
  // Only show messages for the current chat
  if (
    (data.from === currentPartner && data.to === myUsername) ||
    (data.from === myUsername && data.to === currentPartner)
  ) {
    appendMessage(data);
  }
});

function appendMessage({ from, message, time }) {
  const isSent = from === myUsername;
  const div = document.createElement('div');
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  div.innerHTML = `
    <div class="bubble">${escapeHtml(message)}</div>
    <span class="time">${time}</span>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== TYPING INDICATOR ==========
messageInput.addEventListener('input', () => {
  if (!currentRoom) return;

  socket.emit('typing', { room: currentRoom, isTyping: true });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 1500);
});

function stopTyping() {
  if (!currentRoom) return;
  socket.emit('typing', { room: currentRoom, isTyping: false });
}

socket.on('typing', ({ from, isTyping }) => {
  if (from === currentPartner) {
    typingIndicator.classList.toggle('hidden', !isTyping);
  }
});