
import { Sequelize, DataTypes } from 'sequelize';

export const sequelize = new Sequelize('sqlite:./data/database.sqlite', { logging: false });

export const Bot = sequelize.define('Bot', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  name: DataTypes.STRING,
  provider: DataTypes.STRING,
  status: DataTypes.STRING,
  description: DataTypes.TEXT,
  tagline: DataTypes.STRING,
  icon: DataTypes.STRING,
  color: DataTypes.STRING,
  isNew: { type: DataTypes.BOOLEAN, defaultValue: false }
});

export const Stat = sequelize.define('Stat', {
  totalChats: DataTypes.INTEGER,
  activeBots: DataTypes.INTEGER,
  usersOnline: DataTypes.INTEGER
});

// New: Users table for auth and premium status
export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: true }, // Allow null for Google sign-in users
  googleId: { type: DataTypes.STRING, unique: true, allowNull: true }, // Google user ID
  name: { type: DataTypes.STRING, allowNull: true }, // User's name from Google
  avatar: { type: DataTypes.STRING, allowNull: true }, // Profile picture URL
  provider: { type: DataTypes.STRING, defaultValue: 'email' }, // 'email' or 'google'
  isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
});

// New: Usage tracking per user per bot for free-tier limits
export const Usage = sequelize.define('Usage', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  botName: { type: DataTypes.STRING, allowNull: false },
  count: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastUsedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

User.hasMany(Usage, { foreignKey: 'userId', onDelete: 'CASCADE' });
Usage.belongsTo(User, { foreignKey: 'userId' });

export async function initDb() {
  await sequelize.sync();
}
