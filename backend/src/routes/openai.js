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

// ----------------------- ESM dirname -----------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------- Router / Uploads ------------------
const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ----------------------- OpenAI (text + TTS) ---------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables.");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===========================================================
//                 VERTEX AI (IMAGEN) - SERVICE ACCOUNT
// ===========================================================
//
// • Key file: backend/vertex-key.json  (service account JSON)
// • Location: us-central1  (you told me you’re using this)
// • Model:    publishers/google/models/imagegeneration@002
//
// REST (Predict) shape expected:
//
// POST https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/publishers/google/models/imagegeneration@002:predict
// {
//   "instances":[{ "prompt":"..." }],
//   "parameters":{
//     "sampleCount": 1,
//     "sampleImageSize": "1024x1024"
//   }
// }
//
// Response (typical):
// { "predictions": [ { "bytesBase64Encoded": "...", "mimeType": "image/png" } ] }

const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";

// Resolve key RELATIVE to this file to avoid double “backend/”
const VERTEX_KEY_PATH = path.resolve(__dirname, "../../vertex-key.json");

// Supported sizes (safe set). We’ll try them in order if one fails.
// You shared a table; these match common Imagen allowances.
const SUPPORTED_SIZES = [
  "1024x1024", // 1:1 (1K)
  "2048x2048", // 1:1 (2K)
  "896x1280",  // 3:4 portrait (1K-ish)
  "1792x2560", // 3:4 portrait (2K)
  "1280x896",  // 4:3 landscape (1K-ish)
  "2560x1792", // 4:3 landscape (2K)
  "768x1408",  // 9:16 portrait (1K-ish)
  "1536x2816", // 9:16 portrait (2K)
  "1408x768",  // 16:9 landscape (1K-ish)
  "2816x1536", // 16:9 landscape (2K)
];

// ----- helpers -----
function assertServiceAccountFile() {
  if (!fs.existsSync(VERTEX_KEY_PATH)) {
    throw new Error(
      `Service account key missing at ${VERTEX_KEY_PATH}`
    );
  }
}

function readProjectIdFromKey() {
  assertServiceAccountFile();
  const raw = fs.readFileSync(VERTEX_KEY_PATH, "utf8");
  const json = JSON.parse(raw);
  if (!json.project_id) {
    throw new Error("project_id missing in service account key JSON");
  }
  return json.project_id;
}

async function getVertexAccessToken() {
  assertServiceAccountFile();
  const auth = new GoogleAuth({
    keyFile: VERTEX_KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) throw new Error("Failed to obtain Vertex access token");
  return token.token;
}

async function vertexPredict({ projectId, accessToken, prompt, sampleImageSize }) {
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/imagegeneration@002:predict`;

  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      // only provide sampleImageSize if we have one
      ...(sampleImageSize ? { sampleImageSize } : {}),
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
    const detail = json?.error?.message || `${resp.status} ${resp.statusText}`;
    const err = new Error(`Vertex predict failed: ${detail}`);
    err.status = resp.status;
    err.vertex = json;
    throw err;
  }

  const pred = Array.isArray(json?.predictions) ? json.predictions[0] : null;
  const b64 =
    pred?.bytesBase64Encoded ||
    pred?.imageBytes ||
    null;
  const mime = pred?.mimeType || "image/png";
  if (!b64) throw new Error("Vertex returned no image data.");
  return { b64, mime };
}

// Main generator with size fallback logic
async function generateImagenImage(prompt, preferredSize = "1024x1024") {
  if (!prompt || typeof prompt !== "string") {
    const e = new Error("Prompt is required.");
    e.status = 400;
    throw e;
  }

  const projectId = readProjectIdFromKey();
  const accessToken = await getVertexAccessToken();

  // Build the order of sizes to attempt
  const uniqueOrder = [
    preferredSize,
    ...SUPPORTED_SIZES.filter((s) => s !== preferredSize),
  ];

  let lastErr = null;

  for (const size of uniqueOrder) {
    try {
      const { b64, mime } = await vertexPredict({
        projectId,
        accessToken,
        prompt,
        sampleImageSize: size,
      });
      return `data:${mime};base64,${b64}`;
    } catch (err) {
      // If the error explicitly says "Image size `...` is unsupported.",
      // try the next size. Otherwise, surface immediately.
      const msg = String(err?.message || "");
      const unsupported = /Image size `.*` is unsupported/i.test(msg);
      if (!unsupported) {
        throw err; // not a size issue — bail
      }
      lastErr = err; // remember and continue trying next size
    }
  }

  // If we exhausted sizes, throw the last size error.
  throw lastErr || new Error("Failed to generate image with all candidate sizes.");
}

// ===========================================================
// 🧠 TEXT CHAT (with auth and free-tier limit)
// ===========================================================
router.post("/chat", authRequired, async (req, res) => {
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

    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
      model: null,
      type: "text",
      botName: botName || "default",
    });

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
    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: assistantContent,
      model: "gpt-4o-mini",
      type: "text",
      botName: botName || "default",
    });

    await conv.update({ updatedAt: new Date() });
    res.json({ response: assistantContent, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Something went wrong while processing chat." });
  }
});

// ===========================================================
// 📝 STREAMING CHAT (NDJSON)
// ===========================================================
router.post("/chat/stream", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body || {};
  if (!message || typeof message !== "string") {
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

    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
      model: null,
      type: "text",
      botName: botName || "default",
    });

    if (!conv.title) {
      const title = String(message).trim().slice(0, 60);
      await conv.update({
        title: title || `Chat ${conv.id}`,
        botName: botName || conv.botName,
      });
    }

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
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
      await Usage.increment(
        { count: 1 },
        { where: { userId: user.id, botName: botName || "default" } }
      );
      await Usage.update(
        { lastUsedAt: new Date() },
        { where: { userId: user.id, botName: botName || "default" } }
      );
    }

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
    try { res.write(JSON.stringify({ type: "error", error: "Streaming failed" }) + "\n"); } catch {}
    if (!res.headersSent) return res.status(500).json({ error: "Streaming failed" });
    try { res.end(); } catch {}
  }
});

// ===========================================================
// 🎙️ TRANSCRIBE (premium)
// ===========================================================
router.post("/transcribe", authRequired, premiumRequired, upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Audio file is required." });

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
    try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch {}
  }
});

// ===========================================================
// 🖼️ IMAGE (Vertex) (premium)
// ===========================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt, size } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ success: false, error: "Prompt is required." });
    }

    const preferred = (typeof size === "string" && SUPPORTED_SIZES.includes(size))
      ? size
      : "1024x1024";

    const dataUrl = await generateImagenImage(prompt, preferred);
    return res.json({ success: true, image: dataUrl });
  } catch (err) {
    const status = err?.status || 500;
    console.error("❌ Vertex image generation failed:", err);
    return res.status(status).json({ success: false, error: err.message || "Vertex image generation failed" });
  }
});

// ===========================================================
// 🔊 TTS (premium)
// ===========================================================
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
