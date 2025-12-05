// backend/src/routes/openai.js
// CLEAN + SAFE + STABLE VERSION WITH ADAPTIVE PROMPT CLEANER

import express from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

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
// OpenAI
// --------------------------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --------------------------------------------------
// Anthropic
// --------------------------------------------------
const anthropic = (process.env.ANTHROPIC_API_KEY && Anthropic)
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// --------------------------------------------------
// Google Gemini
// --------------------------------------------------
const gemini = (process.env.GEMINI_API_KEY && GoogleGenerativeAI)
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// --------------------------------------------------
// Model Mapping
// --------------------------------------------------
const MODEL_MAP = {
  // OpenAI Models - Fully functional with OpenAI API
  "GPT-4o": { provider: "openai", model: "gpt-4o", isPremium: false },
  "GPT-4o mini": { provider: "openai", model: "gpt-4o-mini", isPremium: false },
  "GPT-5.1": { provider: "openai", model: "gpt-4o", isPremium: true }, // Map to gpt-4o until gpt-5 available
  "GPT-5 Turbo": { provider: "openai", model: "gpt-4o", isPremium: true },
  "GPT-4.1": { provider: "openai", model: "gpt-4-turbo", isPremium: false },
  "GPT-4.1 Mini": { provider: "openai", model: "gpt-4o-mini", isPremium: false },
  
  // Anthropic Models - Fully functional with Anthropic API
  "Claude 3.5 Sonnet": { provider: "anthropic", model: "claude-3-5-sonnet-20241022", isPremium: false },
  "Claude 4.5": { provider: "anthropic", model: "claude-sonnet-4-20250514", isPremium: true },
  "Claude 4 Opus": { provider: "anthropic", model: "claude-sonnet-4-20250514", isPremium: true },
  
  // Google Models - Fully functional with Google Gemini API
  "Gemini 1.5 Pro": { provider: "google", model: "gemini-1.5-pro", isPremium: false },
  "Google Gemini 1.5 Pro": { provider: "google", model: "gemini-1.5-pro", isPremium: false },
  "Gemini 2.0": { provider: "google", model: "gemini-1.5-pro", isPremium: true }, // Map to 1.5 pro until 2.0 available
  "Google Gemini 2.0": { provider: "google", model: "gemini-1.5-pro", isPremium: true },
  
  // DeepSeek Models - Fallback to OpenAI (no official API available yet)
  "DeepSeek V3": { provider: "openai", model: "gpt-4o-mini", isPremium: false },
  "DeepSeek RT": { provider: "openai", model: "gpt-4o-mini", isPremium: false },
  
  // Grok Models - Fallback to OpenAI (X API not publicly available yet)
  "Grok-3 Mini": { provider: "openai", model: "gpt-4o-mini", isPremium: false },
  "Grok-4": { provider: "openai", model: "gpt-4o", isPremium: false },
};

function getModelConfig(botName) {
  return MODEL_MAP[botName] || { provider: "openai", model: "gpt-4o-mini" };
}

// --------------------------------------------------
// Vertex AI
// --------------------------------------------------
const VERTEX_LOCATION = "us-central1";
const KEY_PATH = path.resolve(__dirname, "../vertex-key.json");

console.log("🔑 Vertex KEY_PATH =", KEY_PATH);

function loadServiceAccount() {
  console.log("📄 Loading service account...");

  if (!fs.existsSync(KEY_PATH)) {
    console.error("❌ Service account NOT found:", KEY_PATH);
    throw new Error(`Service account key missing at ${KEY_PATH}`);
  }

  const json = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  console.log("✅ Service account loaded (project:", json.project_id, ")");

  if (!json.project_id) {
    throw new Error("project_id missing in vertex-key.json");
  }

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

  if (!token?.token) {
    throw new Error("Failed to obtain Vertex OAuth token");
  }

  console.log("✅ Vertex OAuth token obtained.");
  return token.token;
}

function vertexUrl(projectId) {
  return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/imagegeneration:predict`;
}

// --------------------------------------------------
// ✅ Adaptive Multi-Stage Prompt Cleaner
// --------------------------------------------------
function adaptiveCleanPrompt(prompt) {
  const original = String(prompt || "").trim();
  if (!original) return "a simple cute harmless illustration";

  // Stage 1 — baseline softener
  let cleaned =
    original +
    " (harmless, family-friendly, wholesome, safe, non-graphic, non-violent, neutral)";

  // Stage 2 — pattern sanitization
  cleaned = cleaned.replace(
    /\b(nude|naked|sex|kill|blood|dead|weapon|gore|bloody|violence|gun)\b/gi,
    "cute"
  );

  // Stage 3 — escalate to fully safe rewrite if still unsafe
  if (
    /\b(nude|naked|sex|kill|blood|dead|weapon|gore|bloody|violence|gun)\b/i.test(
      original
    )
  ) {
    cleaned =
      "A wholesome, cute, friendly illustration of an animal or object in soft colors. No people, no body parts, no sensitive themes.";
  }

  return cleaned;
}

function isSafetyBlock(respJson) {
  const msg = respJson?.error?.message || "";
  return /safety filter|prohibited|blocked/i.test(msg);
}

// --------------------------------------------------
// Vertex Predict
// --------------------------------------------------
async function vertexPredict({ prompt, aspectRatio = "1:1" }) {
  console.log("🎨 vertexPredict()");
  console.log("📝 Prompt:", prompt);

  const sa = loadServiceAccount();
  const token = await getVertexToken();
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

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log("📡 Vertex response status:", resp.status);
  const raw = await resp.text();
  console.log("📥 Raw Vertex response text:", raw);
  const json = JSON.parse(raw);

  if (!resp.ok) {
    const err = new Error(json?.error?.message || "Vertex predict failed");
    err.status = resp.status;
    err.vertex = json;
    throw err;
  }

  const pred = json?.predictions?.[0];
  const mime = pred?.mimeType || pred?.mime_type || "image/png";
  const b64 =
    pred?.bytesBase64Encoded || pred?.imageBytes || pred?.image_bytes || null;

  if (!b64) {
    const err = new Error("Vertex returned no image bytes");
    err.status = 502;
    err.vertex = json;
    throw err;
  }

  return `data:${mime};base64,${b64}`;
}

// --------------------------------------------------
// ✅ NEVER-FAIL generateVertexImage()
// --------------------------------------------------
async function generateVertexImage(userPrompt, aspectRatio = "1:1") {
  console.log("🧾 generateVertexImage()", userPrompt);

  if (!userPrompt || typeof userPrompt !== "string") {
    const e = new Error("Prompt is required.");
    e.status = 400;
    throw e;
  }

  // ✅ Stage 1 — adaptive cleaner
  const cleaned = adaptiveCleanPrompt(userPrompt);
  console.log("✨ Cleaned Prompt:", cleaned);

  try {
    return await vertexPredict({ prompt: cleaned, aspectRatio });
  } catch (e) {
    console.error("❌ First attempt failed:", e.message);

    if (e?.vertex && isSafetyBlock(e.vertex)) {
      console.warn("⚠️ SAFETY TRIGGER — trying polite fallback");

      const fallback =
        "A completely safe, simple, cute illustration of an object. Soft pastel colors. No people, no sensitive content.";

      try {
        return await vertexPredict({ prompt: fallback, aspectRatio });
      } catch (e2) {
        console.error("❌ Fallback failed:", e2.message);

        return {
          politeError: true,
          message:
            "Your request required multiple safety adjustments, but the system still blocked it. Please try a simpler description.",
        };
      }
    }

    throw e;
  }
}

// ============================================================================
// CHAT
// ============================================================================
router.post("/chat", authRequired, async (req, res) => {
  try {
    const { message, botName, conversationId } = req.body;

    if (!message)
      return res.status(400).json({ error: "Message is required." });

    const user = req.user;
    
    // Check usage limit for non-premium users
    const FREE_USER_LIMIT = 5;
    if (!user.isPremium) {
      const usage = await Usage.findOne({
        where: { userId: user.id, botName: botName || "default" }
      });
      
      const currentCount = usage?.count || 0;
      if (currentCount >= FREE_USER_LIMIT) {
        return res.status(402).json({ 
          error: "Free query limit reached. Please upgrade to premium.",
          limit: FREE_USER_LIMIT,
          current: currentCount
        });
      }
    }
    
    let conv;

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

    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
    });

    if (!conv.title) {
      await conv.update({ title: message.slice(0, 60) });
    }

    // Get model configuration
    const modelConfig = getModelConfig(botName);
    
    // Check if premium model requires premium user
    if (modelConfig.isPremium && !user.isPremium) {
      return res.status(403).json({ error: "This model requires a premium subscription." });
    }

    let assistant = "";

    // Route to appropriate provider
    if (modelConfig.provider === "anthropic") {
      if (!anthropic) {
        return res.status(500).json({ error: "Anthropic API not configured." });
      }

      const response = await anthropic.messages.create({
        model: modelConfig.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: message }],
      });

      assistant = response.content[0]?.text || "";

    } else if (modelConfig.provider === "google") {
      if (!gemini) {
        return res.status(500).json({ error: "Google Gemini API not configured." });
      }

      const model = gemini.getGenerativeModel({ model: modelConfig.model });
      const result = await model.generateContent(message);
      assistant = result.response.text() || "";

    } else {
      // OpenAI (default)
      const response = await openai.chat.completions.create({
        model: modelConfig.model,
        messages: [{ role: "user", content: message }],
      });

      assistant = response.choices?.[0]?.message?.content || "";
    }

    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: assistant,
    });

    await conv.update({ updatedAt: new Date() });
    
    // Increment usage counter
    const [usage, created] = await Usage.findOrCreate({
      where: { userId: user.id, botName: botName || "default" },
      defaults: { count: 0, lastUsedAt: new Date() }
    });
    
    await usage.update({
      count: usage.count + 1,
      lastUsedAt: new Date()
    });

    res.json({ response: assistant, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat failed." });
  }
});

// ============================================================================
// STREAM
// ============================================================================
router.post("/chat/stream", authRequired, async (req, res) => {
  try {
    const { message, botName, conversationId } = req.body;

    if (!message)
      return res.status(400).json({ error: "Message is required." });

    const user = req.user;
    
    // Check usage limit for non-premium users
    const FREE_USER_LIMIT = 5;
    if (!user.isPremium) {
      const usage = await Usage.findOne({
        where: { userId: user.id, botName: botName || "default" }
      });
      
      const currentCount = usage?.count || 0;
      if (currentCount >= FREE_USER_LIMIT) {
        return res.status(402).json({ 
          error: "Free query limit reached. Please upgrade to premium.",
          limit: FREE_USER_LIMIT,
          current: currentCount
        });
      }
    }
    
    let conv;

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

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    res.write(
      JSON.stringify({ type: "start", conversationId: conv.id }) + "\n"
    );

    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
    });

    if (!conv.title) {
      await conv.update({ title: message.slice(0, 60) });
    }

    // Get model configuration
    const modelConfig = getModelConfig(botName);
    
    // Check if premium model requires premium user
    if (modelConfig.isPremium && !user.isPremium) {
      res.write(
        JSON.stringify({ type: "error", error: "This model requires a premium subscription." }) + "\n"
      );
      res.end();
      return;
    }

    let full = "";

    // Route to appropriate provider
    if (modelConfig.provider === "anthropic") {
      if (!anthropic) {
        res.write(
          JSON.stringify({ type: "error", error: "Anthropic API not configured." }) + "\n"
        );
        res.end();
        return;
      }

      console.log(`🔵 [ANTHROPIC] Streaming with model: ${modelConfig.model}`);
      
      const stream = await anthropic.messages.stream({
        model: modelConfig.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: message }],
      });

      let chunkCount = 0;
      for await (const chunk of stream) {
        chunkCount++;
        console.log(`🔵 [ANTHROPIC] Chunk ${chunkCount}:`, chunk.type, chunk);
        
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          const delta = chunk.delta.text;
          full += delta;
          res.write(JSON.stringify({ type: "delta", text: delta }) + "\n");
          console.log(`🔵 [ANTHROPIC] Sent delta:`, delta.substring(0, 50));
        }
      }
      
      console.log(`🔵 [ANTHROPIC] Stream complete. Total chunks: ${chunkCount}, Full response length: ${full.length}`);

    } else if (modelConfig.provider === "google") {
      if (!gemini) {
        res.write(
          JSON.stringify({ type: "error", error: "Google Gemini API not configured." }) + "\n"
        );
        res.end();
        return;
      }

      const model = gemini.getGenerativeModel({ model: modelConfig.model });
      const result = await model.generateContentStream(message);

      for await (const chunk of result.stream) {
        const delta = chunk.text();
        if (delta) {
          full += delta;
          res.write(JSON.stringify({ type: "delta", text: delta }) + "\n");
        }
      }

    } else {
      // OpenAI (default)
      const stream = await openai.chat.completions.create({
        model: modelConfig.model,
        messages: [{ role: "user", content: message }],
        stream: true,
      });

      for await (const part of stream) {
        const delta = part?.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          res.write(JSON.stringify({ type: "delta", text: delta }) + "\n");
        }
      }
    }

    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: full,
    });
    
    // Increment usage counter
    const [usage, created] = await Usage.findOrCreate({
      where: { userId: user.id, botName: botName || "default" },
      defaults: { count: 0, lastUsedAt: new Date() }
    });
    
    await usage.update({
      count: usage.count + 1,
      lastUsedAt: new Date()
    });

    res.write(JSON.stringify({ type: "done", response: full }) + "\n");
    res.end();
  } catch (err) {
    console.error("❌ Streaming error:", err);
    console.error("❌ Error stack:", err.stack);
    console.error("❌ Error details:", JSON.stringify(err, null, 2));
    try {
      res.write(
        JSON.stringify({ type: "error", error: "Streaming failed: " + err.message }) + "\n"
      );
    } catch (_) {}
    res.end();
  }
});

// ============================================================================
// TRANSCRIBE
// ============================================================================
router.post(
  "/transcribe",
  authRequired,
  premiumRequired,
  upload.single("audio"),
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "Audio file is required." });

    try {
      // Read file and create blob for OpenAI
      const fileBuffer = fs.readFileSync(req.file.path);
      const audioFile = new File([fileBuffer], req.file.originalname, { type: req.file.mimetype });
      
      const result = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });

      res.json({ transcript: result.text });
    } catch (err) {
      console.error("❌ Transcription error:", err.message, err);
      res.status(500).json({ error: "Transcription failed: " + err.message });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.warn("⚠️ Failed to delete temp audio file:", e);
        }
      }
    }
  }
);

// ============================================================================
// IMAGE (VERTEX)
// ============================================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  const { prompt, ratio } = req.body;

  try {
    const aspectRatio = ratio || "1:1";
    const data = await generateVertexImage(prompt, aspectRatio);

    res.json({ success: true, image: data });
  } catch (err) {
    console.error("❌ Image generation error:", err);
    res.status(err?.status || 500).json({
      success: false,
      error: err.message,
      details: err?.vertex?.error?.message,
    });
  }
});

// ============================================================================
// TTS
// ============================================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text, voice = "alloy", format = "mp3" } = req.body;

  if (!text)
    return res.status(400).json({ error: "Text is required for TTS." });

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
    res.status(500).json({ error: "Failed to synthesize speech." });
  }
});

export default router;
