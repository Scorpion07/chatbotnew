
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import botsRouter from './routes/bots.js';
import statsRouter from './routes/stats.js';
import openaiRouter from './routes/openai.js';
import authRouter from './routes/auth.js';
import usageRouter from './routes/usage.js';
import { initDb } from './models/index.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/bots', botsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/openai', openaiRouter);
app.use('/api/auth', authRouter);
app.use('/api/usage', usageRouter);

app.get('/', (req, res) => res.send('✅ Chatbot backend running'));

io.on('connection', socket => {
  console.log('Client connected', socket.id);
});

const PORT = process.env.PORT || 5000;

(async () => {
  await initDb();
  server.listen(PORT, '0.0.0.0', () => 
    console.log(`🚀 Backend listening on 0.0.0.0:${PORT}`)
  );
})();
