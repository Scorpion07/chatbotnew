import { Sequelize, DataTypes } from "sequelize";

export const sequelize = new Sequelize("sqlite:./data/database.sqlite", {
  logging: false,
});

// ------------------------- MODELS -------------------------
export const Bot = sequelize.define("Bot", {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  name: DataTypes.STRING,
  provider: DataTypes.STRING,
  status: DataTypes.STRING,
  description: DataTypes.TEXT,
  tagline: DataTypes.STRING,
  icon: DataTypes.STRING,
  color: DataTypes.STRING,
  isNew: { type: DataTypes.BOOLEAN, defaultValue: false },
});

export const Stat = sequelize.define("Stat", {
  totalChats: DataTypes.INTEGER,
  activeBots: DataTypes.INTEGER,
  usersOnline: DataTypes.INTEGER,
});

export const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: true },
  googleId: { type: DataTypes.STRING, unique: true, allowNull: true },
  name: { type: DataTypes.STRING, allowNull: true },
  avatar: { type: DataTypes.STRING, allowNull: true },
  provider: { type: DataTypes.STRING, defaultValue: "email" },
  isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
});

export const Usage = sequelize.define("Usage", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  botName: { type: DataTypes.STRING, allowNull: false },
  count: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastUsedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

// ------------------------- RELATIONSHIPS -------------------------
User.hasMany(Usage, { foreignKey: "userId", onDelete: "CASCADE" });
Usage.belongsTo(User, { foreignKey: "userId" });

// ------------------------- INIT -------------------------
export async function initDb() {
  console.log("🗄️  [DB] Syncing models...");
  await sequelize.sync({ alter: true });
  console.log("✅ [DB] Synced successfully");
}

// ------------------------- EXPORT DEFAULT -------------------------
export default { sequelize, Bot, Stat, User, Usage, initDb };
