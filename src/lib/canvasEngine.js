import { TOOL_KIND } from './tools';

// Owns the sketch surface: a permanent raster (freehand strokes + erasing,
// baked in as they happen) plus a single "live" object — the most recently
// placed shape or stamp — which stays movable by pinch until something else
// is drawn, at which point it gets baked into the raster too.
export class SketchEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.liveObject = null; // { kind: 'shape'|'stamp', ... }
    this.activeStroke = null; // in-progress freehand stroke, raw points
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 30;
  }

  resize(width, height) {
    const raster = document.createElement('canvas');
    raster.width = width;
    raster.height = height;
    if (this.canvas.width && this.canvas.height) {
      raster.getContext('2d').drawImage(this.canvas, 0, 0, width, height);
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.raster = raster;
  }

  _cloneRaster() {
    const snap = document.createElement('canvas');
    snap.width = this.raster.width;
    snap.height = this.raster.height;
    snap.getContext('2d').drawImage(this.raster, 0, 0);
    return snap;
  }

  _restoreRaster(snapshot) {
    const rctx = this.raster.getContext('2d');
    rctx.clearRect(0, 0, this.raster.width, this.raster.height);
    rctx.drawImage(snapshot, 0, 0, this.raster.width, this.raster.height);
  }

  // Call before any action that's about to permanently mutate the raster
  // (a new stroke, erase sweep, stamp placement, or clear) so undo has a
  // "before" state to return to. Starting a new action also clears the
  // redo stack, same as any standard undo/redo history.
  checkpoint() {
    this.undoStack.push(this._cloneRaster());
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return false;
    this.bakeLiveObject();
    this.redoStack.push(this._cloneRaster());
    this._restoreRaster(this.undoStack.pop());
    this.render();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    this.undoStack.push(this._cloneRaster());
    this._restoreRaster(this.redoStack.pop());
    this.render();
    return true;
  }

  bakeLiveObject() {
    if (!this.liveObject) return;
    this._drawObject(this.raster.getContext('2d'), this.liveObject);
    this.liveObject = null;
  }

  // --- freehand strokes (pencil / brush / pen) ---

  beginStroke(tool, color, point) {
    this.bakeLiveObject();
    this.activeStroke = { tool, color, points: [point] };
    this._drawStrokeSegment(this.raster.getContext('2d'), this.activeStroke, point, point);
  }

  extendStroke(point) {
    if (!this.activeStroke) return;
    const prev = this.activeStroke.points[this.activeStroke.points.length - 1];
    this.activeStroke.points.push(point);
    this._drawStrokeSegment(this.raster.getContext('2d'), this.activeStroke, prev, point);
  }

  endStroke() {
    this.activeStroke = null;
  }

  _drawStrokeSegment(ctx, stroke, from, to) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.globalAlpha = stroke.tool.soft ? 0.85 : 1;
    ctx.lineWidth = stroke.tool.width;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  // --- eraser (palm sweep) ---

  eraseAt(point, radius = 36) {
    this.bakeLiveObject();
    const ctx = this.raster.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Erasing a single dot per frame leaves visible gaps whenever the hand
  // moves faster than the detection rate — this sweeps a rounded stroke
  // from the last tracked point to the current one instead, the same way
  // a pencil stroke connects consecutive points, so a palm sweep reads as
  // one continuous wipe rather than a dotted line.
  eraseSweep(from, to, radius = 36) {
    this.bakeLiveObject();
    const ctx = this.raster.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  // --- shapes (rectangle / circle / arrow) ---

  beginShape(tool, color, point) {
    this.bakeLiveObject();
    this.liveObject = { kind: 'shape', tool, color, start: point, end: point };
  }

  updateShape(point) {
    if (!this.liveObject || this.liveObject.kind !== 'shape') return;
    this.liveObject.end = point;
  }

  endShape() {
    // stays live/movable until the next thing is drawn
  }

  // --- stamps (pinch-and-release) ---

  previewStamp(emoji, point) {
    if (!this.liveObject || this.liveObject.kind !== 'stamp' || this.liveObject.emoji !== emoji) {
      this.bakeLiveObject();
      this.liveObject = { kind: 'stamp', emoji, x: point.x, y: point.y, preview: true };
    } else {
      this.liveObject.x = point.x;
      this.liveObject.y = point.y;
    }
  }

  dropStamp() {
    if (this.liveObject?.kind === 'stamp') {
      this.liveObject.preview = false;
    }
  }

  // --- pinch grab/move of the live object ---

  moveLiveObject(dx, dy) {
    if (!this.liveObject) return;
    if (this.liveObject.kind === 'shape') {
      this.liveObject.start = { x: this.liveObject.start.x + dx, y: this.liveObject.start.y + dy };
      this.liveObject.end = { x: this.liveObject.end.x + dx, y: this.liveObject.end.y + dy };
    } else if (this.liveObject.kind === 'stamp') {
      this.liveObject.x += dx;
      this.liveObject.y += dy;
    }
  }

  hasLiveObject() {
    return !!this.liveObject;
  }

  // --- per-frame render: raster + live object on top ---

  render() {
    const { ctx, canvas, raster } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(raster, 0, 0);
    if (this.liveObject) {
      this._drawObject(ctx, this.liveObject);
    }
  }

  _drawObject(ctx, obj) {
    if (obj.kind === 'shape') {
      this._drawShape(ctx, obj);
    } else if (obj.kind === 'stamp') {
      this._drawStamp(ctx, obj);
    }
  }

  _drawShape(ctx, { tool, color, start, end }) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool.id === 'rectangle') {
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (tool.id === 'circle') {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool.id === 'arrow') {
      this._drawArrow(ctx, start, end);
    }
    ctx.restore();
  }

  _drawArrow(ctx, start, end) {
    const headLength = 18;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
  }

  _drawStamp(ctx, { emoji, x, y, preview }) {
    ctx.save();
    ctx.globalAlpha = preview ? 0.7 : 1;
    ctx.font = '48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y);
    ctx.restore();
  }

  clear() {
    this.checkpoint();
    const rctx = this.raster.getContext('2d');
    rctx.clearRect(0, 0, this.raster.width, this.raster.height);
    this.liveObject = null;
    this.activeStroke = null;
  }

  toDataURL() {
    this.bakeLiveObject();
    return this.canvas.toDataURL('image/png');
  }
}

export function isStrokeTool(tool) {
  return tool.kind === TOOL_KIND.STROKE;
}

export function isShapeTool(tool) {
  return tool.kind === TOOL_KIND.SHAPE;
}
