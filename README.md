# Git Repository Presentation Generator (MVP)

**Git 저장소 기반 자동 프레젠테이션 생성기** — GitHub URL 하나로 저장소를 읽고, AI가 기술명세·요약 README·발표 슬라이드(PPT/PDF)까지 만들어 주는 웹 MVP입니다.

---

## 이 프로젝트가 하는 일

개발자가 낯선 저장소를 **빠르게 이해하고 발표 자료까지** 준비하는 시간을 줄이는 것이 목표입니다. 웹 화면에서 공개(또는 토큰으로 접근 가능한) GitHub 저장소 주소를 넣고 실행하면, 서버가 아래를 **순서대로** 수행합니다.

1. **저장소 가져오기·분석** — 로컬/Docker에서는 `git` shallow clone, Vercel 등 서버리스에서는 GitHub API/ZIP로 소스를 가져옵니다. `package.json`, `README.md`, `Dockerfile`, `vite.config.ts` 등 우선 파일과 디렉터리 트리·일부 소스를 스캔해, 프론트/백엔드/상태관리/배포/DB·AI API 사용 여부 등을 담은 **메타데이터(JSON)** 로 정리합니다.
2. **Reverse engineering 성격의 기술명세** — 스캔 결과를 바탕으로 LLM이 **마크다운 기술명세**를 작성합니다. 서버는 저장소 루트의 [`reference/instruction.md`](reference/instruction.md) 내용(비어 있지 않을 때만)을 추가 인스트럭션으로 넣습니다. 경로를 바꾸려면 환경 변수 `INSTRUCTION_FILE`(절대 또는 `cwd` 기준 상대)을 설정합니다.
3. **발표용 슬라이드** — 생성된 기술명세를 입력으로 슬라이드 구조(JSON)를 만든 뒤, **PPTX**로 렌더링합니다. **PDF**는 LibreOffice headless가 있는 환경(로컬 Express 등)에서 PPTX를 변환해 제공합니다. Vercel 기본값에서는 PDF 생성을 건너뜁니다.

LLM은 **Gemini 또는 OpenAI**를 지원합니다. 키가 둘 다 있으면 기본(`LLM_PROVIDER=auto`)은 Gemini를 우선합니다.

### 사용자 플로우 (요약)

```text
GitHub URL 입력 → 저장소 분석 → AI 기술명세 생성 → 슬라이드 생성 → Markdown / PPT / PDF 다운로드
```

### UI (이 앱)

- 단일 화면, 다크 톤의 미니멀 UI
- URL 입력 + **「분석 및 자료 생성」** CTA (전체 파이프라인 실행)
- 진행 단계 카드: Clone/스캔 → 기술명세서 → 슬라이드/PPT → **완료**(전 단계 완료로 표시)
- 슬라이드 구조 **미리보기**
- 완료 후 README·기술명세·PPT·PDF(가능 시) 및 ZIP 다운로드
- PDF 변환을 시도했으나 실패한 경우, 다운로드 영역에 **안내 문구**(`pdfError`) 표시

### 생성되는 기술명세(`tech_spec.md`)에 담기는 내용

- 프로젝트 개요(목적, 핵심 기능, 사용자·문제 정의)
- 기술 스택 분석(프론트/백엔드/상태관리/스타일·빌드/배포/AI API 등)
- 시스템 아키텍처·데이터 흐름·API 구조
- 주요 기능 분석
- 디렉터리 구조 설명
- 실행·배포 방법
- 향후 개선 포인트

동시에 저장소용으로 쓸 수 있는 **짧은 요약 `README.md`** 도 별도로 생성합니다.

### 슬라이드

- **스타일**: 다크 기반, 큰 타이포, 카드형 정보 블록, 섹션 구분이 드러나는 발표용 레이아웃(PptxGenJS로 구성).
- **구성 예** (내용은 저장소마다 달라짐): 표지 → 개요 → 기술 스택 → 아키텍처 → 디렉터리 → 핵심 기능 → AI 워크플로 → 배포 → 향후 과제 → 클로징.

### 이 저장소의 구현 스택 (앱 자체)

- **프론트**: React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion, Lucide, React Router
- **API**: 로컬은 Express(`server/local.ts`), 배포는 Vercel Serverless `api/*.ts` — 비즈니스 로직은 `lib/`에서 공유 (`import` 별칭 `@lib`)
- **문서·슬라이드**: OpenAI / Google Generative AI SDK, PptxGenJS, (선택) LibreOffice로 PDF, ZIP은 `archiver`

---

## 요구 사항

- Node.js 20+
- LLM 키 **하나 이상**: [Gemini (Google AI Studio)](https://aistudio.google.com/apikey) `GEMINI_API_KEY` 또는 [OpenAI](https://platform.openai.com/) `OPENAI_API_KEY`
- (선택) 비공개 저장소 또는 rate limit 완화용 `GITHUB_TOKEN`
- (선택) 로컬에서 **PDF**까지 받으려면 LibreOffice(`soffice`) — 설치·한글 폰트·환경 변수는 아래 **「PDF 생성 (로컬 / Express)」** 절을 참고합니다.

---

## 프로젝트 구조 (요약)

| 경로 | 역할 |
|------|------|
| `src/` | React 앱 (페이지·컴포넌트·스토어) |
| `lib/` | 분석·스펙·슬라이드·PDF·ZIP 등 공유 로직 |
| `server/local.ts` | 로컬 개발용 Express API |
| `api/` | Vercel Serverless 핸들러 (`analyze-repo`, `generate-spec`, `generate-slides`, …) |
| `reference/` | 샘플·참고 문서, 기술명세 톤용 [`instruction.md`](reference/instruction.md) (비어 있으면 무시) |

---

## 로컬 개발

```bash
cp .env.example .env.local
# .env.local 에 GEMINI_API_KEY 또는 OPENAI_API_KEY 등을 채웁니다.
# 둘 다 있으면 기본은 Gemini (LLM_PROVIDER=auto). OpenAI만 쓰려면 LLM_PROVIDER=openai.

npm install
npm run dev
```

- 프론트: [http://127.0.0.1:5173](http://127.0.0.1:5173) (Vite)
- API: [http://127.0.0.1:8787](http://127.0.0.1:8787) — Vite가 `/api`를 프록시합니다.

기술명세 톤·강조는 [`reference/instruction.md`](reference/instruction.md)에 작성합니다(`INSTRUCTION_FILE`로 다른 경로 지정 가능). 파일을 고친 뒤에는 **API 서버를 재시작**해야 다시 읽습니다.

### npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite + Express(`tsx watch server/local.ts`) 동시 실행 |
| `npm run dev:client` | 프론트만 |
| `npm run dev:server` | API만 |
| `npm run build` | `tsc` + Vite 프로덕션 빌드 |
| `npm run typecheck` | 타입 검사만 (`tsc --noEmit`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run start:docker` | Docker 이미지에서 사용 (`SERVE_STATIC=1`로 정적 UI + API) |

### PDF 생성 (로컬 / Express)

로컬 API(`server/local.ts`)는 PPTX 생성 후 **LibreOffice headless**(`soffice`)로 `slides.pdf`를 만듭니다. 바이너리가 없거나 변환이 실패하면 PPTX는 그대로 내려가고, 응답 필드 `pdfError`와 UI 안내 문구로 이유를 알 수 있습니다. 서버 콘솔에는 `[grpg] LibreOffice PDF 변환 실패` 로그가 남습니다.

#### Ubuntu / Debian / WSL에 LibreOffice 설치

PPTX는 **Impress** 쪽 필터가 필요합니다. Writer만 있으면 변환이 실패할 수 있습니다.

```bash
sudo apt update
sudo apt install -y libreoffice libreoffice-impress libreoffice-writer libreoffice-core fonts-liberation
```

설치 확인:

```bash
soffice --version
which soffice
# 일부 배포판은 /bin/libreoffice 만 있는 경우가 있음 → which libreoffice
```

수동으로 한 번 변환해 보면 환경 문제를 바로 구분할 수 있습니다.

```bash
cd /path/to/any/dir
soffice --headless --invisible --nologo --convert-to pdf --outdir . slides.pptx
```

성공 시 `slides.pdf`가 같은 디렉터리에 생기고, 터미널에 `impress_pdf_Export` 등의 메시지가 출력됩니다.

#### 한글·CJK가 PDF에서 깨질 때

슬라이드 기본 폰트가 Arial 계열이면 Linux에서 한글이 네모·깨짐으로 나올 수 있습니다. 변환 머신에 **한글 지원 폰트**를 설치하세요.

```bash
sudo apt install -y fonts-noto-cjk fonts-nanum
```

#### 환경 변수 (PDF 관련, `.env.local`)

| 변수 | 설명 |
|------|------|
| `SOFFICE_PATH` | 비우면 `soffice`를 `PATH`에서 찾습니다. `libreoffice`만 있는 경우 등에는 예: `/usr/bin/libreoffice` |
| `LIBREOFFICE_TIMEOUT_MS` | 변환 타임아웃(ms). 기본 `180000` |
| `SKIP_PDF` | `1`이면 PDF 변환을 건너뜁니다(PPTX만). Vercel에서도 동일 |

Vercel에서는 아래 **「Vercel 배포」** 절을 참고하세요.

### LLM (Gemini / OpenAI)

- **`LLM_PROVIDER`**: `auto`(기본) / `gemini` / `openai`. `auto`일 때는 `GEMINI_API_KEY`가 있으면 Gemini, 없으면 OpenAI를 씁니다.
- **`GEMINI_MODEL`**: 비우면 **`gemini-1.5-flash`**. AI Studio에서 제공하는 모델 ID(예: `gemini-2.0-flash`)로 바꿀 수 있습니다.
- **`OPENAI_MODEL`**: OpenAI 사용 시만 적용됩니다(기본 `gpt-4o`).

### 기타 환경 변수

전체 목록과 주석은 [`.env.example`](.env.example)을 참고하세요. 자주 쓰는 항목만 요약합니다.

| 변수 | 설명 |
|------|------|
| `INSTRUCTION_FILE` | 비우면 `reference/instruction.md` |
| `GITHUB_TOKEN` | 비공개 저장소·API 한도 완화 |
| `GIT_CLONE_TIMEOUT_MS` | 로컬 `git` 클론 타임아웃 (기본 120000) |
| `USE_GITHUB_ZIP` | `1`이면 로컬에서도 ZIP 방식으로 소스 수집 |
| `GITHUB_ZIP_TIMEOUT_MS` | ZIP 다운로드 타임아웃 |
| `PORT` | 로컬 API 포트 (기본 8787) |
| `SERVER_TIMEOUT_MS` | Express 서버 소켓 타임아웃 (기본 600000) |
| `ENABLE_PDF_ON_VERCEL` | Vercel에서 PDF 변환 시도(실험용, `1`일 때) |

---

## Docker (UI + API)

```bash
docker compose build
docker compose run --rm -e GEMINI_API_KEY=... app
# 또는 OpenAI만: -e OPENAI_API_KEY=...
docker compose up --build
```

브라우저에서 `http://localhost:8787` 을 열면 빌드된 정적 UI와 API가 같은 포트에서 제공됩니다.

**PDF 주의:** 현재 [`Dockerfile`](Dockerfile)의 `apt-get`에는 `libreoffice-impress`가 포함되어 있지 않아, **컨테이너 안에서 PPTX→PDF가 실패할 수 있습니다.** PDF가 필요하면 `libreoffice-impress` 또는 메타 패키지 `libreoffice`를 Dockerfile에 추가하고, 한글 PDF가 필요하면 위 로컬 절의 **CJK 폰트** 설치도 같은 단계에 넣는 것을 권장합니다. [`docker-compose.yml`](docker-compose.yml)의 `environment`에 `GEMINI_API_KEY` 등 LLM 키를 넣어 주세요.

---

## Vercel 배포

1. 저장소를 Vercel에 연결합니다.
2. 환경 변수에 `GEMINI_API_KEY` 또는 `OPENAI_API_KEY`를 설정합니다. (비공개 저장소·ZIP rate limit에는 `GITHUB_TOKEN` 권장)
3. Vercel(`VERCEL=1`)에서는 **git 대신 GitHub ZIP + API**로 소스를 가져옵니다. 로컬에서도 동일 방식을 쓰려면 `USE_GITHUB_ZIP=1`을 설정합니다.
4. 서버리스 환경에는 LibreOffice가 없어 **PDF는 기본 생성되지 않습니다** (`pdfAvailable: false`, `pdfError`는 변환을 시도하지 않은 경우 `null`). PPT·마크다운은 동일하게 받을 수 있습니다. PDF가 필요하면 **로컬 Express** 또는 **Docker**(Impress 포함 이미지)를 쓰는 것을 권장합니다. 실험적으로 `ENABLE_PDF_ON_VERCEL=1`을 켜면 서버리스에서도 변환을 시도할 수 있으나(용량·콜드 스타트·타임아웃) 운영 난이도가 큽니다. PDF를 끄려면 `SKIP_PDF=1`을 사용합니다.

함수 실행 시간·용량 제한 때문에 **작은 공개 저장소** 위주로 사용하는 것이 안전합니다.

---

## 깃허브에 올리기 전 확인

```bash
npm run typecheck
npm run build
```

---

## API 엔드포인트

| 경로 | 설명 |
|------|------|
| `POST /api/analyze-repo` | body: `{ "url": "https://github.com/owner/repo" }` |
| `POST /api/generate-spec` | body: `{ "metadata": {...} }` — 인스트럭션은 서버가 `INSTRUCTION_FILE` 또는 `reference/instruction.md`에서 읽음 |
| `POST /api/generate-slides` | body: `{ "techSpecMarkdown": "...", "repoUrl": "..." }` — 응답에 `slideDeck`, `pptxBase64`, `pdfBase64`, `pdfAvailable`, `pdfError`(변환 실패 시 안내 문구, 미시도 시 `null`) 포함 |
| `POST /api/export-files` | body: readme / techSpec / pptx base64 (+ optional pdf) → ZIP |
