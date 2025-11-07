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

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------
// Router & uploads
// ---------------------------------------------
const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ---------------------------------------------
// OpenAI — text + TTS
// ---------------------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------
// Vertex AI Image Generation
// ---------------------------------------------
const VERTEX_LOCATION = "us-central1";

// ✅ FIXED PATH — your file lives at: backend/vertex-key.json
const VERTEX_KEY_PATH = path.resolve(
  process.cwd(),
  "backend",
  "vertex-key.json"
);

// --- Read project_id from service account JSON ---
function getServiceAccountProjectId() {
  try {
    const raw = fs.readFileSync(VERTEX_KEY_PATH, "utf8");
    const json = JSON.parse(raw);
    if (!json.project_id) throw new Error("project_id missing in key file");
    return json.project_id;
  } catch (err) {
    throw new Error(
      `Service account key invalid or missing at ${VERTEX_KEY_PATH} → ${err.message}`
    );
  }
}

// --- Get OAuth2 Access Token ---
async function getVertexAccessToken() {
  const auth = new GoogleAuth({
    keyFile: VERTEX_KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) throw new Error("Failed to fetch access token");

  return token.token;
}

// --- Vertex Image Generation ---
async function generateVertexImage(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") {
    const err = new Error("Prompt is required.");
    err.status = 400;
    throw err;
  }

  const projectId = getServiceAccountProjectId();
  const accessToken = await getVertexAccessToken();

  // ✅ Correct Vertex endpoint
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/imagegeneration@002:predict`;

  const body = {
    instances: [{ prompt: userPrompt }],
    parameters: {
      sampleCount: 1,
      sampleImageSize: "1024x1024",
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
    const message =
      json?.error?.message || `${resp.status} ${resp.statusText}`;
    const err = new Error(message);
    err.status = resp.status;
    throw err;
  }

  // ✅ Supported response:
  const pred = Array.isArray(json?.predictions)
    ? json.predictions[0]
    : null;

  const b64 =
    pred?.bytesBase64Encoded ||
    pred?.imageBytes ||
    null;

  const mime = pred?.mimeType || "image/png";

  if (!b64) {
    throw new Error("Vertex returned no image data");
  }

  return `data:${mime};base64,${b64}`;
}

// =====================================================
// 🧠 CHAT
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
      conv = await Conversation.findOne({
        where: { id: conversationId, userId: user.id },
      });
      if (!conv)
        return res.status(404).json({ error: "Conversation not found" });
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
        return res.status(402).json({ error: "Free limit reached" });
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
      await conv.update({
        title: message.slice(0, 60),
        botName: botName || conv.botName,
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    const assistantContent = response.choices?.[0]?.message?.content || "";

    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: assistantContent,
      model: "gpt-4o-mini",
      type: "text",
      botName: botName || "default",
    });

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

    res.json({ response: assistantContent, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// =====================================================
// 📝 STREAM CHAT
// =====================================================
router.post("/chat/stream", authRequired, async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message required" });
  }

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
      stream: true,
    });

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Connection", "keep-alive");

    let full = "";
    for await (const part of stream) {
      const delta = part?.choices?.[0]?.delta?.content || "";
      full += delta;
      res.write(JSON.stringify({ type: "delta", text: delta }) + "\n");
    }

    res.write(JSON.stringify({ type: "done", response: full }) + "\n");
    res.end();
  } catch (err) {
    console.error("❌ Streaming error:", err);
    res.end(JSON.stringify({ type: "error", error: "Streaming failed" }));
  }
});

// =====================================================
// 🎙️ AUDIO TRANSCRIPTION
// =====================================================
router.post(
  "/transcribe",
  authRequired,
  premiumRequired,
  upload.single("audio"),
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "Audio file required" });

    try {
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(req.file.path),
        model: "whisper-1",
      });

      res.json({ transcript: response.text });
    } catch (err) {
      console.error("❌ Transcription error:", err);
      res.status(500).json({ error: "Transcription failed" });
    } finally {
      fs.unlinkSync(req.file.path);
    }
  }
);

// =====================================================
// 🖼️ IMAGE GENERATION (Vertex AI)
// =====================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt)
      return res.status(400).json({ success: false, error: "Prompt required" });

    const dataUrl = await generateVertexImage(prompt);
    return res.json({ success: true, image: dataUrl });
  } catch (err) {
    console.error("❌ Vertex image generation failed:", err);
    res
      .status(err?.status || 500)
      .json({ success: false, error: err.message });
  }
});

// =====================================================
// 🔊 TEXT-TO-SPEECH
// =====================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = "alloy", format = "mp3" } = req.body || {};
  if (!text)
    return res.status(400).json({ error: "Text required for TTS" });

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
