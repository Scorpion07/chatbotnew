import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { authRequired } from "../middleware/auth.js";
import { User } from "../models/index.js";

const router = express.Router();

// ---------- CONFIG ----------
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const TOKEN_EXPIRY = "7d"; // JWT validity

// ---------- METHOD GUARDS (let CORS handle preflight) ----------
router.all(["/signup", "/login", "/google", "/subscribe"], (req, res, next) => {
  if (req.method === "POST" || req.method === "OPTIONS") return next();
  res.set("Allow", "POST, OPTIONS");
  return res.sendStatus(405);
});

// ---------- HELPERS ----------
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isPremium: user.isPremium },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function sanitizeUser(user) {
  const { password, ...safeUser } = user.toJSON();
  return safeUser;
}

// ---------- SIGNUP ----------
router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 8);
    const user = await User.create({ email, password: hashed });
    const token = generateToken(user);

    res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- LOGIN ----------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !user.password)
      return res.status(401).json({ message: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });

    const token = generateToken(user);
    res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- GOOGLE SIGN-IN ----------
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: "Missing Google credential" });
    if (!GOOGLE_CLIENT_ID || !googleClient) {
      console.error("Google login error: GOOGLE_CLIENT_ID not configured");
      return res.status(500).json({ message: "Server misconfiguration: Google client ID missing" });
    }

    // Verify Google ID token via Google JWKS
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || payload.aud !== GOOGLE_CLIENT_ID) {
      console.error("Invalid Google token: audience mismatch", { expected: GOOGLE_CLIENT_ID, got: payload?.aud });
      return res.status(401).json({ message: "Invalid Google token" });
    }

    const { email, name, picture, sub } = payload;

    // Find or create user
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
      user.googleId = user.googleId || sub;
      user.avatar = picture;
      user.name = name;
      await user.save();
    }

    const token = generateToken(user);
    res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error("Google login error:", err?.message || err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------- ME ----------
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Missing Authorization header" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Auth /me error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

// ---------- LOGOUT (frontend clears token) ----------
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

export default router;

// ---------- PREMIUM SUBSCRIPTION (placeholder) ----------
// This endpoint simulates a successful payment by marking the authenticated user as premium.
// In production, wire this to your payment provider's webhook or checkout success callback.
router.post("/subscribe", authRequired, async (req, res) => {
  try {
    req.user.isPremium = true;
    await req.user.save();
    const token = generateToken(req.user);
    return res.json({ user: sanitizeUser(req.user), token });
  } catch (err) {
    console.error("Subscribe error:", err?.message || err);
    return res.status(500).json({ message: "Server error" });
  }
});
