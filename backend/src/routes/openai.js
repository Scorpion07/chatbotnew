// backend/src/routes/openai.js
import express from "express";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";
import { fileURLToPath } from "url";

import { User, Usage, Conversation, Message } from "../models/index.js";
import { appConfig } from "../services/configService.js";
import { authRequired, premiumRequired } from "../middleware/auth.js";

dotenv.config();

// ESM dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Router + file uploads
const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ---------------------- OPENAI (Text + TTS) ----------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------- VERTEX IMAGE GENERATION ----------------------
const VERTEX_LOCATION = "us-central1";
const KEY_PATH = path.resolve(__dirname, "../../vertex-key.json");

// Load service account JSON
function loadServiceAccount() {
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(`Service account key missing at ${KEY_PATH}`);
  }
  const data = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  if (!data.project_id) throw new Error("project_id missing in vertex-key.json");
  return data;
}

// Get OAuth Access Token
async function getVertexToken() {
  const auth = new GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) throw new Error("Failed to obtain Vertex OAuth token");

  return token.token;
}

// ✅ FINAL WORKING Imagen-style Image Generation
async function generateVertexImage(prompt, aspectRatio = "1:1") {
  if (!prompt || typeof prompt !== "string") {
    const e = new Error("Prompt is required.");
    e.status = 400;
    throw e;
  }

  const sa = loadServiceAccount();
  const accessToken = await getVertexToken();

  const url =
    `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/` +
    `projects/${sa.project_id}/locations/${VERTEX_LOCATION}/` +
    `publishers/google/models/imagegeneration:predict`;

  // Correct 2025 schema — NO pixel sizes allowed
  const body = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio,     // "1:1", "16:9", "9:16", "4:3", etc.
      quality: "high",
      outputMimeType: "image/png"
    }
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json();

  if (!resp.ok) {
    const msg = json?.error?.message || `${resp.status} Vertex error`;
    const err = new Error(`Vertex predict failed: ${msg}`);
    err.status = resp.status;
    err.vertex = json;
    throw err;
  }

  const pred = json?.predictions?.[0];
  if (!pred?.bytesBase64Encoded) {
    throw new Error("Vertex returned no image data.");
  }

  return `data:image/png;base64,${pred.bytesBase64Encoded}`;
}

// =====================================================
// ✅ TEXT CHAT
// =====================================================
router.post("/chat", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    // Create or load conversation
    let conv = null;
    if (conversationId) {
      conv = await Conversation.findOne({
        where: { id: conversationId, userId: user.id },
      });
      if (!conv) return res.status(404).json({ error: "Conversation not found" });
    } else {
      conv = await Conversation.create({
        userId: user.id,
        botName: botName || "default",
        title: null,
      });
    }

    // Free-tier limit
    if (!user.isPremium) {
      const FREE_LIMIT = appConfig?.rateLimit?.freeUserLimit || 5;
      const [usage] = await Usage.findOrCreate({
        where: { userId: user.id, botName: botName || "default" },
        defaults: { count: 0 },
      });

      if (usage.count >= FREE_LIMIT) {
        return res.status(402).json({
          error: `Free limit reached for ${botName || "this bot"}.`,
        });
      }
    }

    // Save user message
    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
      type: "text",
      botName: botName || "default",
    });

    // Auto-title
    if (!conv.title) {
      await conv.update({
        title: message.slice(0, 60),
        botName: botName || conv.botName,
      });
    }

    // Generate response
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    const assistantContent = response.choices?.[0]?.message?.content || "";

    // Save assistant message
    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: assistantContent,
      model: "gpt-4o-mini",
      type: "text",
      botName: botName || "default",
    });

    // Increment usage
    if (!user.isPremium) {
      await Usage.increment(
        { count: 1 },
        { where: { userId: user.id, botName: botName || "default" } }
      );
      await Usage.update(
        { lastUsedAt: new Date() },
        { where: { userId: user.id, botName: botName || "default" } }
      );
    }

    await conv.update({ updatedAt: new Date() });

    res.json({ response: assistantContent, conversationId: conv.id });

  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat processing failed" });
  }
});

// =====================================================
// ✅ STREAMING CHAT
// =====================================================
router.post("/chat/stream", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    let conv = null;
    if (conversationId) {
      conv = await Conversation.findOne({
        where: { id: conversationId, userId: user.id },
      });
      if (!conv) return res.status(404).json({ error: "Conversation not found" });
    } else {
      conv = await Conversation.create({
        userId: user.id,
        botName: botName || "default",
        title: null,
      });
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
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

    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: full,
      model: "gpt-4o-mini",
      type: "text",
      botName: botName || "default",
    });

    res.write(JSON.stringify({ type: "done", response: full }) + "\n");
    res.end();
  } catch (err) {
    console.error("❌ Streaming error:", err);
    res.write(JSON.stringify({ type: "error", error: "Streaming failed" }) + "\n");
    res.end();
  }
});

// =====================================================
// ✅ AUDIO TRANSCRIBE (premium)
// =====================================================
router.post(
  "/transcribe",
  authRequired,
  premiumRequired,
  upload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file required" });
    }

    try {
      const result = await openai.audio.transcriptions.create({
        file: fs.createReadStream(req.file.path),
        model: "whisper-1",
      });

      res.json({ transcript: result.text });

    } catch (err) {
      console.error("❌ Transcription error:", err);
      res.status(500).json({ error: "Transcription failed" });
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  }
);

// =====================================================
// ✅ IMAGE GENERATION (Vertex)
// =====================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt, ratio } = req.body;
    const aspectRatio = ratio || "1:1";

    const img = await generateVertexImage(prompt, aspectRatio);
    res.json({ success: true, image: img });

  } catch (err) {
    console.error("❌ Vertex image generation failed:", err);
    res
      .status(err?.status || 500)
      .json({ success: false, error: err.message });
  }
});

// =====================================================
// ✅ TEXT TO SPEECH
// =====================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = "alloy", format = "mp3" } = req.body;

  if (!text) return res.status(400).json({ error: "Text is required" });

  try {
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      format,
    });

    const buffer = Buffer.from(await tts.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);

  } catch (err) {
    console.error("❌ TTS error:", err);
    res.status(500).json({ error: "TTS failed" });
  }
});

export default router;
