
import express from 'express';
import { readConfig, writeConfig } from '../services/configService.js';
const router = express.Router();

router.get('/', async (req, res) => {
  const cfg = await readConfig();
  res.json(cfg.stats);
});

router.post('/', async (req, res) => {
  const cfg = await readConfig();
  cfg.stats = req.body;
  await writeConfig(cfg);
  req.io.emit('stats:update', cfg.stats);
  res.json(cfg.stats);
});

export default router;
