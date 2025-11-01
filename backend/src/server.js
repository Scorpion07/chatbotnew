import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import botsRouter from './routes/bots.js';
import statsRouter from './routes/stats.js';
import openaiRouter from './routes/openai.js';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import { initDb, sequelize } from './models/index.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---------- Middleware ----------
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Attach socket.io instance to every request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ---------- Routers ----------
app.use('/api/bots', botsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/openai', openaiRouter);
app.use('/api/auth', authRouter);
app.use('/api/usage', usageRouter);

// ---------- Health & Root ----------
app.get('/', (req, res) => {
  res.json({ status: '✅ Backend running', time: new Date().toISOString() });
});

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// ---------- Socket.IO ----------
io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`❌ Client disconnected: ${socket.id}`));
});

// ---------- Server startup ----------
const PORT = process.env.PORT || 5000;

// Retry DB init in case of SQLite locks
const startServer = async (retries = 5) => {
  while (retries) {
    try {
      console.log('🗄️  Initializing database...');
      await initDb();
      console.log('✅ Database synced successfully');

      server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Backend running on http://0.0.0.0:${PORT}`);
      });
      return;
    } catch (err) {
      console.error(`DB init failed (${retries} retries left):`, err.message);
      retries -= 1;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.error('❌ Failed to initialize DB after multiple attempts. Exiting.');
  process.exit(1);
};

startServer();
