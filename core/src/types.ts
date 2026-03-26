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
};

export type ReviewResult = ScoredReviewItem & {
  name: string;
};