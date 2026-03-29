export type ScreenplayBlock = {
  id: string;
  text: string;
  normalizedText: string;
  wordSet: Set<string>;
};

export type MatchResult = {
  matchedBlockId: string | null;
  confidence: number;
  reason:
    | "exact"
    | "substring"
    | "token-overlap"
    | "fuzzy"
    | "fallback-top"
    | "empty-query";
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "with",
]);
const MIN_CONSECUTIVE_WORDS = 4;

export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  return normalizeForMatch(input)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function buildScreenplayBlocksFromText(rawText: string): ScreenplayBlock[] {
  const normalized = rawText.replace(/\r\n/g, "\n");
  const chunks = normalized
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((text, index) => {
    const normalizedText = normalizeForMatch(text);
    return {
      id: `screenplay-block-${index}`,
      text,
      normalizedText,
      wordSet: new Set(tokenize(text)),
    };
  });
}

export function findBestScreenplayMatch(
  frameText: string,
  blocks: ScreenplayBlock[]
): MatchResult {
  const normalizedFrameText = normalizeForMatch(frameText);
  if (!normalizedFrameText) {
    return { matchedBlockId: null, confidence: 0, reason: "empty-query" };
  }

  if (blocks.length === 0) {
    return { matchedBlockId: null, confidence: 0, reason: "fallback-top" };
  }

  // Step B: direct matching pipeline before fuzzy logic.
  const exactBlock = blocks.find((block) => block.normalizedText === normalizedFrameText);
  if (exactBlock) {
    return { matchedBlockId: exactBlock.id, confidence: 1, reason: "exact" };
  }

  const phraseBlock = blocks.find(
    (block) =>
      block.normalizedText.includes(normalizedFrameText) ||
      normalizedFrameText.includes(block.normalizedText)
  );
  if (phraseBlock) {
    return { matchedBlockId: phraseBlock.id, confidence: 0.93, reason: "substring" };
  }

  const queryTokens = tokenize(frameText);
  const queryWords = splitWords(normalizedFrameText);
  if (queryTokens.length === 0) {
    return { matchedBlockId: null, confidence: 0, reason: "fallback-top" };
  }

  let bestId: string | null = null;
  let bestScore = 0;
  let bestConsecutiveRun = 0;
  let bestReason: MatchResult["reason"] = "fallback-top";

  for (const block of blocks) {
    const tokenOverlap = getTokenOverlapScore(queryTokens, block.wordSet);
    const fuzzy = getStringSimilarity(normalizedFrameText, block.normalizedText);
    const consecutiveRun = getLongestConsecutiveWordRun(
      queryWords,
      splitWords(block.normalizedText)
    );

    // Weighted lightweight score:
    // - overlap handles semantic closeness from frame text
    // - fuzzy handles phrasing and order similarity
    // - consecutive run enforces phrase continuity (V1 rule: >=4 words)
    const continuityBoost = Math.min(consecutiveRun / 8, 1) * 0.45;
    const score = tokenOverlap * 0.5 + fuzzy * 0.25 + continuityBoost;

    if (score > bestScore) {
      bestScore = score;
      bestId = block.id;
      bestConsecutiveRun = consecutiveRun;
      bestReason =
        consecutiveRun >= MIN_CONSECUTIVE_WORDS
          ? "substring"
          : tokenOverlap >= fuzzy
            ? "token-overlap"
            : "fuzzy";
    }
  }

  // Guardrail for better precision:
  // We only accept fuzzy/token matches when there is a contiguous 4-word phrase match.
  // This keeps "semantic-ish but wrong" matches from hijacking navigation.
  if (bestConsecutiveRun < MIN_CONSECUTIVE_WORDS) {
    return { matchedBlockId: null, confidence: bestScore, reason: "fallback-top" };
  }

  if (!bestId || bestScore < 0.28) {
    return { matchedBlockId: null, confidence: bestScore, reason: "fallback-top" };
  }

  return {
    matchedBlockId: bestId,
    confidence: bestScore,
    reason: bestReason,
  };
}

function getTokenOverlapScore(queryTokens: string[], blockWords: Set<string>): number {
  let overlapCount = 0;
  for (const token of queryTokens) {
    if (blockWords.has(token)) overlapCount += 1;
  }
  return overlapCount / queryTokens.length;
}

function getStringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen > 0 ? 1 - distance / maxLen : 0;
}

function splitWords(input: string): string[] {
  return input.split(" ").filter(Boolean);
}

function getLongestConsecutiveWordRun(queryWords: string[], targetWords: string[]): number {
  if (queryWords.length === 0 || targetWords.length === 0) return 0;

  const dp = Array<number>(targetWords.length + 1).fill(0);
  let longestRun = 0;

  for (let i = 1; i <= queryWords.length; i += 1) {
    for (let j = targetWords.length; j >= 1; j -= 1) {
      if (queryWords[i - 1] === targetWords[j - 1]) {
        dp[j] = dp[j - 1] + 1;
        if (dp[j] > longestRun) longestRun = dp[j];
      } else {
        dp[j] = 0;
      }
    }
  }

  return longestRun;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}
