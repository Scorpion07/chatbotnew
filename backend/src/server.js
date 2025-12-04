import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import botsRouter from './routes/bots.js';
import statsRouter from './routes/stats.js';
import openaiRouter from './routes/openai.js';
import aiRouter from './routes/ai.js';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import conversationsRouter from './routes/conversations.js';
import adminRouter from './routes/admin.js';
import creditcardRouter from './routes/creditcard.js';
import { initDb, sequelize } from './models/index.js';

dotenv.config({ path: '.env' });

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'https://talk-sphere.com',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5001',
  'http://127.0.0.1:5001'
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.use(express.json({ limit: '10mb' }));

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Authorization'],
  })
);

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/bots', botsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/openai', openaiRouter);
app.use('/api/ai', aiRouter);
app.use('/api/auth', authRouter);
app.use('/api/usage', usageRouter);
app.use('/api/admin', adminRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/creditcard', creditcardRouter);

app.get('/', (req, res) => {
  res.json({ status: '✅ Backend running', time: new Date().toISOString() });
});

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: true });
  } catch {
    res.status(500).json({ status: 'error', db: false });
  }
});

const PORT = process.env.PORT || 5000;

// Initialize database before starting server
initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});