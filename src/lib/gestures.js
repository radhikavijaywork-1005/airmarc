import { LANDMARK, distance, isFingerExtended } from './handGeometry';

export const GESTURE = {
  POINT: 'point',
  PALM: 'palm',
  PINCH: 'pinch',
  FIST: 'fist',
  THUMBS_UP: 'thumbsUp',
  THUMBS_DOWN: 'thumbsDown',
  PEACE: 'peace',
  NONE: 'none',
};

// The single-hand gestures that read as a plain floating emoji reaction
// (matching Apple Reactions: only thumbs up/down are simple bubbles — peace
// is a particle effect, handled separately).
export const GESTURE_STAMP = {
  [GESTURE.THUMBS_UP]: '👍',
  [GESTURE.THUMBS_DOWN]: '👎',
};

// The gestures that participate in two-hand combos (matching pair ->
// bigger effect) and/or a single-hand particle effect.
export const REACTION_GESTURES = new Set([GESTURE.THUMBS_UP, GESTURE.THUMBS_DOWN, GESTURE.PEACE]);

const PINCH_DISTANCE = 0.06;
const PINCH_RATIO = PINCH_DISTANCE / 0.15; // see handScale note below

// Classifies a single frame's landmarks into one gesture. Order matters —
// several shapes share raw finger-extended states and are only told apart
// by checking the more specific one first: thumbs-up/down before fist
// (both curl the four fingers; thumbs also spread the thumb away from the
// palm), peace before point (shares the "index extended" state but differs
// on which other fingers are also extended).
export function classifyGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return GESTURE.NONE;

  const thumbTip = landmarks[LANDMARK.THUMB_TIP];
  const thumbMcp = landmarks[LANDMARK.THUMB_MCP];
  const indexTip = landmarks[LANDMARK.INDEX_TIP];
  const indexMcp = landmarks[LANDMARK.INDEX_MCP];
  const wrist = landmarks[LANDMARK.WRIST];
  const middleMcp = landmarks[LANDMARK.MIDDLE_MCP];

  // handScale normalizes the raw MediaPipe pinch threshold (~0.06 at typical
  // webcam distance, where wrist-to-middle-mcp is roughly 0.15) so distance
  // checks still work when the hand is closer to or further from the camera.
  const handScale = distance(wrist, middleMcp) || 1;

  const indexExtended = isFingerExtended(landmarks, LANDMARK.INDEX_TIP, LANDMARK.INDEX_PIP);
  const middleExtended = isFingerExtended(landmarks, LANDMARK.MIDDLE_TIP, LANDMARK.MIDDLE_PIP);
  const ringExtended = isFingerExtended(landmarks, LANDMARK.RING_TIP, LANDMARK.RING_PIP);
  const pinkyExtended = isFingerExtended(landmarks, LANDMARK.PINKY_TIP, LANDMARK.PINKY_PIP);

  const middleCurled = !middleExtended;
  const ringCurled = !ringExtended;
  const pinkyCurled = !pinkyExtended;
  const indexCurled = !indexExtended;

  const thumbIndexPinched = distance(thumbTip, indexTip) / handScale < PINCH_RATIO;
  const thumbSpread = distance(thumbTip, indexMcp) / handScale > 0.6;

  if (thumbIndexPinched) {
    return GESTURE.PINCH;
  }

  if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbSpread) {
    return GESTURE.PALM;
  }

  if (indexCurled && middleCurled && ringCurled && pinkyCurled) {
    if (thumbSpread) {
      // thumb sticking out away from a curled fist — up or down decides
      // which, using the thumb tip vs its base knuckle on the vertical axis.
      const margin = handScale * 0.25;
      if (thumbTip.y < thumbMcp.y - margin) return GESTURE.THUMBS_UP;
      if (thumbTip.y > thumbMcp.y + margin) return GESTURE.THUMBS_DOWN;
    } else {
      return GESTURE.FIST;
    }
  }

  if (indexExtended && middleExtended && ringCurled && pinkyCurled) {
    return GESTURE.PEACE;
  }

  if (indexExtended && middleCurled && ringCurled && pinkyCurled) {
    return GESTURE.POINT;
  }

  return GESTURE.NONE;
}

// Two-hand "heart" shape: thumbs together and index tips together, the
// classic cooperative heart outline — not a single-hand pose, so it's
// checked against both hands' raw landmarks directly rather than through
// classifyGesture.
export function isHeartShape(landmarksA, landmarksB) {
  if (!landmarksA || !landmarksB) return false;
  const thumbA = landmarksA[LANDMARK.THUMB_TIP];
  const thumbB = landmarksB[LANDMARK.THUMB_TIP];
  const indexA = landmarksA[LANDMARK.INDEX_TIP];
  const indexB = landmarksB[LANDMARK.INDEX_TIP];
  const wristA = landmarksA[LANDMARK.WRIST];
  const middleMcpA = landmarksA[LANDMARK.MIDDLE_MCP];
  const scale = distance(wristA, middleMcpA) || 1;

  return distance(thumbA, thumbB) / scale < 1.1 && distance(indexA, indexB) / scale < 1.1;
}
