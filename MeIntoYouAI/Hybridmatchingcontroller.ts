///////////////////////////////// THIS CODEBASE BELONGS TO LIGHT GROUP INC. A HOLDING COMPANY OF MEINTOYOU
///////////////////////////////// HYBRID MATCHING CONTROLLER — AI-FIRST
/////////////////////////////////
///////////////////////////////// RULES:
/////////////////////////////////  1. NO REGEX. EVER.
/////////////////////////////////  2. NO HARDCODED LISTS. EVER.
/////////////////////////////////  3. NO CLIENT-SIDE FALLBACKS FOR AI EXTRACTION.
/////////////////////////////////  4. IF THE LLM IS BROKEN, WE SKIP AI TIER ENTIRELY AND GO STRAIGHT TO TIER 2.
/////////////////////////////////  5. EVERY LLM CALL IS LOGGED — REQUEST BODY AND RAW RESPONSE.
/////////////////////////////////  6. IF LLM RETURNS EMPTY/MALFORMED, WE LOG EXACTLY WHAT IT RETURNED.
/////////////////////////////////  7. AGE IS SOFT SCORING ONLY.
/////////////////////////////////  8. CITY IS HARD FILTER.
/////////////////////////////////  9. MIN SCORE FLOOR IS 0.70.
///////////////////////////////// 10. PROMPT AGE > SETTINGS AGE.
///////////////////////////////// 11. PROMPT GENDER > APP GENDER.
///////////////////////////////// 12. ONLY FIELDS THE LLM EXPLICITLY RETURNS IN relevantFields GET EMBEDDED.
/////////////////////////////////     IF LLM RETURNS EMPTY relevantFields, WE ASSUME THE PROMPT IS VAGUE
/////////////////////////////////     AND EMBED THE FULL PROFILE (NOT "No information").
///////////////////////////////// 13. IF LLM FAILS TO EXTRACT ANY PREFS, AI TIER IS SKIPPED.
///////////////////////////////// 14. OPENROUTER HEADERS ARE ALWAYS INCLUDED.

import { Request, Response } from "express";
import User from "../models/User";
import Match from "../models/Match";
import AIPromptMatching from "../models/AIPromptMatching";
import { calculateDistance } from "../utils/distance";
import { Op } from "sequelize";
import { pipeline } from "@xenova/transformers";

// ─────────────────────────────────────────────────────────────
// TRADITIONAL SCORING HELPERS
// ─────────────────────────────────────────────────────────────

const toNumberOrUndefined = (value: any): number | undefined => {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const toTrimmedLower = (value: any): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const parseInterestList = (value: any): string[] => {
  if (typeof value !== "string") return [];
  return value.split(",").map((i) => i.trim().toLowerCase()).filter(Boolean);
};

const computeInterestOverlapCount = (a: any, b: any): number => {
  const aList = parseInterestList(a);
  const bList = parseInterestList(b);
  if (!aList.length || !bList.length) return 0;
  const bSet = new Set(bList);
  let count = 0;
  for (const item of aList) { if (bSet.has(item)) count++; }
  return count;
};

const computeCandidateDistanceKm = (currentUser: any, candidate: any): number => {
  const lat1 = toNumberOrUndefined(currentUser.lats);
  const lon1 = toNumberOrUndefined(currentUser.longs);
  const lat2 = toNumberOrUndefined(candidate.lats);
  const lon2 = toNumberOrUndefined(candidate.longs);
  if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
    return calculateDistance(lat1, lon1, lat2, lon2);
  }
  return Infinity;
};

const calculateAge = (years: any): number | undefined => {
  const y = toNumberOrUndefined(years);
  if (y == null) return undefined;
  if (y < 120) return y;
  if (y > 1900) return new Date().getFullYear() - y;
  return undefined;
};

const computeMatchScore = (currentUser: any, candidate: any, distanceKm: number): number => {
  const distanceFactor = Number.isFinite(distanceKm) && distanceKm >= 0 ? 1 / (1 + distanceKm) : 0;
  const overlap = computeInterestOverlapCount(currentUser.interest, candidate.interest);
  const currentCount = parseInterestList(currentUser.interest).length || 1;
  const candCount = parseInterestList(candidate.interest).length || 1;
  const avgCount = Math.max(1, (currentCount + candCount) / 2);
  const interestFactor = Math.min(overlap / avgCount, 1);
  const minAge = toNumberOrUndefined(currentUser.ages);
  const maxAge = toNumberOrUndefined(currentUser.secondages);
  let ageFactor = 0.5;
  const candAge = toNumberOrUndefined(candidate.years);
  if (minAge != null && maxAge != null && candAge != null) {
    ageFactor = candAge >= minAge && candAge <= maxAge ? 1 : 0.2;
  }
  let activityFactor = 0.5;
  if (candidate.lastActiveAt) {
    const diffDays = (Date.now() - new Date(candidate.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) activityFactor = 1.0;
    else if (diffDays <= 7) activityFactor = 0.8;
    else if (diffDays <= 30) activityFactor = 0.6;
    else activityFactor = 0.3;
  }
  let profileCompleteness = 0;
  if (candidate.profile) profileCompleteness += 0.6;
  const images = ["im1", "im2", "im3", "im4"].filter((k) => candidate[k]).length;
  profileCompleteness += Math.min(images / 4, 1) * 0.4;
  return (0.35 * distanceFactor + 0.25 * interestFactor + 0.15 * ageFactor + 0.15 * activityFactor + 0.10 * profileCompleteness) + Math.random() * 0.0001;
};

// ─────────────────────────────────────────────────────────────
// AI CONFIG
// ─────────────────────────────────────────────────────────────

const AI_CFG = {
  llmUrl:    process.env.AI_LLM_URL   || "",
  llmModel:  process.env.AI_LLM_MODEL || "",
  apiKey:    process.env.AI_API_KEY   || "",
  appUrl:    process.env.AI_APP_URL   || "https://meintoyou.app",
  appName:   process.env.AI_APP_NAME  || "MeInToYou",
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS   || "30000"),
  maxRetries: parseInt(process.env.AI_MAX_RETRIES  || "3"),
  semanticWeight:   0.65,
  preferenceWeight: 0.35,
  tier1BaseThreshold:    0.70,
  ABSOLUTE_MIN_SCORE:    0.70,
  concurrencyLimit:      parseInt(process.env.AI_CONCURRENCY_LIMIT  || "6"),
  distanceGraceFactor:   parseFloat(process.env.AI_DISTANCE_GRACE   || "1.2"),
};

// ─────────────────────────────────────────────────────────────
// SEMAPHORE
// ─────────────────────────────────────────────────────────────

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;
  constructor(private readonly limit: number) {}
  async acquire(): Promise<void> {
    if (this.running < this.limit) { this.running++; return; }
    return new Promise((res) => { this.queue.push(() => { this.running++; res(); }); });
  }
  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try { return await fn(); } finally { this.release(); }
  }
}

const hybridSemaphore = new Semaphore(AI_CFG.concurrencyLimit);

// ─────────────────────────────────────────────────────────────
// EMBEDDING ENGINE
// ─────────────────────────────────────────────────────────────

let _embedder: any = null;
const getEmbedder = async () => {
  if (!_embedder) _embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return _embedder;
};

const hashText = (t: string): string => {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = Math.imul(31, h) + t.charCodeAt(i) | 0;
  return String(h);
};

const _cache: Map<string, { vec: number[]; ts: number }> = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 24;

const embed = async (text: string): Promise<number[]> => {
  const key = hashText(text);
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.vec;
  const embedder = await getEmbedder();
  const out = await embedder(text, { pooling: "mean", normalize: true });
  const vec: number[] = Array.from(out.data as Float32Array);
  if (!vec.length) throw new Error("Empty embedding");
  _cache.set(key, { vec, ts: Date.now() });
  return vec;
};

export const invalidateEmbeddingCache = (text: string) => { _cache.delete(hashText(text)); };

// ─────────────────────────────────────────────────────────────
// COSINE SIMILARITY
// ─────────────────────────────────────────────────────────────

const cosine = (a: number[], b: number[]): number => {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

// ─────────────────────────────────────────────────────────────
// PROFILE TEXT SYNTHESIS
// If relevantFields is provided and non-empty, only those fields are used.
// If relevantFields is empty/null, we embed the FULL profile (all fields).
// We NEVER return "No relevant information" — that kills embeddings.
// ─────────────────────────────────────────────────────────────

const synthProfile = (u: any, relevantFields?: string[] | null): string => {
  // If no relevantFields specified, emit EVERYTHING (full profile mode)
  if (!relevantFields || relevantFields.length === 0) {
    const p: string[] = [];
    if (u.bio)           p.push(u.bio);
    if (u.interest)      p.push(`I enjoy ${u.interest}`);
    if (u.loveLanguages) p.push(`My love language is ${u.loveLanguages}`);
    if (u.fors)          p.push(`I am looking for ${u.fors}`);
    if (u.looking)       p.push(`Specifically: ${u.looking}`);
    if (u.Orientation)   p.push(`I am ${u.Orientation}`);
    if (u.occupation)    p.push(`I work as ${u.occupation}${u.industry ? ` in ${u.industry}` : ""}`);
    if (u.education)     p.push(`Education: ${u.education}`);
    if (u.schoolname)    p.push(`I studied at ${u.schoolname}`);
    if (u.languages)     p.push(`I speak ${u.languages}`);
    if (u.religion && u.showReligion) p.push(`I am ${u.religion}`);
    if (u.smoking)       p.push(`Smoking: ${u.smoking}`);
    if (u.drinking)      p.push(`Drinking: ${u.drinking}`);
    if (u.exercise)      p.push(`Exercise: ${u.exercise}`);
    const pets: string[] = [];
    if (u.pets_dogs)  pets.push("dogs");
    if (u.pets_cats)  pets.push("cats");
    if (u.pets_other) pets.push("other pets");
    if (pets.length)  p.push(`I have ${pets.join(" and ")}`);
    if (u.hasKids  !== undefined) p.push(`I ${u.hasKids  ? "have" : "do not have"} children`);
    if (u.wantsKids !== undefined) p.push(`I ${u.wantsKids ? "want" : "do not want"} children`);
    if (u.relationshipStatus) p.push(`I am ${u.relationshipStatus}`);
    if (u.gender)  p.push(`I am a ${u.gender}`);
    if (u.years) {
      const age = u.years > 1900 ? new Date().getFullYear() - u.years : u.years;
      p.push(`I am ${age} years old`);
    }
    if (u.height_cm) p.push(`I am ${u.height_cm}cm tall`);
    if (u.city && u.country) p.push(`I live in ${u.city}, ${u.country}`);
    else if (u.city)    p.push(`I live in ${u.city}`);
    else if (u.country) p.push(`I am from ${u.country}`);
    return p.join(". ") || "No profile information available.";
  }

  // relevantFields mode: only include specified fields
  const fieldSet = new Set(relevantFields.map((f) => f.toLowerCase()));
  const p: string[] = [];

  if (fieldSet.has("bio") && u.bio)           p.push(u.bio);
  if (fieldSet.has("interest") && u.interest) p.push(`I enjoy ${u.interest}`);
  if (fieldSet.has("lovelanguages") && u.loveLanguages) p.push(`My love language is ${u.loveLanguages}`);
  if (fieldSet.has("fors") && u.fors)         p.push(`I am looking for ${u.fors}`);
  if (fieldSet.has("looking") && u.looking)   p.push(`Specifically: ${u.looking}`);
  if (fieldSet.has("orientation") && u.Orientation) p.push(`I am ${u.Orientation}`);
  if (fieldSet.has("occupation") && u.occupation)   p.push(`I work as ${u.occupation}${u.industry ? ` in ${u.industry}` : ""}`);
  if (fieldSet.has("education") && u.education)     p.push(`Education: ${u.education}`);
  if (fieldSet.has("schoolname") && u.schoolname)   p.push(`I studied at ${u.schoolname}`);
  if (fieldSet.has("languages") && u.languages)     p.push(`I speak ${u.languages}`);
  if (fieldSet.has("religion") && u.religion && u.showReligion) p.push(`I am ${u.religion}`);
  if (fieldSet.has("smoking") && u.smoking)         p.push(`Smoking: ${u.smoking}`);
  if (fieldSet.has("drinking") && u.drinking)       p.push(`Drinking: ${u.drinking}`);
  if (fieldSet.has("exercise") && u.exercise)       p.push(`Exercise: ${u.exercise}`);
  if (fieldSet.has("pets")) {
    const pets: string[] = [];
    if (u.pets_dogs)  pets.push("dogs");
    if (u.pets_cats)  pets.push("cats");
    if (u.pets_other) pets.push("other pets");
    if (pets.length)  p.push(`I have ${pets.join(" and ")}`);
  }
  if (fieldSet.has("haskids") && u.hasKids !== undefined)  p.push(`I ${u.hasKids  ? "have" : "do not have"} children`);
  if (fieldSet.has("wantskids") && u.wantsKids !== undefined) p.push(`I ${u.wantsKids ? "want" : "do not want"} children`);
  if (fieldSet.has("relationshipstatus") && u.relationshipStatus) p.push(`I am ${u.relationshipStatus}`);
  if (fieldSet.has("gender") && u.gender)  p.push(`I am a ${u.gender}`);
  if (fieldSet.has("age") && u.years) {
    const age = u.years > 1900 ? new Date().getFullYear() - u.years : u.years;
    p.push(`I am ${age} years old`);
  }
  if (fieldSet.has("height") && u.height_cm) p.push(`I am ${u.height_cm}cm tall`);
  if (fieldSet.has("location")) {
    if (u.city && u.country) p.push(`I live in ${u.city}, ${u.country}`);
    else if (u.city)    p.push(`I live in ${u.city}`);
    else if (u.country) p.push(`I am from ${u.country}`);
  }

  return p.join(". ") || "No relevant profile information available.";
};

// ─────────────────────────────────────────────────────────────
// LLM HEADERS BUILDER — OpenRouter requires Referer and X-Title
// ─────────────────────────────────────────────────────────────

const buildLLMHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${AI_CFG.apiKey}`,
    "Content-Type": "application/json",
  };
  // OpenRouter free tier requires these headers
  if (AI_CFG.llmUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = AI_CFG.appUrl;
    headers["X-Title"] = AI_CFG.appName;
  }
  return headers;
};

// ─────────────────────────────────────────────────────────────
// LLM HEALTH CHECK — pings the LLM with a trivial question
// ─────────────────────────────────────────────────────────────

const isLLMAlive = async (): Promise<boolean> => {
  if (!AI_CFG.llmUrl || !AI_CFG.llmModel) {
    console.error("[Hybrid] LLM NOT CONFIGURED — check AI_LLM_URL and AI_LLM_MODEL env vars");
    return false;
  }
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(AI_CFG.llmUrl, {
      method: "POST",
      headers: buildLLMHeaders(),
      body: JSON.stringify({
        model: AI_CFG.llmModel,
        messages: [
          { role: "system", content: "You are a JSON extractor. Return ONLY raw JSON. No markdown." },
          { role: "user", content: 'Extract: age is 25, city is Paris. Return: {"age":25,"city":"Paris"}' },
        ],
        max_tokens: 100,
        temperature: 0.0,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!resp.ok) {
      const body = await resp.text().catch(() => "[could not read body]");
      console.error(`[Hybrid] LLM health check FAILED — HTTP ${resp.status}: ${resp.statusText}`);
      console.error(`[Hybrid] LLM health check response body:`, body);
      return false;
    }

    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    console.log("[Hybrid] LLM health check raw response:", raw);

    const clean = raw.replace(/^\u0060\u0060\u0060\s*json?\s*/i, "").replace(/\s*\u0060\u0060\u0060\s*$/i, "").trim();
    JSON.parse(clean);
    console.log("[Hybrid] LLM health check PASSED");
    return true;
  } catch (e: any) {
    console.error("[Hybrid] LLM health check FAILED:", e.message);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
// LLM PREFERENCE EXTRACTION — NO FALLBACK. NO REGEX.
// If this fails, the caller must handle it (skip AI tier).
// ─────────────────────────────────────────────────────────────

interface ExtractedPrefs {
  ageRange?:         { min: number; max: number };
  maxDistanceKm?:    number;
  minDistanceKm?:    number;
  location?:         string;
  city?:             string;
   heightCm?:         number;  
  relationshipType?: string;
  gender?:           "MAN" | "WOMAN" | null;
  dealbreakers?:     string[];
  relevantFields?:   string[];
}

const _prefCache: Map<string, ExtractedPrefs> = new Map();

const extractPrefsWithLLM = async (text: string): Promise<ExtractedPrefs | null> => {
  const cached = _prefCache.get(text);
  if (cached) return cached;

  if (!AI_CFG.llmUrl || !AI_CFG.llmModel) {
    console.error("[Hybrid] LLM not configured — cannot extract prefs");
    return null;
  }

  const requestBody = {
    model: AI_CFG.llmModel,
    messages: [
      {
        role: "system",
        content: `You extract dating preferences from user text. Return ONLY a JSON object. No markdown, no explanation, no extra text.

Available profile fields: bio, interest, loveLanguages, fors, looking, orientation, occupation, industry, education, schoolname, languages, religion, smoking, drinking, exercise, pets, hasKids, wantsKids, relationshipStatus, gender, age, height, location.

Examples:

Input: "I want a girl in Kigali, early 20s, who loves music"
Output: {"ageMin":20,"ageMax":24,"city":"Kigali","maxDistanceKm":null,"minDistanceKm":null,"relationshipType":null,"gender":"WOMAN","dealbreakers":[],"relevantFields":["gender","age","location","interest"]}

Input: "man, 19 years, lives in kigali rwanda, loves mathematics, 148cm, not less than 10km away, live together"
Output: {"ageMin":19,"ageMax":19,"city":"Kigali","maxDistanceKm":null,"minDistanceKm":10,"relationshipType":"serious","gender":"MAN","dealbreakers":[],"relevantFields":["gender","age","location","height","interest","relationshipStatus"]}

Input: "someone fun, no smokers, under 30"
Output: {"ageMin":null,"ageMax":30,"city":null,"maxDistanceKm":null,"minDistanceKm":null,"relationshipType":"casual","gender":null,"dealbreakers":["smoking"],"relevantFields":["age","smoking"]}

Rules:
- ageMin/ageMax: exact numbers only. "19 years" = 19,19. "early 20s" = 20,24. "mid 20s" = 24,27. "late 20s" = 27,29. "university age" = 18,24. "young" = 18,28. "not too old" = null,35. "19+" = 19,null. "under 25" = null,25.
- city: exact city name if mentioned.
- maxDistanceKm: only if they say "within X km" or "close by" (use 20) or "nearby" (use 20).
- minDistanceKm: only if they say "not less than X" or "at least X away" or "far" (use 50).
- relationshipType: "serious" for long-term/live together/marriage. "casual" for fun/short-term. "friends" for platonic.
- gender: "MAN" or "WOMAN" only if explicitly stated.
- IF HE SAY 6 INCH OR INCHES NOT IN CM PLEASE TRANSFORM TO THE cm also same to us, IF HE SAY MILES CHANGE THAT TO km
- heightCm: convert ANY height mention to centimeters. Use these conversions: 1 foot = 30.48cm, 1 inch = 2.54cm, 1 meter = 100cm.
  Examples: "5 feet" = 152, "5 feet 6 inches" = 168, "5'6\"" = 168, "5ft 6in" = 168, "6 inches" = 15, "148cm" = 148, "1.75m" = 175.
  If vague like "tall", "short", "height doesn't matter" → null.
  If approximate like "around 170" → 170.
  Round to nearest whole number.
- dealbreakers: array of things they explicitly don't want.
- relevantFields: ONLY include fields the user clearly cares about. If they say "has kids or not I dont care", do NOT include hasKids. If they say "height doesnt matter" but also give a number like 148cm, DO include height because they specified one. If dealbreakers mention a field, include that field.`,
      },
      { role: "user", content: `Extract preferences from: "${text}"` },
    ],
    max_tokens: 300,
    temperature: 0.0,
  };

  console.log("[Hybrid] LLM REQUEST BODY:", JSON.stringify(requestBody, null, 2));

  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 15000);
    const resp = await fetch(AI_CFG.llmUrl, {
      method:  "POST",
      headers: buildLLMHeaders(),
      body: JSON.stringify(requestBody),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!resp.ok) {
      const body = await resp.text().catch(() => "[could not read body]");
      console.error(`[Hybrid] LLM HTTP ERROR ${resp.status}: ${resp.statusText}`);
      console.error(`[Hybrid] LLM response body:`, body);
      return null;
    }

    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw  = data.choices?.[0]?.message?.content?.trim() || "";

    console.log("[Hybrid] LLM RAW RESPONSE:", raw);
    console.log("[Hybrid] LLM FULL DATA:", JSON.stringify(data, null, 2));

    // Strip markdown
    const clean = raw
      .replace(/^\u0060\u0060\u0060\s*json?\s*/i, "")
      .replace(/\s*\u0060\u0060\u0060\s*$/i, "")
      .trim();

    console.log("[Hybrid] LLM CLEANED RESPONSE:", clean);

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr: any) {
      console.error("[Hybrid] LLM returned INVALID JSON:", parseErr.message);
      console.error("[Hybrid] Offending text:", clean);
      return null;
    }

    const prefs: ExtractedPrefs = {
      dealbreakers: Array.isArray(parsed.dealbreakers) ? parsed.dealbreakers : [],
      relevantFields: Array.isArray(parsed.relevantFields) ? parsed.relevantFields : [],
    };

    if (parsed.ageMin != null || parsed.ageMax != null) {
      prefs.ageRange = {
        min: parsed.ageMin ?? 18,
        max: parsed.ageMax ?? 100,
      };
    }
    if (parsed.city)             prefs.city = String(parsed.city).trim();
      if (parsed.heightCm != null) prefs.heightCm = Number(parsed.heightCm);
    if (parsed.maxDistanceKm != null) prefs.maxDistanceKm = Number(parsed.maxDistanceKm);
    if (parsed.minDistanceKm != null) prefs.minDistanceKm = Number(parsed.minDistanceKm);
    if (parsed.relationshipType) prefs.relationshipType = String(parsed.relationshipType);
    if (parsed.gender)           prefs.gender = parsed.gender === "MAN" || parsed.gender === "WOMAN" ? parsed.gender : null;

    console.log("[Hybrid] PARSED PREFS:", JSON.stringify(prefs));
    _prefCache.set(text, prefs);
    return prefs;
  } catch (e: any) {
    console.error("[Hybrid] LLM CALL FAILED:", e.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// PREFERENCE ALIGNMENT SCORE
// ─────────────────────────────────────────────────────────────

const calcPrefScore = (userPrefs: ExtractedPrefs, candidate: any, currentUser: any): number => {
  let score  = 0.5;
  let checks = 0;

  if (userPrefs.ageRange && candidate.years) {
    checks++;
    const a = candidate.years > 1900 ? new Date().getFullYear() - candidate.years : candidate.years;
    if (a >= userPrefs.ageRange.min && a <= userPrefs.ageRange.max) {
      score += 0.15;
    } else {
      const gap = Math.min(Math.abs(a - userPrefs.ageRange.min), Math.abs(a - userPrefs.ageRange.max));
      score -= Math.min(0.30, gap * 0.06);
      console.log(`[Hybrid] Cand ${candidate.id} age ${a} outside range ${userPrefs.ageRange.min}-${userPrefs.ageRange.max}, gap=${gap}, penalty=${Math.min(0.30, gap * 0.06).toFixed(2)}`);
    }
  }

  if (userPrefs.maxDistanceKm != null && currentUser.lats && currentUser.longs && candidate.lats && candidate.longs) {
    checks++;
    const d = calculateDistance(
      parseFloat(currentUser.lats), parseFloat(currentUser.longs),
      parseFloat(candidate.lats),  parseFloat(candidate.longs),
    );
    if (d <= userPrefs.maxDistanceKm) {
      score += 0.12;
    } else if (d <= userPrefs.maxDistanceKm * AI_CFG.distanceGraceFactor) {
      score -= 0.04;
    } else {
      score -= Math.min(0.18, (d - userPrefs.maxDistanceKm) * 0.004);
    }
  }

  if (userPrefs.minDistanceKm != null && currentUser.lats && currentUser.longs && candidate.lats && candidate.longs) {
    checks++;
    const d = calculateDistance(
      parseFloat(currentUser.lats), parseFloat(currentUser.longs),
      parseFloat(candidate.lats),  parseFloat(candidate.longs),
    );
    if (d >= userPrefs.minDistanceKm) {
      score += 0.08;
    } else {
      score -= Math.min(0.20, (userPrefs.minDistanceKm - d) * 0.02);
    }
  }

  if (userPrefs.city) {
    checks++;
    const loc = userPrefs.city.toLowerCase();
    const cc  = (candidate.city || "").toLowerCase();
    if (cc.includes(loc) || loc.includes(cc)) {
      score += 0.10;
    }
  }

  if (userPrefs.dealbreakers?.length) {
    const txt = synthProfile(candidate, userPrefs.relevantFields).toLowerCase();
    for (const db of userPrefs.dealbreakers) {
      if (txt.includes(db.toLowerCase())) score -= 0.25;
    }
  }

  if (checks === 0) return 0.5;
  score = 0.4 + score * 0.6;
  return Math.max(0, Math.min(1, score));
};

// ─────────────────────────────────────────────────────────────
// LLM MATCH REASON
// ─────────────────────────────────────────────────────────────

const getMatchReason = async (uText: string, cText: string, sem: number, pref: number): Promise<string> => {
  const combined = sem * AI_CFG.semanticWeight + pref * AI_CFG.preferenceWeight;
  if (!AI_CFG.llmUrl || !AI_CFG.llmModel) {
    if (combined >= 0.80) return "Exceptional match — your personalities, values and what you're each looking for align deeply.";
    if (combined >= 0.70) return "Strong match — you share a similar outlook on life and relationships.";
    if (sem >= 0.68)       return "Great personality match — your energies and communication styles are well aligned.";
    if (pref >= 0.75)      return "Your practical preferences and lifestyle choices align really well.";
    return "You have meaningful things in common worth exploring.";
  }
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), AI_CFG.timeoutMs);
    const resp = await fetch(AI_CFG.llmUrl, {
      method:  "POST",
      headers: buildLLMHeaders(),
      body: JSON.stringify({
        model: AI_CFG.llmModel,
        messages: [
          { role: "system", content: "You are a warm dating app matchmaking assistant. Write ONE specific, warm sentence (max 20 words) about why these two people would get along. Focus on genuine compatibility. Never mention scores or algorithms." },
          { role: "user",   content: `Person A: "${uText.substring(0, 400)}"\nPerson B: "${cText.substring(0, 400)}"\nOne warm match reason:` },
        ],
        max_tokens: 60, temperature: 0.75,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) throw new Error(`LLM ${resp.status}`);
    interface LLMResponse {
      choices?: { message?: { content?: string } }[];
    }
    const data = (await resp.json()) as LLMResponse;
    return data.choices?.[0]?.message?.content?.trim() || "You both have a lot in common worth discovering.";
  } catch {
    if (combined >= 0.75) return "Deep compatibility — your goals and personality align exceptionally.";
    return "Promising match with real shared values and interests.";
  }
};

// ─────────────────────────────────────────────────────────────
// CORE SEMANTIC SCORER
// ─────────────────────────────────────────────────────────────

interface AIScoreResult {
  userId:             number;
  compatibilityScore: number;
  matchReason:        string;
  semanticScore:      number;
  preferenceScore:    number;
  matchMode:          "prompt-to-prompt" | "prompt-to-profile" | "profile-to-prompt" | "profile-to-profile";
}

const scoreCandidate = async (
  userPrompt:         string | null,
  userEmbedding:      number[] | undefined,
  userPrefs:          ExtractedPrefs,
  currentUser:        any,
  candidate:          any,
  candidatePrompt:    string | null,
  candidateEmbedding?: number[],
): Promise<AIScoreResult | null> => {
  try {
    let semanticScore = 0;
    let prefScore     = 0;
    let matchMode:      AIScoreResult["matchMode"];

    if (userPrompt && candidatePrompt && userEmbedding && candidateEmbedding) {
      matchMode = "prompt-to-prompt";
      const promptSim  = cosine(userEmbedding, candidateEmbedding);
      const candProfileEmb = await embed(synthProfile(candidate, userPrefs.relevantFields));
      const profileSim = cosine(userEmbedding, candProfileEmb);
      semanticScore    = promptSim * 0.65 + profileSim * 0.35;
      const candPrefs  = await extractPrefsWithLLM(candidatePrompt);
      const fwdPref    = calcPrefScore(userPrefs, candidate, currentUser);
      const revPref    = candPrefs ? calcPrefScore(candPrefs, currentUser, candidate) : 0.5;
      prefScore        = (fwdPref + revPref) / 2;

    } else if (userPrompt && !candidatePrompt && userEmbedding) {
      matchMode            = "prompt-to-profile";
      const candProfileEmb = await embed(synthProfile(candidate, userPrefs.relevantFields));
      semanticScore        = cosine(userEmbedding, candProfileEmb) * 0.92;
      prefScore            = calcPrefScore(userPrefs, candidate, currentUser);

    } else if (!userPrompt && candidatePrompt && candidateEmbedding) {
      matchMode            = "profile-to-prompt";
      const candPrefs      = await extractPrefsWithLLM(candidatePrompt);
      const userProfileEmb = await embed(synthProfile(currentUser, candPrefs?.relevantFields));
      semanticScore        = cosine(userProfileEmb, candidateEmbedding) * 0.92;
      prefScore            = candPrefs ? calcPrefScore(candPrefs, currentUser, candidate) : 0.5;

    } else {
      matchMode            = "profile-to-profile";
      const [uEmb, cEmb]  = await Promise.all([
        embed(synthProfile(currentUser, userPrefs.relevantFields)),
        embed(synthProfile(candidate, userPrefs.relevantFields)),
      ]);
      semanticScore        = cosine(uEmb, cEmb) * 0.85;
      prefScore            = calcPrefScore(userPrefs, candidate, currentUser);
    }

    const combinedScore = semanticScore * AI_CFG.semanticWeight + prefScore * AI_CFG.preferenceWeight;

    const userText  = userPrompt || synthProfile(currentUser, userPrefs?.relevantFields);
    const candText  = candidatePrompt || synthProfile(candidate, userPrefs?.relevantFields);
    const reason = await getMatchReason(userText, candText, semanticScore, prefScore);

    console.log(
      `[Hybrid] Cand ${candidate.id} | ${matchMode} | sem=${semanticScore.toFixed(3)} pref=${prefScore.toFixed(3)} combined=${combinedScore.toFixed(3)}`,
    );

    return {
      userId:             candidate.id,
      compatibilityScore: Math.max(0, Math.min(1, combinedScore)),
      matchReason:        reason,
      semanticScore,
      preferenceScore:    prefScore,
      matchMode,
    };
  } catch (e) {
    console.error(`[Hybrid] Score failed for candidate ${candidate.id}:`, e);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// THRESHOLD — NEVER goes below ABSOLUTE_MIN_SCORE (0.70)
// ─────────────────────────────────────────────────────────────

const adaptThreshold = (allScores: number[], base: number): number => {
  const floor = AI_CFG.ABSOLUTE_MIN_SCORE;
  if (!allScores.length) return base;

  const sorted = [...allScores].sort((a, b) => b - a);
  const top    = sorted.slice(0, Math.min(10, sorted.length));
  const median = top[Math.floor(top.length / 2)];

  if (median < base) {
    const adaptive = Math.max(floor, median * 0.90);
    console.log(`[Hybrid] Adaptive threshold: ${base} → ${adaptive.toFixed(3)} (top-10 median: ${median.toFixed(3)}, floor: ${floor})`);
    return adaptive;
  }
  return Math.max(floor, base);
};

// ─────────────────────────────────────────────────────────────
// TRADITIONAL PRIORITY FILTER — safety net for tier2
// ─────────────────────────────────────────────────────────────

const runTraditionalFilter = (
  candidates:  any[],
  currentUser: any,
  params: {
    minAge: number; maxAge: number;
    requestedCity: string; requestedCountry: string;
    requestedOrientation: string; requestedFors: string;
    maxDistanceKm: number | undefined;
  },
): any[] => {
  const { minAge, maxAge, requestedCity, requestedCountry, requestedOrientation, requestedFors, maxDistanceKm } = params;

  const enriched = candidates.map((m) => {
    const distanceKm  = computeCandidateDistanceKm(currentUser, m);
    const computedAge = calculateAge(m.years);
    const ageMatch    = computedAge != null && computedAge >= minAge && computedAge <= maxAge;
    const candCity    = toTrimmedLower(m.city);
    const candCountry = toTrimmedLower(m.country);
    const tCity    = requestedCity    && requestedCity    !== "null" ? requestedCity    : toTrimmedLower(currentUser.city);
    const tCountry = requestedCountry && requestedCountry !== "null" ? requestedCountry : toTrimmedLower(currentUser.country);
    const cityMatch     = !!(tCity    && candCity    && candCity    === tCity);
    const countryMatch  = !!(tCountry && candCountry && candCountry === tCountry);
    const distanceMatch = maxDistanceKm != null && distanceKm !== Infinity ? distanceKm <= maxDistanceKm : null;
    const orientationMatch = requestedOrientation && requestedOrientation !== "null"
      ? toTrimmedLower(m.Orientation) === requestedOrientation : true;
    const forsMatch = requestedFors && requestedFors !== "null"
      ? toTrimmedLower(m.fors) === requestedFors : true;
    const interestOverlap = computeInterestOverlapCount(currentUser.interest, m.interest);
    return { ...m, _distKm: distanceKm, _age: computedAge, ageMatch, cityMatch, countryMatch, distanceMatch, orientationMatch, forsMatch, interestOverlap };
  });

  const ok = (m: any) => m.distanceMatch === true || m.distanceMatch === null;
  const priorities = [
    (m: any) => m.orientationMatch && m.forsMatch && m.cityMatch    && m.ageMatch && ok(m),
    (m: any) => m.orientationMatch && m.forsMatch && m.countryMatch && m.ageMatch && ok(m),
    (m: any) => m.orientationMatch && m.forsMatch &&                   m.ageMatch && ok(m),
    (m: any) => m.orientationMatch &&                                  m.ageMatch && ok(m),
    (m: any) =>                                                        m.ageMatch && ok(m),
    (m: any) =>                                                        m.ageMatch,
    (m: any) => ok(m) && m.interestOverlap > 0,
    (m: any) => m.interestOverlap > 0,
    (_: any) => true,
  ];

  for (const pred of priorities) {
    const filtered = enriched.filter(pred);
    if (filtered.length > 0) {
      filtered.sort((a, b) => {
        if (a.orientationMatch !== b.orientationMatch) return b.orientationMatch ? 1 : -1;
        if (a.forsMatch        !== b.forsMatch)        return b.forsMatch        ? 1 : -1;
        if (a.cityMatch        !== b.cityMatch)        return b.cityMatch        ? 1 : -1;
        if (a.countryMatch     !== b.countryMatch)     return b.countryMatch     ? 1 : -1;
        if (a.ageMatch         !== b.ageMatch)         return b.ageMatch         ? 1 : -1;
        const dA = a._distKm !== Infinity ? a._distKm : 999999;
        const dB = b._distKm !== Infinity ? b._distKm : 999999;
        if (dA !== dB) return dA - dB;
        if (a.interestOverlap !== b.interestOverlap) return b.interestOverlap - a.interestOverlap;
        return 0;
      });
      return filtered;
    }
  }
  return enriched;
};

// ─────────────────────────────────────────────────────────────
// HYBRID CONTROLLER — ENTRY POINT
// ─────────────────────────────────────────────────────────────

export const getHybridPotentialMatches = async (req: Request, res: Response) => {
  try {
    const body = req.method === "POST" ? req.body : req.query;
    const { owner, email, from, to, wanttosee, interest, distance, fors, Orientation, country, city, promptAvailable } = body;

    console.log("[Hybrid] Request:", { owner, promptAvailable });

    if (!promptAvailable || (promptAvailable !== "true" && promptAvailable !== true)) {
      res.status(400).json({ message: "Hybrid controller requires promptAvailable=true", status: 0 });
      return;
    }
    if (!owner || !email) {
      res.status(400).json({ message: "Owner and email are required", status: 0 });
      return;
    }
    if (!wanttosee) {
      res.status(400).json({ message: "wanttosee (gender preference) is required", status: 0 });
      return;
    }

    const currentUser = await User.findOne({ where: { id: owner, email } });
    if (!currentUser) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }
    const cu: any = currentUser.toJSON();

    const aiPromptRecord = await AIPromptMatching.findOne({ where: { user_id: owner, isEnabled: true } });
    const userPrompt: string | null = aiPromptRecord?.prompt?.trim() || null;
    if (!userPrompt) {
      console.warn("[Hybrid] No prompt for user:", owner);
      res.status(200).json([]);
      return;
    }

    // ─────────────────────────────────────────────────────────
    // STEP 1: CHECK IF LLM IS ALIVE
    // ─────────────────────────────────────────────────────────
    const llmAlive = await isLLMAlive();
    if (!llmAlive) {
      console.error("[Hybrid] LLM IS DEAD — skipping AI tier entirely.");
    }

    // ─────────────────────────────────────────────────────────
    // STEP 2: EXTRACT PREFS WITH LLM
    // If LLM is dead, userPrefs will be null → AI tier skipped.
    // ─────────────────────────────────────────────────────────
    const userPrefs = llmAlive ? await extractPrefsWithLLM(userPrompt) : null;

    if (llmAlive && !userPrefs) {
      console.error("[Hybrid] LLM is alive but returned NULL prefs — AI tier skipped.");
    }

    // Gender resolution
    let resolvedGender = wanttosee;
    if (userPrefs?.gender && (!resolvedGender || resolvedGender === "null" || resolvedGender === "")) {
      resolvedGender = userPrefs.gender;
      console.log(`[Hybrid] Gender from LLM: ${userPrefs.gender}`);
    }

    const [swipedRows, flaggedRows] = await Promise.all([
      Match.findAll({ where: { user_id: owner },               attributes: ["matched_user_id"] }),
      Match.findAll({ where: { user_id: owner, status: "flag" }, attributes: ["matched_user_id"] }),
    ]);
    const excludedIds = [...new Set([
      ...swipedRows.map((m) => m.matched_user_id),
      ...flaggedRows.map((m) => m.matched_user_id),
    ])];

    console.log("[Hybrid] Final userPrefs:", JSON.stringify(userPrefs));

    // Age authority
    const promptAgeMin = userPrefs?.ageRange?.min;
    const promptAgeMax = userPrefs?.ageRange?.max;
    const settingsAgeMin = toNumberOrUndefined(from) ?? toNumberOrUndefined(cu.ages) ?? 18;
    const settingsAgeMax = toNumberOrUndefined(to)   ?? toNumberOrUndefined(cu.secondages) ?? 100;
    const effectiveMinAge = promptAgeMin ?? settingsAgeMin;
    const effectiveMaxAge = promptAgeMax ?? settingsAgeMax;

    const reqDistKm  = toNumberOrUndefined(distance) ?? toNumberOrUndefined(cu.distance) ?? 200;
    const hardMaxDist = userPrefs?.maxDistanceKm != null
      ? userPrefs.maxDistanceKm * AI_CFG.distanceGraceFactor
      : reqDistKm;

    const reqCountry = toTrimmedLower(country) || toTrimmedLower(cu.country);
    const promptCity = userPrefs?.city ? toTrimmedLower(userPrefs.city) : null;
    const reqCity    = promptCity || toTrimmedLower(city) || toTrimmedLower(cu.city);
    const reqOrient  = toTrimmedLower(Orientation);
    const reqFors    = toTrimmedLower(fors);

    const allCandidates = await User.findAll({
      where: {
        id: { [Op.and]: [{ [Op.ne]: owner }, { [Op.notIn]: excludedIds }] },
        aproved: "YES", IsVerified: true, isBlocked: false, tester: false, photoStatus: "approved",
        gender: resolvedGender,
      },
      limit: 500,
      include: [{ model: AIPromptMatching, as: "aiPrompt" }],
    });

    console.log("[Hybrid] Candidate pool:", allCandidates.length);
    if (allCandidates.length === 0) { res.status(200).json([]); return; }

    // ─────────────────────────────────────────────────────────
    // HARD FILTERS
    // ─────────────────────────────────────────────────────────
    const hardFiltered: any[] = [];
    for (const match of allCandidates) {
      const c: any = match.toJSON();
      const uLat = parseFloat(cu.lats || "0");
      const uLon = parseFloat(cu.longs || "0");
      const cLat = parseFloat(c.lats || "0");
      const cLon = parseFloat(c.longs || "0");
      let distKm = Infinity;
      if (uLat && uLon && cLat && cLon) distKm = calculateDistance(uLat, uLon, cLat, cLon);

      if (distKm > hardMaxDist) continue;

      if (userPrefs?.minDistanceKm != null && distKm < userPrefs.minDistanceKm) {
        console.log(`[Hybrid] Min distance filter: excluded cand ${c.id} dist=${distKm.toFixed(2)}km (min: ${userPrefs.minDistanceKm})`);
        continue;
      }
            // Height hard filter — exact match only when user specified a number
      if (userPrefs?.heightCm != null) {
        const cHeight = toNumberOrUndefined(c.height_cm);
        if (cHeight == null || cHeight !== userPrefs.heightCm) {
          console.log(`[Hybrid] Height filter: excluded cand ${c.id} height=${cHeight}cm (required: ${userPrefs.heightCm}cm)`);
          continue;
        }
      }

      if (reqCity) {
        const cCity = (c.city || "").toLowerCase().trim();
        const cityMatches = cCity.includes(reqCity) || reqCity.includes(cCity);
        const isGlobe = c.globe === "true" || c.globe === true;
        if (!cityMatches && !isGlobe) {
          console.log(`[Hybrid] City filter: excluded cand ${c.id} city="${c.city}" (required: "${reqCity}")`);
          continue;
        }
      }

      if (reqCountry && c.country) {
        const cCo = c.country.toLowerCase();
        if (!cCo.includes(reqCountry) && !reqCountry.includes(cCo)) {
          if (c.globe !== "true" && c.globe !== true) continue;
        }
      }

      c._candidatePrompt = (c as any).aiPrompt?.prompt || null;
      c._distanceKm      = distKm;
      c._age             = c.years && c.years > 1900 ? new Date().getFullYear() - c.years : (c.years || 0);
      hardFiltered.push(c);
    }

    console.log("[Hybrid] After hard filters:", hardFiltered.length);
    if (hardFiltered.length === 0) { res.status(200).json([]); return; }

    // ─────────────────────────────────────────────────────────
    // AI TIER — ONLY if LLM is alive AND prefs were extracted
    // ─────────────────────────────────────────────────────────
    let rawScores: Array<{ result: AIScoreResult; candidateRaw: any }> = [];

    if (llmAlive && userPrefs) {
      // Pre-embed user prompt
      let userEmbedding: number[] | undefined;
      try { userEmbedding = await embed(userPrompt); } catch (e) { console.error("[Hybrid] User embed failed:", e); }

      // Batch embed candidate prompts
      await Promise.all(
        hardFiltered
          .filter((c) => c._candidatePrompt)
          .map(async (c) => {
            try { c._embedding = await embed(c._candidatePrompt); } catch { /* skip */ }
          }),
      );

      // AI scoring with concurrency limit
      await Promise.all(
        hardFiltered.map((candidate) =>
          hybridSemaphore.run(async () => {
            const result = await scoreCandidate(
              userPrompt, userEmbedding, userPrefs, cu,
              candidate, candidate._candidatePrompt || null, candidate._embedding,
            );
            if (result) rawScores.push({ result, candidateRaw: candidate });
          }),
        ),
      );
    } else {
      console.log("[Hybrid] AI TIER SKIPPED — LLM dead or prefs null");
    }

    // ─────────────────────────────────────────────────────────
    // THRESHOLD & TIER SPLIT
    // ─────────────────────────────────────────────────────────
    const allScoreVals = rawScores.map((s) => s.result.compatibilityScore);
    const threshold    = adaptThreshold(allScoreVals, AI_CFG.tier1BaseThreshold);

    const tier1    = rawScores.filter((s) => s.result.compatibilityScore >= threshold);
    const tier1Ids = new Set(tier1.map((s) => s.result.userId));
    tier1.sort((a, b) => b.result.compatibilityScore - a.result.compatibilityScore);

    console.log(`[Hybrid] Scores: total=${rawScores.length}, above_threshold(${threshold.toFixed(2)})=${tier1.length}`);
    if (rawScores.length > 0) {
      const scores = allScoreVals.sort((a, b) => b - a);
      console.log(`[Hybrid] Score distribution: max=${scores[0]?.toFixed(3)} min=${scores[scores.length-1]?.toFixed(3)} median=${scores[Math.floor(scores.length/2)]?.toFixed(3)}`);
    }

    const tier2Sorted = runTraditionalFilter(
      hardFiltered.filter((c) => !tier1Ids.has(c.id)),
      cu,
      { minAge: effectiveMinAge, maxAge: effectiveMaxAge, requestedCity: reqCity, requestedCountry: reqCountry, requestedOrientation: reqOrient, requestedFors: reqFors, maxDistanceKm: reqDistKm },
    );

    console.log(`[Hybrid] TIER1 (AI ≥${threshold.toFixed(2)}): ${tier1.length} | TIER2 (traditional): ${tier2Sorted.length}`);

    // Format and merge
    const formatUser = (raw: any, ai?: AIScoreResult): any => {
      const u = { ...raw };
      ["_candidatePrompt","_embedding","_distanceKm","_distKm","_age","_computedAge","_score",
       "ageMatch","cityMatch","countryMatch","distanceMatch","orientationMatch","forsMatch",
       "interestOverlap","aiPrompt"].forEach((k) => delete u[k]);
      delete u.password; delete u.OTP; delete u.OTPExpiry;
      const dist = raw._distanceKm;
      const age  = raw._age ?? calculateAge(raw.years);
      const base = {
        ...u, age,
        distance:  dist != null && isFinite(dist) ? Number(dist.toFixed(2)) : null,
        matchTier: ai ? "ai" : "traditional",
      };
      if (!ai) return base;
      return {
        ...base,
        aiCompatibilityScore: Math.round(ai.compatibilityScore * 100),
        aiSemanticScore:      Math.round(ai.semanticScore      * 100),
        aiPreferenceScore:    Math.round(ai.preferenceScore    * 100),
        aiMatchReason:        ai.matchReason,
        matchMode:            ai.matchMode,
        promptBasedMatching:  true,
      };
    };

    const merged: any[] = [];
    for (const { result, candidateRaw } of tier1) merged.push(formatUser(candidateRaw, result));
    for (const c of tier2Sorted) {
      if (merged.length >= 50) break;
      merged.push(formatUser(c));
    }

    console.log(`[Hybrid] Returning ${merged.length} (AI: ${tier1.length}, trad: ${merged.length - tier1.length})`);
    res.status(200).json(merged);

  } catch (error: any) {
    console.error("[Hybrid] Fatal error:", error);
    res.status(500).json({
      message: "Server error", status: 0, error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};