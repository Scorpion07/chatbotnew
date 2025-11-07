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

// ---------------------------------------------
// Router & uploads
// ---------------------------------------------
const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ---------------------------------------------
// OpenAI (text + tts) — unchanged
// ---------------------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables.");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------
// Vertex AI Image Generation via Service Account
// ---------------------------------------------
// Required:
//   - Service account JSON at backend/vertex-key.json
//   - Project ID from your file: gen-lang-client-0109618220
//   - Location: us-central1
//
// We authenticate with OAuth2 access token from the service account and
// call the public publisher model predict endpoint.
//
// Endpoint:
//   POST https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/us-central1/publishers/google/models/imagegeneration@002:predict
//
// Body:
// {
//   "instances": [{ "prompt": "a dog wearing sunglasses" }],
//   "parameters": {
//     "sampleCount": 1,
//     "sampleImageSize": "1024x1024"
//   }
// }
const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";
const VERTEX_KEY_PATH = path.resolve(process.cwd(), "backend/vertex-key.json");

// We’ll read the project_id from the key file so you don’t have to set envs
function getServiceAccountProjectId() {
  try {
    const raw = fs.readFileSync(VERTEX_KEY_PATH, "utf8");
    const json = JSON.parse(raw);
    if (!json.project_id) throw new Error("project_id missing in service account key");
    return json.project_id;
  } catch (e) {
    throw new Error(
      `Service account key not found or invalid at ${VERTEX_KEY_PATH} (${e.message})`
    );
  }
}

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

// Returns a data URL: data:image/png;base64,....
async function generateVertexImage(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") {
    const err = new Error("Prompt is required.");
    err.status = 400;
    throw err;
  }

  // Don’t gate on “image intent” keywords—let the model decide.
  const projectId = getServiceAccountProjectId();
  const accessToken = await getVertexAccessToken();

  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/imagegeneration@002:predict`;

  const body = {
    instances: [
      {
        prompt: userPrompt,
        // You can add more fields like "aspectRatio" in new models. For @002 keep it simple.
      },
    ],
    parameters: {
      sampleCount: 1,
      sampleImageSize: "1024x1024",
      // Optional: add safety/seed/guidance as needed
      // guidanceStrength: 7,
      // seed: 0
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
    const detail =
      json?.error?.message ||
      json?.message ||
      `${resp.status} ${resp.statusText}`;
    const err = new Error(`Vertex predict failed: ${detail}`);
    err.status = resp.status;
    err.vertex = json;
    throw err;
  }

  // Response shape typically:
  // {
  //   "predictions": [
  //     {
  //       "bytesBase64Encoded": "iVBORw0KGgoAAA....",
  //       "mimeType": "image/png"
  //     }
  //   ]
  // }
  const pred = Array.isArray(json?.predictions) ? json.predictions[0] : null;
  const b64 =
    pred?.bytesBase64Encoded ||
    pred?.imageBytes || // just in case other shape
    null;

  const mime =
    pred?.mimeType ||
    "image/png";

  if (!b64) {
    throw new Error("Vertex returned no image data.");
  }

  return `data:${mime};base64,${b64}`;
}

// =====================================================
// 🧠 TEXT CHAT ENDPOINT (with auth and free-tier limit)
// =====================================================
router.post("/chat", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    // Ensure conversation exists or create a new one if not provided
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

    // Enforce free-tier limit per user per bot for non-premium users
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

    // Auto-title conversation on first user message
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

    // Increment usage after successful response for non-premium users
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

    // Touch conversation updatedAt
    await conv.update({ updatedAt: new Date() });

    res.json({ response: assistantContent, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Something went wrong while processing chat." });
  }
});

// =====================================================
// 📝 STREAMING CHAT (chunked NDJSON over HTTP POST)
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

    // Enforce free-tier limit per user per bot for non-premium users
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

    // Auto-title conversation on first user message
    if (!conv.title) {
      const title = String(message).trim().slice(0, 60);
      await conv.update({
        title: title || `Chat ${conv.id}`,
        botName: botName || conv.botName,
      });
    }

    // Prepare streaming headers (NDJSON)
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // Send a start event
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

    res.write(
      JSON.stringify({ type: "done", response: full, conversationId: conv.id }) +
        "\n"
    );
    res.end();
  } catch (err) {
    console.error("❌ Streaming chat error:", err);
    try {
      res.write(JSON.stringify({ type: "error", error: "Streaming failed" }) + "\n");
    } catch {}
    if (!res.headersSent) {
      return res.status(500).json({ error: "Streaming failed" });
    }
    try {
      res.end();
    } catch {}
  }
});

// =====================================================
// 🎙️ AUDIO TRANSCRIPTION (premium)
// =====================================================
router.post(
  "/transcribe",
  authRequired,
  premiumRequired,
  upload.single("audio"),
  async (req, res) => {
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
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  }
);

// =====================================================
// 🖼️ IMAGE GENERATION (Vertex) (premium)
// =====================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ success: false, error: "Prompt is required." });
    }

    const dataUrl = await generateVertexImage(prompt);
    return res.json({ success: true, image: dataUrl });
  } catch (err) {
    const status = err?.status || 500;
    console.error("❌ Vertex image generation failed:", err);
    return res
      .status(status)
      .json({ success: false, error: err.message || "Vertex image generation failed" });
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
