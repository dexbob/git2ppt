# 변경 이력 (Changelog)

이 파일은 README의 버전별 변경 이력을 분리해 모아둔 문서입니다.

## 1.7.0

- **Gemini SDK 최신 전환 및 클라이언트 분리** — 기존 `@google/generative-ai` 패키지를 전면 폐기하고, 구글의 최신 공식 차세대 SDK인 `@google/genai` 패키지로 전환. 이를 위해 전용 클라이언트 통신 모듈(`lib/geminiClient.ts`)을 신설하고, Vertex AI express mode 연동을 지원하도록 구조 조정.
- **환경 변수 체계 개편 (`GOOGLE_API_KEY`)** — 구글 AI 통신용 API 키를 기존 `GEMINI_API_KEY`에서 최신 규격인 `GOOGLE_API_KEY`로 통합 변경하고, 기본 탑재 모델을 `gemini-2.5-flash` 모델로 업그레이드.
- **OpenRouter 연동 지원 추가** — `LLM_PROVIDER=openrouter` 환경 설정을 통해 다양한 오픈 소스 및 외부 LLM 모델을 활용할 수 있도록 OpenRouter 연동 모듈을 `lib/llmProvider.ts` 및 `lib/llmCompleteJson.ts`에 추가 탑재.
- **전체 설정 및 가이드라인 일관화** — 신규 환경 변수와 LLM 제공자 구성을 `.env.example`, `README.md`, `.cursor/commands/run-dev.md`, `reference/tech_spec_sample.md` 등에 일괄 반영하여 개발 환경 설정의 혼선 방지.

## 1.6.0

- **저장소 수집 기본 방식 개편 (GitHub API tree+blob)** — `git` 명령을 사용하지 않고 GitHub REST API(Tree) 및 Raw 파일 수집 방식을 기본 경로로 설정. 분석에 필요한 우선순위 파일과 텍스트 코드만 선별적으로 수집하여 대규모 저장소(예: 155MB+)도 평균 3초 안팎에 분석 완료 가능.
- **자동 복구 Cascade 안전망 구축** — 기본 API 수집 방식 실패 시 백엔드에서 자동으로 대체 수단으로 연속 전환 (로컬: API 수집 → 최적화된 `git clone` → `GitHub ZIP` 다운로드 / Vercel: API 수집 → `GitHub ZIP` 다운로드).
- **전체 파이프라인 API 지수 백오프 및 자동 재시도 구축** — 번역(`translate-readme`), 명세서 생성(`generate-spec`), 슬라이드 생성(`generate-slides`) 등 모든 핵심 API 요청 단계에 클라이언트 사이드 자동 재시도 헬퍼(`postJsonWithRetry`) 탑재. AI 호출 한도 초과(429), 서버 과부하(502/503/504) 및 네트워크 일시 끊김 현상이 발생할 때 최대 3회까지 자동으로 재시도(지수 백오프 적용: 1.5초, 3초, 6초) 수행.
- **LLM 구조화 출력(responseSchema & Chat JSON Schema) 전면 적용** — 기술명세서 생성(`generate-spec`) 및 슬라이드 생성(`generate-slides`) 단계에 정교한 OpenAPI 3.0 스키마 명세를 도입하여 엔진 차원에서 제어. Gemini의 `responseSchema` 및 OpenAI의 `strict: true` JSON Schema 설정을 백엔드 전송 파라미터로 직접 결합하여 오타, 필드 누락, 괄호 깨짐 현상을 원천 차단.
- **지능형 이중 안전장치(Deep Safety Net) 존치** — `responseSchema` 강제화를 통한 1차 규격 제한 외에도, 기존 로컬 JSON 수리 복구 모듈(`parseJsonWithRecovery`)을 삭제하지 않고 최종 보루(2차 백업)로 남겨놓음으로써 API 통신이나 프록시 레이어의 변수 속에서도 무결점 파싱 및 100% 무중단 완성도를 제공.
- **실시간 자동 재시도 상태 안내 UI 구현** — 일시적 오류로 백오프 대기가 활성화될 때, 사용자 화면에 깜빡이는 호박색 경고 배너(예: `[README 번역] AI 서비스 사용량 혼잡 등으로 인해 3초 후 자동으로 다시 시도합니다... (시도 1/3)`)를 역동적인 핑(Ping) 포인트와 함께 노출하여 심리적 대기 불안 최소화.
- **메시지 생명 주기 제어 정밀화** — 해당 단계가 성공적으로 완수되어 다음 작업 단계의 카드로 넘어가면 안내 배너가 그 즉시 자동으로 소멸하도록 전이 제어 정밀화.
- **저장소 분석 오류 UX 고도화** — 백엔드의 무중단 자동 Cascade 및 재시도 덕분에 오류율이 비약적으로 낮아짐에 따라, 기존의 수동 `+60초 늘려 재시도` 인터랙션과 408 응답 코드를 전면 제거하고 직관적인 단일 재시도 UI로 단순화.
- **API 명세 및 상태 관리 경량화** — `analyze-repo` API에서 불필요해진 `timeoutMs` 파라미터 및 408 에러 처리를 제거하고, `pipelineStore`와 `HomePage` 내 타임아웃 제어 로직을 삭제하여 프론트엔드 코드의 복잡도 대폭 축소.
- **번들 코드 스플리팅(Bundle Code Splitting) 적용** — 대규모 외부 라이브러리인 애니메이션(`framer-motion`) 및 모듈 의존성들을 `vite.config.ts` 설정을 통해 공통 청크(`vendor`, `motion-bundle`)로 분리. 초기 빌드 시 기존 633KB 단일 파일 구조에서 핵심 메인 로직을 단 32KB 수준으로 대폭 축소시켜 첫 화면 렌더링 속도를 비약적으로 단축하고 캐싱 성능을 극대화.

## 1.5.0

- **저장소 수집 최적화(대용량 미디어 대응)** — `git clone`에 `--filter=blob:none --sparse --no-checkout`을 적용하고 `sparse-checkout` 패턴으로 텍스트/분석 대상 위주 파일만 checkout 하도록 변경. 이미지/영상 비중이 큰 공개 저장소에서 초기 수집량과 지연을 크게 완화.
- **Vercel 분석 경로 안정화** — Vercel 환경에서는 `git` 실행 의존성(`spawn git ENOENT`)을 피하기 위해 저장소 분석을 ZIP/API 경로로 수행하고, 로컬/일반 서버에서는 기존 clone 최적화 경로를 유지.
- **분석 실패 정책 정교화** — 무토큰 1차 시도 실패 시, 일반 오류에서만 토큰 fallback 실행. 타임아웃 실패는 토큰 fallback을 건너뛰고 즉시 타임아웃 오류(`AnalyzeTimeoutError`)로 종료해 사용자가 `+60초` 재시도를 선택하도록 흐름 정리.
- **분석 타임아웃 재시도 UX** — `/api/analyze-repo`가 타임아웃 시 `408 ANALYZE_TIMEOUT`과 `timeoutMs`를 반환하고, 프론트에서 “+60초 늘려 재시도” 버튼으로 같은 실패 단계부터 재실행.
- **README 자산 URL 보정 확장** — 상대 경로 보정 대상을 이미지뿐 아니라 `<video>`, `<source>`, 영상 확장자 링크(`.mp4`, `.webm`, `.mov` 등)까지 확장해 공개 repo README 미디어 렌더 안정성 개선.
- **문서 최신화** — README 상단 히어로 섹션 정리, 수집 방식/타임아웃/분석 API 스펙을 최신 동작 기준으로 갱신.
- **실패 지점부터 재시도** — 파이프라인 에러 시 완료된 단계 결과는 유지하고, 실패한 단계(저장소 분석 / README / 기술명세 / 슬라이드)부터만 다시 실행. URL이 바뀌면 처음부터. PDF 변환 실패는 기존처럼 완료 처리(재시도 대상 아님).
- **표지 설명 품질 개선** — 표지 타이틀은 README H1을 유지하고, 설명(tagline)은 LLM 정제 문장(홍보성 꼬리 문구 제거)으로 사용. 표지 설명 폰트/줄간/간격을 상향해 가독성을 개선.
- **표지 우측 배경 이미지** — 첫 페이지(cover)에만 적용되는 반투명 기하학 배경 이미지를 추가해, 텍스트 영역을 침범하지 않으면서 시각 밀도를 보강.
- **표지 태그 레이아웃** — `#태그`를 한 줄·한 박스·공백 간격으로 왼쪽 정렬하고, 가로폭을 넘기면 태그 개수를 자동으로 줄임.
- **표지 배경 동적 생성 + 템플릿 fallback** — 슬라이드 생성 시 저장소 신호에 맞춘 기하학 배경을 동적 생성(3초 제한)하고, 실패·지연 시 `public/cover-bg/` 템플릿(8종)으로 자동 대체. 환경변수 ON/OFF 없음. 배경 가시성·우측 상단 배치 보정, PPT 삽입 시 base64 임베딩.
- **README 정리** — README에서 버전별 변경 이력 섹션을 제거하고, `CHANGELOG.md`로 연결하도록 정리.
- **문서 분리** — README의 버전별 변경 내용을 `CHANGELOG.md`로 이관하여 온보딩/사용 설명 흐름을 단순화.

## 1.4.0

- **5단계 파이프라인** — 진행 카드: Clone/스캔 → **README** → 기술명세서 → **PPT** → **PDF**. README 번역과 기술명세서 생성을 분리.
- **README 번역 전용 API** — `POST /api/translate-readme` — 저장소 원문 README를 한국어로 **전체 번역**(요약 없음). `generate-spec`은 `techSpecMarkdown`만 반환.
- **문서 미리보기** — `README` / `기술명세서` / `슬라이드 프리뷰` 3탭, 고정 높이(`36rem`). 복제 직후 원본 README 표시 → 번역 중에도 원문 유지·상단 배너 → 번역 완료 시 한국어로 교체.
- **탭 자동 전환** — 원본·번역 README, 기술명세서, 슬라이드가 준비될 때마다 해당 탭으로 이동.
- **README 이미지** — 저장소 내 상대 경로(`docs/...`)를 `raw.githubusercontent.com` 절대 URL로 변환 (`lib/resolveReadmeAssetUrls.ts`) — 미리보기·다운로드에서 배지·로고 표시.
- **마크다운 렌더러** — `react-markdown` + GFM + HTML(sanitize) — GitHub README 스타일에 가깝게 표시.
- **슬라이드 미리보기** — `SlideDeckViewer` (목차 전용 `SlidePreview` 제거).
- **UX** — URL 입력 후 **Enter**로 생성, 생성 시작 시 진행 카드로 **자동 스크롤**, PDF 다운로드 아이콘 구분(`FileType`), PDF 상태는 진행 카드·다운로드 안내에 표시.

## 1.3.0

- **표지 슬라이드 레이아웃** — 타이틀(강조) · README에서 정제한 설명(HTML/이미지 줄 제외) · `#태그`(스캔 스택 + GitHub topics, 설명과 동일 가로폭·최대 2줄) · `@작성자`(GitHub Name) · 클릭 가능한 전체 GitHub URL 순.
- **푸터** — 모든 슬라이드 왼쪽에 짧은 `github.com/owner/repo`(비링크), 오른쪽 프로젝트 브랜딩. 표지 URL만 하이퍼링크.
- **GitHub 메타** — 분석 시 API로 `ownerDisplayName`, `githubTopics` 수집 (`lib/githubOwnerProfile.ts`).
- **README 원문 유지** — 다운로드·미리보기용 README는 그대로 두고, 표지 `tagline`만 `lib/readmeCoverHints.ts`에서 별도 정제.

## 1.2.0

- **Dexter Lab. 푸터** — GitHub 스타일 ©·네비게이션(Repository, Issues, README, Docs), 본문 `max-w-3xl` 폭에 맞춤.
- **브랜드 마크** — 흰 둥근 사각형 + 에rlenmeyer 플라스크 뚫림 SVG (`public/brand/dexter-lab-mark.svg`), favicon 연동.

## 1.1.0

- **문서 미리보기** — 생성된 `tech_spec.md`·`README.md`를 탭으로 화면에서 확인 (`DocumentPreview`). 다운로드 전 본문 검토 가능.
- **탐지 요약 JSON 제거** — UI에서 raw `metadata.detected` 표시를 없애고, 기술명세 생성 중에는 스택 칩(React, Express 등)만 간단히 표시.
- **경량 마크다운 렌더러** — 제목·목록·코드 블록·링크 등 기본 서식 미리보기 (1.4.0에서 `react-markdown`으로 교체).

## 1.0.0

- GitHub URL 입력 → Clone/스캔 → 기술명세·README → PPT/PDF 생성 및 ZIP 다운로드.

