import { LANDMARK, distance } from './handGeometry';

// Fingertip position used as the drawing/cursor point for point + palm gestures.
export function fingertipPoint(landmarks) {
  return landmarks[LANDMARK.INDEX_TIP];
}

// Midpoint between thumb and index tip — the natural pinch anchor.
export function pinchPoint(landmarks) {
  const a = landmarks[LANDMARK.THUMB_TIP];
  const b = landmarks[LANDMARK.INDEX_TIP];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Center of the palm itself (wrist + finger base joints), not the
// fingertips — this is what makes the erase gesture read as a flat hand
// wiping the canvas like a duster on a whiteboard, rather than four
// fingertips dragging a thin trail.
export function palmPoint(landmarks) {
  const base = [
    LANDMARK.WRIST,
    LANDMARK.INDEX_MCP,
    LANDMARK.MIDDLE_MCP,
    LANDMARK.RING_MCP,
    LANDMARK.PINKY_MCP,
  ];
  const sum = base.reduce(
    (acc, idx) => ({ x: acc.x + landmarks[idx].x, y: acc.y + landmarks[idx].y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / base.length, y: sum.y / base.length };
}

// Normalized hand size (wrist to middle-finger base), used to scale the
// eraser radius so it feels palm-sized regardless of distance from camera.
export function handScale(landmarks) {
  return distance(landmarks[LANDMARK.WRIST], landmarks[LANDMARK.MIDDLE_MCP]) || 0.15;
}

export function toCanvasSpace(normalizedPoint, width, height) {
  return { x: normalizedPoint.x * width, y: normalizedPoint.y * height };
}

export { distance };
