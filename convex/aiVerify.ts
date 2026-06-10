"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";

/**
 * AI verification action.
 * Called by the `report` mutation via scheduler after a manual report is submitted.
 *
 * Flow:
 *  1. Fetch the signed URL for the uploaded image from Convex storage.
 *  2. Download the image bytes and base64-encode them.
 *  3. Call Gemini 2.0 Flash with a structured JSON prompt.
 *  4. Parse the response and write results back via `internal.potholes.applyAiResult`.
 */
export const verifyImage = internalAction({
  args: {
    potholeId: v.id("potholes"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // ── 1. Get signed URL ──────────────────────────────────────────────
    const imageUrl: string | null = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) {
      console.error("[aiVerify] Storage URL not found for", args.storageId);
      await ctx.runMutation(internal.potholes.applyAiResult, {
        potholeId: args.potholeId,
        aiVerified: false,
        aiDescription: "Image could not be retrieved from storage.",
        aiDepthEstimate: null,
        aiSeverityConfidence: null,
      });
      return;
    }

    // ── 2. Fetch image bytes ───────────────────────────────────────────
    let imageBase64: string;
    let mimeType: string;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString("base64");
      mimeType = response.headers.get("content-type") || "image/jpeg";
    } catch (err: any) {
      console.error("[aiVerify] Failed to fetch image:", err);
      await ctx.runMutation(internal.potholes.applyAiResult, {
        potholeId: args.potholeId,
        aiVerified: false,
        aiDescription: "Image download failed — cannot verify.",
        aiDepthEstimate: null,
        aiSeverityConfidence: null,
      });
      return;
    }

    // ── 3. Call Gemini Vision ──────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in Convex environment.");

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert road-safety AI inspector. Analyse the image and respond ONLY with a valid JSON object — no markdown, no extra text.

JSON schema:
{
  "isPothole": boolean,           // true if the image clearly shows a pothole / road damage
  "confidence": number,           // 0–100, how confident you are
  "depthEstimate": string | null, // estimated depth range, e.g. "3–5 cm", "10–15 cm"; null if not a pothole
  "severityConfidence": string | null, // e.g. "low (70%)", "medium (85%)", "high (92%)"; null if not a pothole
  "description": string           // 1–2 sentence human-readable summary
}

Rules:
- If the image does NOT contain a visible pothole or road surface damage, set isPothole=false.
- Base depthEstimate on visual cues like shadow depth, surrounding road surface context, and object size references.
- Be conservative: if uncertain, lean toward a shallower depth estimate.`;

    let result: {
      isPothole: boolean;
      confidence: number;
      depthEstimate: string | null;
      severityConfidence: string | null;
      description: string;
    };

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: prompt },
            ],
          },
        ],
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      // Strip any markdown code fences if Gemini wraps the JSON
      const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      result = JSON.parse(cleaned);
    } catch (err: any) {
      console.error("[aiVerify] Gemini error or JSON parse failure:", err);
      await ctx.runMutation(internal.potholes.applyAiResult, {
        potholeId: args.potholeId,
        aiVerified: false,
        aiDescription: "AI analysis failed — please review manually.",
        aiDepthEstimate: null,
        aiSeverityConfidence: null,
      });
      return;
    }

    // ── 4. Write results back ─────────────────────────────────────────
    await ctx.runMutation(internal.potholes.applyAiResult, {
      potholeId: args.potholeId,
      aiVerified: result.isPothole,
      aiDescription: result.description,
      aiDepthEstimate: result.depthEstimate ?? null,
      aiSeverityConfidence: result.severityConfidence ?? null,
    });

    console.log(
      `[aiVerify] potholeId=${args.potholeId} isPothole=${result.isPothole} depth=${result.depthEstimate}`
    );
  },
});
