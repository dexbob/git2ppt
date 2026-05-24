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
  /** GitHub 프로필/조직 Name(표시 이름). API 미제공·미설정 시 null */
  ownerDisplayName: string | null;
  /** GitHub 저장소 topics (API) */
  githubTopics: string[];
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
  /** 발표 전체를 압축하는 핵심 요약 (2~3줄). 9번 슬라이드의 향후 개선과 중복되지 않아야 한다. */
  takeaways?: string[];
  /** 청중이 곧바로 따라할 수 있는 한 줄 실행 명령 (예: "npm install && npm run dev") */
  runCommand?: string;
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
