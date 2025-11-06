import express from "express";
import OpenAI from "openai";
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { User, Usage, Conversation, Message } from "../models/index.js";
import { appConfig } from "../services/configService.js";
import { authRequired, premiumRequired } from "../middleware/auth.js";

dotenv.config();

// ✅ Define router before using it
const router = express.Router();

// ✅ Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// ✅ Initialize OpenAI client if available (don't crash if missing)
const HAS_OPENAI_KEY = !!process.env.OPENAI_API_KEY;
if (!HAS_OPENAI_KEY) {
  console.warn("⚠️ OPENAI_API_KEY is not set. Chat and OpenAI fallbacks will be unavailable.");
}
const openai = HAS_OPENAI_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Optional external provider (PenAPI) passthrough
const PENAPI_BASE = process.env.PENAPI_BASE_URL || '';
const PENAPI_KEY = process.env.PENAPI_KEY || '';
const HAS_GOOGLE_KEY = !!process.env.GOOGLE_API_KEY;
const genAI = HAS_GOOGLE_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
const GEMINI_IMAGE_MODEL = process.env.GOOGLE_IMAGE_MODEL || 'gemini-pro-vision';
const geminiModel = genAI ? genAI.getGenerativeModel({ model: GEMINI_IMAGE_MODEL }) : null;

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
      conv = await Conversation.findOne({ where: { id: conversationId, userId: user.id } });
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else {
      conv = await Conversation.create({ userId: user.id, botName: botName || 'default', title: null });
    }

    // Enforce free-tier limit per user per bot for non-premium users
    if (!user.isPremium) {
      const FREE_LIMIT = (appConfig?.rateLimit?.freeUserLimit) || 5;
      const [usage] = await Usage.findOrCreate({
        where: { userId: user.id, botName: botName || 'default' },
        defaults: { count: 0 }
      });
      if (usage.count >= FREE_LIMIT) {
        return res.status(402).json({ error: `Free limit reached for ${botName || 'this bot'}.` });
      }
    }

    // Persist user message
    const userMsg = await Message.create({
      conversationId: conv.id,
      role: 'user',
      content: message,
      model: null,
      type: 'text',
      botName: botName || 'default'
    });

    // Auto-title conversation on first user message
    if (!conv.title) {
      const title = String(message).trim().slice(0, 60);
      await conv.update({ title: title || `Chat ${conv.id}`, botName: botName || conv.botName });
    }

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI is not configured on the server' });
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    // Increment usage after successful response for non-premium users
    if (!user.isPremium) {
      await Usage.increment(
        { count: 1 },
        { where: { userId: user.id, botName: botName || 'default' } }
      );
      await Usage.update({ lastUsedAt: new Date() }, { where: { userId: user.id, botName: botName || 'default' } });
    }

    const assistantContent = response.choices[0].message.content;
    // Persist assistant message
    await Message.create({
      conversationId: conv.id,
      role: 'assistant',
      content: assistantContent,
      model: 'gpt-4o-mini',
      type: 'text',
      botName: botName || 'default'
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

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    // Ensure conversation exists or create
    let conv = null;
    if (conversationId) {
      conv = await Conversation.findOne({ where: { id: conversationId, userId: user.id } });
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    } else {
      conv = await Conversation.create({ userId: user.id, botName: botName || 'default', title: null });
    }

    // Enforce free-tier limit per user per bot for non-premium users
    if (!user.isPremium) {
      const FREE_LIMIT = (appConfig?.rateLimit?.freeUserLimit) || 5;
      const [usage] = await Usage.findOrCreate({
        where: { userId: user.id, botName: botName || 'default' },
        defaults: { count: 0 }
      });
      if (usage.count >= FREE_LIMIT) {
        return res.status(402).json({ error: `Free limit reached for ${botName || 'this bot'}.` });
      }
    }

    // Persist user message
    await Message.create({
      conversationId: conv.id,
      role: 'user',
      content: message,
      model: null,
      type: 'text',
      botName: botName || 'default'
    });

    // Auto-title conversation on first user message
    if (!conv.title) {
      const title = String(message).trim().slice(0, 60);
      await conv.update({ title: title || `Chat ${conv.id}`, botName: botName || conv.botName });
    }

    // Prepare streaming headers (NDJSON)
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Send a start event
    res.write(JSON.stringify({ type: 'start', conversationId: conv.id }) + "\n");

    // NOTE: For now, route to OpenAI mini model. Future: map botName/provider to specific models.
    if (!openai) {
      res.write(JSON.stringify({ type: 'error', error: 'OpenAI is not configured on the server' }) + "\n");
      return res.end();
    }
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: message }],
      stream: true,
    });

    let full = '';
    for await (const part of stream) {
      const delta = part?.choices?.[0]?.delta?.content || '';
      if (!delta) continue;
      full += delta;
      res.write(JSON.stringify({ type: 'delta', text: delta }) + "\n");
    }

    // Increment usage (only after successful response) for non-premium users
    if (!user.isPremium) {
      await Usage.increment(
        { count: 1 },
        { where: { userId: user.id, botName: botName || 'default' } }
      );
      await Usage.update({ lastUsedAt: new Date() }, { where: { userId: user.id, botName: botName || 'default' } });
    }

    // Persist assistant message
    await Message.create({
      conversationId: conv.id,
      role: 'assistant',
      content: full,
      model: 'gpt-4o-mini',
      type: 'text',
      botName: botName || 'default'
    });

    await conv.update({ updatedAt: new Date() });

    // Final done event
    res.write(JSON.stringify({ type: 'done', response: full, conversationId: conv.id }) + "\n");
    res.end();
  } catch (err) {
    console.error('❌ Streaming chat error:', err);
    try {
      res.write(JSON.stringify({ type: 'error', error: 'Streaming failed' }) + "\n");
    } catch {}
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Streaming failed' });
    }
    try { res.end(); } catch {}
  }
});

// =====================================================
// 🎙️ AUDIO TRANSCRIPTION ENDPOINT
// =====================================================
// Transcription (premium only)
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
    res
      .status(500)
      .json({ error: "Something went wrong while transcribing audio." });
  } finally {
    // ✅ Always delete uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// =====================================================
// 🖼️ IMAGE GENERATION ENDPOINT
// =====================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  let { prompt, size = "512x512", quality = "standard" } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    // Clean up prompt: remove markdown or base64 image text
    prompt = prompt.replace(/!\[.*?\]\(.*?\)/g, "").trim();
    if (prompt === "") {
      prompt = "Generate a creative image inspired by the uploaded photo.";
    }

    // If PenAPI is configured, use it first (simple, minimal link)
    if (PENAPI_BASE) {
      try {
        const r = await fetch(`${PENAPI_BASE.replace(/\/$/, '')}/image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(PENAPI_KEY ? { Authorization: `Bearer ${PENAPI_KEY}` } : {})
          },
          body: JSON.stringify({ prompt, size, quality })
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => '');
          throw new Error(`PenAPI image error: ${r.status} ${txt}`);
        }
        const data = await r.json();
        // Accept flexible shapes: {url} or {b64|base64} or {data:[{url}]}
        const url = data.url || data.imageUrl || data.image_url || (data.data && data.data[0] && data.data[0].url);
        const b64 = data.b64 || data.base64 || (data.data && data.data[0] && (data.data[0].b64 || data.data[0].base64));
        if (url) return res.json({ url });
        if (b64) return res.json({ url: `data:image/png;base64,${b64}` });
        return res.status(500).json({ error: 'PenAPI: unexpected response' });
      } catch (e) {
        console.error('❌ PenAPI image error, falling back to OpenAI:', e.message);
        // fall through to OpenAI fallback
      }
    }

    // Gemini image generation (replace OpenAI fallback)
    if (!geminiModel) {
      return res.status(500).json({ error: 'Gemini is not configured and PenAPI failed/unset.' });
    }
    try {
      // Preferred: SDK method if available
      if (typeof geminiModel.generateImage === 'function') {
        const result = await geminiModel.generateImage({ prompt, size: '1024x1024' });
        const gUrl = result?.data?.[0]?.url || result?.imageUrl;
        const gB64 = result?.data?.[0]?.b64 || result?.data?.[0]?.base64 || result?.b64;
        if (gUrl) return res.json({ url: gUrl });
        if (gB64) return res.json({ url: `data:image/png;base64,${gB64}` });
      }
      // Fallback: REST Images API (broad parsing for schema changes)
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/images:generate?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, n: 1, size: '1024x1024' })
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Gemini Images error: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      const url = data?.url || data?.imageUrl || data?.image_url || data?.images?.[0]?.url || data?.data?.[0]?.url;
      const b64 = data?.b64 || data?.base64 || data?.images?.[0]?.b64 || data?.images?.[0]?.base64 || data?.data?.[0]?.b64 || data?.data?.[0]?.b64_json || data?.candidates?.[0]?.content?.parts?.find(p => p?.inlineData)?.inlineData?.data;
      if (url) return res.json({ url });
      if (b64) return res.json({ url: `data:image/png;base64,${b64}` });
      return res.status(500).json({ error: 'Gemini image generation returned empty response.' });
    } catch (e) {
      console.error('❌ Gemini Image Error:', e);
      return res.status(500).json({ error: 'Gemini image generation failed' });
    }
  } catch (err) {
    if (err.code === "billing_hard_limit_reached") {
      return res.status(402).json({
        error:
          "Your OpenAI account has reached its billing limit. Please add funds or wait for the next billing cycle.",
      });
    }

    console.error("❌ Image generation error:", err);
    res.status(500).json({
      error: "Image generation failed. Please verify your API key or prompt.",
      details: err.message,
    });
  }
});

// =====================================================
// 🔊 TEXT-TO-SPEECH (TTS) ENDPOINT (premium only)
// =====================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = 'alloy', format = 'mp3' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for TTS.' });
  }
  try {
    // If PenAPI is configured, use it first
    if (PENAPI_BASE) {
      try {
        const r = await fetch(`${PENAPI_BASE.replace(/\/$/, '')}/audio/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(PENAPI_KEY ? { Authorization: `Bearer ${PENAPI_KEY}` } : {})
          },
          body: JSON.stringify({ text, voice, format })
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => '');
          throw new Error(`PenAPI TTS error: ${r.status} ${txt}`);
        }
        // Accept either binary stream or JSON with base64
        const contentType = r.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await r.json();
          const b64 = data.audio || data.base64 || data.b64;
          if (!b64) return res.status(500).json({ error: 'PenAPI TTS: no audio base64' });
          const buffer = Buffer.from(b64, 'base64');
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        } else {
          const arrayBuf = await r.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        }
      } catch (e) {
        console.error('❌ PenAPI TTS error, falling back to OpenAI:', e.message);
        // fall through to OpenAI fallback
      }
    }

    // OpenAI fallback (stable)
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI fallback unavailable and PenAPI failed/unset.' });
    }
    const ttsModel = process.env.OPENAI_TTS_MODEL || 'tts-1';
    const tts = await openai.audio.speech.create({
      model: ttsModel,
      voice,
      input: text,
      format,
    });
    const buffer = Buffer.from(await tts.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('❌ TTS error:', err);
    return res.status(500).json({ error: 'Failed to synthesize speech.' });
  }
});

export default router;
