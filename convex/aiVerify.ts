"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const MAX_RETRIES = 3;
// Backoff delays in ms: 1st retry after 8s, 2nd after 20s, 3rd after 45s
const RETRY_DELAYS_MS = [8_000, 20_000, 45_000];

/**
 * AI verification action.
 * Uses Gemini 2.0 Flash via direct REST API.
 * Handles 429 rate-limit errors with scheduled retries (up to MAX_RETRIES).
 */
export const verifyImage = internalAction({
  args: {
    potholeId: v.id("potholes"),
    storageId: v.id("_storage"),
    retryCount: v.optional(v.number()),   // tracks how many times we've retried
  },
  handler: async (ctx, args) => {
    const attempt = args.retryCount ?? 0;

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
      const ct = imgResponse.headers.get("content-type") || "image/jpeg";
      mimeType = ct.startsWith("image/") ? ct.split(";")[0].trim() : "image/jpeg";
      console.log(`[aiVerify] Image fetched: ${buffer.byteLength} bytes, mime=${mimeType}, attempt=${attempt}`);
    } catch (err: any) {
      console.error("[aiVerify] Image download failed:", err.message);
      await ctx.runMutation(internal.potholes.applyAiResult, {
        potholeId: args.potholeId,
        aiVerified: false,
        aiDescription: "Image download failed — flagged for manual review.",
        aiDepthEstimate: null,
        aiSeverityConfidence: null,
      });
      return;
    }

    // ── 3. Call Gemini REST API ────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Convex environment variables.");

    const geminiEndpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const instructionText = `Look at this image carefully.

Task: Determine if there is a pothole or road surface damage visible.

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation.

Required JSON format:
{
  "isPothole": true or false,
  "confidence": <integer 0-100>,
  "depthEstimate": "<e.g. 2-4 cm, 5-10 cm, 15-25 cm>" or null if no pothole,
  "severityConfidence": "<low|medium|high> (<confidence>%)" or null if no pothole,
  "description": "<one or two sentences describing what you see>"
}

Rules:
- Set isPothole=true for ANY visible road damage: holes, cracks, subsidence, broken asphalt, potholes filled with water or mud.
- Set isPothole=false ONLY if the road is clearly perfectly intact or there is no road visible at all.
- Water-filled potholes → isPothole=true, depthEstimate at least 5 cm.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: instructionText },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    };

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr: any) {
      console.error("[aiVerify] Network error calling Gemini:", networkErr.message);
      await scheduleRetryOrFail(ctx, args.potholeId, args.storageId, attempt,
        "Network error reaching AI service — flagged for manual review.");
      return;
    }

    // ── Handle rate limiting (429) with retry ──────────────────────────
    if (geminiResponse.status === 429) {
      const retryAfterHeader = geminiResponse.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader
        ? parseInt(retryAfterHeader) * 1000
        : RETRY_DELAYS_MS[attempt] ?? 60_000;

      console.warn(
        `[aiVerify] 429 rate limit hit (attempt ${attempt}). ` +
        `Scheduling retry in ${retryAfterMs / 1000}s.`
      );

      if (attempt < MAX_RETRIES) {
        await ctx.scheduler.runAfter(retryAfterMs, internal.aiVerify.verifyImage, {
          potholeId: args.potholeId,
          storageId: args.storageId,
          retryCount: attempt + 1,
        });
        // Leave status as "reported" — will be updated when retry fires
        console.log(`[aiVerify] Retry ${attempt + 1}/${MAX_RETRIES} scheduled.`);
      } else {
        // Exhausted all retries — mark as pending manual review
        console.error("[aiVerify] All retries exhausted after 429s.");
        await ctx.runMutation(internal.potholes.applyAiResult, {
          potholeId: args.potholeId,
          aiVerified: false,
          aiDescription: "AI verification is temporarily unavailable (rate limit). A municipal worker will review this report.",
          aiDepthEstimate: null,
          aiSeverityConfidence: null,
        });
      }
      return;
    }

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error(`[aiVerify] Gemini error ${geminiResponse.status}:`, errorBody.slice(0, 200));
      await scheduleRetryOrFail(ctx, args.potholeId, args.storageId, attempt,
        `AI service error (${geminiResponse.status}) — flagged for manual review.`);
      return;
    }

    // ── 4. Parse Gemini response ───────────────────────────────────────
    const geminiData = await geminiResponse.json();
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log("[aiVerify] Raw Gemini text:", rawText.slice(0, 300));

    if (!rawText) {
      console.error("[aiVerify] Empty Gemini response:", JSON.stringify(geminiData).slice(0, 300));
      await scheduleRetryOrFail(ctx, args.potholeId, args.storageId, attempt,
        "AI returned an empty response — flagged for manual review.");
      return;
    }

    let result: {
      isPothole: boolean;
      confidence: number;
      depthEstimate: string | null;
      severityConfidence: string | null;
      description: string;
    };

    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      result = JSON.parse(cleaned);
    } catch {
      // Keyword heuristic fallback
      const lower = rawText.toLowerCase();
      const likelyPothole =
        lower.includes('"ispothole":true') ||
        lower.includes('"ispothole": true') ||
        (lower.includes("pothole") && !lower.includes("no pothole") && !lower.includes('"ispothole":false'));

      console.warn("[aiVerify] JSON parse failed, using heuristic. likelyPothole=", likelyPothole);
      await ctx.runMutation(internal.potholes.applyAiResult, {
        potholeId: args.potholeId,
        aiVerified: likelyPothole,
        aiDescription: likelyPothole
          ? "Pothole likely detected (AI response partially parsed)."
          : "Could not parse AI response — flagged for manual review.",
        aiDepthEstimate: null,
        aiSeverityConfidence: null,
      });
      return;
    }

    // ── 5. Write results ───────────────────────────────────────────────
    console.log(
      `[aiVerify] ✓ isPothole=${result.isPothole}, confidence=${result.confidence}, depth=${result.depthEstimate}`
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

// ── Helper: schedule a retry or write a permanent failure ─────────────────────
async function scheduleRetryOrFail(
  ctx: any,
  potholeId: any,
  storageId: any,
  attempt: number,
  failureDescription: string
) {
  if (attempt < MAX_RETRIES) {
    const delay = RETRY_DELAYS_MS[attempt] ?? 30_000;
    console.warn(`[aiVerify] Scheduling retry ${attempt + 1}/${MAX_RETRIES} in ${delay / 1000}s`);
    await ctx.scheduler.runAfter(delay, internal.aiVerify.verifyImage, {
      potholeId,
      storageId,
      retryCount: attempt + 1,
    });
  } else {
    await ctx.runMutation(internal.potholes.applyAiResult, {
      potholeId,
      aiVerified: false,
      aiDescription: failureDescription,
      aiDepthEstimate: null,
      aiSeverityConfidence: null,
    });
  }
}
