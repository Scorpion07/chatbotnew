import express from 'express';
import Replicate from 'replicate';
import { authRequired, premiumRequired } from '../middleware/auth.js';

const router = express.Router();

// Initialize Replicate client from env
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN || '' });

/**
 * Generate an image with Black Forest Labs FLUX 1.1 Pro on Replicate
 * @param {string} prompt - Text prompt to generate from
 * @param {string} size - e.g., "1024x1024"
 * @returns {Promise<string>} URL of the generated image
 */
export async function generateFluxImage(prompt, size = '1024x1024') {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('Missing REPLICATE_API_TOKEN');
  }
  // Log usage clearly
  console.log(`🖼️  Using FLUX via Replicate: model=black-forest-labs/flux-1.1-pro size=${size}`);

  // Replicate SDK: run returns the prediction output directly
  let output;
  try {
    const out = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          guidance_scale: 3.0,
          num_inference_steps: 28,
          num_outputs: 1,
          seed: null
        }
      }
    );
    output = out;
  } catch (error) {
    // Additional requested error logs
    if (error.response) {
      try {
        const text = await error.response.text();
        console.error("🔥 FLUX ERROR RAW TEXT:", text);
      } catch (_) {}
    }
    console.error("🔥 FLUX ERROR OBJECT:", error);

    if (error.response) {
      let errJson = null;
      try {
        errJson = await error.response.json();
      } catch (_) {}

      console.error("🔥 FLUX API ERROR JSON:", errJson);
      console.error("🔥 FLUX RAW ERROR:", error);
      throw new Error('Flux failed');
    } else {
      console.error("🔥 FLUX UNKNOWN ERROR:", error);
      throw new Error(error.message);
    }
  }

  // Log final image URL when available
  if (Array.isArray(output) && output[0]) {
    console.log("✅ Flux image:", output[0]);
  }

  // Output is typically an array of URLs; return first string URL
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
    return output[0];
  }
  // Some models may return an object with .image or .url
  if (output && typeof output === 'object') {
    if (output.image) return output.image;
    if (output.url) return output.url;
  }

  throw new Error('Unexpected Replicate output format');
}

// POST /api/ai/flux-image
// Body: { prompt: string, size?: string }
router.post('/flux-image', authRequired, premiumRequired, async (req, res) => {
  try {
    const { prompt, size = '1024x1024' } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, message: 'Flux error', error: 'Prompt is required' });
    }

    const url = await generateFluxImage(prompt, size);
    return res.json({ success: true, url });
  } catch (error) {
    console.error('❌ Flux error:', error);
    return res.status(500).json({ success: false, message: 'Flux error', error: String(error?.message || error) });
  }
});

export default router;
