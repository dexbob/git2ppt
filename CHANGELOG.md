# 변경 이력 (Changelog)

이 파일은 README의 버전별 변경 이력을 분리해 모아둔 문서입니다.

## 1.5.0

- **저장소 수집 최적화(대용량 미디어 대응)** — `git clone`에 `--filter=blob:none --sparse --no-checkout`을 적용하고 `sparse-checkout` 패턴으로 텍스트/분석 대상 위주 파일만 checkout 하도록 변경. 이미지/영상 비중이 큰 공개 저장소에서 초기 수집량과 지연을 크게 완화.
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

