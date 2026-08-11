import { GESTURE } from './gestures';

const COMMIT_FRAMES = 4;

// Raw per-frame gesture classification is jittery. This requires a gesture
// to be read consistently for COMMIT_FRAMES in a row before it becomes the
// "committed" gesture that the rest of the app reacts to.
export class GestureDebouncer {
  constructor() {
    this.committed = GESTURE.NONE;
    this.candidate = GESTURE.NONE;
    this.streak = 0;
  }

  update(rawGesture) {
    const next = rawGesture ?? GESTURE.NONE;

    if (next === this.candidate) {
      this.streak += 1;
    } else {
      this.candidate = next;
      this.streak = 1;
    }

    if (this.streak >= COMMIT_FRAMES) {
      this.committed = this.candidate;
    }

    return this.committed;
  }

  reset() {
    this.committed = GESTURE.NONE;
    this.candidate = GESTURE.NONE;
    this.streak = 0;
  }
}
