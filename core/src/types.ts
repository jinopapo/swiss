export type ReviewSpec = {
  name: string;
  description?: string;
  model?: string;
  parallel?: boolean;
};

export type SwissConfig = {
  model: string;
  reviews: ReviewSpec[];
};

export type ReviewInput = {
  content: string;
};

export type ReviewItem = {
  review: string;
  filePath: string;
  line: number;
};

export type ScoredReviewItem = ReviewItem & {
  score: number;
  reason: string;
};

export type ReviewResult = ScoredReviewItem & {
  name: string;
};

export type ReviewDebugEntry = {
  name: string;
  generatedItems: ReviewItem[];
  scoredItems: ScoredReviewItem[];
};

export type RunReviewsResult = {
  results: ReviewResult[];
  stopReason: "needs_action" | "completed";
  debug?: ReviewDebugEntry[];
};