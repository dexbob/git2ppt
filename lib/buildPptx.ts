import PptxGenJS from 'pptxgenjs';
import { existsSync, readFileSync } from 'node:fs';
import type { SlideDeckSpec, SlideSpec } from './types.js';

/** 레이아웃 참고: reference/slide-sample (색·폰트는 가독성 위주로 단순화) */
const BG = '0A0A0A';
const ACCENT = 'E07C3D';
const TEXT = 'F8FAFC';
const MUTED = '94A3B8';
const PANEL = '141414';
const RULE = '2E2E2E';

const FONT = 'Arial';

const W = 9.2;
const X0 = 0.4;
/** 본문·타이틀 좌우 여백을 살짝 넓혀 정렬감을 맞춤 */
const XM = 0.44;
const WM = W - (XM - X0) * 2;
/** 본문은 푸터 구분선(≈5.05) 위 안전 영역 안에만 배치 */
const CONTENT_MAX_Y = 4.88;
const FOOTER_RULE_Y = 5.05;

function pageBgVariant(index: number): {
  x: number;
  y: number;
  w: number;
  h: number;
  shadeTransparency: number;
  leftMaskW: number;
  leftMaskTransparency: number;
} {
  const k = Math.max(0, index);
  const x = -0.52 + (k % 4) * 0.1;
  const y = -0.22 + (k % 5) * 0.06;
  const w = 10.8 + (k % 3) * 0.22;
  const h = 6.05 + (k % 4) * 0.09;
  const shadeTransparency = 78 - (k % 4) * 5;
  const leftMaskW = 4.4 + (k % 3) * 0.35;
  const leftMaskTransparency = 20 + (k % 3) * 6;
  return { x, y, w, h, shadeTransparency, leftMaskW, leftMaskTransparency };
}

function applySlideBackground(
  pptx: PptxGenJS,
  slide: ReturnType<PptxGenJS['addSlide']>,
  slideIndex: number,
  bgDataA: string | null,
  bgDataB: string | null,
) {
  slide.background = { color: BG };
  const bgData = slideIndex % 2 === 0 ? bgDataA ?? bgDataB : bgDataB ?? bgDataA;
  if (!bgData) return;
  const v = pageBgVariant(slideIndex);
  slide.addImage({
    data: bgData,
    x: v.x,
    y: v.y,
    w: v.w,
    h: v.h,
  });
  // 페이지별로 강도를 다르게 해서 같은 기본 배경도 다르게 보이게 만든다.
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 5.625,
    fill: { color: BG, transparency: v.shadeTransparency },
    line: { color: BG, transparency: 100, width: 0 },
  });
  // 좌측 텍스트 영역은 항상 가독성을 위해 한 겹 더 눌러준다.
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: v.leftMaskW,
    h: 5.625,
    fill: { color: BG, transparency: v.leftMaskTransparency },
    line: { color: BG, transparency: 100, width: 0 },
  });
}

function githubOwnerFromUrl(repoUrl: string): string {
  try {
    const u = new URL(repoUrl);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'github.com') {
      const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
      return parts[0] ?? '';
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * PowerPoint·LibreOffice가 github.com/... 를 자동 하이퍼링크로 잡는 것을 막기 위한 표시용 문자열.
 * 보이는 글자는 동일하고, 점·슬래시 뒤에 zero-width space를 넣는다.
 */
function plainTextNoAutoLink(s: string): string {
  return s.replace(/\./g, '.\u200B').replace(/\//g, '/\u200B');
}

/** 푸터용 비링크 짧은 저장소 주소 (예: github.com/owner/repo) */
function shortFooterRepoLabel(repoUrl: string): string {
  const raw = repoUrl.trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/^\//, '').replace(/\/$/, '');
    return path ? `${host}/${path}` : host;
  } catch {
    return raw.length > 52 ? `${raw.slice(0, 49)}…` : raw;
  }
}

function normalizeRepoHyperlink(repoUrl: string): string {
  const raw = repoUrl.trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    return u.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
}

function shortFooterRight(projectName: string, max = 24): string {
  const t = projectName.replace(/\s+/g, ' ').trim();
  if (!t) return 'GIT · SPEC · SLIDE';
  const mostlyAscii = /^[\s\x20-\x7E]+$/.test(t);
  const display = mostlyAscii ? t.toUpperCase() : t;
  if (display.length <= max) return `${display} · GIT`;
  return `${display.slice(0, max - 1)}… · GIT`;
}

function addFooter(
  pptx: PptxGenJS,
  slide: ReturnType<PptxGenJS['addSlide']>,
  left: string,
  right: string,
  opts?: { leftFontSize?: number; rightFontSize?: number },
) {
  const leftFs = opts?.leftFontSize ?? 9;
  const rightFs = opts?.rightFontSize ?? 8;
  slide.addShape(pptx.ShapeType.rect, {
    x: X0,
    y: FOOTER_RULE_Y,
    w: W,
    h: 0.02,
    fill: { color: RULE },
    line: { color: RULE, width: 0 },
  });
  slide.addText(plainTextNoAutoLink(left), {
    x: XM,
    y: 5.12,
    w: 4.45,
    h: 0.35,
    fontSize: leftFs,
    color: MUTED,
    fontFace: FONT,
    underline: { style: 'none' },
  });
  slide.addText(right, {
    x: 4.85,
    y: 5.12,
    w: 4.35,
    h: 0.35,
    fontSize: rightFs,
    color: MUTED,
    fontFace: FONT,
    align: 'right',
  });
}

function addHeaderBand(
  slide: ReturnType<PptxGenJS['addSlide']>,
  sectionTag: string,
  title: string,
  rightHint?: string,
) {
  slide.addText(sectionTag, {
    x: XM,
    y: 0.24,
    w: 4.5,
    h: 0.35,
    fontSize: 10,
    color: ACCENT,
    fontFace: FONT,
    bold: true,
  });
  if (rightHint) {
    slide.addText(rightHint, {
      x: 5.4,
      y: 0.24,
      w: 4.2,
      h: 0.35,
      fontSize: 10,
      color: MUTED,
      fontFace: FONT,
      align: 'right',
    });
  }
  slide.addText(title, {
    x: XM,
    y: 0.58,
    w: WM,
    h: 0.75,
    fontSize: 26,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
}

function estimateCharUnits(text: string): number {
  let charUnits = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    charUnits += cp > 0x7f ? 1.75 : 1;
  }
  return charUnits;
}

function estimateTextWidthInches(text: string, fontSizePt: number): number {
  return estimateCharUnits(text) * (fontSizePt / 72) * 0.095;
}

/** 한 줄 텍스트 박스 크기 (하이퍼링크 클릭 영역을 글자 크기에 가깝게) */
function estimateSingleLineTextBox(text: string, fontSizePt: number): { w: number; h: number } {
  const w = Math.min(WM, Math.max(0.85, estimateTextWidthInches(text, fontSizePt)));
  const h = Math.max(0.26, (fontSizePt / 72) * 1.35);
  return { w, h };
}

const COVER_TAG_FS = 9.5;
const COVER_TAG_ROW_H = 0.28;
const COVER_TAG_SEPARATOR = '   ';

/** 설명과 동일 가로폭(WM) 안에서 태그 줄 수·높이 계산 */
function measureCoverTagsHeight(tags: string[]): number {
  if (!tags.length) return 0;
  return COVER_TAG_ROW_H;
}

/** 한 줄(WM)에 들어가는 태그만 공백 간격으로 이어 붙인다. */
function fitCoverTagsOneLine(tags: string[], maxWidth: number): string {
  const fitted: string[] = [];
  for (const tag of tags) {
    const candidate =
      fitted.length === 0 ? tag : `${fitted.join(COVER_TAG_SEPARATOR)}${COVER_TAG_SEPARATOR}${tag}`;
    const w = estimateTextWidthInches(candidate, COVER_TAG_FS);
    if (w > maxWidth && fitted.length > 0) break;
    fitted.push(tag);
    if (w > maxWidth) break;
  }
  return fitted.join(COVER_TAG_SEPARATOR);
}

/** 표지 #태그: 한 박스·왼쪽 정렬·일정 간격(공백), 한 줄 넘치면 개수 자동 조절 */
function addCoverTagsRow(
  slide: ReturnType<PptxGenJS['addSlide']>,
  tags: string[],
  y: number,
): number {
  const line = fitCoverTagsOneLine(tags, WM);
  if (!line) return y;

  slide.addText(line, {
    x: XM,
    y,
    w: WM,
    h: COVER_TAG_ROW_H,
    fontSize: COVER_TAG_FS,
    color: MUTED,
    fontFace: FONT,
    valign: 'middle',
    wrap: false,
    align: 'left',
  });

  return y + COVER_TAG_ROW_H;
}

/** 표지 작성자: @Name (GitHub Name 우선, 없으면 @login) */
function resolveCoverPresenter(displayName: string | null | undefined, repoUrl: string): string {
  const name = displayName?.trim();
  if (name) return name.startsWith('@') ? name : `@${name}`;
  const login = githubOwnerFromUrl(repoUrl);
  return login ? `@${login}` : '';
}

function addCoverSlide(
  pptx: PptxGenJS,
  s: Extract<SlideSpec, { type: 'cover' }>,
  footerRepoShort: string,
  footerRightShort: string,
  presenterName: string,
  coverTags: string[],
  slideIndex: number,
  bgDataA: string | null,
  bgDataB: string | null,
) {
  const slide = pptx.addSlide();
  applySlideBackground(pptx, slide, slideIndex, bgDataA, bgDataB);

  const gitY = 0.22;
  const gitH = 0.32;
  slide.addText('GIT REPOSITORY', {
    x: XM,
    y: gitY,
    w: WM,
    h: gitH,
    fontSize: 9,
    color: TEXT,
    fontFace: FONT,
    bold: true,
  });

  const desc = s.tagline?.trim() ?? '';
  const repoLink = normalizeRepoHyperlink(s.repoUrl);
  const urlFs = 12;
  const urlBox = repoLink ? estimateSingleLineTextBox(repoLink, urlFs) : { w: 0, h: 0 };
  const nameFs = 14;
  const nameBox = presenterName ? estimateSingleLineTextBox(presenterName, nameFs) : { w: 0, h: 0 };
  const hasTags = coverTags.length > 0;
  const tagsBlockH = hasTags ? measureCoverTagsHeight(coverTags) : 0;
  const titleH = 1.18;
  const titleFs = 36;
  const descH = desc ? 1.58 : 0;
  const descFs = 16;
  const gapTitleDesc = desc ? 0.14 : 0;
  const gapLine = 0.12;
  const gapUrlTags = hasTags && repoLink ? 0.14 : 0;
  const metaH =
    (presenterName ? nameBox.h + (repoLink ? gapLine : 0) : 0) +
    (repoLink ? urlBox.h : 0) +
    gapUrlTags +
    tagsBlockH;
  const gapDescMeta = desc && (presenterName || repoLink || hasTags) ? gapLine : presenterName || repoLink || hasTags ? gapLine : 0.1;
  const blockH = titleH + gapTitleDesc + descH + gapDescMeta + metaH;

  /** 푸터 위 가용 영역 안에서 블록을 세로 중앙보다 살짝 위에 둠 */
  const bandTop = gitY + gitH + 0.14;
  const bandBottom = 4.72;
  const mid = (bandTop + bandBottom) / 2;
  const biasUp = 0.32;
  let clusterY = mid - blockH / 2 - biasUp;
  if (clusterY < bandTop) clusterY = bandTop;

  const titleY = clusterY;
  slide.addText(s.projectName, {
    x: XM,
    y: titleY,
    w: WM,
    h: titleH,
    fontSize: titleFs,
    bold: true,
    color: TEXT,
    fontFace: FONT,
    valign: 'top',
    wrap: true,
  });

  let nextY = titleY + titleH + (desc ? gapTitleDesc : gapDescMeta);
  if (desc) {
    slide.addText(desc, {
      x: XM,
      y: nextY,
      w: WM,
      h: descH,
      fontSize: descFs,
      color: MUTED,
      fontFace: FONT,
      valign: 'top',
      wrap: true,
      lineSpacingMultiple: 1.25,
    });
    nextY += descH + gapDescMeta;
  }

  if (presenterName) {
    slide.addText(presenterName, {
      x: XM,
      y: nextY,
      w: nameBox.w,
      h: nameBox.h,
      fontSize: nameFs,
      color: MUTED,
      fontFace: FONT,
      valign: 'top',
      wrap: false,
    });
    nextY += nameBox.h + (repoLink || hasTags ? gapLine : 0);
  }

  if (repoLink) {
    slide.addText(repoLink, {
      x: XM,
      y: nextY,
      w: urlBox.w,
      h: urlBox.h,
      fontSize: urlFs,
      color: ACCENT,
      fontFace: FONT,
      valign: 'top',
      wrap: false,
      hyperlink: { url: repoLink, tooltip: repoLink },
    });
    nextY += urlBox.h + (hasTags ? gapUrlTags : 0);
  }

  if (hasTags) {
    addCoverTagsRow(slide, coverTags, nextY);
  }

  addFooter(pptx, slide, footerRepoShort || 'github.com', footerRightShort, {
    leftFontSize: 9,
    rightFontSize: 7,
  });
}

function addBulletsSlide(
  pptx: PptxGenJS,
  s: Extract<SlideSpec, { type: 'bullets' }>,
  sectionTag: string,
  footerRepoShort: string,
  brandRight: string,
  slideIndex: number,
  bgDataA: string | null,
  bgDataB: string | null,
) {
  const slide = pptx.addSlide();
  applySlideBackground(pptx, slide, slideIndex, bgDataA, bgDataB);
  addHeaderBand(slide, sectionTag, s.title);

  if (s.bullets.length === 2) {
    const colW = (W - 0.35) / 2;
    const textMaxH = Math.min(2.85, CONTENT_MAX_Y - 2.15);
    for (let i = 0; i < 2; i++) {
      const b = s.bullets[i] ?? '';
      const x = X0 + i * (colW + 0.35);
      slide.addText(String(i + 1), {
        x,
        y: 1.45,
        w: colW,
        h: 0.55,
        fontSize: 36,
        bold: true,
        color: ACCENT,
        fontFace: FONT,
      });
      slide.addText(b.length > 120 ? `${b.slice(0, 117)}…` : b, {
        x,
        y: 2.15,
        w: colW,
        h: textMaxH,
        fontSize: 13,
        color: TEXT,
        fontFace: FONT,
        valign: 'top',
      });
    }
  } else {
    const n = s.bullets.length;
    const startBand = 1.38;
    const ruleH = 0.018;
    const usable = CONTENT_MAX_Y - startBand - Math.max(0, n - 1) * ruleH;
    const rowH = Math.max(0.38, usable / Math.max(1, n));
    const fontSize = rowH < 0.52 ? 11 : rowH < 0.62 ? 12 : 13;
    let blockH = n * rowH + Math.max(0, n - 1) * ruleH;
    const bandH = CONTENT_MAX_Y - startBand;
    let y0 = startBand + Math.max(0, (bandH - blockH) / 2);

    s.bullets.forEach((b, i) => {
      const y = y0 + i * (rowH + ruleH);
      const num = String(i + 1).padStart(2, '0');
      slide.addText(num, {
        x: X0,
        y,
        w: 0.55,
        h: rowH * 0.45,
        fontSize: 14,
        bold: true,
        color: ACCENT,
        fontFace: FONT,
      });
      slide.addText(b, {
        x: X0 + 0.65,
        y,
        w: W - 0.65,
        h: rowH - 0.04,
        fontSize,
        color: TEXT,
        fontFace: FONT,
        valign: 'top',
        wrap: true,
      });
      if (i < s.bullets.length - 1) {
        slide.addShape(pptx.ShapeType.rect, {
          x: X0,
          y: y + rowH,
          w: W,
          h: ruleH,
          fill: { color: RULE },
          line: { color: RULE, width: 0 },
        });
      }
    });
  }

  addFooter(pptx, slide, footerRepoShort || 'github.com', brandRight);
}

function addCardPanel(
  pptx: PptxGenJS,
  slide: ReturnType<PptxGenJS['addSlide']>,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
  i: number,
  c: { title: string; body: string },
  bodyFontSize: number,
) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w: boxW,
    h: boxH,
    fill: { color: PANEL },
    line: { color: RULE, width: 1 },
    rectRadius: 0.06,
  });
  slide.addText(`${String(i + 1).padStart(2, '0')} ${c.title}`, {
    x: x + 0.12,
    y: y + 0.1,
    w: boxW - 0.24,
    h: 0.42,
    fontSize: 12,
    bold: true,
    color: ACCENT,
    fontFace: FONT,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: x + 0.12,
    y: y + 0.5,
    w: boxW - 0.24,
    h: 0.02,
    fill: { color: ACCENT },
    line: { color: ACCENT, width: 0 },
  });
  slide.addText(c.body, {
    x: x + 0.12,
    y: y + 0.58,
    w: boxW - 0.24,
    h: boxH - 0.68,
    fontSize: bodyFontSize,
    color: TEXT,
    fontFace: FONT,
    valign: 'top',
    wrap: true,
  });
}

function addCardsSlide(
  pptx: PptxGenJS,
  s: Extract<SlideSpec, { type: 'cards' }>,
  sectionTag: string,
  footerRepoShort: string,
  brandRight: string,
  slideIndex: number,
  bgDataA: string | null,
  bgDataB: string | null,
) {
  const slide = pptx.addSlide();
  applySlideBackground(pptx, slide, slideIndex, bgDataA, bgDataB);
  const sub =
    s.cards[0]?.body && s.cards[0].body.length > 0
      ? (s.cards[0].body.length > 90 ? `${s.cards[0].body.slice(0, 87)}…` : s.cards[0].body)
      : '';
  addHeaderBand(slide, sectionTag, s.title, sub || undefined);

  const n = Math.min(s.cards.length, 6);
  const topY = 1.42;
  const bottomY = CONTENT_MAX_Y;
  const gap = 0.16;

  if (n === 3) {
    const boxH = (bottomY - topY - 2 * gap) / 3;
    for (let i = 0; i < 3; i++) {
      const c = s.cards[i];
      if (!c) break;
      const y = topY + i * (boxH + gap);
      addCardPanel(pptx, slide, X0, y, W, boxH, i, c, 13);
    }
  } else if (n === 2) {
    const colW = (W - gap) / 2;
    const boxH = bottomY - topY;
    for (let i = 0; i < 2; i++) {
      const c = s.cards[i];
      if (!c) break;
      const x = X0 + i * (colW + gap);
      addCardPanel(pptx, slide, x, topY, colW, boxH, i, c, 13);
    }
  } else {
    const cols = n === 4 ? 2 : n <= 3 ? n : 3;
    const rows = Math.ceil(n / cols);
    const boxH = (bottomY - topY - (rows - 1) * gap) / rows;
    const boxW = (W - gap * (cols - 1)) / cols;
    const bodyFs = rows >= 2 ? 11.5 : 12;

    for (let i = 0; i < n; i++) {
      const c = s.cards[i];
      if (!c) break;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = X0 + col * (boxW + gap);
      const y = topY + row * (boxH + gap);
      addCardPanel(pptx, slide, x, y, boxW, boxH, i, c, bodyFs);
    }
  }

  addFooter(pptx, slide, footerRepoShort || 'github.com', brandRight);
}

function addFlowSlide(
  pptx: PptxGenJS,
  s: Extract<SlideSpec, { type: 'flow' }>,
  sectionTag: string,
  footerRepoShort: string,
  brandRight: string,
  slideIndex: number,
  bgDataA: string | null,
  bgDataB: string | null,
) {
  const slide = pptx.addSlide();
  applySlideBackground(pptx, slide, slideIndex, bgDataA, bgDataB);
  addHeaderBand(slide, sectionTag, s.title);

  const steps = s.steps;
  const n = Math.max(1, steps.length);
  const gap = 0.1;
  const twoRows = n > 5;
  const yTop = 1.72;

  const drawRow = (rowSteps: string[], baseIndex: number, rowN: number, y: number, boxH: number) => {
    const boxW = (W - gap * (rowN - 1)) / rowN;
    let x = X0;
    rowSteps.forEach((step, j) => {
      const i = baseIndex + j;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: boxW,
        h: boxH,
        fill: { color: PANEL },
        line: { color: RULE, width: 1 },
        rectRadius: 0.05,
      });
      slide.addText(`${String(i + 1).padStart(2, '0')} · STEP`, {
        x: x + 0.1,
        y: y + 0.1,
        w: boxW - 0.2,
        h: 0.32,
        fontSize: 9,
        color: ACCENT,
        fontFace: FONT,
        bold: true,
      });
      slide.addText(step, {
        x: x + 0.1,
        y: y + 0.44,
        w: boxW - 0.2,
        h: boxH - 0.52,
        fontSize: rowN > 4 || twoRows ? 10 : 12,
        color: TEXT,
        fontFace: FONT,
        valign: 'top',
        wrap: true,
      });
      x += boxW + gap;
    });
  };

  if (twoRows) {
    const n1 = Math.ceil(n / 2);
    const n2 = n - n1;
    const rowGap = 0.2;
    const boxH = (CONTENT_MAX_Y - yTop - rowGap) / 2;
    drawRow(steps.slice(0, n1), 0, n1, yTop, boxH);
    drawRow(steps.slice(n1), n1, n2, yTop + boxH + rowGap, boxH);
  } else {
    const boxH = Math.min(2.82, CONTENT_MAX_Y - yTop);
    drawRow(steps, 0, n, yTop, boxH);
  }

  addFooter(pptx, slide, footerRepoShort || 'github.com', brandRight);
}

const MONO_FONT = 'Courier New';

function addClosingSlide(
  pptx: PptxGenJS,
  s: Extract<SlideSpec, { type: 'closing' }>,
  sectionTag: string,
  footerRepoShort: string,
  brandRight: string,
  slideIndex: number,
  bgDataA: string | null,
  bgDataB: string | null,
) {
  const slide = pptx.addSlide();
  applySlideBackground(pptx, slide, slideIndex, bgDataA, bgDataB);
  addHeaderBand(slide, sectionTag, '마무리');

  const takeaways = (s.takeaways ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
  const runCommand = (s.runCommand ?? '').trim();

  const bodyTop = 1.42;
  const bodyBottom = CONTENT_MAX_Y;

  let y = bodyTop;

  if (takeaways.length > 0) {
    slide.addText('핵심 요약', {
      x: XM,
      y,
      w: WM,
      h: 0.32,
      fontSize: 12,
      bold: true,
      color: ACCENT,
      fontFace: FONT,
    });
    y += 0.4;

    const rowGap = 0.08;
    const codeBlockReserve = runCommand ? 0.32 + 0.1 + 0.55 + 0.2 : 0;
    const avail = Math.max(0.6, bodyBottom - y - codeBlockReserve);
    const rowH = Math.min(0.56, (avail - rowGap * Math.max(0, takeaways.length - 1)) / takeaways.length);
    const fs = rowH < 0.44 ? 11 : 13;

    takeaways.forEach((line, i) => {
      const num = String(i + 1).padStart(2, '0');
      slide.addText(
        [
          { text: `${num}  `, options: { color: ACCENT, bold: true, fontSize: fs, fontFace: FONT } },
          { text: line, options: { color: TEXT, fontSize: fs, fontFace: FONT } },
        ],
        {
          x: XM,
          y,
          w: WM,
          h: Math.max(0.36, rowH),
          valign: 'top',
          wrap: true,
          fontFace: FONT,
        },
      );
      y += rowH + rowGap;
    });
    y += 0.12;
  }

  if (runCommand) {
    slide.addText('빠른 시작', {
      x: XM,
      y,
      w: WM,
      h: 0.32,
      fontSize: 12,
      bold: true,
      color: ACCENT,
      fontFace: FONT,
    });
    y += 0.4;

    const codeH = 0.55;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: XM,
      y,
      w: WM,
      h: codeH,
      fill: { color: PANEL },
      line: { color: RULE, width: 1 },
      rectRadius: 0.06,
    });
    const display = runCommand.length > 80 ? `${runCommand.slice(0, 77)}…` : runCommand;
    slide.addText(
      [
        { text: '$ ', options: { color: ACCENT, bold: true, fontSize: 13, fontFace: MONO_FONT } },
        { text: display, options: { color: TEXT, fontSize: 13, fontFace: MONO_FONT } },
      ],
      {
        x: XM + 0.18,
        y: y + 0.04,
        w: WM - 0.36,
        h: codeH - 0.08,
        valign: 'middle',
        wrap: false,
        fontFace: MONO_FONT,
      },
    );
    y += codeH + 0.18;
  }

  addFooter(pptx, slide, footerRepoShort || 'github.com', brandRight);
}

function sectionLabelFor(type: SlideSpec['type'], index: number): string {
  const n = String(index).padStart(2, '0');
  const map: Record<string, string> = {
    cover: `${n} · 표지`,
    bullets: `${n} · 개요`,
    cards: `${n} · 핵심`,
    flow: `${n} · 흐름`,
    closing: `${n} · 마무리`,
  };
  return map[type] ?? `${n} · 슬라이드`;
}

export type BuildPptxOptions = {
  /** GitHub 프로필 Name. 없으면 표지에 @login 폴백 */
  ownerDisplayName?: string | null;
  /** 표지 #태그 줄 (예: #React #Docker) */
  coverTags?: string[];
  /** 표지 우측 반투명 배경 이미지 경로 */
  coverBackgroundPath?: string | null;
  /** 두 번째 기본 배경 경로 (페이지별 변형용) */
  coverBackgroundAltPath?: string | null;
};

export async function buildPptxBuffer(
  spec: SlideDeckSpec,
  options?: BuildPptxOptions,
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Git Repository Presentation Generator';
  pptx.subject = 'Auto-generated deck';

  const cover = spec.slides.find((s): s is Extract<SlideSpec, { type: 'cover' }> => s.type === 'cover');
  const footerRepoShort = cover ? shortFooterRepoLabel(cover.repoUrl) : '';
  const brandRight = cover ? shortFooterRight(cover.projectName) : 'GIT · SPEC · SLIDE';
  const coverPresenter = cover
    ? resolveCoverPresenter(options?.ownerDisplayName, cover.repoUrl)
    : '';
  const coverTags = options?.coverTags ?? [];
  const coverBackgroundPath = options?.coverBackgroundPath ?? null;
  const coverBackgroundAltPath = options?.coverBackgroundAltPath ?? null;
  const bgDataA =
    coverBackgroundPath && existsSync(coverBackgroundPath)
      ? `image/png;base64,${readFileSync(coverBackgroundPath).toString('base64')}`
      : null;
  const bgDataB =
    coverBackgroundAltPath && existsSync(coverBackgroundAltPath)
      ? `image/png;base64,${readFileSync(coverBackgroundAltPath).toString('base64')}`
      : null;

  let idx = 0;
  for (const s of spec.slides) {
    idx += 1;
    const tag = sectionLabelFor(s.type, idx);

    switch (s.type) {
      case 'cover':
        addCoverSlide(
          pptx,
          s,
          footerRepoShort,
          brandRight,
          coverPresenter,
          coverTags,
          idx - 1,
          bgDataA,
          bgDataB,
        );
        break;
      case 'bullets':
        addBulletsSlide(pptx, s, tag, footerRepoShort, brandRight, idx - 1, bgDataA, bgDataB);
        break;
      case 'cards':
        addCardsSlide(pptx, s, tag, footerRepoShort, brandRight, idx - 1, bgDataA, bgDataB);
        break;
      case 'flow':
        addFlowSlide(pptx, s, tag, footerRepoShort, brandRight, idx - 1, bgDataA, bgDataB);
        break;
      case 'closing':
        addClosingSlide(pptx, s, tag, footerRepoShort, brandRight, idx - 1, bgDataA, bgDataB);
        break;
      default:
        break;
    }
  }

  const data = await pptx.write({ outputType: 'nodebuffer' });
  return data as Buffer;
}
