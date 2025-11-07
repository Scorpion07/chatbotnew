import express from "express";
import OpenAI from "openai";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import { User, Usage, Conversation, Message } from "../models/index.js";
import { authRequired, premiumRequired } from "../middleware/auth.js";
import { GoogleAuth } from "google-auth-library";
import axios from "axios";

dotenv.config();

const router = express.Router();

// Multer for uploads
const upload = multer({ dest: "uploads/" });

// ---------------------------------------------
// ✅ OpenAI (text + audio) — unaffected
// ---------------------------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------------------------------------
// ✅ Vertex AI setup (Service Account Only)
// ---------------------------------------------
const PROJECT = process.env.GCP_PROJECT_ID;
const LOCATION = "us-central1";

// ✅ ABSOLUTE PATH to service account JSON
const KEY_PATH = "/home/saxenadevansh703/chatbotnew/backend/vertex-key.json";

if (!fs.existsSync(KEY_PATH)) {
  console.error("❌ Vertex key missing:", KEY_PATH);
  process.exit(1);
}

const auth = new GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

// ---------------------------------------------
// ✅ Vertex Image Generation (FINAL, WORKING)
// ---------------------------------------------
async function generateVertexImage(prompt) {
  if (!prompt) throw new Error("Prompt missing");

  // Basic safety: ensure user is requesting an image
  const isImage = /(image|picture|photo|art|draw|logo|design|illustration)/i.test(prompt);
  if (!isImage) {
    const err = new Error("This prompt does not describe an image.");
    err.code = "NO_IMAGE_INTENT";
    throw err;
  }

  const client = await auth.getClient();

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/imagegeneration@002:predict`;

  const body = {
    prompt,
    negativePrompt: "",
    parameters: { sampleCount: 1 },
  };

  const response = await client.request({
    url,
    method: "POST",
    data: body,
  });

  const data = response.data;

  if (!data?.predictions?.[0]?.bytesBase64Encoded) {
    throw new Error("Vertex returned no image");
  }

  const base64 = data.predictions[0].bytesBase64Encoded;

  return `data:image/png;base64,${base64}`;
}

// =====================================================================
// ✅ CHAT ENDPOINT
// =====================================================================
router.post("/chat", authRequired, async (req, res) => {
  const { message, botName, conversationId } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const user = req.user;

    let conv;
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
    });

    const reply = response.choices[0].message.content;

    await Message.create({
      conversationId: conv.id,
      role: "assistant",
      content: reply,
    });

    res.json({ response: reply, conversationId: conv.id });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// =====================================================================
// ✅ TTS AUDIO
// =====================================================================
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
      format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (err) {
    console.error("❌ TTS error:", err);
    res.status(500).json({ error: "TTS failed" });
  }
});

// =====================================================================
// ✅ IMAGE GENERATION (Vertex)
// =====================================================================
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: "Prompt required" });

    const img = await generateVertexImage(prompt);

    res.json({ success: true, image: img });
  } catch (err) {
    console.error("❌ Vertex Image Error:", err);

    if (err.code === "NO_IMAGE_INTENT") {
      return res.status(400).json({
        success: false,
        error: "This prompt does not describe an image.",
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message || "Image generation failed",
    });
  }
});

export default router;
