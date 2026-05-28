#!/usr/bin/env python3
"""Cover slide geometric background — line/dot pattern clipped by soft rotated rectangle."""

from __future__ import annotations

import argparse
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

W, H = 1600, 900
PATTERN_OPACITY_SCALE = 0.30

PALETTES: dict[str, dict[str, object]] = {
    "security": {"bg": (9, 14, 20, 0), "line": (80, 198, 245), "dot": (173, 232, 255)},
    "web": {"bg": (11, 14, 24, 0), "line": (96, 165, 250), "dot": (191, 219, 254)},
    "backend": {"bg": (14, 13, 18, 0), "line": (248, 141, 88), "dot": (254, 205, 138)},
    "ai": {"bg": (14, 11, 24, 0), "line": (173, 151, 255), "dot": (221, 214, 254)},
    "infra": {"bg": (9, 17, 18, 0), "line": (45, 212, 191), "dot": (153, 246, 228)},
    "mobile": {"bg": (18, 12, 24, 0), "line": (244, 114, 182), "dot": (251, 207, 232)},
    "data": {"bg": (10, 18, 20, 0), "line": (74, 222, 128), "dot": (187, 247, 208)},
    "general": {"bg": (10, 12, 18, 0), "line": (102, 182, 220), "dot": (186, 230, 250)},
}


def _rng(seed: int) -> random.Random:
    return random.Random(seed)


def _blend_channel(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def _draw_line_mesh(
    draw: ImageDraw.ImageDraw,
    rng: random.Random,
    line_rgb: tuple[int, int, int],
    dot_rgb: tuple[int, int, int],
):
    points = [(rng.randint(int(W * 0.58), W - 24), rng.randint(28, H - 24)) for _ in range(44)]
    for x1, y1 in points:
        near = sorted(points, key=lambda p: (p[0] - x1) ** 2 + (p[1] - y1) ** 2)[1 : rng.randint(3, 5)]
        for x2, y2 in near:
            dist = math.hypot(x2 - x1, y2 - y1)
            alpha = max(48, 170 - int(dist * 0.18))
            draw.line([(x1, y1), (x2, y2)], fill=(*line_rgb, alpha), width=rng.randint(1, 2))

    for x, y in points:
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(*dot_rgb, rng.randint(160, 230)))


def _draw_soft_waves(draw: ImageDraw.ImageDraw, rng: random.Random, line_rgb: tuple[int, int, int]):
    for row in range(4):
        y = int(H * (0.36 + row * 0.12))
        amp = rng.randint(12, 24)
        period = rng.uniform(65.0, 110.0)
        pts = []
        for x in range(int(W * 0.56), W, 18):
            yy = y + int(math.sin((x + row * 70) / period) * amp)
            pts.append((x, yy))
        if len(pts) > 1:
            draw.line(pts, fill=(*line_rgb, rng.randint(72, 130)), width=rng.randint(1, 2))


def _draw_vertical_shade(draw: ImageDraw.ImageDraw):
    for i in range(0, W, 4):
        t = i / W
        a = int(18 * (t ** 1.25))
        draw.line([(i, 0), (i, H)], fill=(10, 12, 16, a), width=4)


def _rotated_rect_polygon(cx: float, cy: float, rw: float, rh: float, deg: float):
    rad = math.radians(deg)
    c, s = math.cos(rad), math.sin(rad)
    pts = [(-rw / 2, -rh / 2), (rw / 2, -rh / 2), (rw / 2, rh / 2), (-rw / 2, rh / 2)]
    out = []
    for x, y in pts:
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out


def _build_soft_mask(rng: random.Random):
    # 매번 달라지는 사각형(위치/크기/회전)
    cx = rng.uniform(W * 0.68, W * 0.90)
    cy = rng.uniform(H * 0.28, H * 0.62)
    rw = rng.uniform(W * 0.30, W * 0.46)
    rh = rng.uniform(H * 0.62, H * 0.88)
    deg = rng.uniform(-42.0, 42.0)

    poly = _rotated_rect_polygon(cx, cy, rw, rh, deg)

    hard = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(hard)
    d.polygon(poly, fill=210)

    # 내부는 선명, 경계는 부드럽게 사라지도록 다단 블러 혼합
    soft1 = hard.filter(ImageFilter.GaussianBlur(40))
    soft2 = hard.filter(ImageFilter.GaussianBlur(92))
    center = hard.filter(ImageFilter.GaussianBlur(14))
    merged = ImageChops.lighter(soft1, center)
    merged = ImageChops.add(merged, soft2, scale=1.7)

    # 좌측 경계가 딱 끊겨 보이지 않도록, 왼쪽에서 오른쪽으로 점진 페이드 적용
    fade = Image.new("L", (W, 1), 0)
    px = fade.load()
    fade_start = int(W * 0.40)
    fade_end = int(W * 0.76)
    for x in range(W):
      if x <= fade_start:
          v = 0
      elif x >= fade_end:
          v = 255
      else:
          v = int(255 * (x - fade_start) / max(1, fade_end - fade_start))
      px[x, 0] = v
    fade = fade.resize((W, H))
    merged = ImageChops.multiply(merged, fade)

    # 배경 패턴 투명도 조절 (낮을수록 더 투명)
    merged = merged.point(lambda p: int(p * PATTERN_OPACITY_SCALE))
    return merged


def render(category: str, seed: int, out_path: Path) -> None:
    rng = _rng(seed)
    data = PALETTES.get(category, PALETTES["general"])
    bg = data["bg"]
    line_rgb = data["line"]
    dot_rgb = data["dot"]

    # 배경 캔버스
    img = Image.new("RGBA", (W, H), bg)
    base_draw = ImageDraw.Draw(img, "RGBA")
    _draw_vertical_shade(base_draw)

    # 패턴 전용 레이어 (선/점만)
    pattern = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pattern, "RGBA")
    _draw_line_mesh(pd, rng, line_rgb, dot_rgb)
    _draw_soft_waves(pd, rng, line_rgb)

    # 사각형 마스크 내부는 또렷, 외곽은 부드럽게 페이드
    mask = _build_soft_mask(rng)
    pattern.putalpha(mask)

    # 합성 + 약한 블러
    img.alpha_composite(pattern)
    img = img.filter(ImageFilter.GaussianBlur(0.18))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["dynamic", "templates"], default="dynamic")
    parser.add_argument("--category", default="general")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", required=False)
    parser.add_argument("--templates-dir", default="public/cover-bg")
    args = parser.parse_args()

    if args.mode == "templates":
        root = Path(args.templates_dir)
        for cat in PALETTES:
            out = root / f"{cat}.png"
            render(cat, hash(cat) & 0xFFFFFFFF, out)
            print(out)
        return 0

    if not args.out:
        print("error: --out required for dynamic mode", file=sys.stderr)
        return 1
    render(args.category, args.seed, Path(args.out))
    print(args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
