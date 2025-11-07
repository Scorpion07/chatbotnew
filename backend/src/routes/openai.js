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

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ---------------------------------------------
// OpenAI text + audio
// ---------------------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------
// Vertex AI — Imagen 4
// Uses: publishers/google/models/imagen-4.0:predict
// ---------------------------------------------
const VERTEX_LOCATION = "us-central1";
const VERTEX_KEY_PATH = path.resolve(process.cwd(), "backend/vertex-key.json");

function loadServiceAccount() {
  if (!fs.existsSync(VERTEX_KEY_PATH)) {
    throw new Error(
      `Service account key missing at ${VERTEX_KEY_PATH}`
    );
  }
  return JSON.parse(fs.readFileSync(VERTEX_KEY_PATH, "utf8"));
}

async function getAccessToken() {
  const auth = new GoogleAuth({
    keyFile: VERTEX_KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) throw new Error("Failed to get Vertex access token");
  return token.token;
}

// ✅ Imagen 4 — Generate image
async function generateImagen4(prompt, aspectRatio = "1:1") {
  const sa = loadServiceAccount();
  const projectId = sa.project_id;
  const token = await getAccessToken();

  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/imagen-4.0:predict`;

  const body = {
    instances: [
      {
        prompt,
        aspectRatio
      }
    ],
    parameters: {
      quality: "high"
    }
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const json = await resp.json();

  if (!resp.ok) {
    const msg = json?.error?.message || `${resp.status} ${resp.statusText}`;
    const err = new Error(`Vertex predict failed: ${msg}`);
    err.status = resp.status;
    throw err;
  }

  // Imagen 4 returns:
  // predictions[0].bytesBase64Encoded
  const pred = json?.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded;

  if (!b64) throw new Error("Imagen 4 returned no image data");

  return `data:image/png;base64,${b64}`;
}

// ------------------------------------------------------
// TEXT CHAT — unchanged
// ------------------------------------------------------
router.post("/chat", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body;

  if (!message)
    return res.status(400).json({ error: "Message is required." });

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
      const title = message.slice(0, 60);
      await conv.update({
        title: title || `Chat ${conv.id}`,
        botName: botName || conv.botName,
      });
    }

    const reply = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    const content = reply.choices?.[0]?.message?.content || "";

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
      content,
      model: "gpt-4o-mini",
      type: "text",
      botName: botName || "default",
    });

    await conv.update({ updatedAt: new Date() });

    res.json({ response: content, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res
      .status(500)
      .json({ error: "Something went wrong while processing chat." });
  }
});

// ------------------------------------------------------
// IMAGE GENERATION (Vertex) — PREMIUM ONLY
// ------------------------------------------------------
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt, aspect = "1:1" } = req.body;
    if (!prompt)
      return res.status(400).json({ success: false, error: "Prompt required" });

    const dataUrl = await generateImagen4(prompt, aspect);

    return res.json({ success: true, image: dataUrl });
  } catch (err) {
    console.error("❌ Vertex image generation failed:", err);
    res
      .status(err.status || 500)
      .json({ success: false, error: err.message });
  }
});

// ------------------------------------------------------
// AUDIO TTS — unchanged
// ------------------------------------------------------
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = "alloy", format = "mp3" } = req.body || {};
  if (!text)
    return res.status(400).json({ error: "Text required for TTS." });

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
    res.status(500).json({ error: "Failed to synthesize speech." });
  }
});

export default router;
