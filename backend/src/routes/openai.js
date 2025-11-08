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
// Vertex AI (Imagen)
// --------------------------------------------------
const VERTEX_LOCATION = "us-central1";
const KEY_PATH = path.resolve(__dirname, "../vertex-key.json");

// ✅ Logging key path
console.log("🔑 Vertex KEY_PATH =", KEY_PATH);

function loadServiceAccount() {
  console.log("📄 Loading service account...");

  if (!fs.existsSync(KEY_PATH)) {
    console.error("❌ Service account NOT found:", KEY_PATH);
    throw new Error(`Service account key missing at ${KEY_PATH}`);
  }

  const json = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  console.log("✅ Service account loaded (project:", json.project_id, ")");

  if (!json.project_id) throw new Error("project_id missing in vertex-key.json");
  return json;
}

async function getVertexToken() {
  console.log("🔑 Getting OAuth token from Vertex...");

  const auth = new GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token?.token) throw new Error("Failed to obtain Vertex OAuth token");

  console.log("✅ Vertex OAuth token obtained.");
  return token.token;
}

function vertexUrl(projectId) {
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/imagegeneration:predict`;

  console.log("🌐 Vertex URL:", url);
  return url;
}

function sanitizePrompt(prompt) {
  const original = String(prompt || "").trim();
  if (!original) return "a simple harmless illustration";

  let cleaned = original;

  // --- Stage 1: Softener ---
  cleaned +=
    " (harmless, family-friendly, safe, non-violent, non-graphic, neutral tone)";

  // --- Stage 2: Replace risky keywords ---
  cleaned = cleaned.replace(
    /\b(nude|naked|kill|weapon|blood|dead|violence|sex|gore|nsfw)\b/gi,
    "cute"
  );

  // --- Stage 3: Hard safe rewrite (if original contains banned words) ---
  if (/\b(nude|naked|kill|weapon|blood|dead|violence|sex|gore|nsfw)\b/i.test(original)) {
    cleaned =
      "A wholesome, cute, friendly illustration with soft colors. No people, no violence, no nudity. Safe for all audiences.";
  }

  return cleaned;
}


function isSafetyBlock(respJson) {
  const msg = respJson?.error?.message || "";
  return /safety filter|prohibited/i.test(msg);
}

async function vertexPredict({ prompt, aspectRatio = "1:1" }) {
  console.log("🎨 Calling vertexPredict()");
  console.log("📝 Prompt:", prompt);
  console.log("🔳 Aspect Ratio:", aspectRatio);

  const sa = loadServiceAccount();
  const accessToken = await getVertexToken();
  const url = vertexUrl(sa.project_id);

  const body = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio,
      safetyLevel: "block_mature",
      outputMimeType: "image/png",
      quality: "high",
    },
  };

  console.log("📤 Vertex Request Body:", JSON.stringify(body, null, 2));

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await resp.clone().text();
  console.log("📥 Vertex Raw Response:", raw);

  const json = JSON.parse(raw);

  if (!resp.ok) {
    console.error("❌ Vertex error response:", json);
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
    console.error("❌ Vertex returned no bytes:", json);
    const err = new Error("Vertex returned no image data.");
    err.status = 502;
    err.vertex = json;
    throw err;
  }

  console.log("✅ Vertex image generation SUCCESS.");
  return `data:${mime};base64,${b64}`;
}

async function generateVertexImage(userPrompt, aspectRatio = "1:1") {
  console.log("🎨 generateVertexImage()");
  console.log("🧾 User Prompt:", userPrompt);

  if (!userPrompt || typeof userPrompt !== "string") {
    const e = new Error("Prompt is required.");
    e.status = 400;
    throw e;
  }

  const safe1 = sanitizePrompt(userPrompt);
  console.log("✨ Sanitized Prompt:", safe1);

  try {
    return await vertexPredict({ prompt: safe1, aspectRatio });
  } catch (e) {
    console.error("❌ First attempt failed:", e.message);
    console.error("📛 STACK:", e.stack);
    console.error("📛 RAW VERTEX:", e.vertex);

    if (e?.vertex && isSafetyBlock(e.vertex)) {
      console.warn("⚠️ SAFETY FILTER TRIGGERED — retrying with softened prompt.");

      const softened =
        "A benign, wholesome illustration: " +
        userPrompt +
        " (no people, no nudity, no violence, no sensitive context; friendly, cute, stylized).";

      console.log("✨ Retry Prompt:", softened);

      return await vertexPredict({ prompt: softened, aspectRatio });
    }

    throw e;
  }
}

// ====================================================================================
// CHAT
// ====================================================================================
router.post("/chat", authRequired, async (req, res) => {
  console.log("💬 /chat request:", req.body);

  const { message, botName, conversationId } = req.body;

  if (!message) {
    console.error("❌ Chat missing message");
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    let conv = null;
    if (conversationId) {
      conv = await Conversation.findOne({
        where: { id: conversationId, userId: user.id },
      });
      console.log("📂 Loaded conversation:", conversationId);

      if (!conv) {
        console.error("❌ Conversation not found");
        return res.status(404).json({ error: "Conversation not found" });
      }
    } else {
      console.log("🆕 Creating new conversation...");
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
        console.warn("⚠️ Free limit reached for", botName);
        return res.status(402).json({
          error: `Free limit reached for ${botName || "this bot"}.`,
        });
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
      const t = message.trim().slice(0, 60);
      await conv.update({ title: t || `Chat ${conv.id}` });
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

    await conv.update({ updatedAt: new Date() });

    res.json({ response: assistantContent, conversationId: conv.id });

  } catch (err) {
    console.error("❌ Chat error:", err);
    console.error("📛 STACK:", err.stack);
    res.status(500).json({ error: "Something went wrong while processing chat." });
  }
});

// ====================================================================================
// STREAMING CHAT
// ====================================================================================
router.post("/chat/stream", authRequired, async (req, res) => {
  console.log("💬 /chat/stream request:", req.body);

  const { message, botName, conversationId } = req.body || {};

  if (!message) {
    console.error("❌ Streaming: Missing message");
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    let conv = null;
    if (conversationId) {
      conv = await Conversation.findOne({
        where: { id: conversationId, userId: user.id },
      });
      if (!conv) {
        console.error("❌ Stream conv not found:", conversationId);
        return res.status(404).json({ error: "Conversation not found" });
      }
    } else {
      conv = await Conversation.create({
        userId: user.id,
        botName: botName || "default",
        title: null,
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
      if (delta) {
        full += delta;
        res.write(JSON.stringify({ type: "delta", text: delta }) + "\n");
      }
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

    res.write(JSON.stringify({ type: "done", response: full }) + "\n");
    res.end();

  } catch (err) {
    console.error("❌ Streaming error:", err);
    console.error("📛 STACK:", err.stack);

    try {
      res.write(JSON.stringify({ type: "error", error: "Streaming failed" }) + "\n");
    } catch {}

    try { res.end(); } catch {}
  }
});

// ====================================================================================
// AUDIO TRANSCRIPTION
// ====================================================================================
router.post("/transcribe", authRequired, premiumRequired, upload.single("audio"), async (req, res) => {
  console.log("🎤 /transcribe HIT");

  if (!req.file) {
    console.error("❌ No audio uploaded");
    return res.status(400).json({ error: "Audio file is required." });
  }

  try {
    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
    });

    res.json({ transcript: result.text });

  } catch (err) {
    console.error("❌ Transcription error:", err);
    console.error("📛 STACK:", err.stack);
    res.status(500).json({ error: "Something went wrong while transcribing audio." });
  } finally {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// ====================================================================================
// IMAGE GENERATION
// ====================================================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  console.log("🖼️ /image request:", req.body);

  try {
    const { prompt, ratio } = req.body;
    const aspectRatio = ratio || "1:1";

    console.log("📝 Prompt:", prompt);
    console.log("🔳 Ratio:", aspectRatio);

    const dataUrl = await generateVertexImage(prompt, aspectRatio);

    res.json({ success: true, image: dataUrl });

  } catch (err) {
    console.error("❌ Image generation error:", err.message);
    console.error("📛 STACK:", err.stack);
    console.error("📛 RAW VERTEX:", err.vertex);

    res.status(err?.status || 500).json({
      success: false,
      error: err.message,
      details: err?.vertex?.error?.message || undefined,
    });
  }
});

// ====================================================================================
// TEXT TO SPEECH
// ====================================================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = "alloy", format = "mp3" } = req.body;

  console.log("🔊 /audio request:", req.body);

  if (!text) {
    console.error("❌ TTS missing text");
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
    res.send(buffer);

  } catch (err) {
    console.error("❌ TTS error:", err);
    console.error("📛 STACK:", err.stack);
    res.status(500).json({ error: "Failed to synthesize speech." });
  }
});

export default router;
