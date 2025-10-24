
import fs from 'fs-extra';
import path from 'path';
const configPath = path.join(process.cwd(), 'config.json');

export async function readConfig() {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { bots: [], stats: { totalChats: 0, activeBots: 0, usersOnline: 0 } };
  }
}

export async function writeConfig(cfg) {
  await fs.writeFile(configPath, JSON.stringify(cfg, null, 2));
  return cfg;
}
