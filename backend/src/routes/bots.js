
import express from 'express';
import { readConfig, writeConfig } from '../services/configService.js';
const router = express.Router();

router.get('/', async (req, res) => {
  const cfg = await readConfig();
  res.json(cfg.bots);
});

router.post('/', async (req, res) => {
  const cfg = await readConfig();
  const { name, provider, description, tagline, icon, color, isNew } = req.body;
  const id = Math.max(0, ...cfg.bots.map(b => b.id)) + 1;
  const newBot = {
    id,
    name,
    provider,
    status: 'online',
    description,
    tagline,
    icon,
    color,
    isNew: isNew || false
  };
  cfg.bots.push(newBot);
  await writeConfig(cfg);
  req.io.emit('bots:update', cfg.bots);
  res.json(newBot);
});

router.delete('/:id', async (req, res) => {
  const cfg = await readConfig();
  const id = parseInt(req.params.id);
  cfg.bots = cfg.bots.filter(b => b.id !== id);
  await writeConfig(cfg);
  req.io.emit('bots:update', cfg.bots);
  res.json({ ok: true });
});

export default router;
