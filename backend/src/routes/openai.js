import express from "express";
import OpenAI from "openai";
import Replicate from "replicate";
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

// ✅ Validate API key
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in environment variables.");
  process.exit(1);
}

// ✅ Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Replicate client for FLUX image generation
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN || '' });

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
  let { prompt } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    // Clean up prompt: remove markdown or base64 image text
    prompt = String(prompt).replace(/!\[.*?\]\(.*?\)/g, "").trim();
    if (prompt === "") {
      prompt = "Generate a creative image inspired by the uploaded photo.";
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('❌ Flux image generation failed: missing REPLICATE_API_TOKEN');
      return res.status(500).json({ error: 'Flux image generation failed' });
    }

    // Log clear usage of FLUX via Replicate
    console.log('🖼️  Using FLUX via Replicate: model=black-forest-labs/flux-schnell');

    const output = await replicate.run(
      'black-forest-labs/flux-schnell',
      { input: { prompt } }
    );

    let url = null;
    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
      url = output[0];
    } else if (output && typeof output === 'object') {
      url = output.url || output.image || null;
    }

    if (!url) {
      console.error('❌ Flux image generation failed: unexpected output');
      return res.status(500).json({ error: 'Flux image generation failed' });
    }

    return res.json({ url });
  } catch (err) {
    console.error('❌ Flux image generation failed:', err);
    return res.status(500).json({ error: 'Flux image generation failed' });
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
    const tts = await openai.audio.speech.create({
      model: 'tts-1',
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
