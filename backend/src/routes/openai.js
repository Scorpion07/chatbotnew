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

// --------------------------------------------------
// ESM __dirname
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// Router + uploads
// --------------------------------------------------
const router = express.Router();
const upload = multer({ dest: "uploads/" });

// --------------------------------------------------
// OpenAI (text + tts)
// --------------------------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --------------------------------------------------
// Vertex AI (Imagen publisher) via Service Account
//   • Key path (CONFIRMED): backend/src/vertex-key.json
//   • Location: us-central1
//   • Endpoint: publishers/google/models/imagegeneration:predict
//   • Use aspectRatio only (no pixel sizes)
// --------------------------------------------------
const VERTEX_LOCATION = "us-central1";
const KEY_PATH = path.resolve(__dirname, "../vertex-key.json"); // <== Choice B

function loadServiceAccount() {
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(`Service account key missing at ${KEY_PATH}`);
  }
  const json = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  if (!json.project_id) throw new Error("project_id missing in vertex-key.json");
  return json;
}

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

function vertexUrl(projectId) {
  return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/imagegeneration:predict`;
}

// Basic prompt softening to avoid false safety triggers.
function sanitizePrompt(p) {
  const base = String(p || "").trim();
  const softener =
    " (family-friendly, harmless, non-violent, non-graphic, neutral tone, safe)";
  // If already long enough or descriptive, just append softener lightly
  return base + softener;
}

// Detect Vertex safety filter message
function isSafetyBlock(respJson) {
  const msg = respJson?.error?.message || "";
  return /safety filter|prohibited/i.test(msg);
}

async function vertexPredict({ prompt, aspectRatio = "1:1" }) {
  const sa = loadServiceAccount();
  const accessToken = await getVertexToken();
  const url = vertexUrl(sa.project_id);

  const body = {
    // 2025 schema: instances + parameters; use aspectRatio (string like "1:1", "16:9", "9:16", "4:3", "3:4")
    instances: [{ prompt }],
    parameters: {
      aspectRatio,
      // optional hints that stay within public schema expectations
      safetyLevel: "block_mature", // conservative default; we also sanitize prompt
      outputMimeType: "image/png",
      // quality can be "standard" | "high"; keeping "high"
      quality: "high",
    },
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
  const mime =
    pred?.mimeType ||
    pred?.mime_type ||
    "image/png";

  const b64 =
    pred?.bytesBase64Encoded ||
    pred?.imageBytes ||
    pred?.image_bytes ||
    null;

  if (!b64) {
    const err = new Error("Vertex returned no image data.");
    err.status = 502;
    err.vertex = json;
    throw err;
  }

  return `data:${mime};base64,${b64}`;
}

// High-level safe image generation with one retry if safety blocks.
async function generateVertexImage(userPrompt, aspectRatio = "1:1") {
  if (!userPrompt || typeof userPrompt !== "string") {
    const e = new Error("Prompt is required.");
    e.status = 400;
    throw e;
  }

  // Attempt 1: sanitized prompt
  const safe1 = sanitizePrompt(userPrompt);
  try {
    return await vertexPredict({ prompt: safe1, aspectRatio });
  } catch (e) {
    // If safety blocked, try a softened rewrite once.
    if (e?.vertex && isSafetyBlock(e.vertex)) {
      const softened =
        "A benign, wholesome illustration: " +
        userPrompt +
        " (no people, no nudity, no violence, no sensitive context; friendly, cute, stylized).";
      return await vertexPredict({ prompt: softened, aspectRatio });
    }
    throw e;
  }
}

// =====================================================
// 🧠 TEXT CHAT
// =====================================================
router.post("/chat", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    // Ensure conversation exists or create
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
        return res
          .status(402)
          .json({ error: `Free limit reached for ${botName || "this bot"}.` });
      }
    }

    // Persist user message
    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
      model: null,
      type: "text",
      botName: botName || "default",
    });

    // Auto-title first message
    if (!conv.title) {
      const title = String(message).trim().slice(0, 60);
      await conv.update({
        title: title || `Chat ${conv.id}`,
        botName: botName || conv.botName,
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    // Increment usage for non-premium
    if (!req.user.isPremium) {
      await Usage.increment(
        { count: 1 },
        { where: { userId: req.user.id, botName: botName || "default" } }
      );
      await Usage.update(
        { lastUsedAt: new Date() },
        { where: { userId: req.user.id, botName: botName || "default" } }
      );
    }

    const assistantContent = response.choices?.[0]?.message?.content || "";

    // Persist assistant message
    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: assistantContent,
      model: "gpt-4o-mini",
      type: "text",
      botName: botName || "default",
    });

    // Touch conversation
    await conv.update({ updatedAt: new Date() });

    res.json({ response: assistantContent, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Something went wrong while processing chat." });
  }
});

// =====================================================
// 📝 STREAMING CHAT (NDJSON)
// =====================================================
router.post("/chat/stream", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    // Ensure conversation exists or create
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

    // Streaming headers
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // Start event
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

    // Persist assistant message
    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: full,
      model: "gpt-4o-mini",
      type: "text",
      botName: botName || "default",
    });

    await conv.update({ updatedAt: new Date() });

    res.write(JSON.stringify({ type: "done", response: full, conversationId: conv.id }) + "\n");
    res.end();
  } catch (err) {
    console.error("❌ Streaming chat error:", err);
    try {
      res.write(JSON.stringify({ type: "error", error: "Streaming failed" }) + "\n");
    } catch {}
    if (!res.headersSent) {
      return res.status(500).json({ error: "Streaming failed" });
    }
    try { res.end(); } catch {}
  }
});

// =====================================================
// 🎙️ AUDIO TRANSCRIPTION (premium)
// =====================================================
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
    res.status(500).json({ error: "Something went wrong while transcribing audio." });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// =====================================================
// 🖼️ IMAGE GENERATION (Vertex • premium)
// =====================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt, ratio } = req.body || {};
    const aspectRatio = ratio || "1:1"; // allowed: "1:1", "16:9", "9:16", "4:3", "3:4"
    const dataUrl = await generateVertexImage(prompt, aspectRatio);
    return res.json({ success: true, image: dataUrl });
  } catch (err) {
    const status = err?.status || 500;
    console.error("❌ Vertex image generation failed:", err);
    return res.status(status).json({
      success: false,
      error: err.message || "Vertex image generation failed",
      details: err?.vertex?.error?.message || undefined,
    });
  }
});

// =====================================================
// 🔊 TEXT-TO-SPEECH (premium)
// =====================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = "alloy", format = "mp3" } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required for TTS." });
  }
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
    return res.send(buffer);
  } catch (err) {
    console.error("❌ TTS error:", err);
    return res.status(500).json({ error: "Failed to synthesize speech." });
  }
});

export default router;
