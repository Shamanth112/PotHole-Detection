import { describe, it, expect } from 'vitest';
import {
  parseAiResponse,
  stripMarkdownFences,
  looksLikePothole,
} from '../aiParse';

describe('stripMarkdownFences', () => {
  it('removes ```json fences', () => {
    expect(stripMarkdownFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('removes plain ``` fences', () => {
    expect(stripMarkdownFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('leaves plain JSON untouched', () => {
    expect(stripMarkdownFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe('looksLikePothole', () => {
  it('detects explicit isPothole:true JSON', () => {
    expect(looksLikePothole('...{"isPothole":true}...')).toBe(true);
    expect(looksLikePothole('...{"isPothole": true}...')).toBe(true);
  });
  it('rejects isPothole:false', () => {
    expect(looksLikePothole('{"isPothole":false}')).toBe(false);
  });
  it('treats plain "pothole" mention as a hit', () => {
    expect(looksLikePothole('I see a pothole in the road.')).toBe(true);
  });
  it('rejects "no pothole" phrasing', () => {
    expect(looksLikePothole('There is no pothole here.')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(looksLikePothole('POTHOLE damage visible')).toBe(true);
  });
});

describe('parseAiResponse', () => {
  const goodJson = JSON.stringify({
    isPothole: true,
    confidence: 87,
    depthEstimate: '5-10 cm',
    severityConfidence: 'high (87%)',
    description: 'A clear pothole in the centre of the lane.',
  });

  it('parses a well-formed Gemini JSON response', () => {
    const r = parseAiResponse(goodJson);
    expect(r).toEqual({
      isPothole: true,
      confidence: 87,
      depthEstimate: '5-10 cm',
      severityConfidence: 'high (87%)',
      description: 'A clear pothole in the centre of the lane.',
    });
  });

  it('handles markdown-fenced JSON', () => {
    const r = parseAiResponse('```json\n' + goodJson + '\n```');
    expect(r?.isPothole).toBe(true);
    expect(r?.confidence).toBe(87);
  });

  it('returns null on empty input', () => {
    expect(parseAiResponse('')).toBeNull();
    expect(parseAiResponse('   ')).toBeNull();
  });

  it('returns null when isPothole is missing', () => {
    const r = parseAiResponse(JSON.stringify({ confidence: 50, description: 'meh' }));
    expect(r).toBeNull();
  });

  it('clamps confidence to 0..100 and rounds to integer', () => {
    const r = parseAiResponse(
      JSON.stringify({ isPothole: true, confidence: 87.6, description: 'x' })
    );
    expect(r?.confidence).toBe(88);
  });

  it('handles out-of-range confidence values defensively', () => {
    const r = parseAiResponse(
      JSON.stringify({ isPothole: true, confidence: 250, description: 'x' })
    );
    expect(r?.confidence).toBe(100);
  });

  it('provides a default description when missing', () => {
    const r = parseAiResponse(JSON.stringify({ isPothole: false, confidence: 10 }));
    expect(r?.description).toBeTruthy();
    expect(r?.description).not.toBe('');
  });

  it('treats missing depthEstimate/severityConfidence as null', () => {
    const r = parseAiResponse(
      JSON.stringify({ isPothole: true, confidence: 50, description: 'x' })
    );
    expect(r?.depthEstimate).toBeNull();
    expect(r?.severityConfidence).toBeNull();
  });

  it('returns null on truly malformed JSON', () => {
    expect(parseAiResponse('this is not json')).toBeNull();
    expect(parseAiResponse('{isPothole: tru')).toBeNull();
  });
});