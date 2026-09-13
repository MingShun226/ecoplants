/**
 * The arithmetic behind pinching, panning and double-tapping a photograph.
 *
 * Pulled out of the viewer because it is the part that kept being wrong, and
 * because none of it needs React, a DOM or a finger to check. Three attempts at
 * this component each shipped a plausible-looking formula that drifted in a way
 * only a real pinch revealed; the tests beside this file reproduce those
 * gestures as numbers.
 *
 * One convention throughout, and most of the bugs came from breaking it:
 * positions are **relative to the middle of the stage**, in CSS pixels, before
 * any transform. The picture is centred there at rest, so the identity view is
 * all zeroes and a positive `x` moves it right.
 *
 * The transform this describes is `translate(x, y) scale(scale)`, in that
 * order, about the element's own centre. A point at image-local offset `u` from
 * that centre therefore lands at `x + u * scale`.
 */

export interface View {
  scale: number;
  x: number;
  y: number;
}

export const FITTED: View = { scale: 1, x: 0, y: 0 };

/** How large the picture is drawn at rest, and how much of it can be seen. */
export interface Frame {
  /** The picture's laid-out size, before any transform. */
  imageWidth: number;
  imageHeight: number;
  /** The visible window it sits in. */
  stageWidth: number;
  stageHeight: number;
}

/**
 * Hold the picture over the window.
 *
 * Measured against the **picture**, not the window. The image is fitted, so at
 * rest it is usually narrower or shorter than the stage — bounding it by the
 * stage let it be dragged until an edge came inside and left a gap, and the
 * next zoom hauled it back, which reads as the picture repositioning itself.
 *
 * What may travel is half of however much the scaled picture overflows, which
 * is nothing at all until it is larger than the window in that direction.
 */
export function clampView(view: View, frame: Frame): View {
  const limitX = Math.max(0, (frame.imageWidth * view.scale - frame.stageWidth) / 2);
  const limitY = Math.max(0, (frame.imageHeight * view.scale - frame.stageHeight) / 2);

  return {
    scale: view.scale,
    x: Math.min(limitX, Math.max(-limitX, view.x)),
    y: Math.min(limitY, Math.max(-limitY, view.y)),
  };
}

/**
 * Change scale while holding one point still.
 *
 * What a double tap and the zoom buttons do. The point is where the tap landed,
 * relative to the middle of the stage; `(0, 0)` zooms about the middle and
 * leaves a centred picture centred.
 */
export function zoomAbout(view: View, scale: number, px: number, py: number): View {
  const ratio = scale / view.scale;
  return {
    scale,
    x: px - (px - view.x) * ratio,
    y: py - (py - view.y) * ratio,
  };
}

/**
 * Where the picture should be, part-way through a pinch.
 *
 * Solved from where the gesture began rather than stepped from the frame
 * before, and that is the whole point. Stepping zooms about the midpoint *as it
 * is now*, which anchors correctly at that instant and never moves the picture
 * along with the fingers — and a real pinch's midpoint always drifts, because
 * nobody spreads two fingers symmetrically. Every frame then re-anchors a
 * little further over, and the drift accumulates until the picture has slid off
 * to one side.
 *
 * A pinch means one thing: the bit of the picture that was under the fingers
 * when it started is still under them now. That is one equation, it covers the
 * zoom and the pan together, and solving it from the start leaves nothing to
 * accumulate.
 */
export function pinchView(
  start: View,
  startMid: { x: number; y: number },
  currentMid: { x: number; y: number },
  scale: number,
): View {
  // Where the fingers began, in the picture's own coordinates.
  const ux = (startMid.x - start.x) / start.scale;
  const uy = (startMid.y - start.y) / start.scale;

  // Put that point back under them, wherever they have got to.
  return {
    scale,
    x: currentMid.x - ux * scale,
    y: currentMid.y - uy * scale,
  };
}

/** Keep a scale inside the range the viewer offers. */
export function clampScale(scale: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, scale));
}

/**
 * Where a point on screen sits in the picture's own coordinates.
 *
 * The inverse of the transform, and what every formula above is checked
 * against: if a gesture claims to hold a point still, this returns the same
 * answer before and after.
 */
export function toImageSpace(view: View, px: number, py: number): { x: number; y: number } {
  return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
}
