import express from "express";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { User, Usage } from "../models/index.js";
import { authRequired, premiumRequired } from "../middleware/auth.js";

dotenv.config();

// ✅ Define router before using it
const router = express.Router();

// ✅ Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// ✅ Validate API key
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables.");
  process.exit(1);
}

// ✅ Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================================================
// 🧠 TEXT CHAT ENDPOINT (with auth and free-tier limit)
// =====================================================
router.post("/chat", authRequired, async (req, res) => {
  const { message, botName } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
  const user = req.user;

    // Enforce free-tier limit: 5 queries per bot for non-premium users
    if (!user.isPremium) {
      const FREE_LIMIT = 5;
      const [usage] = await Usage.findOrCreate({
        where: { userId: user.id, botName: botName || 'default' },
        defaults: { count: 0 }
      });
      if (usage.count >= FREE_LIMIT) {
        return res.status(402).json({ error: `Free limit reached for ${botName || 'this bot'}.` });
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    // Increment usage after successful response for non-premium users
    if (!user.isPremium) {
      await Usage.increment(
        { count: 1 },
        { where: { userId: user.id, botName: botName || 'default' } }
      );
      await Usage.update({ lastUsedAt: new Date() }, { where: { userId: user.id, botName: botName || 'default' } });
    }

    res.json({ response: response.choices[0].message.content });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Something went wrong while processing chat." });
  }
});

// =====================================================
// 🎙️ AUDIO TRANSCRIPTION ENDPOINT
// =====================================================
// Transcription (premium only)
router.post("/transcribe", authRequired, premiumRequired, upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Audio file is required." });
  }

  try {
    const audioPath = req.file.path;

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
    });

    res.json({ transcript: response.text });
  } catch (err) {
    console.error("❌ Audio transcription error:", err);
    res
      .status(500)
      .json({ error: "Something went wrong while transcribing audio." });
  } finally {
    // ✅ Always delete uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// =====================================================
// 🖼️ IMAGE GENERATION ENDPOINT
// =====================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  let { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    // Clean up prompt: remove markdown or base64 image text
    prompt = prompt.replace(/!\[.*?\]\(.*?\)/g, "").trim();
    if (prompt === "") {
      prompt = "Generate a creative image inspired by the uploaded photo.";
    }

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "512x512",
    });

    res.json({ url: response.data[0].url });
  } catch (err) {
    if (err.code === "billing_hard_limit_reached") {
      return res.status(402).json({
        error:
          "Your OpenAI account has reached its billing limit. Please add funds or wait for the next billing cycle.",
      });
    }

    console.error("❌ Image generation error:", err);
    res.status(500).json({
      error: "Image generation failed. Please verify your API key or prompt.",
      details: err.message,
    });
  }
});

// =====================================================
// 🔊 TEXT-TO-SPEECH (TTS) ENDPOINT (premium only)
// =====================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = 'alloy', format = 'mp3' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for TTS.' });
  }
  try {
    const tts = await openai.audio.speech.create({
      model: 'tts-1',
      voice,
      input: text,
      format,
    });
    const buffer = Buffer.from(await tts.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('❌ TTS error:', err);
    return res.status(500).json({ error: 'Failed to synthesize speech.' });
  }
});

export default router;
