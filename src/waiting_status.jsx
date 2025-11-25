// waiting_status.jsx
// React port of the "waiting_status.html" slot game.
// The component is self-contained and renders three canvas reels with a Start/Stop button.
// All comments are in English.

import React, { useEffect, useRef } from "react";

export default function WaitingStatus() {
  const rootRef = useRef(null);

  useEffect(() => {
    // Symbols for reels (replace with your own assets if desired)
    const SYMBOLS = ["🍒", "🍋", "⭐", "7️⃣", "🔔", "🍇", "💎", "🍀", "Ⓚ"];

    const btn = rootRef.current.querySelector("#btn");
    const canvases = Array.from(rootRef.current.querySelectorAll("canvas"));

    // Ease function for smooth deceleration
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

    class Reel {
      constructor(canvas, symbols, profile) {
        this.c = canvas;
        this.ctx = canvas.getContext("2d");
        this.syms = symbols;
        this.n = symbols.length;
        this.tileH = canvas.height;
        this.total = this.n * this.tileH;

        // Physical profile per reel
        this.accel = profile.accel; // acceleration px/s^2
        this.max = profile.max; // cruising speed px/s
        this.brake = profile.brake; // baseline braking (only for helper speed)
        this.extraSpins = profile.extra; // extra full turns before stopping
        this.stopDuration = profile.stopDuration; // duration of easing deceleration

        // State
        this.offset = 0;
        this.speed = 0;
        this.active = false; // accelerating / spinning phase
        this.stopping = false; // decelerating phase
        this.targetOffset = null;
        this.stopStartOffset = 0;
        this.stopDistance = 0;
        this.stopElapsed = 0;
      }

      start() {
        this.offset = 0;
        this.speed = 0;
        this.active = true;
        this.stopping = false;
        this.targetOffset = null;
        this.stopElapsed = 0;
      }

      // Plan a stop so that the reel lands exactly on a symbol
      planStop(targetIndex = Math.floor(Math.random() * this.n)) {
        if (this.stopping) return;

        // Target alignment: offset % total == targetIndex * tileH
        const baseTurns = Math.floor(this.offset / this.total);
        let target = baseTurns * this.total + targetIndex * this.tileH;

        // Ensure we add a minimum amount of extra full turns
        const minOffset = this.offset + this.extraSpins * this.total;
        while (target < minOffset) target += this.total;

        this.targetOffset = target;

        // Enter braking phase
        this.stopping = true;
        this.active = false;
        this.stopStartOffset = this.offset;
        this.stopDistance = this.targetOffset - this.stopStartOffset;

        // If currently slow, give it a small push for a nicer ease-out
        this.speed = Math.max(this.speed, this.max * 0.65);
      }

      update(dt) {
        if (this.active && !this.stopping) {
          // Accelerate to cruising speed
          this.speed = Math.min(this.max, this.speed + this.accel * dt);
          this.offset += this.speed * dt;
          // Keep offset bounded to avoid large numbers (no visual wrap needed here)
          this.offset %= this.targetOffset ? this.targetOffset + this.total * 2 : 1e12;
          return;
        }
        if (this.stopping) {
          // Smooth deceleration with easing
          this.stopElapsed = Math.min(this.stopElapsed + dt, this.stopDuration);
          const t = this.stopElapsed / this.stopDuration;
          const eased = easeOutCubic(t);
          this.offset = this.stopStartOffset + this.stopDistance * eased;

          // Helper "current speed" (not used for physics, but useful for effects)
          this.speed = Math.max(0, this.speed - this.brake * dt);

          if (t >= 1) {
            // Snap precisely to the target
            this.offset = this.targetOffset;
            this.speed = 0;
            this.stopping = false;
          }
        }
      }

      isMoving() {
        return this.active || this.stopping || this.speed > 0.1;
      }

      draw() {
        const ctx = this.ctx,
          w = this.c.width,
          h = this.c.height,
          t = this.tileH;
        ctx.clearRect(0, 0, w, h);

        const m = ((this.offset % this.total) + this.total) % this.total;
        const start = -m - t;

        for (let k = 0; k < this.n + 3; k++) {
          const y = start + k * t;
          const idx = (k - 1 + this.n) % this.n;
          const sym = this.syms[idx];

          // Tile background
          ctx.fillStyle = "#101010";
          ctx.fillRect(0, y, w, t);

          // Symbol
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `${Math.floor(h * 0.55)}px "Segoe UI Emoji","Apple Color Emoji",Arial`;
          ctx.fillStyle = "#fff";
          ctx.fillText(sym, w / 2, y + t / 2 + 4);

          // Thin separators
          ctx.strokeStyle = "rgba(255,255,255,.06)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(w, y + 0.5);
          ctx.moveTo(0, y + t - 0.5);
          ctx.lineTo(w, y + t - 0.5);
          ctx.stroke();
        }

        // Soft mask on top and bottom edges
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "rgba(0,0,0,.38)");
        g.addColorStop(0.5, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,.38)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // Different reel profiles to make the stop timings pleasingly staggered
    const profiles = [
      { max: 1900, accel: 4200, brake: 2400, extra: 2, stopDuration: 1.2 },
      { max: 2200, accel: 4800, brake: 2200, extra: 3, stopDuration: 1.4 },
      { max: 2500, accel: 5200, brake: 2000, extra: 4, stopDuration: 1.6 },
    ];

    const reels = canvases.map((c, i) => new Reel(c, SYMBOLS, profiles[i]));

    let running = false; // spinning mode
    let stopping = false; // already in braking phase
    let last = 0,
      raf = 0;

    function loop(t) {
      if (!last) last = t;
      const dt = Math.min((t - last) / 1000, 1 / 30); // clamp the step
      last = t;

      reels.forEach((r) => {
        r.update(dt);
        r.draw();
      });

      if (reels.some((r) => r.isMoving())) {
        raf = requestAnimationFrame(loop);
      } else {
        // Everything stopped
        raf = 0;
        running = false;
        stopping = false;
        btn.textContent = "PLAY (while waiting)";
      }
    }

    function startAll() {
      reels.forEach((r) => r.start());
      running = true;
      stopping = false;
      btn.textContent = "STOP (I'm lucky)";
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    }

    function stopAll() {
      if (stopping) return;
      stopping = true;
      // Schedule a stop for each reel; different stopDuration/extra make them stagger
      reels.forEach((r) => r.planStop());
      btn.textContent = "PLAY (while waiting)";
    }

    const onClick = () => {
      if (!running && !stopping) startAll();
      else if (running && !stopping) stopAll();
    };
    btn.addEventListener("click", onClick);

    // First paint
    reels.forEach((r) => r.draw());

    // Cleanup on unmount
    return () => {
      btn.removeEventListener("click", onClick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef}>
      <div className="slot">
        <div className="cabinet">
          <div className="reels" id="reels">
            <div className="reel">
              <canvas width="164" height="164"></canvas>
              <div className="winline"></div>
            </div>
            <div className="reel">
              <canvas width="164" height="164"></canvas>
              <div className="winline"></div>
            </div>
            <div className="reel">
              <canvas width="164" height="164"></canvas>
              <div className="winline"></div>
            </div>
          </div>
        </div>
        <button id="btn">PLAY (while waiting)</button>
      </div>

      {/* Scoped styles ported from the HTML version */}
      <style>{`
        :root{--bg:#0f0f0f;--fg:#fff;--glass:#151515;}
        .slot{display:flex;flex-direction:column;align-items:center;gap:22px}
        .cabinet{padding:18px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border:1px solid #242424;box-shadow:0 10px 35px rgba(0,0,0,.5)}
        .reels{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;background:#0b0b0b;border:1px solid #1f1f1f;padding:14px;border-radius:14px}
        .reel{position:relative}
        .winline{position:absolute;left:14px;right:14px;top:50%;transform:translateY(-50%);height:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);opacity:.45;pointer-events:none}
        canvas{width:164px;height:164px;border-radius:12px;background:#000;display:block}
        button{padding:12px 28px;border-radius:999px;border:none;background:#1f1f1f;color:var(--fg);font-size:18px;cursor:pointer;transition:background .2s ease,transform .12s ease}
        button:hover{background:#262626;transform:translateY(-1px)}
      `}</style>
    </div>
  );
}
