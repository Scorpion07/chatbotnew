import express from "express";
import OpenAI from "openai";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import { User, Usage, Conversation, Message } from "../models/index.js";
import { authRequired, premiumRequired } from "../middleware/auth.js";
import { GoogleAuth } from "google-auth-library";

dotenv.config();

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// -------------------------------------------------
// ✅ OpenAI (text + audio)
// -------------------------------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -------------------------------------------------
// ✅ Vertex AI Setup (safe, no crash)
// -------------------------------------------------
const PROJECT = process.env.GCP_PROJECT_ID;
const LOCATION = "us-central1";
const KEY_PATH = "/home/saxenadevansh703/chatbotnew/backend/vertex-key.json";

if (!fs.existsSync(KEY_PATH)) {
  console.error("❌ Missing service account key:", KEY_PATH);
}

// Create auth instance but DO NOT call it yet
const vertexAuth = new GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

// -------------------------------------------------
// ✅ Vertex Image Generation Function (final)
// -------------------------------------------------
async function generateVertexImage(prompt) {
  if (!prompt) throw new Error("Prompt missing");

  const isImageIntent = /(image|picture|art|photo|logo|design|draw)/i.test(prompt);
  if (!isImageIntent) {
    const err = new Error("This prompt does not describe an image.");
    err.code = "NO_IMAGE_INTENT";
    throw err;
  }

  // Auth client created **inside** function (safe)
  const client = await vertexAuth.getClient();

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/imagegeneration@002:predict`;

  const payload = {
    prompt,
    negativePrompt: "",
    parameters: { sampleCount: 1 }
  };

  const response = await client.request({
    url,
    method: "POST",
    data: payload,
  });

  const base64 = response?.data?.predictions?.[0]?.bytesBase64Encoded;
  if (!base64) throw new Error("Vertex returned no image");

  return `data:image/png;base64,${base64}`;
}

// -------------------------------------------------
// ✅ TEXT CHAT
// -------------------------------------------------
router.post("/chat", authRequired, async (req, res) => {
  const { message } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }]
    });
    res.json({ response: response.choices[0].message.content });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// -------------------------------------------------
// ✅ AUDIO (TTS)
// -------------------------------------------------
router.post("/audio", authRequired, premiumRequired, async (req, res) => {
  const { text } = req.body;
  try {
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

// -------------------------------------------------
// ✅ IMAGE GENERATION (Vertex)
// -------------------------------------------------
router.post("/image", authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: "Prompt required" });
    }

    const img = await generateVertexImage(prompt);
    res.json({ success: true, image: img });

  } catch (err) {
    console.error("❌ Image error:", err);

    if (err.code === "NO_IMAGE_INTENT") {
      return res.status(400).json({ success: false, error: "This prompt does not describe an image." });
    }

    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
