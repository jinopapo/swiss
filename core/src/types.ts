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
  kind: "text" | "diff";
  content: string;
};

export type ReviewResult = {
  name: string;
  review: string;
  score: number;
  filePath: string;
  line: number;
};