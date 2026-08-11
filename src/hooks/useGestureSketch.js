import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHandTracking } from './useHandTracking';
import { classifyGesture, GESTURE, GESTURE_STAMP, REACTION_GESTURES, isHeartShape } from '../lib/gestures';
import { GestureDebouncer } from '../lib/gestureDebouncer';
import { fingertipPoint, palmPoint, pinchPoint, toCanvasSpace, handScale } from '../lib/handGestureUtils';
import { SketchEngine, isStrokeTool, isShapeTool } from '../lib/canvasEngine';
import { drawHandSkeleton } from '../lib/drawSkeleton';
import { ParticleSystem } from '../lib/particles';
import { TOOL_KIND, DEFAULT_TOOL_ID, DEFAULT_COLOR, resolveTool, isStampToolId } from '../lib/tools';

const DWELL_MS = 550;
const CALIBRATION_CONFIRM_MS = 1100;
const STAMP_HINT_MS = 3400;
const STAMP_HINT_STORAGE_KEY = 'gesture-sketch-stamp-hint-shown';

export function useGestureSketch() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const skeletonCanvasRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const cursorRef = useRef(null);

  const engineRef = useRef(null);
  const debouncerRef = useRef(new GestureDebouncer());
  const comboDebouncerRef = useRef(new GestureDebouncer());
  const particleSystemRef = useRef(new ParticleSystem());
  const lastFrameTimeRef = useRef(performance.now());
  const hitboxesRef = useRef(new Map()); // id -> element
  const dwellRef = useRef({ id: null, startedAt: 0 });
  const frameStateRef = useRef({
    prevGesture: GESTURE.NONE,
    prevCombo: 'none',
    lastPinchPoint: null,
    lastErasePoint: null,
    smoothedDrawPoint: null,
    activeToolIdRef: DEFAULT_TOOL_ID,
    activeColorRef: DEFAULT_COLOR,
  });

  const [activeToolId, setActiveToolId] = useState(DEFAULT_TOOL_ID);
  const [activeColor, setActiveColor] = useState(DEFAULT_COLOR);
  const [gestureLabel, setGestureLabel] = useState(GESTURE.NONE);
  const [handPresent, setHandPresent] = useState(false);
  const [hover, setHover] = useState({ id: null, progress: 0 });
  const [captureFlash, setCaptureFlash] = useState(false);
  const [calibration, setCalibration] = useState('awaiting'); // awaiting | confirmed | ready
  const calibrationRef = useRef('awaiting');
  const [stampHint, setStampHint] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const stampHintShownRef = useRef(
    typeof window !== 'undefined' && window.localStorage.getItem(STAMP_HINT_STORAGE_KEY) === '1',
  );

  // keep refs in sync so the per-frame callback (defined once) always reads
  // the latest selection without needing to be recreated every render.
  useEffect(() => {
    frameStateRef.current.activeToolIdRef = activeToolId;
  }, [activeToolId]);
  useEffect(() => {
    frameStateRef.current.activeColorRef = activeColor;
  }, [activeColor]);

  useEffect(() => {
    if (!isStampToolId(activeToolId) || stampHintShownRef.current) return;
    stampHintShownRef.current = true;
    window.localStorage.setItem(STAMP_HINT_STORAGE_KEY, '1');
    setStampHint(true);
    const timer = setTimeout(() => setStampHint(false), STAMP_HINT_MS);
    return () => clearTimeout(timer);
  }, [activeToolId]);

  const dismissGuide = useCallback(() => setGuideOpen(false), []);

  const registerHitbox = useCallback((id, el) => {
    if (el) hitboxesRef.current.set(id, el);
    else hitboxesRef.current.delete(id);
  }, []);

  const activeTool = useMemo(() => resolveTool(activeToolId), [activeToolId]);

  const onSelect = useRef(null); // set by caller (App) via setOnSelect

  const setOnSelect = useCallback((fn) => {
    onSelect.current = fn;
  }, []);

  const exportSketch = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const url = engine.toDataURL();
    const link = document.createElement('a');
    link.href = url;
    link.download = `airmarc-${Date.now()}.png`;
    link.click();
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 260);
  }, []);

  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const skeletonCanvas = skeletonCanvasRef.current;
    const particleCanvas = particleCanvasRef.current;
    const engine = engineRef.current;
    if (!container || !canvas || !engine) return;
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    engine.resize(w, h);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    engine.render();

    if (skeletonCanvas) {
      skeletonCanvas.width = w;
      skeletonCanvas.height = h;
      skeletonCanvas.style.width = `${rect.width}px`;
      skeletonCanvas.style.height = `${rect.height}px`;
    }

    if (particleCanvas) {
      particleCanvas.width = w;
      particleCanvas.height = h;
      particleCanvas.style.width = `${rect.width}px`;
      particleCanvas.style.height = `${rect.height}px`;
    }
  }, []);

  const clearSketch = useCallback(() => {
    engineRef.current?.clear();
    engineRef.current?.render();
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Called right before any raster mutation (new stroke, erase, stamp
  // placement) so undo always has a "before" state to return to.
  const checkpoint = useCallback(() => {
    engineRef.current?.checkpoint();
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.undo()) return;
    setCanUndo(engine.canUndo());
    setCanRedo(engine.canRedo());
  }, []);

  const redo = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.redo()) return;
    setCanUndo(engine.canUndo());
    setCanRedo(engine.canRedo());
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (!(e.metaKey || e.ctrlKey) || key !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new SketchEngine(canvasRef.current);
      resizeCanvas();
    }
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  const processDwell = useCallback((pageX, pageY, isPointing) => {
    const boxes = hitboxesRef.current;
    let hitId = null;
    if (isPointing) {
      for (const [id, el] of boxes) {
        const r = el.getBoundingClientRect();
        if (pageX >= r.left && pageX <= r.right && pageY >= r.top && pageY <= r.bottom) {
          hitId = id;
          break;
        }
      }
    }

    const dwell = dwellRef.current;
    if (hitId && hitId === dwell.id) {
      const elapsed = performance.now() - dwell.startedAt;
      const progress = Math.min(1, elapsed / DWELL_MS);
      setHover({ id: hitId, progress });
      if (progress >= 1) {
        onSelect.current?.(hitId);
        dwell.id = null;
        dwell.startedAt = 0;
        setHover({ id: null, progress: 0 });
      }
    } else if (hitId) {
      dwell.id = hitId;
      dwell.startedAt = performance.now();
      setHover({ id: hitId, progress: 0 });
    } else if (dwell.id) {
      dwell.id = null;
      dwell.startedAt = 0;
      setHover({ id: null, progress: 0 });
    }

    return !!hitId;
  }, []);

  const onResults = useCallback(
    (result) => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      // particles animate on their own clock regardless of whether a hand
      // is currently tracked, so a reaction keeps floating away even if you
      // drop your hand out of frame partway through.
      const particleCanvas = particleCanvasRef.current;
      if (particleCanvas) {
        particleSystemRef.current.update(dt);
        const pctx = particleCanvas.getContext('2d');
        pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particleSystemRef.current.render(pctx);
      }

      const engine = engineRef.current;
      const container = containerRef.current;
      const cursorEl = cursorRef.current;
      if (!engine || !container) return;

      const landmarks = result.landmarks?.[0];
      const containerRect = container.getBoundingClientRect();
      const state = frameStateRef.current;
      const skeletonCanvas = skeletonCanvasRef.current;

      if (!landmarks) {
        setHandPresent(false);
        if (state.prevGesture === GESTURE.POINT) engine.endStroke();
        state.prevGesture = GESTURE.NONE;
        debouncerRef.current.reset();
        setGestureLabel(GESTURE.NONE);
        if (cursorEl) cursorEl.style.opacity = '0';
        if (skeletonCanvas) {
          skeletonCanvas.getContext('2d').clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
        }
        engine.render();
        return;
      }

      setHandPresent(true);

      if (calibrationRef.current === 'awaiting') {
        calibrationRef.current = 'confirmed';
        setCalibration('confirmed');
        setTimeout(() => {
          calibrationRef.current = 'ready';
          setCalibration('ready');
        }, CALIBRATION_CONFIRM_MS);
      }

      if (skeletonCanvas) {
        drawHandSkeleton(
          skeletonCanvas.getContext('2d'),
          landmarks,
          skeletonCanvas.width,
          skeletonCanvas.height,
          { emphasize: calibrationRef.current !== 'ready' },
        );
      }

      const raw = classifyGesture(landmarks);
      const gesture = debouncerRef.current.update(raw);
      setGestureLabel((prev) => (prev === gesture ? prev : gesture));

      const tool = resolveTool(state.activeToolIdRef);
      const color = state.activeColorRef;

      // normalized point per gesture, then both canvas-space (for drawing,
      // unmirrored raw camera space) and page-space (mirrored, for cursor +
      // palette hit-testing) versions.
      let norm;
      if (gesture === GESTURE.PINCH) norm = pinchPoint(landmarks);
      else if (gesture === GESTURE.PALM) norm = palmPoint(landmarks);
      else norm = fingertipPoint(landmarks);

      const canvasPoint = toCanvasSpace(norm, engine.canvas.width, engine.canvas.height);
      const mirroredX = containerRect.left + (containerRect.width - norm.x * containerRect.width);
      const pageY = containerRect.top + norm.y * containerRect.height;

      if (cursorEl) {
        cursorEl.style.opacity = gesture === GESTURE.FIST ? '0.35' : '1';
        cursorEl.style.transform = `translate3d(${mirroredX}px, ${pageY}px, 0)`;
        cursorEl.dataset.gesture = gesture;
      }

      const overPalette = gesture === GESTURE.POINT && processDwell(mirroredX, pageY, true);
      if (gesture !== GESTURE.POINT) processDwell(0, 0, false);

      const enteringGesture = gesture !== state.prevGesture;

      if (gesture === GESTURE.POINT && !overPalette) {
        if (isStrokeTool(tool)) {
          // Raw landmark jitter (a few px of noise even on a still hand)
          // translates directly into a shaky, hard-to-control line at 1:1
          // tracking. A light exponential smoothing filter on the draw
          // point only (not the cursor dot, not shapes) cuts that jitter
          // to something drawable while staying visually instant — alpha
          // 0.55 means it's still mostly this frame's position, just not
          // 100% of the raw noise.
          if (enteringGesture || !state.smoothedDrawPoint) {
            checkpoint();
            state.smoothedDrawPoint = canvasPoint;
            engine.beginStroke(tool, color, canvasPoint);
          } else {
            const alpha = 0.55;
            state.smoothedDrawPoint = {
              x: state.smoothedDrawPoint.x + (canvasPoint.x - state.smoothedDrawPoint.x) * alpha,
              y: state.smoothedDrawPoint.y + (canvasPoint.y - state.smoothedDrawPoint.y) * alpha,
            };
            engine.extendStroke(state.smoothedDrawPoint);
          }
        } else if (isShapeTool(tool)) {
          if (enteringGesture) {
            checkpoint();
            engine.beginShape(tool, color, canvasPoint);
          } else {
            engine.updateShape(canvasPoint);
          }
        }
      } else if (state.prevGesture === GESTURE.POINT) {
        if (isStrokeTool(tool)) engine.endStroke();
        else if (isShapeTool(tool)) engine.endShape();
        state.smoothedDrawPoint = null;
      }

      if (gesture === GESTURE.PALM && !overPalette) {
        // scale the eraser to the hand's actual size in frame, so a palm
        // sweep clears a palm-sized patch whether the hand is near or far.
        const radius = handScale(landmarks) * engine.canvas.width * 0.4;
        if (state.lastErasePoint) {
          engine.eraseSweep(state.lastErasePoint, canvasPoint, radius);
        } else {
          checkpoint();
          engine.eraseAt(canvasPoint, radius);
        }
        state.lastErasePoint = canvasPoint;
      } else if (state.prevGesture === GESTURE.PALM) {
        state.lastErasePoint = null;
      }

      if (gesture === GESTURE.PINCH) {
        if (tool.kind === TOOL_KIND.STAMP) {
          if (enteringGesture) checkpoint();
          engine.previewStamp(tool.emoji, canvasPoint);
        } else if (enteringGesture) {
          state.lastPinchPoint = canvasPoint;
        } else if (state.lastPinchPoint && engine.hasLiveObject()) {
          const dx = canvasPoint.x - state.lastPinchPoint.x;
          const dy = canvasPoint.y - state.lastPinchPoint.y;
          engine.moveLiveObject(dx, dy);
          state.lastPinchPoint = canvasPoint;
        }
      } else if (state.prevGesture === GESTURE.PINCH) {
        if (tool.kind === TOOL_KIND.STAMP) engine.dropStamp();
        state.lastPinchPoint = null;
      }

      // Reactions, matching Apple's actual gesture set: a single hand
      // doing thumbs up/down is a plain floating emoji bubble; a single
      // peace sign is balloons; two hands doing the *same* sign together
      // triggers the bigger effect (fireworks, rain, confetti),
      // and bringing both hands' thumb+index tips together forms a heart.
      // None of these leave anything on the sketch — that's what the
      // palette's stamp tool (select, then pinch-and-release) is for.
      //
      // Gated on the *committed* gesture (not the raw per-frame read) and
      // skipped entirely while a work gesture is active — otherwise a
      // single noisy frame mid-stroke (point briefly misread, or a
      // spurious second-hand detection near the drawing hand) was enough
      // to pop a balloon or heart while actually drawing.
      const isWorkGesture =
        gesture === GESTURE.POINT || gesture === GESTURE.PALM || gesture === GESTURE.PINCH;
      const secondLandmarks = result.landmarks?.[1];
      let comboKey = 'none';
      let heartMid = null;

      if (isWorkGesture) {
        comboKey = 'none';
      } else if (secondLandmarks && isHeartShape(landmarks, secondLandmarks)) {
        comboKey = 'heart';
        const a = fingertipPoint(landmarks);
        const b = fingertipPoint(secondLandmarks);
        heartMid = toCanvasSpace(
          { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          engine.canvas.width,
          engine.canvas.height,
        );
      } else if (secondLandmarks) {
        const secondGesture = classifyGesture(secondLandmarks);
        if (REACTION_GESTURES.has(gesture) && gesture === secondGesture) {
          comboKey = `combo:${gesture}`;
        }
      } else if (REACTION_GESTURES.has(gesture)) {
        comboKey = `single:${gesture}`;
      }

      const committedCombo = comboDebouncerRef.current.update(comboKey);
      const enteringCombo = committedCombo !== 'none' && committedCombo !== state.prevCombo;

      if (enteringCombo && particleCanvas) {
        const w = particleCanvas.width;
        const h = particleCanvas.height;
        const ps = particleSystemRef.current;

        if (committedCombo === 'heart' && heartMid) {
          ps.spawnHearts(heartMid.x, heartMid.y, w);
        } else if (committedCombo === `combo:${GESTURE.THUMBS_UP}`) {
          ps.spawnFireworks(w, h);
        } else if (committedCombo === `combo:${GESTURE.THUMBS_DOWN}`) {
          ps.spawnRain(w, h);
        } else if (committedCombo === `combo:${GESTURE.PEACE}`) {
          ps.spawnConfetti(w);
        } else if (committedCombo === `single:${GESTURE.PEACE}`) {
          ps.spawnBalloons(w, h);
        } else if (committedCombo === `single:${GESTURE.THUMBS_UP}`) {
          ps.spawnDirectionalBurst(GESTURE_STAMP[GESTURE.THUMBS_UP], w, h, 'up');
        } else if (committedCombo === `single:${GESTURE.THUMBS_DOWN}`) {
          ps.spawnDirectionalBurst(GESTURE_STAMP[GESTURE.THUMBS_DOWN], w, h, 'down');
        }
      }

      state.prevCombo = committedCombo;
      state.prevGesture = gesture;
      engine.render();
    },
    [processDwell, checkpoint],
  );

  const { videoRef, status, stage, error } = useHandTracking(onResults);

  return {
    containerRef,
    canvasRef,
    skeletonCanvasRef,
    particleCanvasRef,
    cursorRef,
    videoRef,
    status,
    stage,
    error,
    guideOpen,
    dismissGuide,
    activeToolId,
    setActiveToolId,
    activeColor,
    setActiveColor,
    activeTool,
    gestureLabel,
    handPresent,
    hover,
    registerHitbox,
    setOnSelect,
    exportSketch,
    clearSketch,
    undo,
    redo,
    canUndo,
    canRedo,
    captureFlash,
    calibration,
    stampHint,
  };
}
