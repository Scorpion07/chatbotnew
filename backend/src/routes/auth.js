import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/index.js";

import { authRequired } from "../middleware/auth.js";
import { subscribeUser } from "../controllers/authController.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || "7d";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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

// Subscribe (placeholder)
router.post("/subscribe", subscribeUser);

// Signup
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

// Login
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

// Google Sign-In (GIS)
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ message: "Missing Google credential" });
    if (!googleClient) {
      console.error("Missing GOOGLE_CLIENT_ID");
      return res.status(500).json({ message: "Google OAuth not configured" });
    }
    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || payload.aud !== GOOGLE_CLIENT_ID)
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
    // Generate JWT
    const token = generateToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Google login error:", err);
    return res.status(401).json({ message: "Invalid or expired Google credential" });
  }
});

// /me
router.get("/me", authRequired, async (req, res) => {
  try {
    return res.json({ user: sanitizeUser(req.user) });
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

// Upgrade to premium
router.post("/upgrade-premium", authRequired, async (req, res) => {
  try {
    const user = req.user;
    
    // Update user to premium
    user.isPremium = true;
    await user.save();
    
    // Generate new token with updated isPremium status
    const token = generateToken(user);
    
    return res.json({ 
      success: true, 
      message: "Successfully upgraded to premium",
      user: sanitizeUser(user),
      token // Return new token with updated isPremium claim
    });
  } catch (err) {
    console.error("Upgrade error:", err);
    return res.status(500).json({ message: "Failed to upgrade account" });
  }
});

export default router;