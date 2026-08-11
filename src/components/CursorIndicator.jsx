import { forwardRef } from 'react';

// Position is set imperatively (style.transform) from the per-frame gesture
// loop in useGestureSketch, not via React state — a cursor dot has to move
// every single tracked frame, and that has no business going through a
// re-render. Only the gesture label text uses normal React state, since it
// changes rarely (only on a debounced commit).
const CursorIndicator = forwardRef(function CursorIndicator({ gestureLabel, handPresent }, ref) {
  return (
    <>
      <div ref={ref} className="cursor-dot" data-gesture={gestureLabel}>
        <span className="cursor-eraser-icon">🧽</span>
      </div>
      <div className="gesture-readout" data-visible={handPresent}>
        <span className="gesture-readout-dot" data-gesture={gestureLabel} />
        {handPresent ? gestureLabel : 'no hand detected'}
      </div>
    </>
  );
});

export default CursorIndicator;
