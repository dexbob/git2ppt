# 변경 이력 (Changelog)

이 파일은 README의 버전별 변경 이력을 분리해 모아둔 문서입니다.

## 1.5.0

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

