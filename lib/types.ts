/** Parsed public GitHub repository URL */
export type ParsedGithubRepo = {
  owner: string;
  repo: string;
  /** Normalized https URL without .git */
  webUrl: string;
};

export type PriorityFileSummary = {
  path: string;
  /** Truncated text or description */
  excerpt: string;
};

export type DetectedSignals = {
  frontend?: string;
  backend?: string;
  stateManagement?: string;
  deployment?: string;
  aiApis: string[];
  database?: string;
  features: string[];
};

export type RepositoryMetadata = {
  repoUrl: string;
  parsed: ParsedGithubRepo;
  defaultBranch: string;
  directoryTreeSample: string;
  priorityFileSummaries: PriorityFileSummary[];
  detected: DetectedSignals;
  /** ISO date */
  scannedAt: string;
};

export type SlideBulletSlide = {
  type: 'bullets';
  title: string;
  bullets: string[];
};

export type SlideCardsSlide = {
  type: 'cards';
  title: string;
  cards: { title: string; body: string }[];
};

export type SlideFlowSlide = {
  type: 'flow';
  title: string;
  steps: string[];
};

export type SlideCoverSlide = {
  type: 'cover';
  projectName: string;
  tagline: string;
  repoUrl: string;
  generatedAt: string;
};

export type SlideClosingSlide = {
  type: 'closing';
  repoUrl: string;
  /** 기술명세에 근거한 향후 개선·추가 기능 (없으면 빈 배열) */
  futureBullets?: string[];
};

export type SlideSpec =
  | SlideCoverSlide
  | SlideBulletSlide
  | SlideCardsSlide
  | SlideFlowSlide
  | SlideClosingSlide;

export type SlideDeckSpec = {
  slides: SlideSpec[];
};
