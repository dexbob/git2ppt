<div align="center">

# Git Repository Presentation Generator

**Git 저장소 기반 자동 프레젠테이션 생성기**

GitHub URL 하나로 저장소를 분석하고, AI가 기술명세서와 발표 슬라이드(PPT/PDF)까지 자동 생성합니다.

[빠른 시작](#빠른-시작) · [기능 개요](#이-프로젝트가-하는-일) · [환경 변수](#환경-변수) · [API](#api)

</div>

| 항목 | 값 |
|---|---|
| 패키지명 | `git2ppt` |
| Node.js | 20+ |
| 주요 런타임 | React + Vite + Express + Vercel |

---

## 이 프로젝트가 하는 일

개발자가 낯선 저장소를 **빠르게 이해하고 발표 자료까지** 준비하는 시간을 줄이는 것이 목표입니다. 웹 화면에서 공개(또는 `GITHUB_TOKEN`으로 접근 가능한) GitHub 저장소 HTTPS URL을 넣고 **「분석 및 자료 생성」** (또는 Enter)을 실행하면, 서버가 아래를 **순서대로** 수행합니다.

1. **저장소 가져오기·분석** — 기본은 `git` shallow clone(무토큰)이며, `partial clone(--filter=blob:none) + sparse checkout`으로 텍스트 위주 파일만 받아 대용량 이미지/영상 다운로드를 최소화합니다. 실패 시 `GITHUB_TOKEN`이 설정되어 있으면 자동으로 토큰 인증 clone을 재시도합니다(단, 타임아웃 실패는 즉시 종료 후 시간 증가 재시도 경로). `package.json`, `README.md`, `Dockerfile`, `vite.config.ts` 등 우선 파일과 디렉터리 트리·일부 소스 스니펫을 스캔해, 프론트/백엔드/상태관리/배포/DB·AI API 사용 여부 등을 **메타데이터(JSON)** 로 정리합니다. 루트 `README.md` 원문을 추출하고, 상대 경로 이미지·영상은 GitHub raw URL로 보정합니다.
2. **README 번역** (README가 있을 때) — 원문 README를 LLM으로 **한국어 전체 번역**합니다. 구조·배지·HTML·코드는 유지하고, prose만 번역합니다.
3. **기술명세 생성** — 스캔 결과를 바탕으로 LLM이 **마크다운 기술명세**(`tech_spec.md` 성격)만 작성합니다. [`reference/instruction.md`](reference/instruction.md)가 비어 있지 않으면 추가 인스트럭션으로 사용합니다(`INSTRUCTION_FILE`로 경로 변경 가능).
4. **발표용 슬라이드** — 기술명세와 **번역 README**(없으면 원문)를 입력으로 슬라이드 구조(JSON)를 만든 뒤 **PPTX**로 렌더링합니다. LibreOffice(`soffice`)가 있는 환경에서는 **PDF** 변환도 시도합니다.

LLM은 **Gemini 또는 OpenAI**만 지원합니다(`LLM_PROVIDER=auto`일 때 `GEMINI_API_KEY`가 있으면 Gemini, 없으면 OpenAI).

### 사용자 플로우

```text
GitHub URL 입력(Enter 가능) → Clone/스캔 → README(원문·번역) → 기술명세서 → 슬라이드/PPT·PDF
  → 미리보기(탭 자동 전환) → README·tech_spec·PPT·PDF(가능 시)·ZIP 다운로드
```

### UI

- 단일 페이지, 다크 톤 (`src/pages/HomePage.tsx`)
- 진행 카드 5단계: **Clone / 스캔** → **README** → **기술명세서** → **PPT** → **PDF** (`AnalysisProgress`). README 없으면 README 카드는 건너뜀 표시.
- 생성 시작 시 진행 카드로 **자동 스크롤** — 아래 미리보기가 함께 보이도록.
- **문서 미리보기** (`DocumentPreview`) — **README** / **기술명세서** / **슬라이드 프리뷰** 탭, 본문 높이 고정. README는 복제 직후 원문 → 번역 중 원문+배너 → 번역 완료 시 한국어. 각 산출물 준비 시 해당 탭으로 자동 이동.
- **슬라이드 프리뷰** — `SlideDeckViewer`로 슬라이드 단위 미리보기.
- 개별 다운로드: `README.md`(한국어 번역본), `tech_spec.md`, `slides.pptx`, `slides.pdf`(가능 시), **ZIP 일괄** (`presentation-bundle.zip`)
- PDF 미제공·변환 실패 시 진행 카드·다운로드 섹션에 `pdfNote` / `pdfError` 안내
- 저장소 분석 타임아웃 시 `+60초 늘려 재시도` 버튼 제공 (실패 단계부터 재시도)

### 생성물

| 파일 | 설명 |
|------|------|
| `README.md` | 저장소 README **한국어 번역본** (원문 구조·배지·이미지 URL 보정) |
| `tech_spec.md` | 역공학 성격의 기술명세 (생성) |
| `slides.pptx` | PptxGenJS 기반 발표 슬라이드 |
| `slides.pdf` | LibreOffice 변환 성공 시 (선택) |

슬라이드는 다크 톤·카드형 레이아웃이며, 저장소·기술명세 내용에 따라 표지·스택·아키텍처·기능·배포 등 섹션이 구성됩니다. **표지**는 프로젝트명·요약 설명·`#` 태그·`@` 작성자(GitHub 표시 이름)·저장소 URL(클릭)로 정리되며, README의 HTML/배너 줄은 표지 설명에 넣지 않습니다.

---

## 기술 스택 (이 앱)

| 영역 | 기술 |
|------|------|
| 프론트 | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion, Lucide, React Router |
| API (로컬) | Express — [`server/local.ts`](server/local.ts) |
| API (배포) | Vercel Serverless — [`api/`](api/) |
| 공유 로직 | [`lib/`](lib/) (`@lib` 별칭) |
| LLM | `@google/generative-ai`, `openai` |
| 문서·슬라이드 | PptxGenJS, LibreOffice(선택 PDF), `archiver`(ZIP) |
| 저장소 수집 | `simple-git` (partial clone + sparse checkout, 토큰 fallback) |

---

## 프로젝트 구조

| 경로 | 역할 |
|------|------|
| `src/` | React UI (페이지, 컴포넌트, Zustand 스토어) |
| `src/components/DocumentPreview.tsx` | README·기술명세·슬라이드 3탭 미리보기 |
| `src/components/SlideDeckViewer.tsx` | 슬라이드 덱 프리뷰 |
| `src/utils/simpleMarkdown.tsx` | react-markdown 기반 README/명세 렌더 |
| `lib/translateReadme.ts` | README 한국어 번역 |
| `lib/resolveReadmeAssetUrls.ts` | README 상대 이미지 → GitHub raw URL |
| `lib/extractRepoReadme.ts` | 스캔 결과에서 README 원문 추출 |
| `lib/` | GitHub 분석, LLM, PPTX/PDF, ZIP, 표지 태그·README 정제 (`coverTags.ts`, `readmeCoverHints.ts`, `githubOwnerProfile.ts`) |
| `server/local.ts` | 로컬 Express API + (선택) `dist` 정적 서빙 |
| `api/` | Vercel 핸들러 (`analyze-repo`, `translate-readme`, `generate-spec`, `generate-slides`, `export-files`) |
| `reference/` | [`instruction.md`](reference/instruction.md)(기술명세 톤), 샘플 문서 |
| `start_server.sh` | 의존성 검사 후 로컬/프로덕션 모드 실행 |
| `vercel.json` | Serverless 함수 타임아웃·`lib`/`reference` 포함 |

---

## 요구 사항

- **Node.js 20+**
- LLM 키 **하나 이상**: [`GEMINI_API_KEY`](https://aistudio.google.com/apikey) 또는 [`OPENAI_API_KEY`](https://platform.openai.com/)
- (선택) 비공개 저장소·API rate limit: `GITHUB_TOKEN`
- (선택) PDF: LibreOffice `soffice` (+ Impress 권장, 한글은 CJK 폰트)

---

## 빠른 시작

```bash
cp .env.example .env.local
# .env.local 에 GEMINI_API_KEY 또는 OPENAI_API_KEY 설정

npm install
npm run dev
```

| 서비스 | URL |
|--------|-----|
| 프론트 (Vite) | http://127.0.0.1:5173 |
| API (Express) | http://127.0.0.1:8787 — Vite가 `/api`를 프록시 |

[`reference/instruction.md`](reference/instruction.md)를 수정한 뒤에는 **API 서버를 재시작**해야 반영됩니다.

### `start_server.sh` (대안)

의존성(`node_modules`, `tsc`/`vite`/`tsx`)이 없으면 `npm install` 안내 후 종료합니다.

```bash
chmod +x start_server.sh   # 최초 1회

./start_server.sh local    # npm run dev 와 동일 (HMR, 5173 + 8787)
./start_server.sh          # npm run build 후 SERVE_STATIC=1 로 8787 단일 포트
```

> `./start_server.sh`로 실행하세요. `. ./start_server.sh`처럼 **source**하면 Ctrl+C 시 쉘까지 종료될 수 있습니다.

두 번째 모드는 Tailscale 등 **외부에서 8787 하나만** 열 때 유용합니다.

### npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite + Express 동시 실행 |
| `npm run dev:client` | 프론트만 |
| `npm run dev:server` | API만 |
| `npm run build` | `tsc` + Vite 프로덕션 빌드 → `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | 빌드 결과 미리보기 (Vite) |

---

## 저장소 가져오기 방식

| 단계 | 방식 |
|------|------|
| 1차 시도(기본) | `git` shallow clone + `--filter=blob:none` + `--sparse` (`lib/cloneRepo.ts`) — 토큰 없이 시도 |
| 2차 시도(자동) | 1차 실패가 일반 오류일 때 + `GITHUB_TOKEN` 존재 시 토큰 인증 clone 재시도 |
| 타임아웃 실패 | 토큰 fallback 없이 종료 후, UI에서 `+60초 늘려 재시도` 안내 |

클론 임시 디렉터리는 분석 후 삭제됩니다.

---

## 환경 변수

전체 목록: [`.env.example`](.env.example)

### LLM

| 변수 | 설명 |
|------|------|
| `LLM_PROVIDER` | `auto`(기본) / `gemini` / `openai` |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` | 비우면 `gemini-1.5-flash` |
| `OPENAI_API_KEY` | OpenAI |
| `OPENAI_MODEL` | 기본 `gpt-4o` |

> `.env.example`의 `ANTHROPIC_API_KEY`는 현재 코드에서 **사용하지 않습니다**.

### GitHub·분석

| 변수 | 설명 |
|------|------|
| `GITHUB_TOKEN` | 비공개 저장소·rate limit |
| `GIT_CLONE_TIMEOUT_MS` | 저장소 분석(클론+스캔) 타임아웃 기준 (기본 `120000`) |
| `GITHUB_ZIP_TIMEOUT_MS` | GitHub 메타 API 조회 타임아웃 (기본 `120000`) |
| `INSTRUCTION_FILE` | 기술명세 인스트럭션 경로 (기본 `reference/instruction.md`) |

### 서버

| 변수 | 설명 |
|------|------|
| `PORT` | 로컬 API 포트 (기본 `8787`) |
| `SERVER_TIMEOUT_MS` | Express 소켓 타임아웃 (기본 `600000`) |
| `SERVE_STATIC` | `1`이면 `dist/` 정적 UI + SPA fallback |

### PDF (LibreOffice)

| 변수 | 설명 |
|------|------|
| `SOFFICE_PATH` | `soffice` 경로 (비우면 `PATH` 검색) |
| `LIBREOFFICE_TIMEOUT_MS` | 변환 타임아웃 (기본 `180000`) |
| `SKIP_PDF` | `1`이면 PDF 생략 (PPTX만) |
| `ENABLE_PDF_ON_VERCEL` | `1`일 때만 Vercel에서 PDF 변환 **시도** (기본은 생략) |

로컬 Express에서 변환 실패 시 콘솔: `[git2ppt] LibreOffice PDF 변환 실패`.

#### Ubuntu / Debian / WSL

```bash
sudo apt update
sudo apt install -y libreoffice libreoffice-impress libreoffice-writer libreoffice-core fonts-liberation
# 한글 PDF
sudo apt install -y fonts-noto-cjk fonts-nanum
```

```bash
soffice --headless --invisible --nologo --convert-to pdf --outdir . slides.pptx
```

---

## Vercel 배포

1. GitHub 저장소 연결 (예: `dexbob/git2ppt`)
2. 환경 변수: `GEMINI_API_KEY` 또는 `OPENAI_API_KEY` (비공개 repo·rate limit 완화에는 `GITHUB_TOKEN` 권장)
3. 저장소 수집은 기본적으로 `git` shallow clone(무토큰 우선, 실패 시 토큰 재시도) 방식
4. LibreOffice 없음 → **PDF 기본 비활성** (`pdfAvailable: false`, `pdfNote`로 안내). PPTX·마크다운은 동일
5. [`vercel.json`](vercel.json): API 함수 `maxDuration` 60초, `lib`·`reference` 포함

실험적 PDF: `ENABLE_PDF_ON_VERCEL=1` (실패·타임아웃 가능). 끄기: `SKIP_PDF=1`.

---

## API

로컬·Vercel 모두 `/api/*` POST (JSON). 로컬 개발 시 Vite가 `8787`로 프록시합니다.

| 경로 | Body | 응답 요약 |
|------|------|-----------|
| `POST /api/analyze-repo` | `{ "url": "https://github.com/owner/repo", "timeoutMs"?: number }` | 성공: `{ "metadata" }` / 타임아웃: `408 { "code":"ANALYZE_TIMEOUT", "timeoutMs", "error" }` |
| `POST /api/translate-readme` | `{ "sourceMarkdown": "..." }` | `{ "readmeMarkdown" }` — 한국어 전체 번역(마크다운 본문만) |
| `POST /api/generate-spec` | `{ "metadata": { ... } }` | `{ "techSpecMarkdown" }` |
| `POST /api/generate-slides` | `{ "techSpecMarkdown", "repoUrl", "readmeMarkdown"?`, `ownerDisplayName?`, `detected?`, `githubTopics?` }` | `{ "slideDeck", "pptxBase64", "pdfBase64", "pdfAvailable", "pdfError", "pdfNote" }` |
| `POST /api/export-files` | `{ "readmeMarkdown", "techSpecMarkdown", "pptxBase64", "pdfBase64"? }` | ZIP 바이너리 (`presentation-bundle.zip`) |

프론트 파이프라인: [`src/store/pipelineStore.ts`](src/store/pipelineStore.ts) — `analyze-repo` → (README 있으면) `translate-readme` → `generate-spec` → `generate-slides` 순으로 자동 호출. 클라이언트에서 README 이미지 URL 보정(`resolveReadmeAssetUrls`).

---

## 커밋·배포 전 확인

```bash
npm run typecheck
npm run build
```

기능 추가·수정 후에는 [`package.json`](package.json)의 `version`을 올리고, [`CHANGELOG.md`](CHANGELOG.md)에 요약을 남기는 것을 권장합니다. 패치(`1.1.x`)는 버그 수정, 마이너(`1.x.0`)는 UI·기능 추가, 메이저(`x.0.0`)는 호환성이 깨지는 변경에 사용합니다.

---

## 라이선스

저장소 루트에 별도 라이선스 파일이 없으면, 배포·재배포 전 저장소 소유자 정책을 확인하세요.
