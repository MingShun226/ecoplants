/**
 * The gestures in the photo viewer, as arithmetic.
 *
 * Three attempts at that component each shipped a formula that looked right and
 * drifted under a real pinch — the picture sliding off to one side while the
 * fingers stayed put. These reproduce the gestures as numbers, so the next
 * plausible-looking formula has to survive them first.
 *
 * Run with `npm test`. No browser, no fingers.
 */
import { register } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";

register("./ts-alias-hook.mjs", import.meta.url);

const { FITTED, clampView, zoomAbout, pinchView, toImageSpace } = await import(
  "../lib/ui/zoom.ts"
);

/** A portrait photo on a phone: 366x457 drawn inside a 390x524 window. */
const PHONE = { imageWidth: 366, imageHeight: 457, stageWidth: 390, stageHeight: 524 };

/** Equal to within a rounding hair. */
function near(actual, expected, what) {
  assert.ok(
    Math.abs(actual - expected) < 0.001,
    `${what}: expected ${expected}, got ${actual}`,
  );
}

// -------------------------------------------------------------- zoom about --

test("zooming about the middle leaves a centred picture centred", () => {
  const after = zoomAbout(FITTED, 2.5, 0, 0);
  near(after.x, 0, "x");
  near(after.y, 0, "y");
  near(after.scale, 2.5, "scale");
});

test("zooming about a point holds that point still", () => {
  // A double tap 80px right and 40px above the middle.
  const before = FITTED;
  const px = 80;
  const py = -40;

  const after = zoomAbout(before, 2.5, px, py);

  const wasOver = toImageSpace(before, px, py);
  const isOver = toImageSpace(after, px, py);
  near(isOver.x, wasOver.x, "the picture point under the tap, x");
  near(isOver.y, wasOver.y, "the picture point under the tap, y");
});

test("zooming back out from a zoomed, panned state holds its point too", () => {
  const before = { scale: 3, x: -120, y: 60 };
  const px = -30;
  const py = 90;

  const after = zoomAbout(before, 1.5, px, py);

  const wasOver = toImageSpace(before, px, py);
  const isOver = toImageSpace(after, px, py);
  near(isOver.x, wasOver.x, "x");
  near(isOver.y, wasOver.y, "y");
});

// ------------------------------------------------------------------ pinch --

test("a pinch keeps what was under the fingers under the fingers", () => {
  const start = FITTED;
  const startMid = { x: 20, y: -10 };
  // Fingers spread and the midpoint drifts, which is what fingers do.
  const currentMid = { x: 55, y: 25 };

  const after = pinchView(start, startMid, currentMid, 2.2);

  const wasOver = toImageSpace(start, startMid.x, startMid.y);
  const isOver = toImageSpace(after, currentMid.x, currentMid.y);
  near(isOver.x, wasOver.x, "x");
  near(isOver.y, wasOver.y, "y");
});

test("a pinch that does not move or scale changes nothing", () => {
  const start = { scale: 1.8, x: 40, y: -25 };
  const mid = { x: 12, y: 60 };
  const after = pinchView(start, mid, mid, 1.8);

  near(after.x, start.x, "x");
  near(after.y, start.y, "y");
});

test("a pinch that only drags pans by exactly the drag", () => {
  const start = { scale: 2, x: 0, y: 0 };
  const after = pinchView(start, { x: 0, y: 0 }, { x: 30, y: -45 }, 2);

  near(after.x, 30, "x");
  near(after.y, -45, "y");
});

test("solving from the start does not drift the way stepping did", () => {
  // The bug, reproduced: a pinch delivered in many small frames, each with the
  // midpoint wandering. Solved from the start, the answer at the end is the
  // same whether it arrived in one frame or forty.
  const start = FITTED;
  const startMid = { x: 5, y: 5 };
  const endMid = { x: 48, y: -22 };

  const inOneGo = pinchView(start, startMid, endMid, 3);

  let stepped = start;
  const frames = 40;
  for (let i = 1; i <= frames; i += 1) {
    const t = i / frames;
    stepped = pinchView(
      start,
      startMid,
      { x: startMid.x + (endMid.x - startMid.x) * t, y: startMid.y + (endMid.y - startMid.y) * t },
      1 + 2 * t,
    );
  }

  near(stepped.x, inOneGo.x, "x after forty frames");
  near(stepped.y, inOneGo.y, "y after forty frames");
});

// ------------------------------------------------------------------ clamp --

test("a fitted picture cannot be dragged at all", () => {
  // Nothing overflows at scale 1, so there is nowhere to go and no gap to open.
  const after = clampView({ scale: 1, x: 200, y: -200 }, PHONE);
  near(after.x, 0, "x");
  near(after.y, 0, "y");
});

test("a magnified picture may travel exactly its overflow", () => {
  const scale = 2;
  const after = clampView({ scale, x: 9999, y: 9999 }, PHONE);

  near(after.x, (PHONE.imageWidth * scale - PHONE.stageWidth) / 2, "x limit");
  near(after.y, (PHONE.imageHeight * scale - PHONE.stageHeight) / 2, "y limit");
});

test("the bound is symmetric", () => {
  const scale = 2.5;
  const right = clampView({ scale, x: 9999, y: 0 }, PHONE);
  const left = clampView({ scale, x: -9999, y: 0 }, PHONE);
  near(left.x, -right.x, "left mirrors right");
});

test("an axis that still fits is pinned even while the other pans", () => {
  // A wide window and a portrait picture: at 1.2x it overflows vertically and
  // not horizontally, and sideways drag has to stay pinned or a gap opens.
  const wide = { imageWidth: 300, imageHeight: 500, stageWidth: 900, stageHeight: 400 };
  const after = clampView({ scale: 1.2, x: 400, y: 400 }, wide);

  near(after.x, 0, "x stays pinned");
  near(after.y, (500 * 1.2 - 400) / 2, "y travels its overflow");
});

test("clamping never invents movement", () => {
  // Whatever it does, it only ever reduces. A picture at rest stays at rest.
  const after = clampView({ scale: 3, x: 0, y: 0 }, PHONE);
  near(after.x, 0, "x");
  near(after.y, 0, "y");
});
