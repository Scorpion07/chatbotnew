import express from "express";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { User, Usage, Conversation, Message } from "../models/index.js";
import { appConfig } from "../services/configService.js";
import { authRequired, premiumRequired } from "../middleware/auth.js";

// Vertex AI
import { VertexAI } from "@google-cloud/vertexai";

dotenv.config();

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ✅ OpenAI for chat + TTS only
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -----------------------------------------------------------------------
 ✅ ALWAYS GENERATE IMAGE USING VERTEX AI (Service Account Key)
 ----------------------------------------------------------------------- */

async function generateVertexImage(prompt) {
  const project = process.env.GCP_PROJECT_ID;
  const location = "us-central1";

  if (!project) throw new Error("Missing GCP_PROJECT_ID");

  const keyPath = "./backend/vertex-key.json";
  if (!fs.existsSync(keyPath)) {
    throw new Error("Service account key not found at backend/vertex-key.json");
  }

  // ✅ Initialize Vertex AI using service account file
  const vertex = new VertexAI({
    project,
    location,
    keyFile: keyPath,
  });

  const model = vertex.getGenerativeModel({
    model: "imagegeneration@002",
  });

  // ✅ Always treat ANY prompt as valid image request
  const result = await model.generateImages({
    prompt: String(prompt),
    size: "1024x1024",
  });

  const base64 = result?.images?.[0]?.bytes;
  if (!base64) throw new Error("Vertex image generation returned empty response");

  return `data:image/png;base64,${base64}`;
}

/* -----------------------------------------------------------------------
 ✅ CHAT COMPLETION (unchanged)
 ----------------------------------------------------------------------- */
router.post("/chat", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body;

  if (!message) return res.status(400).json({ error: "Message is required." });

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
        title: null
      });
    }

    if (!user.isPremium) {
      const FREE_LIMIT = appConfig?.rateLimit?.freeUserLimit || 5;
      const [usage] = await Usage.findOrCreate({
        where: { userId: user.id, botName: botName || "default" },
        defaults: { count: 0 }
      });
      if (usage.count >= FREE_LIMIT) {
        return res.status(402).json({ error: `Free limit reached.` });
      }
    }

    await Message.create({
      conversationId: conv.id,
      role: 'user',
      content: message,
    });

    if (!conv.title) {
      await conv.update({ title: message.slice(0, 60) });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    const content = response.choices[0].message.content;

    if (!user.isPremium) {
      await Usage.increment({ count: 1 }, { where: { userId: user.id, botName: botName || "default" } });
    }

    await Message.create({
      conversationId: conv.id,
      role: 'assistant',
      content,
      model: "gpt-4o-mini",
    });

    await conv.update({ updatedAt: new Date() });

    res.json({ response: content, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

/* -----------------------------------------------------------------------
 ✅ IMAGE GENERATION — ALWAYS USE VERTEX AI
 ----------------------------------------------------------------------- */
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: "Prompt required" });

  try {
    const img = await generateVertexImage(prompt);
    return res.json({ success: true, image: img });
  } catch (err) {
    console.error("❌ Vertex image generation failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* -----------------------------------------------------------------------
 ✅ AUDIO TTS
 ----------------------------------------------------------------------- */
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required." });

  try {
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text
    });

    const buffer = Buffer.from(await tts.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error("❌ TTS error:", err);
    res.status(500).json({ error: "TTS failed." });
  }
});

export default router;
