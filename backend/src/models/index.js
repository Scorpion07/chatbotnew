import { Sequelize, DataTypes } from "sequelize";
import bcrypt from "bcryptjs";

//
// ------------------------- DATABASE SETUP -------------------------
//
export const sequelize = new Sequelize("sqlite:./data/database.sqlite", {
  logging: false,
});

//
// ------------------------- MODELS -------------------------
//
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
  // Note: No 'unique' on googleId for SQLite; we’ll add unique index manually after sync.
  googleId: { type: DataTypes.STRING, allowNull: true },
  name: { type: DataTypes.STRING, allowNull: true },
  avatar: { type: DataTypes.STRING, allowNull: true },
  provider: { type: DataTypes.STRING, defaultValue: "email" },
  isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
  isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
});

export const Usage = sequelize.define("Usage", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  botName: { type: DataTypes.STRING, allowNull: false },
  count: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastUsedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

// Conversation and Message models for persistent chat history
export const Conversation = sequelize.define("Conversation", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: true },
  botName: { type: DataTypes.STRING, allowNull: true },
});

export const Message = sequelize.define("Message", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  role: { type: DataTypes.STRING, allowNull: false }, // 'user' | 'assistant'
  content: { type: DataTypes.TEXT, allowNull: false },
  model: { type: DataTypes.STRING, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: true }, // 'text' | 'image' | 'audio' | 'search'
  botName: { type: DataTypes.STRING, allowNull: true },
});

export const CreditCard = sequelize.define("CreditCard", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  cardName: { type: DataTypes.STRING, allowNull: false },
  cardNumberLast4: { type: DataTypes.STRING, allowNull: false }, // Store only last 4 digits
  cardType: { type: DataTypes.STRING, allowNull: true }, // Visa, Mastercard, etc.
  expiryMonth: { type: DataTypes.STRING, allowNull: false },
  expiryYear: { type: DataTypes.STRING, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

//
// ------------------------- RELATIONSHIPS -------------------------
//
User.hasMany(Usage, { foreignKey: "userId", onDelete: "CASCADE" });
Usage.belongsTo(User, { foreignKey: "userId" });

// Conversations relationships
User.hasMany(Conversation, { foreignKey: "userId", onDelete: "CASCADE" });
Conversation.belongsTo(User, { foreignKey: "userId" });
Conversation.hasMany(Message, { foreignKey: "conversationId", onDelete: "CASCADE" });
Message.belongsTo(Conversation, { foreignKey: "conversationId" });

// Credit card relationships
User.hasMany(CreditCard, { foreignKey: "userId", onDelete: "CASCADE" });
CreditCard.belongsTo(User, { foreignKey: "userId" });

//
// ------------------------- INIT FUNCTION -------------------------
//
export async function initDb() {
  console.log("🗄️  Initializing database...");

  try {
    console.log("🗄️  [DB] Syncing models...");

    await sequelize.sync({ alter: false, force: false });

    // Add unique index safely (SQLite allows multiple NULLs)
    try {
      const table = User.getTableName();
      const tableName = typeof table === "string" ? table : table.tableName;
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_googleId ON ${tableName} (googleId) WHERE googleId IS NOT NULL;`
      );
    } catch (e) {
      console.warn("⚠️  [DB] Skipping unique index creation for User.googleId:", e.message);
    }

    console.log("✅ [DB] Synced successfully");
    
    // Seed persistent admin user
    try {
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'saxenadevansh703@gmail.com';
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'qwerty@123';
      if (ADMIN_EMAIL && ADMIN_PASSWORD) {
        let admin = await User.findOne({ where: { email: ADMIN_EMAIL } });
        if (!admin) {
          const hashed = await bcrypt.hash(ADMIN_PASSWORD, 8);
          admin = await User.create({ 
            email: ADMIN_EMAIL, 
            password: hashed, 
            provider: 'email', 
            isAdmin: true,
            isPremium: true 
          });
          console.log("✅ [DB] Admin user created");
        } else {
          // Ensure admin flag stays in sync
          if (!admin.isAdmin) {
            admin.isAdmin = true;
            admin.isPremium = true;
            await admin.save();
            console.log("✅ [DB] Admin user updated");
          }
        }
      }
    } catch (seedErr) {
      console.warn('⚠️  [DB] Admin seed skipped:', seedErr.message);
    }
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    console.error("Full error:", error);

    if (error.message.includes("Validation error")) {
      console.error("⚠️ Likely cause: duplicate or invalid data in database.sqlite");
      console.error("👉 Tip: Delete 'backend/data/database.sqlite' and restart the backend.");
    }

    // Force process exit so PM2 restarts cleanly instead of infinite retry loop
    process.exit(1);
  }
}

//
// ------------------------- EXPORT DEFAULT -------------------------
//
export default {
  sequelize,
  Bot,
  Stat,
  User,
  Usage,
  Conversation,
  Message,
  CreditCard,
  initDb,
};
