/**
 * Parsing helpers for Gemini 2.0 Flash responses.
 *
 * Gemini is asked to return a strict JSON object. In practice we sometimes
 * get back markdown-fenced JSON, JSON with leading prose, or free-text that
 * mentions "pothole" but doesn't parse. This module centralises the
 * "be liberal in what we accept" logic so the rest of the AI verification
 * pipeline can rely on a clean result.
 */

export interface AiVerificationResult {
  isPothole: boolean;
  confidence: number;
  depthEstimate: string | null;
  severityConfidence: string | null;
  description: string;
}

/**
 * Strip leading/trailing markdown code fences if Gemini adds them
 * (it sometimes does despite `responseMimeType: application/json`).
 */
export function stripMarkdownFences(rawText: string): string {
  return rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/**
 * Heuristic for "looks like a pothole" when JSON parsing fails.
 *
 * We treat this as a last-resort fallback — the keyword check is intentionally
 * conservative (requires "pothole" but NOT "no pothole").
 */
export function looksLikePothole(rawText: string): boolean {
  const lower = rawText.toLowerCase();
  return (
    lower.includes('"ispothole":true') ||
    lower.includes('"ispothole": true') ||
    (lower.includes('pothole') &&
      !lower.includes('no pothole') &&
      !lower.includes('"ispothole":false'))
  );
}

/**
 * Parse a Gemini response into a structured verification result.
 *
 * Returns `null` if the text is empty or doesn't contain the keys we need.
 * Callers should treat `null` as "flag for manual review" — never throw, so
 * the AI verification action can always write something to the database.
 */
export function parseAiResponse(rawText: string): AiVerificationResult | null {
  if (!rawText || !rawText.trim()) return null;

  try {
    const cleaned = stripMarkdownFences(rawText);
    const parsed = JSON.parse(cleaned) as Partial<AiVerificationResult>;

    if (typeof parsed.isPothole !== 'boolean') return null;

    return {
      isPothole: parsed.isPothole,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
          : 0,
      depthEstimate:
        typeof parsed.depthEstimate === 'string' ? parsed.depthEstimate : null,
      severityConfidence:
        typeof parsed.severityConfidence === 'string'
          ? parsed.severityConfidence
          : null,
      description:
        typeof parsed.description === 'string'
          ? parsed.description
          : 'No description provided.',
    };
  } catch {
    return null;
  }
}