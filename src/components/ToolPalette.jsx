import { motion, useReducedMotion } from 'framer-motion';
import { TOOLS, STAMPS, COLORS } from '../lib/tools';

function stampToolId(emoji) {
  return `stamp-${emoji}`;
}

function PaletteButton({
  id,
  group,
  isActive,
  hover,
  registerHitbox,
  onClick,
  children,
  label,
  variant,
  disabled,
}) {
  const reduceMotion = useReducedMotion();
  const isHovering = !disabled && hover.id === id;

  return (
    <button
      ref={(el) => registerHitbox(id, disabled ? null : el)}
      className={`palette-btn${variant ? ` palette-btn-${variant}` : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      style={
        isHovering
          ? { '--dwell-progress': `${Math.round(hover.progress * 360)}deg` }
          : undefined
      }
      data-hovering={isHovering || undefined}
    >
      {isActive && (
        <motion.span
          layoutId={`highlight-${group}`}
          className="palette-highlight"
          transition={
            reduceMotion
              ? { type: 'tween', duration: 0.18, ease: 'easeOut' }
              : { type: 'spring', visualDuration: 0.3, bounce: 0 }
          }
        />
      )}
      <span className="palette-btn-content">{children}</span>
    </button>
  );
}

export default function ToolPalette({
  activeToolId,
  activeColor,
  hover,
  registerHitbox,
  onSelectTool,
  onSelectColor,
  onClear,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  return (
    <div className="tool-palette">
      <div className="palette-section">
        {TOOLS.map((tool) => (
          <PaletteButton
            key={tool.id}
            id={tool.id}
            group="tool"
            isActive={activeToolId === tool.id}
            hover={hover}
            registerHitbox={registerHitbox}
            onClick={() => onSelectTool(tool.id)}
            label={tool.label}
          >
            <span className="palette-glyph">{tool.glyph}</span>
          </PaletteButton>
        ))}
      </div>

      <div className="palette-divider" />

      <div className="palette-section">
        {STAMPS.map((emoji) => (
          <PaletteButton
            key={emoji}
            id={stampToolId(emoji)}
            group="tool"
            isActive={activeToolId === stampToolId(emoji)}
            hover={hover}
            registerHitbox={registerHitbox}
            onClick={() => onSelectTool(stampToolId(emoji))}
            label={`Reaction stamp ${emoji} — pinch and release to drop it`}
          >
            <span className="palette-glyph">{emoji}</span>
          </PaletteButton>
        ))}
      </div>

      <div className="palette-divider" />

      <div className="palette-section">
        {COLORS.map((color) => (
          <PaletteButton
            key={color}
            id={`color-${color}`}
            group="color"
            isActive={activeColor === color}
            hover={hover}
            registerHitbox={registerHitbox}
            onClick={() => onSelectColor(color)}
            label={`Color ${color}`}
          >
            <span className="palette-swatch" style={{ background: color }} />
          </PaletteButton>
        ))}
      </div>

      <div className="palette-divider" />

      <div className="palette-section">
        <PaletteButton
          id="undo"
          isActive={false}
          hover={hover}
          registerHitbox={registerHitbox}
          onClick={onUndo}
          label="Undo (Ctrl/Cmd+Z)"
          disabled={!canUndo}
        >
          <span className="palette-glyph">↶</span>
        </PaletteButton>

        <PaletteButton
          id="redo"
          isActive={false}
          hover={hover}
          registerHitbox={registerHitbox}
          onClick={onRedo}
          label="Redo (Ctrl/Cmd+Shift+Z)"
          disabled={!canRedo}
        >
          <span className="palette-glyph">↷</span>
        </PaletteButton>
      </div>

      <div className="palette-divider" />

      <div className="palette-section">
        <PaletteButton
          id="clear"
          isActive={false}
          hover={hover}
          registerHitbox={registerHitbox}
          onClick={onClear}
          label="Clear the whole sketch"
          variant="danger"
        >
          <span className="palette-glyph">🗑</span>
        </PaletteButton>

        <PaletteButton
          id="export"
          isActive={false}
          hover={hover}
          registerHitbox={registerHitbox}
          onClick={onExport}
          label="Save sketch as PNG"
          variant="primary"
        >
          <span className="palette-glyph">⤓</span>
        </PaletteButton>
      </div>
    </div>
  );
}
