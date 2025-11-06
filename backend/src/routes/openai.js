import express from "express";
import OpenAI from "openai";
import axios from "axios";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { User, Usage, Conversation, Message } from "../models/index.js";
import { appConfig, apiKeys } from "../services/configService.js";
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

    // Prefer Stability if key is configured
    if (apiKeys.stability) {
      const endpoint = "https://api.stability.ai/v2beta/stable-image/generate/core";
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("output_format", "png");
      // Optionally hint size via aspect ratio; default to 1:1
      const aspect = size === '1024x1024' || size === '512x512' ? '1:1' : (size === '1024x576' ? '16:9' : '1:1');
      form.append("aspect_ratio", aspect);

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKeys.stability}`,
          'Accept': 'image/*'
        },
        body: form
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error('Stability image error:', resp.status, text);
        return res.status(500).json({ error: 'Stability image generation failed', details: text });
      }
      const arrayBuf = await resp.arrayBuffer();
      const b64 = Buffer.from(arrayBuf).toString('base64');
      return res.json({ url: `data:image/png;base64,${b64}` });
    }

    // Fallback to OpenAI if Stability not configured
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      quality,
      response_format: 'b64_json'
    });

    const b64 = response?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({ error: 'Image generation failed: empty response.' });
    }
    const dataUrl = `data:image/png;base64,${b64}`;
    res.json({ url: dataUrl });
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
  try {
    const { text, format = 'mp3' } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for audio generation.' });
    }

    const wantsJson = (req.headers.accept || '').includes('application/json') || String(req.query.base64 || '') === '1';

    // Primary: OpenAI TTS (gpt-4o-mini-tts)
    try {
      const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const audio = await oai.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: text,
        format: 'mp3'
      });
      const buffer = Buffer.from(await audio.arrayBuffer());

      if (wantsJson) {
        return res.json({ success: true, provider: 'openai', audio: buffer.toString('base64') });
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error('OpenAI audio failed, trying Gemini...', err?.response?.data || err?.message || err);
    }

    // Fallback: Gemini audio (gemini-2.0-flash) with response_mime_type=audio/wav
    try {
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          contents: [{ parts: [{ text }] }],
          generationConfig: { response_mime_type: 'audio/wav' }
        },
        {
          params: { key: process.env.GOOGLE_API_KEY },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      // API may return base64 audio data in a part; honor the provided structure
      const part = response.data?.candidates?.[0]?.content?.parts?.[0];
      const audioB64 = typeof part === 'string' ? part : (part?.audio || part?.inline_data?.data || null);
      if (!audioB64) throw new Error('No audio from Gemini');

      if (wantsJson) {
        return res.json({ success: true, provider: 'gemini', audio: audioB64 });
      }
      const buffer = Buffer.from(audioB64, 'base64');
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error('Gemini audio error:', err?.response?.data || err?.message || err);
      return res.status(500).json({ error: 'Audio generation failed.', details: err?.response?.data || err?.message || err });
    }
  } catch (err) {
    console.error('Audio route failed:', err);
    return res.status(500).json({ error: 'Fatal audio error' });
  }
});

export default router;
