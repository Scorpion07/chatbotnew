// backend/src/routes/openai.js
// FULL UPDATED FILE WITH ADAPTIVE MULTI-STAGE PROMPT CLEANER + POLITE FALLBACK

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
// OpenAI
// --------------------------------------------------
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// --------------------------------------------------
// ✅ Adaptive multi-stage prompt cleaner
// --------------------------------------------------
function adaptiveCleanPrompt(prompt) {
  const original = String(prompt || "").trim();
  if (!original) return "a simple harmless illustration";

  // Stage 1: Base softening
  let cleaned = original +
    " (harmless, family-friendly, safe, non-violent, non-graphic, neutral)";

  // Stage 2: Remove banned patterns if any (generic)
  cleaned = cleaned.replace(/\b(nude|kill|blood|dead|weapon|sex)\b/gi, "cute");

  // Stage 3: Hard rewrite if prompt still too risky
  if (/\b(nude|kill|blood|dead|weapon|sex)\b/i.test(original)) {
    cleaned = `A wholesome, cute, friendly illustration of an animal or object. Soft colors, safe content.`;
  }

  return cleaned;
}

// --------------------------------------------------
// Safety block detection
// --------------------------------------------------
function isSafetyBlock(respJson) {
  const msg = respJson?.error?.message || "";
  return /safety filter|prohibited/i.test(msg);
}

// --------------------------------------------------
// Vertex Predict
// --------------------------------------------------
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
  const mime = pred?.mimeType || pred?.mime_type || "image/png";
  const b64 = pred?.bytesBase64Encoded || pred?.imageBytes || pred?.image_bytes;

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

// --------------------------------------------------
// ✅ generateVertexImage with adaptive cleaning + polite fallback
// --------------------------------------------------
async function generateVertexImage(userPrompt, aspectRatio = "1:1") {
  console.log("🎨 generateVertexImage()");
  console.log("🧾 User Prompt:", userPrompt);

  if (!userPrompt || typeof userPrompt !== "string") {
    const e = new Error("Prompt is required.");
    e.status = 400;
    throw e;
  }

  // Stage 1: adaptive cleaner
  const cleaned = adaptiveCleanPrompt(userPrompt);
  console.log("✨ Cleaned Prompt:", cleaned);

  try {
    return await vertexPredict({ prompt: cleaned, aspectRatio });
  } catch (e) {
    console.error("❌ First attempt failed:", e.message);

    if (e?.vertex && isSafetyBlock(e.vertex)) {
      console.warn("⚠️ SAFETY FILTER — attempting polite fallback");

      const fallback =
        `A completely safe, friendly, simple illustration (soft colors, cute style). ` +
        `Original request was rewritten for safety.`;

      console.log("✨ Polite fallback prompt:", fallback);

      try {
        return await vertexPredict({ prompt: fallback, aspectRatio });
      } catch (e2) {
        console.error("❌ Fallback failed too:", e2.message);
        return {
          politeError: true,
          message:
            "Your request was adjusted for safety, but the system still blocked it. Please try a simpler description.",
        };
      }
    }

    throw e;
  }
}

// ============================================================================
// CHAT ENDPOINTS (unchanged logic)
// ============================================================================

// --- Standard Chat ---
router.post("/chat", authRequired, async (req, res) => {
  try {
    const { message, botName, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required." });

    const user = req.user;
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

    await Message.create({
      conversationId: conv.id,
      role: "user",
      content: message,
    });

    if (!conv.title) {
      await conv.update({ title: message.slice(0, 60) });
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
    });

    await conv.update({ updatedAt: new Date() });

    res.json({ response: assistantContent, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat failed." });
  }
});

// --- Streaming Chat ---
router.post("/chat/stream", authRequired, async (req, res) => {
  try {
    const { message, botName, conversationId } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required." });

    const user = req.user;
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

    res.setHeader("Content-Type", "application/x-ndjson");
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
    });

    res.write(JSON.stringify({ type: "done", response: full }) + "\n");
    res.end();
  } catch (err) {
    console.error("❌ Stream error:", err);
    try { res.write(JSON.stringify({ type: "error", error: "Streaming failed" }) + "\n"");}
