import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/index.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

// ---------- CONFIG ----------
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const TOKEN_EXPIRY = "7d";

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// ---------- HELPERS ----------
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      isPremium: user.isPremium,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function sanitizeUser(user) {
  const { password, ...safe } = user.toJSON();
  return safe;
}

// ---------- METHOD GUARDS ----------
router.all(["/signup", "/login", "/google"], (req, res, next) => {
  if (req.method === "POST" || req.method === "OPTIONS") return next();
  res.set("Allow", "POST, OPTIONS");
  return res.sendStatus(405);
});

// ------------------------------------------------------
// ✅ SIGNUP
// ------------------------------------------------------
router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(409).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 8);
    const user = await User.create({ email, password: hashed });

    const token = generateToken(user);
    return res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------------------
// ✅ LOGIN
// ------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !user.password)
      return res.status(401).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken(user);
    return res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------------------
// ✅ GOOGLE SIGN-IN
// ------------------------------------------------------
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential)
      return res.status(400).json({ message: "Missing Google credential" });

    if (!googleClient) {
      console.error("Missing GOOGLE_CLIENT_ID");
      return res.status(500).json({ message: "Google OAuth not configured" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload)
      return res.status(401).json({ message: "Invalid Google token" });

    const { email, name, picture, sub } = payload;

    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({
        email,
        name,
        avatar: picture,
        googleId: sub,
        provider: "google",
      });
    } else {
      if (!user.googleId) user.googleId = sub;
      user.name = name;
      user.avatar = picture;
      await user.save();
    }

    const token = generateToken(user);
    return res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error("Google login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------------------
// ✅ /me (requires token in Authorization: Bearer XXX)
// ------------------------------------------------------
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth)
      return res.status(401).json({ message: "Missing Authorization header" });

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Auth /me error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

// ------------------------------------------------------
// ✅ LOGOUT (frontend deletes token)
// ------------------------------------------------------
router.post("/logout", (req, res) => {
  return res.json({ message: "Logged out" });
});

// ------------------------------------------------------
// ✅ PREMIUM: SUBSCRIBE (requires token)
// ------------------------------------------------------
router.post("/subscribe", authRequired, async (req, res) => {
  try {
    req.user.isPremium = true;
    await req.user.save();
    return res.json({ ok: true, user: sanitizeUser(req.user) });
  } catch (err) {
    console.error("Subscribe error:", err);
    return res.status(500).json({ message: "Failed to subscribe" });
  }
});

// ------------------------------------------------------
// ✅ PREMIUM: UNSUBSCRIBE (requires token)
// ------------------------------------------------------
router.post("/unsubscribe", authRequired, async (req, res) => {
  try {
    req.user.isPremium = false;
    await req.user.save();
    return res.json({ ok: true, user: sanitizeUser(req.user) });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return res.status(500).json({ message: "Failed to unsubscribe" });
  }
});

export default router;
