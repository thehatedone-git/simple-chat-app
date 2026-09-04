const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();

function getPrivateRoom(user1, user2) {
  return [user1, user2].sort().join('_');
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    username = (username || '').trim();

    if (!username || username.length < 2) {
      socket.emit('username-error', 'Username must be at least 2 characters.');
      return;
    }
    if (username.length > 20) {
      socket.emit('username-error', 'Username must be 20 characters or less.');
      return;
    }

    const isTaken = Array.from(users.values()).includes(username);
    if (isTaken) {
      socket.emit('username-error', 'Username already taken. Please choose another.');
      return;
    }

    users.set(socket.id, username);
    socket.username = username;

    socket.emit('join-success', username);
    io.emit('user-list', Array.from(users.values()));

    console.log(`${username} joined`);
  });

  socket.on('start-chat', (targetUsername) => {
    const myUsername = users.get(socket.id);
    if (!myUsername || !targetUsername || myUsername === targetUsername) return;

    const room = getPrivateRoom(myUsername, targetUsername);
    socket.join(room);

    for (const [id, name] of users.entries()) {
      if (name === targetUsername) {
        io.to(id).emit('chat-request', {
          from: myUsername,
          room: room
        });
        break;
      }
    }

    socket.emit('chat-started', {
      with: targetUsername,
      room: room
    });
  });

  socket.on('join-room', (room) => {
    if (room) socket.join(room);
  });

  socket.on('private-message', ({ room, message, to }) => {
    const from = users.get(socket.id);
    if (!from || !message || !message.trim()) return;

    const msgData = {
      from,
      to,
      message: message.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    io.to(room).emit('private-message', msgData);
  });

  socket.on('typing', ({ room, isTyping }) => {
    const from = users.get(socket.id);
    if (!from || !room) return;
    socket.to(room).emit('typing', { from, isTyping });
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    if (username) {
      users.delete(socket.id);
      io.emit('user-list', Array.from(users.values()));
      console.log(`${username} left`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Server running at http://localhost:${PORT}`);
  console.log(`   Open this URL in multiple browser tabs to test the chat.\n`);
});