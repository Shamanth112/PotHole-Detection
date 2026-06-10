"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * AI verification action.
 * Uses Gemini 2.0 Flash via direct REST API call (most reliable).
 *
 * Flow:
 *  1. Fetch the signed image URL from Convex storage.
 *  2. Download image bytes, base64-encode.
 *  3. POST to Gemini REST API with a simple, clear prompt.
 *  4. Parse response and write results back via internal.potholes.applyAiResult.
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
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status}`);
      const buffer = await imgResponse.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString("base64");
      // Normalise MIME type — Convex storage sometimes returns application/octet-stream
      const ct = imgResponse.headers.get("content-type") || "image/jpeg";
      mimeType = ct.startsWith("image/") ? ct.split(";")[0].trim() : "image/jpeg";
      console.log(`[aiVerify] Downloaded image: ${buffer.byteLength} bytes, mimeType=${mimeType}`);
    } catch (err: any) {
      console.error("[aiVerify] Failed to fetch image:", err);
      await ctx.runMutation(internal.potholes.applyAiResult, {
        potholeId: args.potholeId,
        aiVerified: false,
        aiDescription: "Image download failed — the report has been flagged for manual review.",
        aiDepthEstimate: null,
        aiSeverityConfidence: null,
      });
      return;
    }

    // ── 3. Call Gemini REST API directly ──────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Convex environment variables.");

    const geminiEndpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Two-part prompt: first the image, then the instruction.
    // Keeping the instruction text separate from the schema avoids confusion.
    const instructionText = `Look at this image carefully.

Task: Determine if there is a pothole or road surface damage (cracks, subsidence, holes, broken asphalt) visible in the image.

Respond with ONLY a raw JSON object — absolutely no markdown, no code fences, no extra explanation.

Required JSON format:
{
  "isPothole": true or false,
  "confidence": <integer 0-100>,
  "depthEstimate": "<depth range like 2-4 cm, 5-10 cm, 15-25 cm>" or null if no pothole,
  "severityConfidence": "<low|medium|high> (<confidence>%)" or null if no pothole,
  "description": "<one or two sentences describing what you see>"
}

Important rules:
- Set isPothole=true for ANY visible road damage: holes, cracks, subsidence, broken asphalt, potholes filled with water.
- Set isPothole=false ONLY if the image shows no road at all, or the road is perfectly intact.
- For depthEstimate, consider the shadow depth, water level, surrounding gravel, and road thickness (typically 5-15 cm).
- If the pothole is filled with water, estimate at least 5 cm depth.`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
            {
              text: instructionText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,       // Low temperature for deterministic output
        maxOutputTokens: 512,
        responseMimeType: "application/json",  // Force JSON output mode
      },
    };

    let rawText = "";
    try {
      const geminiResponse = await fetch(geminiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        throw new Error(`Gemini API error ${geminiResponse.status}: ${errorBody}`);
      }

      const geminiData = await geminiResponse.json();
      console.log("[aiVerify] Raw Gemini response:", JSON.stringify(geminiData).slice(0, 500));

      rawText =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ??
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.json_value ??
        "";

      if (!rawText) {
        // Some versions return JSON directly in the candidate
        const candidate = geminiData?.candidates?.[0];
        console.error("[aiVerify] No text in response. Full candidate:", JSON.stringify(candidate));
        throw new Error("Empty response from Gemini");
      }
    } catch (err: any) {
      console.error("[aiVerify] Gemini API call failed:", err.message);
      await ctx.runMutation(internal.potholes.applyAiResult, {
        potholeId: args.potholeId,
        aiVerified: false,
        aiDescription: `AI service error — flagged for manual review. (${err.message?.slice(0, 80)})`,
        aiDepthEstimate: null,
        aiSeverityConfidence: null,
      });
      return;
    }

    // ── 4. Parse the JSON response ─────────────────────────────────────
    let result: {
      isPothole: boolean;
      confidence: number;
      depthEstimate: string | null;
      severityConfidence: string | null;
      description: string;
    };

    try {
      // Strip any accidental markdown fences
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      console.log("[aiVerify] Cleaned response text:", cleaned.slice(0, 300));
      result = JSON.parse(cleaned);
    } catch (parseErr: any) {
      console.error("[aiVerify] JSON parse failed. Raw text was:", rawText);
      // Last resort: attempt a heuristic parse based on keywords
      const lower = rawText.toLowerCase();
      const likelyPothole =
        lower.includes('"ispothole": true') ||
        lower.includes('"ispothole":true') ||
        (lower.includes("pothole") && !lower.includes("no pothole") && !lower.includes("false"));

      await ctx.runMutation(internal.potholes.applyAiResult, {
        potholeId: args.potholeId,
        aiVerified: likelyPothole,
        aiDescription: likelyPothole
          ? "Pothole detected (AI response could not be fully parsed)."
          : "Could not parse AI response — flagged for manual review.",
        aiDepthEstimate: null,
        aiSeverityConfidence: null,
      });
      return;
    }

    // ── 5. Write verified results back ────────────────────────────────
    console.log(
      `[aiVerify] Result: isPothole=${result.isPothole}, confidence=${result.confidence}, depth=${result.depthEstimate}`
    );

    await ctx.runMutation(internal.potholes.applyAiResult, {
      potholeId: args.potholeId,
      aiVerified: result.isPothole === true,
      aiDescription: result.description ?? null,
      aiDepthEstimate: result.depthEstimate ?? null,
      aiSeverityConfidence: result.severityConfidence ?? null,
    });
  },
});
