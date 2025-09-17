import { useEffect, useMemo, useRef, useState } from "react";
import GraphCanvas from "../components/GraphCanvas";
import "./CalculatorPage.css";

// Graphing calculator with math.js for complex and real computations.
// Rows accept either raw expressions (assignments, calculations) or graph lines like: y = sin(x)
// Definitions (e.g., f(x)=sin(x)) can be referenced in subsequent graph rows.

let math = null;
try {
  // Lazy load to avoid breaking if not installed yet; user should `npm i mathjs`.
  // eslint-disable-next-line global-require
  const { create, all } = require("mathjs");
  math = create(all);
} catch (e) {
  // mathjs not installed; basic fallback evaluator won’t support complex/advanced
}

const DEFAULT_VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

function randomColor(i) {
  const palette = [
    "#1976d2", "#d32f2f", "#388e3c", "#f57c00", "#7b1fa2", "#00796b", "#455a64", "#5d4037",
  ];
  return palette[i % palette.length];
}

export default function CalculatorPage() {
  const [rows, setRows] = useState(() => [
    { id: 1, input: "y = sin(x)", mode: "graph", color: randomColor(0), visible: true },
  ]);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [error, setError] = useState(null);
  const scopeRef = useRef({});

  const compiled = useMemo(() => compileRows(rows, scopeRef), [rows]);

  const series = useMemo(() => {
    return compiled
      .filter((r) => r.mode === "graph" && r.visible && !r.error && r.evalY)
      .map((r) => ({ id: r.id, color: r.color, visible: r.visible, evalY: r.evalY }));
  }, [compiled]);

  function addRow() {
    setRows((rs) => [
      ...rs,
      { id: (rs[rs.length - 1]?.id || 0) + 1, input: "", mode: "calc", color: randomColor(rs.length), visible: true },
    ]);
  }
  function updateRow(id, patch) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  useEffect(() => {
    setError(math ? null : "mathjs not installed — run: npm i mathjs");
  }, []);

  return (
    <section className="gc">
      <div className="gc__left">
        <h2 className="gc__title">Graphing Calculator</h2>
        {error && <div className="gc__small" style={{ color: "#d32f2f" }}>{error}</div>}
        <button className="gc__btn gc__add" onClick={addRow} aria-label="Add Expression">+ Add Expression</button>

        {compiled.map((row) => (
          <div className="gc__expr" key={row.id}>
            <span className="gc__color" style={{ ["--color"]: row.color }} />
            <input
              className="gc__input"
              placeholder={row.mode === "graph" ? "y = ..." : "Enter expression"}
              value={row.input}
              onChange={(e) => updateRow(row.id, { input: e.target.value })}
            />
            <div className="gc__meta">
              <div className="gc__row">
                <input
                  id={`vis-${row.id}`}
                  type="checkbox"
                  className="gc__checkbox"
                  checked={row.visible}
                  onChange={(e) => updateRow(row.id, { visible: e.target.checked })}
                />
                <label htmlFor={`vis-${row.id}`} className="gc__small">Visible</label>
              </div>
              <div className="gc__row">
                <input
                  type="color"
                  value={row.color}
                  onChange={(e) => updateRow(row.id, { color: e.target.value })}
                  title="Color"
                />
                <button className="gc__btn" onClick={() => removeRow(row.id)} title="Delete">×</button>
              </div>
              {row.mode === "calc" && (
                <div className="gc__result" title="Result">
                  {row.error ? `Error: ${row.error}` : formatResult(row.result)}
                </div>
              )}
              {row.mode === "graph" && row.error && (
                <div className="gc__result" style={{ color: "#d32f2f" }}>Error: {row.error}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="gc__right">
        <div className="gc__toolbar">
          <div className="gc__split">
            <button className="gc__btn" onClick={() => setView(DEFAULT_VIEW)}>Reset View</button>
            <button className="gc__btn" onClick={() => setView((v) => ({ xMin: v.xMin * 1.2, xMax: v.xMax * 1.2, yMin: v.yMin * 1.2, yMax: v.yMax * 1.2 }))}>Zoom Out</button>
            <button className="gc__btn" onClick={() => setView((v) => ({ xMin: v.xMin * 0.8, xMax: v.xMax * 0.8, yMin: v.yMin * 0.8, yMax: v.yMax * 0.8 }))}>Zoom In</button>
          </div>
          <span className="gc__small">Drag to pan, scroll to zoom.</span>
        </div>
        <GraphCanvas
          viewport={view}
          onViewportChange={setView}
          series={series}
          scope={scopeRef.current}
        />
      </div>
    </section>
  );
}

  function compileRows(rows, scopeRef) {
  // Build scope by evaluating calc/definition rows in order.
  const out = [];
  const scope = {};
  const haveMath = !!math;

  for (const row of rows) {
    const trimmed = (row.input || "").trim();
    const graphMatch = /^y\s*=\s*(.+)$/i.exec(trimmed);

    if (graphMatch) {
      const rhs = normalizeImplicitMultiplication(graphMatch[1]);
      if (haveMath) {
        try {
          const node = math.parse(rhs);
          const code = node.compile();
          out.push({ ...row, mode: "graph", error: null, evalY: (x, s) => code.evaluate({ ...s, x }) });
        } catch (e) {
          out.push({ ...row, mode: "graph", error: e?.message || String(e) });
        }
      } else {
        out.push({ ...row, mode: "graph", error: "mathjs not available" });
      }
      continue;
    }

    // Otherwise: raw expression mode
    if (!trimmed) {
      out.push({ ...row, mode: "calc", result: "" });
      continue;
    }
    if (haveMath) {
      try {
        const res = math.evaluate(normalizeImplicitMultiplication(trimmed), scope);
        out.push({ ...row, mode: "calc", result: res, error: null });
      } catch (e) {
        out.push({ ...row, mode: "calc", result: "", error: e?.message || String(e) });
      }
    } else {
      // Minimal fallback using Function (no complex, limited safety)
      try {
        // eslint-disable-next-line no-new-func
        const f = new Function("with(this) { return (" + trimmed + "); }");
        const res = f.call(scope);
        out.push({ ...row, mode: "calc", result: res, error: null });
      } catch (e) {
        out.push({ ...row, mode: "calc", result: "", error: "Install mathjs for rich evaluation" });
      }
    }
  }

  // Save resulting scope for the graph to reference user-defined functions/vars.
  scopeRef.current = scope;
  return out;
}

function formatResult(res) {
  if (res == null) return "";
  if (typeof res === "object") {
    // mathjs types to string
    try { return String(res.toString()); } catch (_) {}
    try { return JSON.stringify(res); } catch (_) {}
  }
  if (typeof res === "number") {
    if (!isFinite(res)) return String(res);
    return String(Math.round(res * 1e12) / 1e12);
  }
  return String(res);
}

// Insert explicit * for common implicit-multiplication patterns
function normalizeImplicitMultiplication(expr) {
  let s = expr;
  // number followed by variable (exclude scientific notation 1e10)
  s = s.replace(/(\d(?:\.\d+)?)\s*([a-df-zA-DF-Z])/g, "$1*$2");
  // number followed by open paren
  s = s.replace(/(\d(?:\.\d+)?)\s*\(/g, "$1*(");
  // close paren followed by number/letter/(
  s = s.replace(/\)\s*([0-9a-zA-Z(])/g, ")*$1");
  return s;
}
