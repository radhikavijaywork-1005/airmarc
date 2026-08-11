import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGestureSketch } from '../hooks/useGestureSketch';
import ToolPalette from './ToolPalette';
import CursorIndicator from './CursorIndicator';
import CaptureFlash from './CaptureFlash';

const GESTURE_LEGEND = [
  { icon: '☝️', gesture: 'point', action: 'Draw' },
  { icon: '✋', gesture: 'palm', action: 'Erase' },
  { icon: '🤏', gesture: 'pinch', action: 'Grab · move' },
  { icon: '✊', gesture: 'fist', action: 'Pause' },
];

// tooltip = the gesture you make, spelled out — the resulting icon alone
// (especially the combo effects) doesn't look like any hand shape, so the
// hover guide has to name the shape, not just the effect.
const REACTION_LEGEND = [
  { icon: '👍', gesture: 'thumbsUp', tooltip: '👍 Thumbs up → pops a reaction' },
  { icon: '👎', gesture: 'thumbsDown', tooltip: '👎 Thumbs down → pops a reaction' },
  { icon: '✌️', gesture: 'peace', tooltip: '✌️ Peace sign → balloons' },
];

// Two-hand combos — matching Apple's Reactions gesture set. Shown as a
// static reference row rather than live-highlighted, since it needs both
// hands agreeing on the same shape to fire.
const COMBO_LEGEND = [
  { icon: '🎆', tooltip: '👍 + 👍, both hands → fireworks' },
  { icon: '🌧️', tooltip: '👎 + 👎, both hands → rain' },
  { icon: '🎊', tooltip: '✌️ + ✌️, both hands → confetti' },
  { icon: '💗', tooltip: 'Touch fingertips of both hands → hearts' },
];

// Same motif as the favicon (a drawn line trailing into a glowing cursor
// dot), reused here so the loading and guide screens read as the same
// brand mark rather than introducing a second logo.
function AirmarcMark() {
  return (
    <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true">
      <path
        d="M9 34C13 23 20 14 33 12.5"
        fill="none"
        stroke="#f5f2ea"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="35" cy="12" r="6.5" fill="#5ad1ff" opacity="0.32" />
      <circle cx="35" cy="12" r="3.4" fill="#5ad1ff" />
    </svg>
  );
}

const GUIDE_ITEMS = [
  { icon: '☝️', title: 'Draw', desc: 'Point index finger to draw' },
  { icon: '✋', title: 'Erase', desc: 'Sweep open palm to erase' },
  { icon: '🤏', title: 'Move', desc: 'Pinch to grab & reposition' },
  { icon: '✊', title: 'Idle', desc: 'Close fist to pause' },
];

export default function GestureSketch() {
  const {
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
  } = useGestureSketch();

  useEffect(() => {
    setOnSelect((id) => {
      if (id === 'export') {
        exportSketch();
      } else if (id === 'clear') {
        clearSketch();
      } else if (id === 'undo') {
        undo();
      } else if (id === 'redo') {
        redo();
      } else if (id.startsWith('color-')) {
        setActiveColor(id.slice('color-'.length));
      } else {
        setActiveToolId(id);
      }
    });
  }, [setOnSelect, exportSketch, clearSketch, undo, redo, setActiveColor, setActiveToolId]);

  return (
    <div className="app-shell">
      <div className="video-stage" ref={containerRef}>
        <div className="mirrored-layer">
          <video ref={videoRef} className="webcam-feed" playsInline muted />
          <canvas ref={canvasRef} className={`sketch-canvas${captureFlash ? ' capture-pulse' : ''}`} />
          <canvas ref={skeletonCanvasRef} className="skeleton-canvas" />
          <canvas ref={particleCanvasRef} className="particle-canvas" />
        </div>

        <div className="overlay-layer">
          <CaptureFlash active={captureFlash} />
          <CursorIndicator ref={cursorRef} gestureLabel={gestureLabel} handPresent={handPresent} />

          <div className="hud">
            <div className="hud-title">Airmarc</div>
            <ul className="gesture-legend">
              {GESTURE_LEGEND.map((g) => (
                <li
                  key={g.gesture}
                  className="gesture-legend-item"
                  data-active={handPresent && gestureLabel === g.gesture}
                >
                  <span className="gesture-legend-icon">{g.icon}</span>
                  <span className="gesture-legend-action">{g.action}</span>
                </li>
              ))}
            </ul>

            <div className="reaction-legend">
              {REACTION_LEGEND.map((g) => (
                <span
                  key={g.gesture}
                  className="reaction-legend-item legend-hoverable"
                  data-active={handPresent && gestureLabel === g.gesture}
                  tabIndex={0}
                >
                  {g.icon}
                  <span className="legend-tooltip">{g.tooltip}</span>
                </span>
              ))}
            </div>

            <div className="combo-legend">
              {COMBO_LEGEND.map((g) => (
                <span key={g.icon} className="combo-legend-item legend-hoverable" tabIndex={0}>
                  {g.icon}
                  <span className="legend-tooltip">{g.tooltip}</span>
                </span>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {status === 'loading' && (
              <motion.div
                className="fullscreen-status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div className="status-badge">
                  <AirmarcMark />
                </div>
                <div className="status-text">
                  {stage === 'camera' ? 'Requesting camera access…' : 'Loading hand-tracking model…'}
                </div>
                <div className="status-progress">
                  <div className="status-progress-fill" />
                </div>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                className="fullscreen-status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div className="status-badge status-badge-error">
                  <AirmarcMark />
                </div>
                <div className="status-text status-text-error">
                  Couldn't access the camera or hand-tracking model{error ? `: ${error}` : '.'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {status === 'ready' && guideOpen && (
              <motion.div
                className="fullscreen-status guide-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <motion.div
                  className="guide-card"
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ type: 'spring', visualDuration: 0.35, bounce: 0.15 }}
                >
                  <div className="status-badge">
                    <AirmarcMark />
                  </div>
                  <div className="guide-title">Draw in the air</div>
                  <div className="guide-grid">
                    {GUIDE_ITEMS.map((item) => (
                      <div className="guide-item" key={item.title}>
                        <span className="guide-item-icon">{item.icon}</span>
                        <div>
                          <div className="guide-item-title">{item.title}</div>
                          <div className="guide-item-desc">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="guide-cta" onClick={dismissGuide}>
                    Let's Go!
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {status === 'ready' && !guideOpen && calibration !== 'ready' && (
              <motion.div
                className="calibration-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                {calibration === 'awaiting' ? (
                  <>
                    <span className="calibration-icon calibration-pulse">✋</span>
                    <div className="calibration-title">Show your hand to the camera</div>
                    <div className="calibration-subtitle">
                      We'll trace your thumb, fingers, and palm to get started.
                    </div>
                  </>
                ) : (
                  <>
                    <span className="calibration-icon">✅</span>
                    <div className="calibration-title">Hand detected</div>
                    <div className="calibration-subtitle">Tracking thumb, fingers, and palm.</div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {stampHint && (
              <motion.div
                className="stamp-hint"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                🤏 Pinch and release to drop this stamp. Thumbs up/down also work as
                instant reactions — try peace ✌️ for balloons, or match gestures with a
                second hand for the bigger effects.
              </motion.div>
            )}
          </AnimatePresence>

          <ToolPalette
            activeToolId={activeToolId}
            activeColor={activeColor}
            hover={hover}
            registerHitbox={registerHitbox}
            onSelectTool={setActiveToolId}
            onSelectColor={setActiveColor}
            onClear={clearSketch}
            onExport={exportSketch}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      </div>
    </div>
  );
}
