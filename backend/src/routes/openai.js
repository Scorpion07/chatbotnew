// backend/src/routes/openai.js
import express from "express";
import OpenAI from "openai";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { User, Usage, Conversation, Message } from "../models/index.js";
import { appConfig } from "../services/configService.js";
import { authRequired, premiumRequired } from "../middleware/auth.js";

dotenv.config();

// Router
const router = express.Router();

// Multer for uploads
const upload = multer({ dest: "uploads/" });

// -------------------------------
// OpenAI client (text/audio only)
// -------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables.");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -----------------------------------------------
// Vertex AI (Imagen 2) over REST for image ONLY
// -----------------------------------------------
// Uses GOOGLE_API_KEY (no service account), does not affect Google Sign-In.
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_LOCATION = process.env.GCP_LOCATION || "us-central1";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

function ensureVertexEnv() {
  const missing = [];
  if (!GCP_PROJECT_ID) missing.push("GCP_PROJECT_ID");
  if (!GCP_LOCATION) missing.push("GCP_LOCATION");
  if (!GOOGLE_API_KEY) missing.push("GOOGLE_API_KEY");
  if (missing.length) {
    const msg = `Missing required env: ${missing.join(", ")}`;
    const err = new Error(msg);
    err.code = "ENV_MISSING";
    throw err;
  }
}

/**
 * Call Vertex AI Imagen 2 (imagegeneration@002) via REST.
 * - API Key auth (query param ?key=...)
 * - No service account required
 * - Returns data URL (image/png;base64,...)
 */
async function generateVertexImage(userPrompt, { size = "1024x1024" } = {}) {
  ensureVertexEnv();

  // No image intent filter — always assume prompt is valid

  // Vertex Imagen supports only specific dimensions
  const allowedSizes = new Set([
    "1024x1024",
    "1024x1536",
    "1536x1024",
    "auto",
  ]);
  if (!allowedSizes.has(size)) {
    const err = new Error(
      `Invalid size '${size}'. Allowed: 1024x1024, 1024x1536, 1536x1024, auto`
    );
    err.code = "BAD_SIZE";
    throw err;
  }

  // Try both modern and legacy endpoints to be resilient to regional rollouts.
  const endpoints = [
    // Newer-style endpoint (if enabled on your project/region)
    `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
      GCP_PROJECT_ID
    )}/locations/${encodeURIComponent(
      GCP_LOCATION
    )}/publishers/google/models/imagegeneration@002:generate`,
    // Legacy-style "predictions" endpoint (widely available)
    `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
      GCP_PROJECT_ID
    )}/locations/${encodeURIComponent(
      GCP_LOCATION
    )}/publishers/google/models/imagegeneration@002:predict`,
  ];

  // We’ll try both request shapes (new/legacy) until one succeeds.
  const attempts = [
    // New request body shape (if supported)
    {
      body: {
        // Some regions accept this "prompt + image" style payload:
        prompt: { text: String(userPrompt) },
        image: { size },
        // Optional: add safety/seed/options here if you want
      },
      extractor: async (resJson) => {
        // Try to find base64 in common fields
        // Possible shapes:
        // - { images: [{ b64: "..." }]}
        // - { images: [{ bytesBase64Encoded: "..." }]}
        // - { predictions: [{ bytesBase64Encoded: "..." }]}
        let b64 =
          resJson?.images?.[0]?.b64 ||
          resJson?.images?.[0]?.bytesBase64Encoded ||
          resJson?.predictions?.[0]?.bytesBase64Encoded ||
          null;
        return b64;
      },
    },
    // Legacy request body shape
    {
      body: {
        instances: [{ prompt: String(userPrompt) }],
        parameters: {
          sampleCount: 1,
          imageDimensions: size === "auto" ? "1024x1024" : size,
        },
      },
      extractor: async (resJson) => {
        // Legacy responses typically:
        // { predictions: [{ bytesBase64Encoded: "...", mimeType: "image/png" }] }
        let b64 =
          resJson?.predictions?.[0]?.bytesBase64Encoded ||
          resJson?.images?.[0]?.b64 ||
          null;
        return b64;
      },
    },
  ];

  let lastErr;
  for (const ep of endpoints) {
    for (const attempt of attempts) {
      try {
        const url = `${ep}?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attempt.body),
        });

        const text = await resp.text();
        let json;
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = {};
        }

        if (!resp.ok) {
          const apiMsg =
            json?.error?.message ||
            json?.message ||
            resp.statusText ||
            "Vertex request failed";
          const err = new Error(
            `[${resp.status}] ${apiMsg} (endpoint: ${ep.split(":").pop()})`
          );
          err.status = resp.status;
          throw err;
        }

        const b64 = await attempt.extractor(json);
        if (!b64) {
          const err = new Error("Vertex did not return an image.");
          err.code = "NO_IMAGE";
          throw err;
        }

        return `data:image/png;base64,${b64}`;
      } catch (e) {
        lastErr = e;
        // Try next attempt/endpoint
      }
    }
  }

  // If we reach here, both shapes/endpoints failed.
  throw lastErr || new Error("Vertex image generation failed.");
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
    const userMsg = await Message.create({
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

    const assistantContent = response.choices[0].message.content;

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
    res
      .status(500)
      .json({ error: "Something went wrong while processing chat." });
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

    // Stream from OpenAI
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

    // Increment usage (only after successful response) for non-premium users
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

    // Final done event
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
// 🎙️ AUDIO TRANSCRIPTION ENDPOINT (premium)
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
      // Always delete uploaded file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  }
);

// =====================================================
// 🖼️ IMAGE GENERATION ENDPOINT (Vertex only, premium)
// =====================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  const { prompt, size } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ success: false, error: "Prompt is required." });
  }

  try {
    const dataUrl = await generateVertexImage(prompt, { size });
    return res.json({ success: true, image: dataUrl });
  } catch (err) {
    if (err?.code === "NO_IMAGE_INTENT") {
      return res
        .status(400)
        .json({ success: false, error: "This prompt does not describe an image." });
    }
    if (err?.code === "BAD_SIZE") {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err?.code === "ENV_MISSING") {
      return res.status(500).json({ success: false, error: err.message });
    }
    console.error("❌ Vertex image generation failed:", err);
    // Surface Vertex error status/text if we have it
    const msg =
      err?.message ||
      "Vertex image generation failed. Check GCP project, location, API enablement, and GOOGLE_API_KEY.";
    return res.status(500).json({ success: false, error: msg });
  }
});

// =====================================================
// 🔊 TEXT-TO-SPEECH (TTS) ENDPOINT (premium only)
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
