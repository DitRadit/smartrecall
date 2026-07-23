const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const onlineUsers = new Map(); // userId -> { socketId, role, nama, connectedAt }

function initSocket(server, configuredOrigins) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
        try {
          const { protocol, hostname, port } = new URL(origin);
          const isLocalDevOrigin = protocol === 'http:' && port === '5173' && (
            hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
          );
          return callback(null, isLocalDevOrigin);
        } catch (error) {
          return callback(error);
        }
      },
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, role, nama }
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const role = socket.user.role;
    const nama = socket.user.nama;
    
    // Store in memory
    onlineUsers.set(userId, {
      userId,
      socketId: socket.id,
      role,
      nama,
      connectedAt: new Date().toISOString()
    });

    if (role === 'admin') {
      socket.join('admin');
      // Send the current list of online users to the admin who just joined
      socket.emit('onlineUsers', Array.from(onlineUsers.values()));
    }

    // Broadcast to admins that a new user connected
    io.to('admin').emit('userConnected', { userId, role, nama, connectedAt: new Date().toISOString() });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      // Broadcast to admins
      io.to('admin').emit('userDisconnected', { userId });
    });
  });

  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
}

module.exports = { initSocket, getIo };
