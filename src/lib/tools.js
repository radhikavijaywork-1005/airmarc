export const TOOL_KIND = {
  STROKE: 'stroke',
  SHAPE: 'shape',
  STAMP: 'stamp',
};

export const TOOLS = [
  { id: 'pencil', label: 'Pencil', kind: TOOL_KIND.STROKE, glyph: '✎', width: 2 },
  { id: 'brush', label: 'Brush', kind: TOOL_KIND.STROKE, glyph: '⬤', width: 14, soft: true },
  { id: 'pen', label: 'Pen', kind: TOOL_KIND.STROKE, glyph: '✒', width: 6 },
  { id: 'rectangle', label: 'Rectangle', kind: TOOL_KIND.SHAPE, glyph: '▭' },
  { id: 'circle', label: 'Circle', kind: TOOL_KIND.SHAPE, glyph: '◯' },
  { id: 'arrow', label: 'Arrow', kind: TOOL_KIND.SHAPE, glyph: '↗' },
];

// Matches the actual single-hand reaction gestures (👍 👎 ✌️) — no point
// offering a manual stamp for a shape no hand gesture can make.
export const STAMPS = ['👍', '👎', '✌️'];

export const COLORS = ['#f5f2ea', '#ff5c5c', '#ffb84d', '#4dd08a', '#4da3ff', '#c792ff'];

export const DEFAULT_TOOL_ID = 'pencil';
export const DEFAULT_COLOR = COLORS[0];

export function stampToolId(emoji) {
  return `stamp-${emoji}`;
}

export function isStampToolId(id) {
  return id?.startsWith('stamp-');
}

// TOOLS only lists strokes/shapes — stamps are generated ids, so resolve
// those into an equivalent tool object on the fly rather than listing every
// emoji as a static entry.
export function resolveTool(id) {
  const found = TOOLS.find((t) => t.id === id);
  if (found) return found;
  if (isStampToolId(id)) {
    const emoji = id.slice('stamp-'.length);
    return { id, kind: TOOL_KIND.STAMP, label: `Stamp ${emoji}`, emoji };
  }
  return TOOLS[0];
}
