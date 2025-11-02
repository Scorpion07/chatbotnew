import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import botsRouter from './routes/bots.js';
import statsRouter from './routes/stats.js';
import openaiRouter from './routes/openai.js';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import conversationsRouter from './routes/conversations.js';
import adminRouter from './routes/admin.js';
import { initDb, sequelize } from './models/index.js';

// ---------- Load environment variables ----------
dotenv.config({ path: '.env' });

const app = express();
const server = http.createServer(app);

// ---------- Allowed Origins ----------
const allowedOrigins = [
  'https://talk-sphere.com',
  'https://www.talk-sphere.com',
  'http://localhost:5173', // for local vite dev
  'http://localhost:3000', // fallback dev port
  'http://localhost:4173', // vite preview
  'http://127.0.0.1:4173', // vite preview (explicit localhost)
];

// ---------- Socket.IO setup ----------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// ---------- Middleware ----------
app.use(express.json({ limit: '10mb' }));

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests from allowed origins or from server-side (no origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Attach socket.io instance to requests
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
app.use('/api/admin', adminRouter);
app.use('/api/conversations', conversationsRouter);

// ---------- Health checks ----------
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
let serverStarted = false;

const startServer = async (retries = 5) => {
  if (serverStarted) return;
  serverStarted = true;

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
      console.error(`❌ DB init failed (${retries} retries left):`, err.message);
      retries -= 1;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.error('💀 Failed to initialize DB after multiple attempts. Exiting.');
  process.exit(1);
};

// ---------- Start ----------
startServer();
