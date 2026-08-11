const GRAVITY = 700; // px/s^2, confetti + firework sparks + rain fall speed

const FIREWORK_COLORS = ['#ff6b6b', '#ffd166', '#5ad1ff', '#ff6bd6', '#7ef29c'];
const CONFETTI_COLORS = ['#f5f2ea', '#ff5c5c', '#ffb84d', '#4dd08a', '#4da3ff', '#c792ff'];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// A small, hand-rolled particle sim (no library) — each effect is just a
// batch of particles with a `type` tag; update() and render() branch on
// that tag. Deliberately not trying to pixel-clone Apple's exact renders,
// just the recognizable idea of each: rising balloons, falling confetti,
// a firework burst, streaking rain, floating hearts.
export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawnBalloons(width, height, count = 7) {
    // sizes are chosen relative to canvas width (device-pixel space, already
    // DPR-scaled) rather than fixed px, so a reaction reads as "felt" on a
    // Retina screen instead of rendering at half the intended visual size.
    const size = () => width * rand(0.05, 0.075);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'balloon',
        x: rand(width * 0.15, width * 0.85),
        y: height + rand(20, 160),
        vx: 0,
        vy: -rand(70, 110),
        phase: rand(0, Math.PI * 2),
        size: size(),
        color: CONFETTI_COLORS[Math.floor(rand(0, CONFETTI_COLORS.length))],
        life: 0,
        maxLife: rand(3, 3.8),
      });
    }
  }

  spawnHearts(originX, originY, width, count = 10) {
    // spread wide like balloons instead of clustering tightly around the
    // origin point — a tight cluster reads as one congested blob rather
    // than a proper burst of separate hearts.
    const spreadX = width * 0.22;
    const spreadY = width * 0.09;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'heart',
        x: originX + rand(-spreadX, spreadX),
        y: originY + rand(-spreadY, spreadY),
        vx: 0,
        vy: -rand(70, 110),
        phase: rand(0, Math.PI * 2),
        size: width * rand(0.05, 0.075),
        life: 0,
        maxLife: rand(2.8, 3.6),
        delay: rand(0, 0.3),
      });
    }
  }

  // Thumbs up rises from the bottom (like balloons), thumbs down falls
  // from the top (like rain/confetti) — every effect in this system reads
  // as a clear vertical flow, so a burst that just radiated in place stood
  // out as the odd one, and "thumbs down" radiating upward too made no
  // sense next to what the gesture actually means.
  spawnDirectionalBurst(emoji, width, height, direction, count = 9) {
    const rising = direction === 'up';
    const size = () => width * rand(0.045, 0.07);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'emojiBurst',
        emoji,
        x: rand(width * 0.25, width * 0.75),
        y: rising ? height + rand(20, 140) : rand(-140, -20),
        vx: 0,
        vy: rising ? -rand(90, 140) : rand(90, 140),
        phase: rand(0, Math.PI * 2),
        size: size(),
        life: 0,
        maxLife: rand(1.7, 2.3),
        delay: rand(0, 0.25),
      });
    }
  }

  spawnFireworks(width, height, bursts = 3) {
    for (let b = 0; b < bursts; b++) {
      const cx = rand(width * 0.2, width * 0.8);
      const cy = rand(height * 0.2, height * 0.5);
      const color = FIREWORK_COLORS[Math.floor(rand(0, FIREWORK_COLORS.length))];
      const sparkCount = 32;
      const spread = width * 0.16;
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i / sparkCount) * Math.PI * 2 + rand(-0.1, 0.1);
        const speed = spread * rand(0.7, 1.3);
        this.particles.push({
          type: 'spark',
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: width * rand(0.006, 0.011),
          color,
          life: 0,
          maxLife: rand(0.9, 1.3),
          delay: b * 0.18,
        });
      }
    }
  }

  spawnRain(width, height, count = 45) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'rain',
        x: rand(0, width),
        y: rand(-height, 0),
        vx: -40,
        vy: rand(500, 700),
        length: height * rand(0.03, 0.05),
        life: 0,
        maxLife: 3,
      });
    }
  }

  spawnConfetti(width, count = 55) {
    for (let i = 0; i < count; i++) {
      const w = width * rand(0.01, 0.016);
      this.particles.push({
        type: 'confetti',
        x: rand(0, width),
        y: rand(-400, 0),
        vx: rand(-30, 30),
        vy: rand(120, 220),
        rotation: rand(0, Math.PI * 2),
        rotSpeed: rand(-6, 6),
        w,
        h: w * rand(1.5, 1.8),
        color: CONFETTI_COLORS[Math.floor(rand(0, CONFETTI_COLORS.length))],
        phase: rand(0, Math.PI * 2),
        life: 0,
        maxLife: rand(3, 3.6),
      });
    }
  }


  update(dt) {
    if (dt <= 0) return;
    for (const p of this.particles) {
      p.life += dt;
      if (p.delay && p.life < p.delay) continue;

      switch (p.type) {
        case 'balloon':
        case 'heart':
        case 'emojiBurst':
          p.y += p.vy * dt;
          p.x += Math.sin(p.life * 2 + p.phase) * 18 * dt;
          break;
        case 'spark':
          p.vy += GRAVITY * dt * 0.5;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case 'rain':
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          break;
        case 'confetti':
          p.vy += GRAVITY * dt * 0.25;
          p.x += p.vx * dt + Math.sin(p.life * 3 + p.phase) * 12 * dt;
          p.y += p.vy * dt;
          p.rotation += p.rotSpeed * dt;
          break;
        default:
          break;
      }
    }

    this.particles = this.particles.filter((p) => p.life - (p.delay || 0) < p.maxLife);
  }

  render(ctx) {
    for (const p of this.particles) {
      if (p.delay && p.life < p.delay) continue;
      const age = p.life - (p.delay || 0);
      const t = Math.min(1, age / p.maxLife);

      ctx.save();
      switch (p.type) {
        case 'balloon': {
          const fade = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
          ctx.globalAlpha = fade;
          ctx.font = `${p.size}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🎈', p.x, p.y);
          break;
        }
        case 'heart': {
          const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
          ctx.globalAlpha = fade;
          ctx.font = `${p.size}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💗', p.x, p.y);
          break;
        }
        case 'spark': {
          ctx.globalAlpha = Math.max(0, 1 - t);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.size * 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'emojiBurst': {
          const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
          ctx.globalAlpha = fade;
          ctx.font = `${p.size}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, p.x, p.y);
          break;
        }
        case 'rain': {
          ctx.globalAlpha = 0.65;
          ctx.strokeStyle = 'rgba(180, 220, 255, 0.85)';
          ctx.lineWidth = Math.max(2, p.length * 0.12);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.02, p.y + p.length);
          ctx.stroke();
          break;
        }
        case 'confetti': {
          const fade = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          break;
        }
        default:
          break;
      }
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}
