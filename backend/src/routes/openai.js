import express from "express";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { VertexAI } from "@google-cloud/vertexai";

import { User, Usage, Conversation, Message } from "../models/index.js";
import { appConfig } from "../services/configService.js";
import { authRequired, premiumRequired } from "../middleware/auth.js";

dotenv.config();

// ------------------ ROUTER ------------------
const router = express.Router();

// ------------------ MULTER (audio uploads) ------------------
const upload = multer({ dest: "uploads/" });

// ------------------ OpenAI Init ------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ------------------ Vertex AI Setup (Image Generation Only) ------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load service account file: backend/vertex-key.json
const keyPath = path.join(__dirname, "..", "vertex-key.json");

const vertex = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: "us-central1",
  keyFile: keyPath,
});

const imageModel = vertex.getGenerativeModel({
  model: "imagegeneration@002",
});

// ✅ Minimal helper: Convert prompt → Image
async function generateVertexImage(prompt) {
  // Always treat prompt as image request
  if (!prompt || typeof prompt !== "string" || prompt.length < 2) {
    throw new Error("Invalid prompt");
  }


  const result = await imageModel.generateImages({
    prompt,
    size: "1024x1024",
  });

  const base64 = result?.images?.[0]?.bytes;

  if (!base64) {
    throw new Error("Vertex returned no image");
  }

  return `data:image/png;base64,${base64}`;
}

// =====================================================
// ✅ TEXT CHAT ENDPOINT
// =====================================================
router.post("/chat", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    let conv = null;
    if (conversationId) {
      conv = await Conversation.findOne({ where: { id: conversationId, userId: user.id } });
      if (!conv) return res.status(404).json({ error: "Conversation not found" });
    } else {
      conv = await Conversation.create({
        userId: user.id,
        botName: botName || "default",
        title: null,
      });
    }

    // Free tier usage limit
    if (!user.isPremium) {
      const FREE_LIMIT = appConfig?.rateLimit?.freeUserLimit || 5;

      const [usage] = await Usage.findOrCreate({
        where: { userId: user.id, botName: botName || "default" },
        defaults: { count: 0 },
      });

      if (usage.count >= FREE_LIMIT) {
        return res.status(402).json({ error: "Free usage limit reached." });
      }
    }

    // Save user message
    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
      model: null,
      type: "text",
      botName: botName || "default",
    });

    if (!conv.title) {
      const title = message.trim().slice(0, 60);
      await conv.update({
        title: title || `Chat ${conv.id}`,
        botName: botName || conv.botName,
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    if (!user.isPremium) {
      await Usage.increment({ count: 1 }, { where: { userId: user.id, botName: botName || "default" } });
      await Usage.update({ lastUsedAt: new Date() }, { where: { userId: user.id } });
    }

    const assistantText = response.choices[0].message.content;

    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: assistantText,
      model: "gpt-4o-mini",
      type: "text",
    });

    await conv.update({ updatedAt: new Date() });

    return res.json({ response: assistantText, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    return res.status(500).json({ error: "Chat failed" });
  }
});

// =====================================================
// ✅ STREAMING CHAT
// =====================================================
router.post("/chat/stream", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body || {};

  if (!message) return res.status(400).json({ error: "Message is required" });

  try {
    const user = req.user;

    let conv = null;
    if (conversationId) {
      conv = await Conversation.findOne({ where: { id: conversationId, userId: user.id } });
      if (!conv) return res.status(404).json({ error: "Conversation not found" });
    } else {
      conv = await Conversation.create({ userId: user.id, botName: botName || "default", title: null });
    }

    if (!user.isPremium) {
      const FREE_LIMIT = appConfig?.rateLimit?.freeUserLimit || 5;

      const [usage] = await Usage.findOrCreate({
        where: { userId: user.id, botName: botName || "default" },
        defaults: { count: 0 },
      });

      if (usage.count >= FREE_LIMIT) {
        return res.status(402).json({ error: "Free usage limit reached" });
      }
    }

    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
      type: "text",
    });

    if (!conv.title) {
      await conv.update({ title: message.slice(0, 60) });
    }

    // Streaming headers
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(JSON.stringify({ type: "start", conversationId: conv.id }) + "\n");

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
      stream: true,
    });

    let full = "";

    for await (const part of stream) {
      const delta = part?.choices?.[0]?.delta?.content || "";
      if (!delta) continue;
      full += delta;
      res.write(JSON.stringify({ type: "delta", text: delta }) + "\n");
    }

    if (!user.isPremium) {
      await Usage.increment({ count: 1 }, { where: { userId: user.id, botName: botName || "default" } });
      await Usage.update({ lastUsedAt: new Date() }, { where: { userId: user.id } });
    }

    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: full,
      model: "gpt-4o-mini",
      type: "text",
    });

    await conv.update({ updatedAt: new Date() });

    res.write(JSON.stringify({ type: "done", response: full }) + "\n");
    res.end();
  } catch (err) {
    console.error("❌ Stream error:", err);
    res.write(JSON.stringify({ type: "error" }) + "\n");
    res.end();
  }
});

// =====================================================
// ✅ AUDIO TRANSCRIPTION
// =====================================================
router.post("/transcribe", authRequired, premiumRequired, upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Audio file required" });

  try {
    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
    });

    return res.json({ transcript: result.text });
  } catch (err) {
    console.error("❌ Transcription error:", err);
    return res.status(500).json({ error: "Transcription failed" });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// =====================================================
// ✅ IMAGE GENERATION (Vertex AI)
// =====================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) return res.status(400).json({ success: false, error: "Prompt required" });

  try {
    const image = await generateVertexImage(prompt);
    return res.json({ success: true, image });
  } catch (err) {
    if (err.code === "NO_IMAGE_INTENT") {
      return res.status(400).json({ success: false, error: "This prompt does not describe an image." });
    }

    console.error("❌ Vertex error:", err);
    return res.status(500).json({ success: false, error: "Image generation failed" });
  }
});

// =====================================================
// ✅ TEXT → SPEECH
// =====================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = "alloy", format = "mp3" } = req.body;

  if (!text) return res.status(400).json({ error: "Text is required." });

  try {
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      format,
    });

    const buffer = Buffer.from(await tts.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);

    res.send(buffer);
  } catch (err) {
    console.error("❌ TTS error:", err);
    return res.status(500).json({ error: "TTS failed" });
  }
});

export default router;
