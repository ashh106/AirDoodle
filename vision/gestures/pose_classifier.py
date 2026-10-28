"""Mutually exclusive AirDoodle pose classification (either physical hand).

Priority:
  1. thumb-index pinch -> draw
  2. index-middle crossing -> detail erase
  3. curled/fist pose -> object erase
  4. none -> pointer
"""

from __future__ import annotations

import math
from typing import Dict, Optional, Tuple

Landmark = Tuple[float, float]
Landmarks = Dict[int, Landmark]

DRAW_PINCH_ENTER = 0.26
DRAW_PINCH_EXIT = 0.35
FIST_ENTER = 1.05
FIST_EXIT = 1.22
CROSS_TIP_MAX = 0.55


def distance(a: Landmark, b: Landmark) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def palm_scale(lm: Landmarks) -> float:
    if 0 not in lm or 9 not in lm:
        return 100.0
    scale = distance(lm[0], lm[9])
    return scale if scale >= 10.0 else 100.0


def _orientation(a: Landmark, b: Landmark, c: Landmark) -> float:
    return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1])


def segments_intersect(a: Landmark, b: Landmark, c: Landmark, d: Landmark) -> bool:
    o1 = _orientation(a, b, c)
    o2 = _orientation(a, b, d)
    o3 = _orientation(c, d, a)
    o4 = _orientation(c, d, b)
    return (o1 * o2 < 0) and (o3 * o4 < 0)


def is_pinch(lm: Landmarks, scale: float, hysteresis: str = "enter") -> bool:
    if 4 not in lm or 8 not in lm:
        return False
    ratio = distance(lm[4], lm[8]) / scale
    return ratio < (DRAW_PINCH_EXIT if hysteresis == "exit" else DRAW_PINCH_ENTER)


def is_index_middle_cross(lm: Landmarks, scale: float) -> bool:
    """2D proxy for crossing the index over the middle finger."""
    needed = (5, 6, 8, 9, 10, 12)
    if any(i not in lm for i in needed):
        return False

    index_len = distance(lm[5], lm[8]) / scale
    middle_len = distance(lm[9], lm[12]) / scale
    if index_len < 0.35 or middle_len < 0.35:
        return False

    tips_close = distance(lm[8], lm[12]) / scale < CROSS_TIP_MAX
    bones_cross = segments_intersect(lm[5], lm[8], lm[9], lm[12])

    # Lateral swap: index tip and index MCP lie on opposite sides of the middle finger.
    mid_dir = (lm[12][0] - lm[9][0], lm[12][1] - lm[9][1])
    to_index_tip = (lm[8][0] - lm[9][0], lm[8][1] - lm[9][1])
    to_index_mcp = (lm[5][0] - lm[9][0], lm[5][1] - lm[9][1])
    cross_tip = mid_dir[0] * to_index_tip[1] - mid_dir[1] * to_index_tip[0]
    cross_mcp = mid_dir[0] * to_index_mcp[1] - mid_dir[1] * to_index_mcp[0]
    lateral_swap = (cross_tip * cross_mcp) < 0 and abs(cross_tip) > 40.0

    # Index tip nearer to middle PIP than to a fully open spread.
    tucked = distance(lm[8], lm[10]) / scale < 0.42 and tips_close
    return bones_cross or (tips_close and (lateral_swap or tucked))


def is_fist(lm: Landmarks, scale: float, hysteresis: str = "enter") -> bool:
    """Compact curled-hand pose from joint curl + fingertip-to-palm distances."""
    tips = (8, 12, 16, 20)
    pips = (6, 10, 14, 18)
    mcps = (5, 9, 13, 17)
    if 0 not in lm or any(i not in lm for i in tips + pips + mcps):
        return False

    palm = lm[9] if 9 in lm else lm[0]
    tip_palm = sum(distance(lm[t], palm) for t in tips) / (4.0 * scale)
    curled = 0
    for tip, pip, mcp in zip(tips, pips, mcps):
        if distance(lm[tip], lm[mcp]) < distance(lm[pip], lm[mcp]) * 1.35:
            curled += 1
        elif distance(lm[tip], lm[0]) < distance(lm[mcp], lm[0]) * 1.05:
            curled += 1

    limit = FIST_EXIT if hysteresis == "exit" else FIST_ENTER
    return curled >= 3 and tip_palm < limit


def classify_pose(lm: Landmarks, active: Optional[str] = None) -> str:
    """Return pinch | cross | fist | none with hysteresis for the active action."""
    if not lm or 0 not in lm or 8 not in lm:
        return "none"
    scale = palm_scale(lm)

    if active == "drawing":
        return "pinch" if is_pinch(lm, scale, "exit") else "none"
    if active == "detail":
        return "cross" if is_index_middle_cross(lm, scale) else "none"
    if active == "object":
        return "fist" if is_fist(lm, scale, "exit") else "none"

    if is_pinch(lm, scale, "enter"):
        return "pinch"
    if is_index_middle_cross(lm, scale):
        return "cross"
    if is_fist(lm, scale, "enter"):
        return "fist"
    return "none"


def idle_brush_width(lm: Landmarks, current: int = 4) -> int:
    """Brush width from an open thumb-index span. Never use a closed pinch."""
    if 4 not in lm or 8 not in lm:
        return current
    scale = palm_scale(lm)
    span = distance(lm[4], lm[8]) / scale
    if span < DRAW_PINCH_EXIT:
        return current
    width = int(round(4 + (span - 0.38) * 36))
    return max(2, min(24, width))
