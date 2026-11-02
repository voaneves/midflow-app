/**
 * Copy limits enforced by the server quality gate (server/ai/prompt.ts → LIMITS).
 * The editor warns before a field exceeds them. Kept in sync by server/tests/limits-sync.test.ts.
 */
export const COPY_LIMITS = {
  headlineChars: 60,
  storyHeadlineChars: 70,
  highlightChars: 28,
  subChars: 120,
  tagChars: 22,
  ctaChars: 26,
  bulletChars: 48,
  iconLabelChars: 24,
  pollChars: 24,
  captionMin: 180,
  captionMax: 1500,
  hashtagsMin: 5,
  hashtagsMax: 12,
} as const
