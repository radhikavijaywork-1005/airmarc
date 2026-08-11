import { HAND_CONNECTIONS } from './handConnections';

export function drawHandSkeleton(ctx, landmarks, width, height, { emphasize = false } = {}) {
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const points = landmarks.map((p) => ({ x: p.x * width, y: p.y * height }));

  ctx.save();
  ctx.strokeStyle = emphasize ? 'rgba(120, 225, 255, 0.9)' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = emphasize ? 3 : 1.5;
  ctx.lineCap = 'round';
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(points[a].x, points[a].y);
    ctx.lineTo(points[b].x, points[b].y);
    ctx.stroke();
  }

  ctx.fillStyle = emphasize ? 'rgba(120, 225, 255, 1)' : 'rgba(255, 255, 255, 0.55)';
  const r = emphasize ? 4.5 : 2.5;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
