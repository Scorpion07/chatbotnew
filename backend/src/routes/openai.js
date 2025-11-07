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

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// --------------------------
// OpenAI for text / tts
// --------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --------------------------
// Vertex AI config
// --------------------------
const VERTEX_LOCATION = "us-central1";

// ✅ FIXED ABSOLUTE PATH (correct location)
const VERTEX_KEY_PATH = path.resolve(__dirname, "../../vertex-key.json");

// ✅ Read project_id from service account key
function getServiceAccountProjectId() {
  try {
    const raw = fs.readFileSync(VERTEX_KEY_PATH, "utf8");
    const json = JSON.parse(raw);
    if (!json.project_id) throw new Error("Missing project_id in service account");
    return json.project_id;
  } catch (e) {
    throw new Error(
      `Service account key invalid or missing at ${VERTEX_KEY_PATH} → ${e.message}`
    );
  }
}

// ✅ Obtain OAuth2 Access Token from service account
async function getVertexAccessToken() {
  const auth = new GoogleAuth({
    keyFile: VERTEX_KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) throw new Error("Failed to obtain Vertex access token");
  return token.token;
}

// ✅ Main Vertex image generator
async function generateVertexImage(userPrompt) {
  if (!userPrompt) {
    const err = new Error("Prompt required");
    err.status = 400;
    throw err;
  }

  const projectId = getServiceAccountProjectId();
  const accessToken = await getVertexAccessToken();

  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/imagegeneration@002:predict`;

  const body = {
    instances: [
      {
        prompt: userPrompt
      }
    ],
    parameters: {
      sampleCount: 1,
      sampleImageSize: "1024x1024"
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
    const msg =
      json?.error?.message ||
      json?.message ||
      `${resp.status} ${resp.statusText}`;

    const err = new Error(`Vertex predict failed: ${msg}`);
    err.status = resp.status;
    throw err;
  }

  const pred = json?.predictions?.[0];
  if (!pred) throw new Error("Vertex returned no predictions");

  const imageBytes =
    pred.bytesBase64Encoded ||
    pred.imageBytes ||
    null;

  if (!imageBytes) throw new Error("Vertex returned no image data");

  const mime = pred.mimeType || "image/png";

  return `data:${mime};base64,${imageBytes}`;
}

// ----------------------------
// CHAT (text)
// ----------------------------
router.post("/chat", authRequired, async (req, res) => {
  try {
    const { message, botName, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const user = req.user;

    let conv = null;
    if (conversationId) {
      conv = await Conversation.findOne({
        where: { id: conversationId, userId: user.id }
      });
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
        return res.status(402).json({
          error: `Free limit reached for ${botName || "this bot"}.`
        });
      }
    }

    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
      type: "text"
    });

    if (!conv.title) {
      await conv.update({
        title: message.slice(0, 60),
        botName: botName || conv.botName
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    const answer = response.choices?.[0]?.message?.content || "";

    if (!user.isPremium) {
      await Usage.increment(
        { count: 1 },
        { where: { userId: user.id, botName: botName || "default" } }
      );
    }

    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: answer,
      type: "text"
    });

    await conv.update({ updatedAt: new Date() });

    return res.json({ response: answer, conversationId: conv.id });

  } catch (err) {
    console.error("❌ Chat error:", err);
    return res.status(500).json({ error: "Chat failed" });
  }
});

// ----------------------------
// IMAGE GENERATION (Vertex)
// ----------------------------
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ success: false, error: "Prompt required" });

    const img = await generateVertexImage(prompt);
    return res.json({ success: true, image: img });
  } catch (err) {
    console.error("❌ Vertex image generation failed:", err);
    return res
      .status(err?.status || 500)
      .json({ success: false, error: err.message });
  }
});

// ----------------------------
// TTS
// ----------------------------
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
      format: "mp3",
    });

    const buffer = Buffer.from(await tts.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error("❌ TTS error:", err);
    return res.status(500).json({ error: "TTS failed" });
  }
});

export default router;
