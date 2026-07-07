// SPDX-License-Identifier: Apache-2.0
// Lightweight canvas hero: anonymized identities (left) stream through a
// hashing "shield" and emerge as program-scoped nullifiers (right). No 3D
// dependency — reliable on GitHub Pages, degrades to a static gradient if the
// canvas context is unavailable.

export function mountHero(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  const particles = [];
  const COLORS = ['#4ade80', '#38bdf8', '#c084fc', '#facc15'];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn() {
    particles.push({
      x: -10,
      y: 20 + Math.random() * (height - 40),
      speed: 0.6 + Math.random() * 1.1,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      hashed: false,
      wobble: Math.random() * Math.PI * 2
    });
  }

  let raf = 0;
  let frame = 0;

  function draw() {
    frame += 1;
    ctx.clearRect(0, 0, width, height);
    const shieldX = width * 0.5;

    // shield line
    const grad = ctx.createLinearGradient(shieldX - 30, 0, shieldX + 30, 0);
    grad.addColorStop(0, 'rgba(74,222,128,0)');
    grad.addColorStop(0.5, 'rgba(74,222,128,0.45)');
    grad.addColorStop(1, 'rgba(74,222,128,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(shieldX - 30, 0, 60, height);
    ctx.strokeStyle = 'rgba(125,246,180,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(shieldX, 6);
    ctx.lineTo(shieldX, height - 6);
    ctx.stroke();

    if (frame % 8 === 0 && particles.length < 90) spawn();

    for (const p of particles) {
      p.x += p.speed;
      p.wobble += 0.05;
      const y = p.y + Math.sin(p.wobble) * 3;
      if (!p.hashed && p.x >= shieldX) {
        p.hashed = true;
        p.color = '#7df6b4';
      }
      ctx.globalAlpha = p.x < shieldX ? 0.85 : 0.95;
      if (p.hashed) {
        // nullifier: small hex-tile square
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 3, y - 3, 6, 6);
      } else {
        // raw identity: soft dot
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].x > width + 12) particles.splice(i, 1);
    }

    raf = requestAnimationFrame(draw);
  }

  const onResize = () => resize();
  resize();
  globalThis.addEventListener('resize', onResize);
  raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    globalThis.removeEventListener('resize', onResize);
  };
}
