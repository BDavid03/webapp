import { useEffect, useMemo, useRef } from "react";

// Lightweight graph canvas: draws grid, axes, and functions y=f(x).
// Props:
// - width, height (optional) else fills parent size via ResizeObserver
// - viewport: { xMin, xMax, yMin, yMax }
// - onViewportChange(next)
// - series: [{ id, color, visible, evalY(x, scope) -> number|null }]
// - scope: object of variables/functions for eval

export default function GraphCanvas({
  width,
  height,
  viewport,
  onViewportChange,
  series = [],
  scope = {},
}) {
  const canvasRef = useRef(null);
  const sizeRef = useRef({ w: width || 0, h: height || 0 });
  const vpRef = useRef(viewport);
  vpRef.current = viewport;

  // Auto-resize to parent if width/height not provided
  useEffect(() => {
    if (width && height) return; // fixed size
    const el = canvasRef.current;
    if (!el) return;
    const hasRO = typeof ResizeObserver !== "undefined";
    if (!hasRO) {
      // Fallback: set a default size and draw once
      const defaultW = Math.max(100, el.parentElement?.clientWidth || 600);
      const defaultH = Math.max(120, Math.floor(defaultW * 0.7));
      sizeRef.current = { w: defaultW, h: defaultH };
      const dpr = getDpr();
      el.width = defaultW * dpr;
      el.height = defaultH * dpr;
      el.style.width = defaultW + "px";
      el.style.height = defaultH + "px";
      draw();
      return;
    }
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      const parent = el.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = Math.max(100, Math.floor(rect.width));
      const h = Math.max(120, Math.floor(rect.width * 0.7));
      if (sizeRef.current.w === w && sizeRef.current.h === h) return;
      sizeRef.current = { w, h };
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dpr = getDpr();
        el.width = w * dpr;
        el.height = h * dpr;
        // Avoid setting style dimensions here to prevent ResizeObserver loop warnings
        draw();
      });
    });
    ro.observe(el.parentElement);
    return () => { if (rafId) cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [width, height]);

  // Draw whenever inputs change
  useEffect(() => { draw(); });

  function toPx(x, y) {
    const { xMin, xMax, yMin, yMax } = vpRef.current;
    const dpr = getDpr();
    const w = (canvasRef.current?.width || 0) / dpr;
    const h = (canvasRef.current?.height || 0) / dpr;
    const px = ((x - xMin) / (xMax - xMin)) * w;
    const py = h - ((y - yMin) / (yMax - yMin)) * h;
    return [px, py];
  }

  function toWorld(px, py) {
    const { xMin, xMax, yMin, yMax } = vpRef.current;
    const dpr = getDpr();
    const w = (canvasRef.current?.width || 0) / dpr;
    const h = (canvasRef.current?.height || 0) / dpr;
    const x = xMin + (px / w) * (xMax - xMin);
    const y = yMin + ((h - py) / h) * (yMax - yMin);
    return [x, y];
  }

  function niceStep(range) {
    const raw = range / 10;
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1e-12, Math.abs(raw)))));
    const base = raw / pow;
    let nice = 1;
    if (base < 1.5) nice = 1;
    else if (base < 3) nice = 2;
    else if (base < 7) nice = 5;
    else nice = 10;
    return nice * pow;
  }

  function drawGrid(ctx, w, h) {
    const { xMin, xMax, yMin, yMax } = vpRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Grid steps
    const xStep = niceStep(xMax - xMin);
    const yStep = niceStep(yMax - yMin);

    ctx.save();
    ctx.lineWidth = 1;

    // Minor grid (lighter)
    ctx.strokeStyle = "#f1f1f1";
    for (let x = Math.ceil(xMin / (xStep / 5)) * (xStep / 5); x <= xMax; x += xStep / 5) {
      const [px] = toPx(x, 0);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
    for (let y = Math.ceil(yMin / (yStep / 5)) * (yStep / 5); y <= yMax; y += yStep / 5) {
      const [, py] = toPx(0, y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    // Major grid
    ctx.strokeStyle = "#e3e3e3";
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      const [px] = toPx(x, 0);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      const [, py] = toPx(0, y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1.5;
    // y=0
    if (yMin < 0 && yMax > 0) {
      const [, py0] = toPx(0, 0);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(py0) + 0.5);
      ctx.lineTo(w, Math.round(py0) + 0.5);
      ctx.stroke();
    }
    // x=0
    if (xMin < 0 && xMax > 0) {
      const [px0] = toPx(0, 0);
      ctx.beginPath();
      ctx.moveTo(Math.round(px0) + 0.5, 0);
      ctx.lineTo(Math.round(px0) + 0.5, h);
      ctx.stroke();
    }
    ctx.restore();

    // Axis labels (simple)
    ctx.fillStyle = "#666";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      const [px] = toPx(x, 0);
      ctx.fillText(String(roundNice(x)), px + 2, h - 4);
    }
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      const [, py] = toPx(0, y);
      ctx.fillText(String(roundNice(y)), 4, py - 2);
    }
  }

  function roundNice(x) {
    const a = Math.abs(x);
    if (a >= 1000 || a < 0.001) return x.toExponential(0);
    return Math.round(x * 1000) / 1000;
  }

  function drawSeries(ctx, w, h) {
    const { xMin, xMax } = vpRef.current;
    const steps = Math.max(200, Math.floor(w));
    for (const s of series) {
      if (!s || s.visible === false) continue;
      ctx.save();
      ctx.strokeStyle = s.color || "#1976d2";
      ctx.lineWidth = 2;
      let pen = false;
      let prevPy = null;
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        let y = null;
        try {
          const val = s.evalY ? s.evalY(x, scope) : null;
          if (val == null) { pen = false; continue; }
          if (typeof val === "number" && isFinite(val)) y = val;
          else if (val && typeof val.re === "number" && typeof val.im === "number" && Math.abs(val.im) < 1e-9) y = val.re;
          else { pen = false; continue; }
        } catch (_) {
          pen = false; continue;
        }
        const [px, py] = toPx(x, y);
        if (!isFinite(py) || Math.abs(prevPy - py) > h * 3) pen = false; // break on jumps
        if (!pen) { ctx.beginPath(); ctx.moveTo(px, py); pen = true; }
        else { ctx.lineTo(px, py); }
        prevPy = py;
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function draw() {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = getDpr();
    const w = (width || sizeRef.current.w || c.clientWidth || 600) * dpr;
    const h = (height || sizeRef.current.h || c.clientHeight || 400) * dpr;
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid(ctx, w / dpr, h / dpr);
    drawSeries(ctx, w / dpr, h / dpr);
  }

  function getDpr() {
    if (typeof window !== "undefined" && typeof window.devicePixelRatio === "number") return window.devicePixelRatio;
    return 1;
  }

  // Pan + zoom interactions
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let dragging = false;
    let startPx = [0, 0];
    let startWorld = [0, 0];
    let startVP = vpRef.current;

    function onPointerDown(e) {
      dragging = true;
      startPx = [e.offsetX, e.offsetY];
      startWorld = toWorld(e.offsetX, e.offsetY);
      startVP = { ...vpRef.current };
      el.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const nowWorld = toWorld(e.offsetX, e.offsetY);
      const dx = nowWorld[0] - startWorld[0];
      const dy = nowWorld[1] - startWorld[1];
      const next = {
        xMin: startVP.xMin - dx,
        xMax: startVP.xMax - dx,
        yMin: startVP.yMin - dy,
        yMax: startVP.yMax - dy,
      };
      onViewportChange?.(next);
    }
    function onPointerUp(e) {
      dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    function onWheel(e) {
      e.preventDefault();
      const zoom = e.deltaY < 0 ? 0.9 : 1.1;
      const [cx, cy] = toWorld(e.offsetX, e.offsetY);
      const { xMin, xMax, yMin, yMax } = vpRef.current;
      const nxMin = cx + (xMin - cx) * zoom;
      const nxMax = cx + (xMax - cx) * zoom;
      const nyMin = cy + (yMin - cy) * zoom;
      const nyMax = cy + (yMax - cy) * zoom;
      onViewportChange?.({ xMin: nxMin, xMax: nxMax, yMin: nyMin, yMax: nyMax });
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [onViewportChange]);

  return (
    <canvas ref={canvasRef} style={{ width: width ? width : "100%", height: height ? height : "auto", touchAction: "none", borderRadius: 8 }} />
  );
}
