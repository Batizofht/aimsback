///////////////////////////////// THIS CODEBASE BELONGS TO LIGHT GROUP INC. A HOLDING COMPANY OF MEINTOYOU
///////////////////////////////// AI-BASED MATCHING CONTROLLER - PRODUCTION GRADE EMBEDDING & LLM SYSTEM

import { Request, Response } from "express";
import User from "../models/User";
import Match from "../models/Match";
import AIPromptMatching from "../models/AIPromptMatching";
import { calculateDistance } from "../utils/distance";
import { Op } from "sequelize";
import { pipeline } from '@xenova/transformers';

// ─────────────────────────────────────────────────────────────
// CONFIGURATION: Set these in your .env file
// ─────────────────────────────────────────────────────────────

interface AIConfig {
  provider: "huggingface" | "openai" | "cohere" | "openrouter" | "custom";
  embeddingUrl: string;
  embeddingModel: string;
  llmUrl: string;
  llmModel: string;
  apiKey: string;
  embeddingDim: number;
  batchSize: number;
  timeoutMs: number;
  maxRetries: number;
  minCompatibilityThreshold: number;
  semanticWeight: number;
  preferenceWeight: number;
}

const AI_CONFIG: AIConfig = {
  provider: (process.env.AI_PROVIDER as any) || "huggingface",
  embeddingUrl: process.env.AI_EMBEDDING_URL || "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
  embeddingModel: process.env.AI_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2",
  llmUrl: process.env.AI_LLM_URL || "",
  llmModel: process.env.AI_LLM_MODEL || "",
  apiKey: process.env.AI_API_KEY || "",
  embeddingDim: parseInt(process.env.AI_EMBEDDING_DIM || "384"),
  batchSize: parseInt(process.env.AI_BATCH_SIZE || "32"),
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || "30000"),
  maxRetries: parseInt(process.env.AI_MAX_RETRIES || "3"),
  minCompatibilityThreshold: parseFloat(process.env.AI_MIN_THRESHOLD || "0.72"),
  semanticWeight: 0.6,
  preferenceWeight: 0.4,
};

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface AIMatchResult {
  userId: number;
  compatibilityScore: number;
  matchReason: string;
  semanticScore: number;
  preferenceScore: number;
  extractedPreferences?: ExtractedPreferences;
}

interface ExtractedPreferences {
  ageRange?: { min: number; max: number };
  distance?: number;
  location?: string;
  interests?: string[];
  relationshipType?: string;
  dealbreakers?: string[];
}

interface EmbeddingCache {
  [userId: number]: {
    vector: number[];
    textHash: string;
    timestamp: number;
  };
}

interface UserProfile {
  id?: number;
  bio?: string;
  interest?: string;
  fors?: string;
  Orientation?: string;
  education?: string;
  occupation?: string;
  industry?: string;
  city?: string;
  country?: string;
  years?: number;
  religion?: string;
  smoking?: string;
  drinking?: string;
  exercise?: string;
  languages?: string;
  pets_dogs?: boolean | null;
  pets_cats?: boolean | null;
  pets_other?: boolean | null;
  loveLanguages?: string;
  lovelanguages?: string;
  hasKids?: boolean | null;
  wantsKids?: boolean | null;
  relationshipStatus?: string;
  height_cm?: number;
  lats?: string;
  longs?: string;
  gender?: string;
  globe?: string | boolean;
  lastActiveAt?: Date;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────
// IN-MEMORY EMBEDDING CACHE (Redis recommended for production)
// ─────────────────────────────────────────────────────────────

export const embeddingCache: EmbeddingCache = {};
export const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// ─────────────────────────────────────────────────────────────
// UTILITY: Profile text synthesis
// ─────────────────────────────────────────────────────────────

const buildSyntheticProfile = (user: UserProfile): string => {
  const parts: string[] = [];
  
  if (user.bio) parts.push(`About me: ${user.bio}`);
  if (user.interest) parts.push(`I enjoy: ${user.interest}`);
  if (user.fors) parts.push(`Looking for: ${user.fors}`);
  if (user.Orientation) parts.push(`Orientation: ${user.Orientation}`);
  if (user.education) parts.push(`Education: ${user.education}`);
  if (user.occupation) parts.push(`Work: ${user.occupation} in ${user.industry || "my field"}`);
  if (user.city && user.country) parts.push(`Located in: ${user.city}, ${user.country}`);
  if (user.years) {
    const age = user.years > 1900 ? new Date().getFullYear() - user.years : user.years;
    parts.push(`Age: ${age}`);
  }
  if (user.religion) parts.push(`Religion: ${user.religion}`);
  if (user.smoking) parts.push(`Smoking: ${user.smoking}`);
  if (user.drinking) parts.push(`Drinking: ${user.drinking}`);
  if (user.exercise) parts.push(`Exercise: ${user.exercise}`);
  if (user.languages) parts.push(`Languages: ${user.languages}`);
  if (user.pets_dogs || user.pets_cats || user.pets_other) {
    const pets = [];
    if (user.pets_dogs) pets.push("dogs");
    if (user.pets_cats) pets.push("cats");
    if (user.pets_other) pets.push("other pets");
    parts.push(`Pets: ${pets.join(", ")}`);
  }
  if (user.loveLanguages || user.lovelanguages) {
    parts.push(`Love languages: ${user.loveLanguages || user.lovelanguages}`);
  }
  if (user.hasKids !== undefined) parts.push(`Have children: ${user.hasKids ? "yes" : "no"}`);
  if (user.wantsKids !== undefined) parts.push(`Want children: ${user.wantsKids ? "yes" : "no"}`);
  if (user.relationshipStatus) parts.push(`Relationship status: ${user.relationshipStatus}`);
  if (user.height_cm) parts.push(`Height: ${user.height_cm}cm`);

  return parts.join(". ") || "No profile information available.";
};

// ─────────────────────────────────────────────────────────────
// UTILITY: Preference extraction with NLP patterns
// ─────────────────────────────────────────────────────────────

const extractAgeFromText = (text: string): { min: number; max: number } | undefined => {
  const patterns = [
    /(\d+)\s*(?:-\s*|to\s*|–\s*)(\d+)\s*(?:years?\s*old|y\.?o\.?|age)?/i,
    /(?:between\s+)(\d+)(?:\s+and\s+|\s*-\s*)(\d+)/i,
    /(?:age\s+)?(\d+)\+?\s*(?:years?\s*old|y\.?o\.?)?/i,
    /(?:around\s+|about\s+)(\d+)/i,
    /(\d+)\s*[-–]\s*(\d+)\s*(?:years?\s*old)?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        return { min: parseInt(match[1]), max: parseInt(match[2]) };
      }
      const age = parseInt(match[1]);
      return { min: Math.max(18, age - 5), max: age + 5 };
    }
  }
  return undefined;
};

const extractDistanceFromText = (text: string): number | undefined => {
  const patterns = [
    /within\s+(\d+)\s*(km|kilometers?|miles?|mi)/i,
    /(\d+)\s*(km|kilometers?|miles?|mi)\s*(?:radius|away|distance)/i,
    /(?:close|near|nearby|local)\s*(?:within\s+)?(\d+)?/i,
    /same\s+(city|town|area|neighborhood)/i,
    /(?:max\s+)?distance\s*(?:of\s+)?(\d+)\s*(km|mi)?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) {
        const value = parseInt(match[1]);
        const unit = match[2]?.toLowerCase() || "km";
        return unit.startsWith("mi") ? Math.round(value * 1.60934) : value;
      }
      if (match[0].toLowerCase().includes("same")) return 15;
    }
  }
  return undefined;
};

const extractLocationFromText = (text: string): string | undefined => {
  const patterns = [
    /(?:in|near|around|from|living\s+in|based\s+in|located\s+in)\s+([A-Za-z\s]+(?:,\s*[A-Za-z\s]+)?)/i,
    /([A-Za-z\s]+(?:,\s*[A-Za-z\s]+)?)\s*(?:area|region|city)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().replace(/[^\w\s,]/g, "");
    }
  }
  return undefined;
};

const extractInterestsFromText = (text: string): string[] | undefined => {
  const patterns = [
    /(?:interested\s+in|like|love|enjoy|into|passionate\s+about)\s+([^.]+)/i,
    /hobbies?\s*(?:include|:)?\s+([^.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]
        .split(/,|and|&/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 2);
    }
  }
  return undefined;
};

const extractRelationshipType = (text: string): string | undefined => {
  const types = [
    { keywords: ["long-term", "serious", "marriage", "commitment", "life partner"], value: "serious" },
    { keywords: ["casual", "fun", "dating", "short-term"], value: "casual" },
    { keywords: ["friends", "friendship", "platonic"], value: "friends" },
    { keywords: ["hookup", "nsa", "physical"], value: "hookup" },
  ];

  const lower = text.toLowerCase();
  for (const type of types) {
    if (type.keywords.some(k => lower.includes(k))) return type.value;
  }
  return undefined;
};

const extractDealbreakers = (text: string): string[] => {
  const patterns = [
    /(?:deal\s*breaker|dealbreaker|no\s+|don't\s+want|must\s+not|can't\s+stand)\s+([^.]+)/gi,
    /(?:non-smoker|no\s+smoking|no\s+drugs|no\s+kids|must\s+have)/gi,
  ];

  const dealbreakers: string[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      dealbreakers.push(match[1]?.trim() || match[0].trim());
    }
  }
  return dealbreakers;
};

const extractPreferencesFromPrompt = (prompt: string): ExtractedPreferences => {
  return {
    ageRange: extractAgeFromText(prompt),
    distance: extractDistanceFromText(prompt),
    location: extractLocationFromText(prompt),
    interests: extractInterestsFromText(prompt),
    relationshipType: extractRelationshipType(prompt),
    dealbreakers: extractDealbreakers(prompt),
  };
};

// ─────────────────────────────────────────────────────────────
// CORE: REAL EMBEDDING API CALLS
// ─────────────────────────────────────────────────────────────

const generateHash = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return String(hash);
};


let embedder: any = null;

const getEmbeddingWithRetry = async (text: string, retries = AI_CONFIG.maxRetries): Promise<number[]> => {
  const cacheKey = generateHash(text);
  
  // Check cache
  for (const [userId, entry] of Object.entries(embeddingCache)) {
    if (entry.textHash === cacheKey && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.vector;
    }
  }

  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  const output = await embedder(text, { pooling: 'mean', normalize: true });
  const embedding: number[] = Array.from(output.data);

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Empty embedding received");
  }

  // Store in cache
  embeddingCache[-1] = {
    vector: embedding,
    textHash: cacheKey,
    timestamp: Date.now(),
  };

  return embedding;
};
// ─────────────────────────────────────────────────────────────
// CORE: BATCH EMBEDDING FOR PERFORMANCE
// ─────────────────────────────────────────────────────────────

const getBatchEmbeddings = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];
  if (texts.length === 1) return [await getEmbeddingWithRetry(texts[0])];

  // Process in batches
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += AI_CONFIG.batchSize) {
    const batch = texts.slice(i, i + AI_CONFIG.batchSize);
    const batchPromises = batch.map(text => getEmbeddingWithRetry(text));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  return results;
};

// ─────────────────────────────────────────────────────────────
// CORE: COSINE SIMILARITY
// ─────────────────────────────────────────────────────────────

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// ─────────────────────────────────────────────────────────────
// CORE: LLM-POWERED COMPATIBILITY REASONING
// ─────────────────────────────────────────────────────────────

const generateMatchReason = async (
  userPrompt: string,
  candidatePrompt: string,
  candidateProfile: UserProfile,
  semanticScore: number,
  preferenceScore: number
): Promise<string> => {
  if (!AI_CONFIG.llmUrl || !AI_CONFIG.llmModel) {
    // Fallback to template-based reasons
    if (semanticScore > 0.85) return "Exceptional compatibility: your personalities, values, and desires align deeply.";
    if (semanticScore > 0.75) return "Strong compatibility: shared outlook on life and relationships.";
    if (preferenceScore > 0.8) return "Great lifestyle match: your practical preferences align well.";
    return "Good potential match with some shared interests.";
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeoutMs);

    const response = await fetch(AI_CONFIG.llmUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_CONFIG.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_CONFIG.llmModel,
        messages: [
          {
            role: "system",
            content: "You are a dating app's matchmaking AI. Analyze two users' dating prompts and generate ONE concise, warm sentence (max 20 words) explaining why they match. Be specific but respectful. Never mention scores or algorithms."
          },
          {
            role: "user",
            content: `User A says: "${userPrompt.substring(0, 500)}"
            
Candidate says: "${candidatePrompt.substring(0, 500)}"
Candidate profile: ${buildSyntheticProfile(candidateProfile).substring(0, 300)}

Generate one warm, specific match reason.`
          }
        ],
        max_tokens: 60,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("LLM API error");

    const data: any = await response.json();
    const reason = data.choices?.[0]?.message?.content?.trim() ||
                   data.choices?.[0]?.text?.trim() ||
                   data.response?.trim();

    return reason || "Compatible match based on shared values and interests.";
  } catch (error) {
    // Silent fallback to templates
    if (semanticScore > 0.85) return "Deep compatibility: your relationship goals and personalities align exceptionally.";
    if (semanticScore > 0.75) return "Strong match: shared values and complementary lifestyles.";
    return "Promising match with aligned interests and preferences.";
  }
};

// ─────────────────────────────────────────────────────────────
// CORE: PREFERENCE ALIGNMENT SCORING
// ─────────────────────────────────────────────────────────────

const calculatePreferenceAlignment = (
  userPrefs: ExtractedPreferences,
  candidate: UserProfile,
  currentUser: UserProfile
): { score: number; violations: string[] } => {
  let score = 0.5; // Neutral baseline
  const violations: string[] = [];
  let checks = 0;

  // Age alignment
  if (userPrefs.ageRange && candidate.years) {
    checks++;
    const candAge = candidate.years > 1900 
      ? new Date().getFullYear() - candidate.years 
      : candidate.years;
    
    if (candAge >= userPrefs.ageRange.min && candAge <= userPrefs.ageRange.max) {
      score += 0.15;
    } else {
      const dist = Math.min(
        Math.abs(candAge - userPrefs.ageRange.min),
        Math.abs(candAge - userPrefs.ageRange.max)
      );
      score -= Math.min(0.2, dist * 0.02);
      violations.push(`Age ${candAge} outside preferred range`);
    }
  }

  // Distance alignment
  if (userPrefs.distance && currentUser.lats && currentUser.longs && candidate.lats && candidate.longs) {
    checks++;
    const dist = calculateDistance(
      parseFloat(currentUser.lats),
      parseFloat(currentUser.longs),
      parseFloat(candidate.lats),
      parseFloat(candidate.longs)
    );
    if (dist <= userPrefs.distance) {
      score += 0.15;
    } else {
      score -= Math.min(0.2, (dist - userPrefs.distance) * 0.005);
      violations.push(`Distance ${Math.round(dist)}km exceeds ${userPrefs.distance}km preference`);
    }
  }

  // Location alignment
  if (userPrefs.location) {
    checks++;
    const loc = userPrefs.location.toLowerCase();
    const candCity = (candidate.city || "").toLowerCase();
    const candCountry = (candidate.country || "").toLowerCase();
    
    if (candCity.includes(loc) || candCountry.includes(loc) || loc.includes(candCity) || loc.includes(candCountry)) {
      score += 0.1;
    } else {
      score -= 0.05;
    }
  }

  // Interest overlap
  if (userPrefs.interests && candidate.interest) {
    checks++;
    const userInterestSet = new Set(userPrefs.interests);
    const candInterests = candidate.interest.toLowerCase().split(/,|;/).map(s => s.trim());
    const overlap = candInterests.filter(i => userInterestSet.has(i) || 
      Array.from(userInterestSet).some(ui => i.includes(ui) || ui.includes(i)));
    
    if (overlap.length > 0) {
      score += Math.min(0.15, overlap.length * 0.05);
    }
  }

  // Relationship type alignment
  if (userPrefs.relationshipType && candidate.fors) {
    checks++;
    const candType = extractRelationshipType(candidate.fors);
    if (candType === userPrefs.relationshipType) {
      score += 0.1;
    } else if (candType && userPrefs.relationshipType === "serious" && candType === "casual") {
      score -= 0.15; // Strong mismatch
      violations.push("Different relationship goals");
    }
  }

  // Dealbreaker check
  if (userPrefs.dealbreakers && userPrefs.dealbreakers.length > 0) {
    const profileText = buildSyntheticProfile(candidate).toLowerCase();
    for (const dealbreaker of userPrefs.dealbreakers) {
      if (profileText.includes(dealbreaker.toLowerCase())) {
        score -= 0.3;
        violations.push(`Dealbreaker detected: ${dealbreaker}`);
      }
    }
  }

  // Normalize by number of checks to prevent over-penalization
  if (checks > 0) {
    score = 0.3 + (score * 0.7); // Rescale to 0-1 range
  }

  return { 
    score: Math.max(0, Math.min(1, score)), 
    violations 
  };
};

// ─────────────────────────────────────────────────────────────
// CORE: FULL AI COMPATIBILITY CALCULATION
// ─────────────────────────────────────────────────────────────

const calculateAICompatibility = async (
  userPrompt: string,
  candidatePrompt: string | null,
  candidateProfile: UserProfile,
  currentUser: UserProfile,
  userPrefs: ExtractedPreferences,
  userEmbedding?: number[],
  candidateEmbedding?: number[]
): Promise<{ score: number; reason: string; semanticScore: number; preferenceScore: number }> => {
  
  let semanticScore = 0;
  let preferenceScore = 0;

  // MODE 1: Prompt-to-Prompt (Highest quality)
  if (userPrompt && candidatePrompt && userEmbedding && candidateEmbedding) {
    semanticScore = cosineSimilarity(userEmbedding, candidateEmbedding);
    
    const candPrefs = extractPreferencesFromPrompt(candidatePrompt);
    const { score: prefScore } = calculatePreferenceAlignment(candPrefs, currentUser, candidateProfile);
    preferenceScore = prefScore;

  // MODE 2: Prompt-to-Profile (User has prompt, candidate doesn't)
  } else if (userPrompt && !candidatePrompt && userEmbedding) {
    const syntheticProfile = buildSyntheticProfile(candidateProfile);
    const candidateEmbedding = await getEmbeddingWithRetry(syntheticProfile);
    semanticScore = cosineSimilarity(userEmbedding, candidateEmbedding) * 0.92;
    
    const { score: prefScore } = calculatePreferenceAlignment(userPrefs, candidateProfile, currentUser);
    preferenceScore = prefScore;

  // MODE 3: Profile-to-Prompt (Candidate has prompt, user doesn't)
  } else if (!userPrompt && candidatePrompt && candidateEmbedding) {
    const syntheticProfile = buildSyntheticProfile(currentUser);
    const userEmbedding = await getEmbeddingWithRetry(syntheticProfile);
    semanticScore = cosineSimilarity(userEmbedding, candidateEmbedding) * 0.92;
    
    const candPrefs = extractPreferencesFromPrompt(candidatePrompt);
    const { score: prefScore } = calculatePreferenceAlignment(candPrefs, currentUser, candidateProfile);
    preferenceScore = prefScore;

  // MODE 4: Profile-to-Profile (Neither has prompt)
  } else {
    const [userEmb, candEmb] = await Promise.all([
      getEmbeddingWithRetry(buildSyntheticProfile(currentUser)),
      getEmbeddingWithRetry(buildSyntheticProfile(candidateProfile))
    ]);
    semanticScore = cosineSimilarity(userEmb, candEmb) * 0.85;
    
    // Use profile-based preference inference
    const { score: prefScore } = calculatePreferenceAlignment(userPrefs, candidateProfile, currentUser);
    preferenceScore = prefScore;
  }

  // Weighted combination
  const combinedScore = 
    (semanticScore * AI_CONFIG.semanticWeight) + 
    (preferenceScore * AI_CONFIG.preferenceWeight);

  // Generate human-readable reason
  const reason = await generateMatchReason(
    userPrompt || buildSyntheticProfile(currentUser),
    candidatePrompt || buildSyntheticProfile(candidateProfile),
    candidateProfile,
    semanticScore,
    preferenceScore
  );

  return {
    score: Math.max(0, Math.min(1, combinedScore)),
    reason,
    semanticScore,
    preferenceScore,
  };
};

// ─────────────────────────────────────────────────────────────
// CONTROLLER: Get AI-based potential matches
// ─────────────────────────────────────────────────────────────

export const getAIPotentialMatches = async (req: Request, res: Response) => {
  try {
    const {
      owner,
      email,
      from,
      to,
      wanttosee,
      interest,
      distance,
      fors,
      Orientation,
      country,
      city,
      promptAvailable,
      limit = 50,
      offset = 0,
    } = req.method === "POST" ? req.body : req.query;

    console.log("[AIPotentialMatches] Request:", { owner, promptAvailable, limit, offset });

    if (!owner || !email) {
      res.status(400).json({ message: "Owner and email are required", status: 0 });
      return;
    }

    const currentUser = await User.findOne({
      where: { id: owner, email: email },
      include: [{ model: AIPromptMatching, as: "aiPrompt" }],
    });

    if (!currentUser) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    const currentUserData: UserProfile = currentUser.toJSON();
    const userPrompt = currentUserData.aiPrompt?.prompt || null;
    const hasUserPrompt = !!userPrompt && userPrompt.trim().length > 0;

    // Get already swiped users
    const swipedUsers = await Match.findAll({
      where: { user_id: owner },
      attributes: ["matched_user_id"],
    });
    const swipedUserIds = swipedUsers.map((m) => m.matched_user_id);

    // Base conditions
    const baseConditions: any = {
      id: { [Op.and]: [{ [Op.ne]: owner }, { [Op.notIn]: swipedUserIds }] },
      aproved: "YES",
      IsVerified: true,
      isBlocked: false,
      tester: false,
      photoStatus: "approved",
    };

    if (!wanttosee) {
      res.status(400).json({ message: "wanttosee (gender preference) is required", status: 0 });
      return;
    }
    baseConditions.gender = wanttosee;

    // Extract preferences
    const promptPreferences = hasUserPrompt ? extractPreferencesFromPrompt(userPrompt) : {};
    
    const minAge = promptPreferences.ageRange?.min ?? (from ?? currentUserData.ages ?? 18);
    const maxAge = promptPreferences.ageRange?.max ?? (to ?? currentUserData.secondages ?? 100);
    const maxDistance = promptPreferences.distance ?? (distance ?? 100);

    // Fetch candidates
    const allMatches = await User.findAll({
      where: baseConditions,
      limit: 500, // Fetch more for AI scoring
      include: [{ model: AIPromptMatching, as: "aiPrompt" }],
    });

    console.log("[AIPotentialMatches] Candidates after base filter:", allMatches.length);

    if (allMatches.length === 0) {
      res.status(200).json({ matches: [], total: 0, page: 0 });
      return;
    }

    // Pre-compute user embedding if they have a prompt
    let userEmbedding: number[] | undefined;
    if (hasUserPrompt) {
      try {
        userEmbedding = await getEmbeddingWithRetry(userPrompt);
      } catch (e) {
        console.error("[AIPotentialMatches] User embedding failed:", e);
      }
    }

    // Process candidates with early termination for hard filters
    const candidateData: Array<{
      user: UserProfile;
      prompt: string | null;
      embedding?: number[];
      distanceKm: number;
      age: number;
    }> = [];

    for (const match of allMatches) {
      const candidate: UserProfile = match.toJSON();
      
      // Hard filter: Distance
      const userLat = parseFloat(currentUserData.lats || "0");
      const userLon = parseFloat(currentUserData.longs || "0");
      const candLat = parseFloat(candidate.lats || "0");
      const candLon = parseFloat(candidate.longs || "0");
      
      let distanceKm = Infinity;
      if (userLat && userLon && candLat && candLon) {
        distanceKm = calculateDistance(userLat, userLon, candLat, candLon);
      }
      if (distanceKm > maxDistance) continue;

      // Hard filter: Age
      const candAge = candidate.years && candidate.years > 1900 
        ? new Date().getFullYear() - candidate.years 
        : (candidate.years || 0);
      if (candAge < minAge || candAge > maxAge) continue;

      // Hard filter: Country
      const requestedCountry = country && country !== 'null' 
        ? country.toLowerCase() 
        : (currentUserData.country || '').toLowerCase();
      if (requestedCountry && candidate.country) {
        const candCountry = candidate.country.toLowerCase();
        if (!candCountry.includes(requestedCountry) && !requestedCountry.includes(candCountry)) {
          if (candidate.globe !== 'true' && candidate.globe !== true) continue;
        }
      }

      // Hard filter: City from prompt
      if (promptPreferences.location) {
        const promptLoc = promptPreferences.location.toLowerCase();
        const candCity = (candidate.city || "").toLowerCase();
        const candCountry = (candidate.country || "").toLowerCase();
        if (!candCity.includes(promptLoc) && !candCountry.includes(promptLoc) && 
            !promptLoc.includes(candCity) && !promptLoc.includes(candCountry)) {
          continue;
        }
      }

      candidateData.push({
        user: candidate,
        prompt: candidate.aiPrompt?.prompt || null,
        distanceKm,
        age: candAge,
      });
    }

    console.log("[AIPotentialMatches] After hard filters:", candidateData.length);

    // Batch fetch embeddings for candidates with prompts
    const candidatesWithPrompts = candidateData.filter(c => c.prompt);
    if (candidatesWithPrompts.length > 0) {
      const promptTexts = candidatesWithPrompts.map(c => c.prompt!);
      try {
        const embeddings = await getBatchEmbeddings(promptTexts);
        candidatesWithPrompts.forEach((c, i) => {
          c.embedding = embeddings[i];
        });
      } catch (e) {
        console.error("[AIPotentialMatches] Batch embedding failed:", e);
      }
    }

    // Calculate AI compatibility for all candidates
    const aiResults: AIMatchResult[] = [];
    
    const compatibilityPromises = candidateData.map(async (candidate) => {
      try {
        const result = await calculateAICompatibility(
          userPrompt,
          candidate.prompt,
          candidate.user,
          currentUserData,
          promptPreferences,
          userEmbedding,
          candidate.embedding
        );

        // Dynamic threshold based on match quality
        const hasPromptMatch = hasUserPrompt && candidate.prompt;
        const minThreshold = hasPromptMatch ? 0.68 : 0.62;

        if (result.score >= minThreshold) {
          aiResults.push({
            userId: candidate.user.id!,
            compatibilityScore: result.score,
            matchReason: result.reason,
            semanticScore: result.semanticScore,
            preferenceScore: result.preferenceScore,
            extractedPreferences: promptPreferences,
          });
        }
      } catch (e) {
        console.error(`[AIPotentialMatches] Compatibility calc failed for user ${candidate.user.id}:`, e);
      }
    });

    await Promise.all(compatibilityPromises);

    // Sort by compatibility score descending
    aiResults.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Pagination
    const totalResults = aiResults.length;
    const paginatedResults = aiResults.slice(offset, offset + limit);
    const topMatchIds = paginatedResults.map(r => r.userId);

    if (topMatchIds.length === 0) {
      res.status(200).json({ matches: [], total: 0, page: Math.floor(offset / limit) });
      return;
    }

    // Fetch full user data for results
    const finalUsers = await User.findAll({
      where: { id: { [Op.in]: topMatchIds } },
    });

    const finalMatches = topMatchIds.map(id => {
      const user = finalUsers.find((u: any) => u.id === id);
      const aiResult = aiResults.find(r => r.userId === id);
      if (!user || !aiResult) return null;

      const userData: any = user.toJSON();
      const candidateInfo = candidateData.find(c => c.user.id === id);

      // Sanitize
      delete userData.password;
      delete userData.OTP;
      delete userData.OTPExpiry;

      return {
        ...userData,
        age: candidateInfo?.age,
        distance: candidateInfo?.distanceKm ? Number(candidateInfo.distanceKm.toFixed(2)) : null,
        aiCompatibilityScore: Math.round(aiResult.compatibilityScore * 100),
        aiSemanticScore: Math.round(aiResult.semanticScore * 100),
        aiPreferenceScore: Math.round(aiResult.preferenceScore * 100),
        aiMatchReason: aiResult.matchReason,
        promptBasedMatching: hasUserPrompt,
        matchMode: hasUserPrompt && candidateInfo?.prompt ? "prompt-to-prompt" :
                   hasUserPrompt ? "prompt-to-profile" :
                   candidateInfo?.prompt ? "profile-to-prompt" : "profile-to-profile",
      };
    }).filter(Boolean);

    console.log("[AIPotentialMatches] Returning:", finalMatches.length, "matches");
    
    res.status(200).json({
      matches: finalMatches,
      total: totalResults,
      page: Math.floor(offset / limit),
      hasMore: offset + limit < totalResults,
    });

  } catch (error: any) {
    console.error("[AIPotentialMatches] Fatal error:", error);
    res.status(500).json({ 
      message: "Server error", 
      status: 0, 
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined 
    });
  }
};

// ─────────────────────────────────────────────────────────────
// CONTROLLER: Save/Update user prompt
// ─────────────────────────────────────────────────────────────

export const saveUserPrompt = async (req: Request, res: Response) => {
  try {
    const { userId, prompt } = req.body;
    
    if (!userId || !prompt) {
      res.status(400).json({ message: "User ID and prompt are required", status: 0 });
      return;
    }
    
    const wordCount = prompt.trim().split(/\s+/).length;
    if (wordCount > 1500) {
      res.status(400).json({ message: "Prompt exceeds 1500 word limit", status: 0 });
      return;
    }

    // Pre-validate by generating embedding (catches API issues early)
    let embeddingValid = false;
    try {
      await getEmbeddingWithRetry(prompt.substring(0, 500));
      embeddingValid = true;
    } catch (e) {
      console.warn("[SaveUserPrompt] Embedding pre-check failed:", e);
    }
    
    const [aiPrompt, created] = await AIPromptMatching.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        prompt: prompt.trim(),
        isEnabled: true,
        lastUpdated: new Date(),
      },
    });
    
    if (!created) {
      await aiPrompt.update({
        prompt: prompt.trim(),
        lastUpdated: new Date(),
        isEnabled: true,
      });
    }

    // Invalidate cache
    delete embeddingCache[userId as any];
    
    res.status(200).json({
      message: "Prompt saved successfully",
      status: 1,
      data: {
        id: aiPrompt.id,
        prompt: aiPrompt.prompt,
        isEnabled: aiPrompt.isEnabled,
        lastUpdated: aiPrompt.lastUpdated,
        embeddingStatus: embeddingValid ? "ready" : "pending",
      },
    });
    
  } catch (error: any) {
    console.error("[SaveUserPrompt] Error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CONTROLLER: Get user prompt
// ─────────────────────────────────────────────────────────────

export const getUserPrompt = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }
    
    const aiPrompt = await AIPromptMatching.findOne({
      where: { user_id: Number(userId) },
    });

    if (!aiPrompt) {
      res.status(200).json({ hasPrompt: false, prompt: null, isEnabled: false });
      return;
    }
    
    res.status(200).json({
      hasPrompt: true,
      prompt: aiPrompt.prompt,
      isEnabled: aiPrompt.isEnabled,
      lastUpdated: aiPrompt.lastUpdated,
      embeddingStatus: (aiPrompt as any).embeddingStatus || "unknown",
    });
    
  } catch (error: any) {
    console.error("[GetUserPrompt] Error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CONTROLLER: Toggle AI matching
// ─────────────────────────────────────────────────────────────

export const toggleAIMatching = async (req: Request, res: Response) => {
  try {
    const { userId, enabled } = req.body;
    
    if (!userId || enabled === undefined) {
      res.status(400).json({ message: "User ID and enabled status are required", status: 0 });
      return;
    }

    const userIdNum = Number(userId);
    if (!Number.isFinite(userIdNum)) {
      res.status(400).json({ message: "User ID must be a valid number", status: 0 });
      return;
    }

    const enabledBool =
      typeof enabled === "boolean"
        ? enabled
        : String(enabled).toLowerCase() === "true";
    
    const aiPrompt = await AIPromptMatching.findOne({
      where: { user_id: userIdNum },
    });
    
    if (!aiPrompt) {
      res.status(404).json({ message: "No prompt found for user", status: 0 });
      return;
    }
    
    await aiPrompt.update({ isEnabled: enabledBool });
    
    res.status(200).json({
      message: `AI matching ${enabledBool ? "enabled" : "disabled"}`,
      status: 1,
      isEnabled: aiPrompt.isEnabled,
    });
    
  } catch (error: any) {
    console.error("[ToggleAIMatching] Error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CONTROLLER: Delete user prompt
// ─────────────────────────────────────────────────────────────

export const deleteUserPrompt = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      res.status(400).json({ message: "Invalid User ID", status: 0 });
      return;
    }

    await AIPromptMatching.destroy({
      where: { user_id: userIdNum },
    });
    
    // Invalidate cache
    delete embeddingCache[userId as any];
    
    res.status(200).json({ message: "Prompt deleted successfully", status: 1 });
    
  } catch (error: any) {
    console.error("[DeleteUserPrompt] Error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CONTROLLER: Health check / embedding test
// ─────────────────────────────────────────────────────────────

export const testEmbedding = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const testText = text || "I am looking for a serious relationship with someone who loves hiking and lives in New York.";
    
    const start = Date.now();
    const embedding = await getEmbeddingWithRetry(testText);
    const duration = Date.now() - start;
    
    res.status(200).json({
      status: 1,
      provider: AI_CONFIG.provider,
      model: AI_CONFIG.embeddingModel,
      dimension: embedding.length,
      expectedDim: AI_CONFIG.embeddingDim,
      durationMs: duration,
      sample: embedding.slice(0, 5),
      textProcessed: testText.substring(0, 100),
    });
  } catch (error: any) {
    res.status(500).json({
      status: 0,
      error: error.message,
      config: {
        provider: AI_CONFIG.provider,
        url: AI_CONFIG.embeddingUrl,
        hasKey: !!AI_CONFIG.apiKey,
      }
    });
  }
};

// ─────────────────────────────────────────────────────────────
// CONTROLLER: Batch pre-compute embeddings (admin/background)
// ─────────────────────────────────────────────────────────────

export const precomputeEmbeddings = async (req: Request, res: Response) => {
  try {
    const { userIds } = req.body;
    
    const where: any = { isEnabled: true };
    if (userIds?.length > 0) {
      where.user_id = { [Op.in]: userIds };
    }

    const prompts = await AIPromptMatching.findAll({ where });
    
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    for (const prompt of prompts) {
      try {
        const text = (prompt as any).prompt;
        if (!text) continue;
        
        const embedding = await getEmbeddingWithRetry(text);
        embeddingCache[(prompt as any).user_id] = {
          vector: embedding,
          textHash: generateHash(text),
          timestamp: Date.now(),
        };
        results.success++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`User ${(prompt as any).user_id}: ${e.message}`);
      }
    }
    
    res.status(200).json({
      status: 1,
      processed: results.success + results.failed,
      success: results.success,
      failed: results.failed,
      errors: results.errors.slice(0, 10), // Limit error output
    });
    
  } catch (error: any) {
    res.status(500).json({ status: 0, error: error.message });
  }
};