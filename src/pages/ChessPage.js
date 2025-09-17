import { useEffect, useMemo, useRef, useState } from "react";
import "./ChessPage.css";

// Basic chess with local AI.
// - Supports all standard moves except: castling and en passant are NOT implemented.
// - Promotion auto-queens.
// - AI uses alpha-beta with depth mapping to difficulty (1-10) and slight randomness on lower levels.

const WHITE = "w";
const BLACK = "b";

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const UNICODE = {
  P: "\u2659",
  N: "\u2658",
  B: "\u2657",
  R: "\u2656",
  Q: "\u2655",
  K: "\u2654",
  p: "\u265F",
  n: "\u265E",
  b: "\u265D",
  r: "\u265C",
  q: "\u265B",
  k: "\u265A",
};

function symbolFor(piece, set) {
  if (!piece) return "";
  if (set === "unicode") return UNICODE[piece] || "";
  // letters set: uppercase for white, lowercase for black
  const letter = piece.toUpperCase();
  return piece === piece.toUpperCase() ? letter : letter.toLowerCase();
}

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function initialBoard() {
  // 8x8 array, [row][col], row 0 is top (Black's back rank), row 7 bottom (White's back rank)
  return [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    ["R", "N", "B", "Q", "K", "B", "N", "R"],
  ];
}

function pieceColor(piece) {
  if (!piece) return null;
  if (piece === piece.toUpperCase()) return WHITE;
  return BLACK;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function findKing(board, color) {
  const target = color === WHITE ? "K" : "k";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === target) return [r, c];
    }
  }
  return null;
}

function isSquareAttacked(board, r, c, byColor) {
  // Pawn attacks
  const dr = byColor === WHITE ? -1 : 1;
  const pawn = byColor === WHITE ? "P" : "p";
  for (const dc of [-1, 1]) {
    const rr = r + dr;
    const cc = c + dc;
    if (inBounds(rr, cc) && board[rr][cc] === pawn) return true;
  }

  // Knight attacks
  const knight = byColor === WHITE ? "N" : "n";
  const kMoves = [
    [-2, -1], [-2, 1], [2, -1], [2, 1],
    [-1, -2], [-1, 2], [1, -2], [1, 2],
  ];
  for (const [dr2, dc2] of kMoves) {
    const rr = r + dr2, cc = c + dc2;
    if (inBounds(rr, cc) && board[rr][cc] === knight) return true;
  }

  // King attacks (adjacent)
  const king = byColor === WHITE ? "K" : "k";
  for (let drk = -1; drk <= 1; drk++) {
    for (let dck = -1; dck <= 1; dck++) {
      if (drk === 0 && dck === 0) continue;
      const rr = r + drk, cc = c + dck;
      if (inBounds(rr, cc) && board[rr][cc] === king) return true;
    }
  }

  // Sliding pieces: bishops/queens diagonals
  const bishop = byColor === WHITE ? "B" : "b";
  const queen = byColor === WHITE ? "Q" : "q";
  const diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [drd, dcd] of diagDirs) {
    let rr = r + drd, cc = c + dcd;
    while (inBounds(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (p === bishop || p === queen) return true;
        break;
      }
      rr += drd; cc += dcd;
    }
  }

  // Sliding pieces: rooks/queens orthogonals
  const rook = byColor === WHITE ? "R" : "r";
  const orthoDirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dro, dco] of orthoDirs) {
    let rr = r + dro, cc = c + dco;
    while (inBounds(rr, cc)) {
      const p = board[rr][cc];
      if (p) {
        if (p === rook || p === queen) return true;
        break;
      }
      rr += dro; cc += dco;
    }
  }

  return false;
}

function isInCheck(board, color) {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  const [r, c] = kingPos;
  return isSquareAttacked(board, r, c, color === WHITE ? BLACK : WHITE);
}

function generatePseudoMoves(board, color) {
  const moves = [];
  const their = color === WHITE ? BLACK : WHITE;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const pc = pieceColor(p);
      if (pc !== color) continue;
      const isWhite = pc === WHITE;
      const lower = p.toLowerCase();

      if (lower === "p") {
        const dir = isWhite ? -1 : 1;
        const startRow = isWhite ? 6 : 1;
        const one = [r + dir, c];
        if (inBounds(one[0], one[1]) && !board[one[0]][one[1]]) {
          // move forward
          if (one[0] === 0 || one[0] === 7) {
            moves.push({ from: [r, c], to: one, promo: isWhite ? "Q" : "q" });
          } else {
            moves.push({ from: [r, c], to: one });
          }
          // two
          const two = [r + 2 * dir, c];
          if (r === startRow && !board[two[0]][two[1]]) {
            moves.push({ from: [r, c], to: two });
          }
        }
        // captures
        for (const dc of [-1, 1]) {
          const rr = r + dir, cc = c + dc;
          if (!inBounds(rr, cc)) continue;
          const t = board[rr][cc];
          if (t && pieceColor(t) === their) {
            if (rr === 0 || rr === 7) moves.push({ from: [r, c], to: [rr, cc], promo: isWhite ? "Q" : "q" });
            else moves.push({ from: [r, c], to: [rr, cc] });
          }
        }
      } else if (lower === "n") {
        const dirs = [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]];
        for (const [dr, dc] of dirs) {
          const rr = r + dr, cc = c + dc;
          if (!inBounds(rr, cc)) continue;
          const t = board[rr][cc];
          if (!t || pieceColor(t) === their) moves.push({ from: [r, c], to: [rr, cc] });
        }
      } else if (lower === "b" || lower === "r" || lower === "q") {
        const diag = lower !== "r" ? [[1,1],[1,-1],[-1,1],[-1,-1]] : [];
        const ortho = lower !== "b" ? [[1,0],[-1,0],[0,1],[0,-1]] : [];
        for (const [dr, dc] of [...diag, ...ortho]) {
          let rr = r + dr, cc = c + dc;
          while (inBounds(rr, cc)) {
            const t = board[rr][cc];
            if (!t) moves.push({ from: [r, c], to: [rr, cc] });
            else {
              if (pieceColor(t) === their) moves.push({ from: [r, c], to: [rr, cc] });
              break;
            }
            rr += dr; cc += dc;
          }
        }
      } else if (lower === "k") {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const rr = r + dr, cc = c + dc;
            if (!inBounds(rr, cc)) continue;
            const t = board[rr][cc];
            if (!t || pieceColor(t) === their) moves.push({ from: [r, c], to: [rr, cc] });
          }
        }
        // Note: castling intentionally not implemented
      }
    }
  }
  return moves;
}

function applyMove(board, move) {
  const nb = cloneBoard(board);
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = nb[fr][fc];
  nb[fr][fc] = "";
  nb[tr][tc] = move.promo ? move.promo : piece;
  return nb;
}

function generateLegalMoves(board, color) {
  const pseudo = generatePseudoMoves(board, color);
  const legal = [];
  for (const m of pseudo) {
    const nb = applyMove(board, m);
    if (!isInCheck(nb, color)) legal.push(m);
  }
  return legal;
}

function evaluate(board) {
  // Positive favors White, negative favors Black
  let score = 0;
  let material = 0;
  let mobility = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const base = PIECE_VALUES[p.toLowerCase()] || 0;
      const sign = p === p.toUpperCase() ? 1 : -1;
      material += sign * base;
      // Slight centralization bonus
      const centerDist = Math.abs(3.5 - r) + Math.abs(3.5 - c);
      const centerBonus = (4 - Math.min(4, centerDist)) * 2; // up to ~8
      mobility += sign * centerBonus;
    }
  }
  score = material + mobility;
  return score;
}

function negamax(board, color, depth, alpha, beta) {
  // color WHITE=1, BLACK=-1 in sign context
  if (depth === 0) {
    return { score: evaluate(board) * (color === WHITE ? 1 : -1) };
  }
  const legal = generateLegalMoves(board, color);
  if (legal.length === 0) {
    // checkmate or stalemate
    const inCheck = isInCheck(board, color);
    if (inCheck) return { score: -100000 + (3 - depth) }; // mate in X (worse when deeper)
    return { score: 0 }; // stalemate
  }

  let best = { score: -Infinity, move: null };
  const nextColor = color === WHITE ? BLACK : WHITE;

  // Simple move ordering: captures first by MVV-LVA heuristic
  legal.sort((a, b) => {
    const capA = captureValue(board, a);
    const capB = captureValue(board, b);
    return capB - capA;
  });

  for (const m of legal) {
    const child = applyMove(board, m);
    const { score } = negamax(child, nextColor, depth - 1, -beta, -alpha);
    const val = -score;
    if (val > best.score) {
      best = { score: val, move: m };
    }
    if (val > alpha) alpha = val;
    if (alpha >= beta) break; // alpha-beta cutoff
  }
  return best;
}

function captureValue(board, move) {
  const [tr, tc] = move.to;
  const target = board[tr][tc];
  if (!target) return 0;
  return PIECE_VALUES[target.toLowerCase()] || 0;
}

function coordToAlgebra([r, c]) {
  return "abcdefgh"[c] + String(8 - r);
}

function formatMove(m, piece) {
  const from = coordToAlgebra(m.from);
  const to = coordToAlgebra(m.to);
  const promo = m.promo ? "=" + m.promo.toUpperCase() : "";
  const p = (piece || "").toUpperCase();
  const lead = p && p !== "P" ? p : "";
  return `${lead}${from}-${to}${promo}`;
}

function difficultyToDepth(diff) {
  // Map 1..10 to depth and randomness
  // Keep depth modest for responsiveness
  if (diff <= 2) return 1;
  if (diff <= 4) return 2;
  if (diff <= 6) return 3;
  if (diff <= 9) return 4;
  return 4; // Depth 5 can be slow in browser; cap at 4
}

function pickMoveWithNoise(best, legal, diff) {
  // For easy levels, inject randomness among top moves
  if (diff >= 6) return best;
  const topN = diff <= 2 ? 4 : 2;
  // Assume legal already roughly ordered; pick among first N that improve a bit
  const choices = legal.slice(0, Math.min(topN, legal.length));
  return choices[Math.floor(Math.random() * choices.length)] || best;
}

export default function ChessPage() {
  const [board, setBoard] = useState(() => initialBoard());
  const [turn, setTurn] = useState(WHITE);
  const [humanColor, setHumanColor] = useState(WHITE);
  const [orientation, setOrientation] = useState(WHITE);
  const [difficulty, setDifficulty] = useState(4);
  const [selected, setSelected] = useState(null); // [r,c] or null
  const [legalMoves, setLegalMoves] = useState([]); // for selected piece
  const [history, setHistory] = useState([]); // strings for display
  const [status, setStatus] = useState("");
  const [lastMove, setLastMove] = useState(null); // {from,to}
  const [hintMove, setHintMove] = useState(null); // optional suggested move
  const [boardStack, setBoardStack] = useState(() => [initialBoard()]); // snapshots to undo
  const [moveStack, setMoveStack] = useState([]); // stack of move objects for undo
  const [pieceSet, setPieceSet] = useState("unicode"); // 'unicode' | 'letters'
  const thinkingRef = useRef(false);


  const gameOver = useMemo(() => {
    const moves = generateLegalMoves(board, turn);
    if (moves.length === 0) {
      const inCheck = isInCheck(board, turn);
      return inCheck ? (turn === WHITE ? "Black wins by checkmate" : "White wins by checkmate") : "Draw by stalemate";
    }
    return null;
  }, [board, turn]);

  useEffect(() => {
    if (gameOver) setStatus(gameOver);
    else setStatus(`${turn === WHITE ? "White" : "Black"} to move`);
  }, [gameOver, turn]);

  // Engine move when it's engine's turn
  useEffect(() => {
    const engineColor = humanColor === WHITE ? BLACK : WHITE;
    if (gameOver || turn !== engineColor) return;
    if (thinkingRef.current) return;
    thinkingRef.current = true;
    setStatus("Engine thinking...");

    // Slight timeout to keep UI responsive
    const id = setTimeout(() => {
      const legal = generateLegalMoves(board, turn);
      if (legal.length === 0) {
        thinkingRef.current = false;
        return;
      }
      const depth = difficultyToDepth(difficulty);
      const ordered = [...legal].sort((a, b) => captureValue(board, b) - captureValue(board, a));
      const result = negamax(board, turn, depth, -Infinity, Infinity);
      const best = result.move || ordered[0];
      const picked = pickMoveWithNoise(best, ordered, difficulty);
      doMove(picked);
      thinkingRef.current = false;
    }, 60);

    return () => clearTimeout(id);
  }, [board, turn, humanColor, difficulty, gameOver]);

  function doMove(move) {
    const nb = applyMove(board, move);
    const piece = board[move.from[0]][move.from[1]];
    setBoard(nb);
    setBoardStack((s) => [...s, nb]);
    setMoveStack((ms) => [{ ...move, piece }, ...ms]);
    setTurn((t) => (t === WHITE ? BLACK : WHITE));
    setHistory((h) => [`${formatMove(move, piece)}`, ...h].slice(0, 60));
    setSelected(null);
    setLegalMoves([]);
    setHintMove(null);
    setLastMove({ from: move.from, to: move.to });
  }

  function onSquareClick(viewIndex) {
    if (gameOver) return;
    const [r, c] = viewToModel(viewIndex, orientation);
    const current = board[r][c];
    const currentColor = pieceColor(current);
    const engineColor = humanColor === WHITE ? BLACK : WHITE;
    if (turn !== humanColor) return; // not player's turn

    if (selected) {
      // Deselect if clicking the same square
      if (selected[0] === r && selected[1] === c) {
        setSelected(null);
        setLegalMoves([]);
        return;
      }
      // Attempt a move if the clicked square is a legal destination
      const move = legalMoves.find((m) => m.to[0] === r && m.to[1] === c);
      if (move) {
        doMove(move);
        return;
      }
      // Otherwise, if clicking another own piece, reselect
      if (current && currentColor === humanColor) {
        const lm = generateLegalMoves(board, humanColor).filter((m) => m.from[0] === r && m.from[1] === c);
        setSelected([r, c]);
        setLegalMoves(lm);
        return;
      }
      // Clicked elsewhere; clear selection
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    // No selection yet
    if (current && currentColor === humanColor) {
      const lm = generateLegalMoves(board, humanColor).filter((m) => m.from[0] === r && m.from[1] === c);
      setSelected([r, c]);
      setLegalMoves(lm);
    }
  }

  function newGame(side = humanColor) {
    const init = initialBoard();
    setBoard(init);
    setBoardStack([init]);
    setMoveStack([]);
    setTurn(WHITE);
    setHistory([]);
    setSelected(null);
    setLegalMoves([]);
    setHintMove(null);
    setLastMove(null);
    setStatus("White to move");
    // If user chose Black, engine (White) should move first
    setHumanColor(side);
    setOrientation(side);
  }

  // Re-run immediate engine move if starting as Black
  useEffect(() => {
    // Kick once on side switch if it's now engine's turn at initial position
    if (board === null) return;
    // no-op: handled by main engine effect depending on turn and humanColor
  }, [humanColor]);

  const inCheckNow = useMemo(() => isInCheck(board, turn), [board, turn]);
  const rowFactors = useMemo(() => {
    // Shrink rows with no pieces to a fraction of normal height
    const EMPTY_RANK_FACTOR = 0.7; // 70% height for empty ranks
    const factors = new Array(8).fill(1);
    for (let r = 0; r < 8; r++) {
      let hasPiece = false;
      for (let c = 0; c < 8; c++) { if (board[r][c]) { hasPiece = true; break; } }
      if (!hasPiece) factors[r] = EMPTY_RANK_FACTOR;
    }
    return factors;
  }, [board]);
  const rowSum = useMemo(() => rowFactors.reduce((a, b) => a + b, 0), [rowFactors]);

  const squares = useMemo(() => {
    // Orientation: if WHITE, row 0 is top; if BLACK, row 7 is top
    const arr = [];
    for (let i = 0; i < 64; i++) {
      const [r, c] = viewToModel(i, orientation);
      const piece = board[r][c];
      const sym = piece ? symbolFor(piece, pieceSet) : "";
      // selection/hints
      let selectedHere = selected && selected[0] === r && selected[1] === c;
      let canGo = false;
      let canCap = false;
      if (selected) {
        for (const m of legalMoves) {
          if (m.to[0] === r && m.to[1] === c) {
            canGo = true;
            if (board[r][c]) canCap = true;
            break;
          }
        }
      }
      const lastFrom = lastMove && lastMove.from[0] === r && lastMove.from[1] === c;
      const lastTo = lastMove && lastMove.to[0] === r && lastMove.to[1] === c;

      // Coordinates labels based on view coordinates
      const vr = Math.floor(i / 8);
      const vc = i % 8;
      const file = fileLetter(vc, orientation);
      const rank = rankNumber(vr, orientation);
      const showFile = vr === 7; // bottom row in view
      const showRank = vc === 0; // left column in view

      arr.push({ index: i, r, c, vr, vc, piece, sym, selectedHere, canGo, canCap, lastFrom, lastTo, file, rank, showFile, showRank });
    }
    return arr;
  }, [board, orientation, selected, legalMoves, lastMove, pieceSet]);

  // Undo last half-move (ply)
  function undoPly() {
    if (boardStack.length <= 1) return;
    setBoardStack((bs) => {
      const next = bs.slice(0, -1);
      setBoard(next[next.length - 1]);
      return next;
    });
    setMoveStack((ms) => {
      const newMs = ms.slice(1);
      const prevMove = newMs[0] || null;
      setLastMove(prevMove ? { from: prevMove.from, to: prevMove.to } : null);
      return newMs;
    });
    setHistory((h) => h.slice(1));
    setTurn((t) => (t === WHITE ? BLACK : WHITE));
    setSelected(null);
    setLegalMoves([]);
    setHintMove(null);
  }

  // Undo a full move (two plies) if available
  function undoTurn() {
    undoPly();
    // call twice if still available
    setTimeout(() => undoPly(), 0);
  }

  // Show engine hint for the human side
  function showHint() {
    if (gameOver || turn !== humanColor) return;
    const legal = generateLegalMoves(board, turn);
    if (legal.length === 0) return;
    const depth = difficultyToDepth(Math.max(4, difficulty));
    const result = negamax(board, turn, depth, -Infinity, Infinity);
    const best = result.move || legal[0];
    setHintMove(best);
  }

  // Clear selection on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSelected(null);
        setLegalMoves([]);
        setHintMove(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="chess">
      <div className="chess__main">
        <div
          className="chess__board"
          style={{
            aspectRatio: `${8}/${rowSum}`,
            gridTemplateRows: rowFactors.map((f) => `${f}fr`).join(" "),
          }}
        >
          {squares.map((sq, idx) => {
            const isLight = ((Math.floor(idx / 8) + (idx % 8)) % 2) === 0;
            const classes = [
              "chess__square",
              isLight ? "chess__square--light" : "chess__square--dark",
              sq.selectedHere ? "chess__square--selected" : "",
              sq.canGo ? (sq.canCap ? "chess__square--can-capture" : "chess__square--hint") : "",
              (sq.lastFrom || sq.lastTo) ? "chess__square--last" : "",
              sq.lastTo ? "chess__square--moved-to" : "",
              inCheckNow && isKingAt(board, turn, sq.r, sq.c) ? "chess__square--check" : "",
              hintMove && hintMove.to[0] === sq.r && hintMove.to[1] === sq.c ? "chess__square--hint" : "",
            ].filter(Boolean).join(" ");
            return (
              <div
                key={idx}
                className={classes}
                onClick={() => onSquareClick(sq.index)}
                title={`${coordToAlgebra([sq.r, sq.c])}`}
              >
                {sq.piece ? (
                  <span
                    className={[
                      "chess__piece",
                      pieceColor(sq.piece) === WHITE ? "chess__piece--white" : "chess__piece--black",
                      sq.lastTo ? "chess__piece--moved" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    {sq.sym}
                  </span>
                ) : null}
                {sq.showFile && (
                  <span className="chess__coord-file">{sq.file}</span>
                )}
                {sq.showRank && (
                  <span className="chess__coord-rank">{sq.rank}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="chess__sidepanel">
          <div className="chess__widget">
            <h3 className="chess__widget-title">Controls</h3>
            <div className="chess__controls-grid">
              <div className="chess__label">
                Side:
                <label style={{ marginLeft: 6 }}>
                  <input type="radio" name="side" checked={humanColor === WHITE} onChange={() => newGame(WHITE)} /> White
                </label>
                <label style={{ marginLeft: 10 }}>
                  <input type="radio" name="side" checked={humanColor === BLACK} onChange={() => newGame(BLACK)} /> Black
                </label>
              </div>
              <div className="chess__label">
                Difficulty:
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  style={{ marginLeft: 6, verticalAlign: "middle" }}
                />
                <span style={{ marginLeft: 6 }}>{difficulty}</span>
              </div>
              <div className="chess__label">
                Piece Set:
                <select value={pieceSet} onChange={(e) => setPieceSet(e.target.value)} style={{ marginLeft: 6 }}>
                  <option value="unicode">Unicode</option>
                  <option value="letters">Letters</option>
                </select>
              </div>
              <div className="chess__actions">
                <button className="chess__btn" onClick={() => newGame(humanColor)}>New Game</button>
                <button className="chess__btn" onClick={undoPly}>Undo Move</button>
                <button className="chess__btn" onClick={undoTurn}>Undo Turn</button>
                <button className="chess__btn" onClick={showHint} disabled={turn !== humanColor}>Hint</button>
                <button className="chess__btn" onClick={() => setOrientation((o) => (o === WHITE ? BLACK : WHITE))}>Flip Board</button>
              </div>
            </div>
          </div>

          <div className="chess__widget">
            <h3 className="chess__widget-title">Status</h3>
            <div className="chess__status">{status}</div>
          </div>
          <div className="chess__history">
            {history.length === 0 ? (
              <div>No moves yet.</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {history.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function viewToModel(viewIndex, orientation) {
  // Map displayed index 0..63 to board [r,c] depending on orientation
  const vr = Math.floor(viewIndex / 8);
  const vc = viewIndex % 8;
  if (orientation === WHITE) {
    return [vr, vc];
  } else {
    // Flip for Black at top
    return [7 - vr, 7 - vc];
  }
}

function isKingAt(board, color, r, c) {
  const king = color === WHITE ? "K" : "k";
  return board[r][c] === king;
}

function fileLetter(vc, orientation) {
  const filesW = "abcdefgh";
  const filesB = "hgfedcba";
  return orientation === WHITE ? filesW[vc] : filesB[vc];
}

function rankNumber(vr, orientation) {
  return orientation === WHITE ? String(8 - vr) : String(vr + 1);
}
