require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/consultations', require('./routes/consultations'));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Telehealth API Server is running' });
});

// Socket.io for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  socket.on('chat-message', async (data) => {
    const { roomId, senderId, senderRole, message } = data;
    
    // Broadcast message to all users in the room
    io.to(roomId).emit('chat-message', {
      senderId,
      senderRole,
      message,
      timestamp: new Date(),
    });

    // Save message to database (you can add this functionality)
    try {
      const Consultation = require('./models/Consultation');
      const consultation = await Consultation.findOne({ roomId });
      if (consultation) {
        consultation.chatMessages.push({
          senderId,
          senderRole,
          message,
        });
        await consultation.save();
      }
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
