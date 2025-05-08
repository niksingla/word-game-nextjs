import React, { useState, useEffect, useRef } from "react";

// ------------------- MOCK DATA --------------------------

const DIFFICULTY_SETTINGS = {
  Easy: {
    gridSize: 8,
    words: ["CAT", "DOG", "FISH", "BIRD", "HAT", "SUN", "TREE", "MOON"],
    aiSpeed: 3000, // ms per word
  },
  Medium: {
    gridSize: 12,
    words: [
      "ELEPHANT", "GIRAFFE", "PYTHON", "ROCKET",
      "JUPITER", "ZEBRA", "MONKEY", "BANANA",
      "BICYCLE", "KANGAROO", "CHOCOLATE", "DIAMOND"
    ],
    aiSpeed: 1800,
  },
  Hard: {
    gridSize: 16,
    words: [
      "KNOWLEDGE", "ASTRONOMY", "ALGORITHM", "NEUTRON",
      "TELESCOPE", "VOLCANO", "MICROSCOPE", "EVOLUTION",
      "PHILOSOPHY", "ARCHITECTURE", "COMPUTER", "HARMONY",
      "TRIANGLE", "PYRAMID", "MOUNTAIN", "PARADOX"
    ],
    aiSpeed: 1100,
  }
};

// ------------------- UTILITY FUNCTIONS ------------------

// Directions: [dx, dy]: (horizontal, vertical, diagonal, etc)
const DIRECTIONS = [
  [0, 1],   // right
  [1, 0],   // down
  [1, 1],   // down-right
  [-1, 0],  // up
  [0, -1],  // left
  [-1, -1], // up-left
  [1, -1],  // down-left
  [-1, 1],  // up-right
];

// Fill the grid with random letters for unused cells
function randomLetter() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters.charAt(Math.floor(Math.random() * letters.length));
}

// Returns true if [x, y] is within grid size
function inBounds(x: number, y: number, size: number) {
  return x >= 0 && x < size && y >= 0 && y < size;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ------------------- GAME GENERATION --------------------

type PlacedWord = {
  word: string;
  positions: [number, number][];
};

interface GenerateGridResult {
  grid: string[][];
  placedWords: PlacedWord[];
}

function generateGrid(gridSize: number, words: string[]): GenerateGridResult {
  let grid: string[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(""));
  let placedWords: PlacedWord[] = [];

  for (const word of shuffle(words)) {
    let placed = false;
    let tries = 0;
    const maxTries = 100;
    while (!placed && tries < maxTries) {
      const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const dx = dir[0];
      const dy = dir[1];

      // Random start position
      const x = Math.floor(Math.random() * gridSize);
      const y = Math.floor(Math.random() * gridSize);

      let valid = true;
      let positions: [number, number][] = [];
      let cx = x, cy = y;

      for (let i = 0; i < word.length; i++) {
        if (!inBounds(cx, cy, gridSize)) {
          valid = false;
          break;
        }
        if (grid[cx][cy] && grid[cx][cy] !== word[i]) {
          valid = false;
          break;
        }
        positions.push([cx, cy]);
        cx += dx;
        cy += dy;
      }

      if (valid) {
        for (let i = 0; i < word.length; i++) {
          const [px, py] = positions[i];
          grid[px][py] = word[i];
        }
        placedWords.push({ word, positions });
        placed = true;
      }
      tries++;
    }
    // Fail quietly if can't place after maxTries
  }

  // Fill empty cells
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      if (!grid[i][j]) grid[i][j] = randomLetter();
    }
  }

  return { grid, placedWords };
}

// ------------------- SCOREBOARD HANDLING ----------------

type ScoreEntry = {
  date: string;
  difficulty: string;
  player: number;
  ai: number;
  status: "Win" | "Lose" | "Draw";
};

function getScoreHistory(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("ws_scores") || "[]");
  } catch {
    return [];
  }
}

function addScoreHistory(entry: ScoreEntry) {
  if (typeof window === "undefined") return;
  const scores = getScoreHistory();
  scores.unshift(entry); // latest first
  localStorage.setItem("ws_scores", JSON.stringify(scores.slice(0, 10)));
}

// ------------------- COMPONENTS -------------------------

type Difficulty = keyof typeof DIFFICULTY_SETTINGS;

type Selection = {
  path: [number, number][];
  word: string;
};

type FoundWord = {
  player: "user" | "ai";
  word: string;
  positions: [number, number][];
};

const colors = {
  gridBg: "#191d31",
  cellBg: "#23264a",
  cellBgHover: "#2b3059",
  cellSelected: "#60a5fa",
  cellFoundUser: "#34d399",
  cellFoundAI: "#f472b6",
  wordListBg: "#23264a",
  aiColor: "#f472b6",
  userColor: "#34d399",
  boardBorder: "#374151",
  selectedBorder: "#2563eb",
};

const fadeIn = {
  animation: "fadeIn 0.4s ease",
};

const popIn = {
  animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
};

const BoardCell: React.FC<{
  letter: string;
  selected: boolean;
  foundBy?: "user" | "ai";
  highlight?: boolean;
  onPointerDown: () => void;
  onPointerEnter: () => void;
}> = ({ letter, selected, foundBy, highlight, onPointerDown, onPointerEnter }) => {
  let bg = colors.cellBg;
  let color = "#fff";
  let border = `1.5px solid ${colors.boardBorder}`;
  if (foundBy === "user") {
    bg = colors.cellFoundUser;
    color = "#191d31";
    border = `2.5px solid ${colors.userColor}`;
  } else if (foundBy === "ai") {
    bg = colors.cellFoundAI;
    color = "#191d31";
    border = `2.5px solid ${colors.aiColor}`;
  } else if (selected) {
    bg = colors.cellSelected;
    border = `2.5px solid ${colors.selectedBorder}`;
    color = "#fff";
  } else if (highlight) {
    bg = colors.cellBgHover;
    border = `2px solid ${colors.selectedBorder}`;
  }
  return (
    <div
      style={{
        background: bg,
        color,
        border,
        borderRadius: 7,
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "1.2rem",
        userSelect: "none",
        transition: "background 0.15s, border 0.15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: selected ? "0 0 0 2px #60a5fa" : "",
        ... (foundBy ? fadeIn : {}),
      }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      data-testid="cell"
    >
      {letter}
    </div>
  );
};

const WordList: React.FC<{
  words: string[];
  foundWords: FoundWord[];
  placedWords: PlacedWord[];
}> = ({ words, foundWords, placedWords }) => {
  return (
    <div style={{
      background: colors.wordListBg, borderRadius: 12, padding: 18, minWidth: 170,
      boxShadow: "0 2px 12px #0003"
    }}>
      <div style={{
        color: "#b8c0e0", fontSize: "1.1rem",
        marginBottom: 12, fontWeight: 600, letterSpacing: 1,
      }}>Word List</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {words.map(w => {
          const found = foundWords.find(fw => fw.word === w);
          const anim = found ? popIn : {};
          let color = "#fff";
          if (found?.player === "user") color = colors.userColor;
          if (found?.player === "ai") color = colors.aiColor;
          return (
            <li key={w}
              style={{
                marginBottom: 7,
                color,
                opacity: found ? 1 : 0.75,
                textDecoration: found ? "line-through" : undefined,
                transition: "color 0.2s, opacity 0.2s",
                fontWeight: found ? 700 : undefined,
                fontSize: "1.03rem",
                ...anim,
              }}
            >{w}</li>
          );
        })}
      </ul>
    </div>
  );
};

const Scoreboard: React.FC<{ scores: ScoreEntry[] }> = ({ scores }) => (
  <div style={{
    background: "#181b2a", borderRadius: 12, padding: 16, marginTop: 30,
    maxWidth: 520, boxShadow: "0 1px 8px #0003"
  }}>
    <div style={{
      color: "#b8c0e0", fontSize: "1.1rem",
      marginBottom: 9, fontWeight: 600, letterSpacing: 1,
    }}>Scoreboard (last 10 games)</div>
    <table style={{
      width: "100%", color: "#dbeafe", fontSize: "0.98rem", borderCollapse: "collapse",
      marginBottom: 0
    }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", fontWeight: 500 }}>Date</th>
          <th>Level</th>
          <th>You</th>
          <th>AI</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {scores.length === 0 && (
          <tr>
            <td colSpan={5} style={{ opacity: 0.6, textAlign: "center" }}>No games played yet.</td>
          </tr>
        )}
        {scores.map((s, i) => (
          <tr key={i}>
            <td style={{ fontSize: "0.92rem" }}>{s.date}</td>
            <td>{s.difficulty}</td>
            <td style={{ color: colors.userColor, fontWeight: 600 }}>{s.player}</td>
            <td style={{ color: colors.aiColor, fontWeight: 600 }}>{s.ai}</td>
            <td style={{
              color:
                s.status === "Win" ? "#34d399"
                  : s.status === "Lose" ? "#f472b6" : "#fbbf24",
              fontWeight: 700,
            }}>{s.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ------------------- MAIN PAGE --------------------------

const WordSearchGame: React.FC = () => {
  // Game states
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [gameData, setGameData] = useState<GenerateGridResult | null>(null);
  const [foundWords, setFoundWords] = useState<FoundWord[]>([]);
  const [selection, setSelection] = useState<[number, number][]>([]);
  const [selecting, setSelecting] = useState(false);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);

  // Scoreboard
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  // Game status
  const [gameOver, setGameOver] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [aiThinking, setAIThinking] = useState(false);

  // For responsive cell size
  const boardRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(36);

  // On mount, load scoreboard
  useEffect(() => {
    setScores(getScoreHistory());
  }, []);

  // Start new game
  useEffect(() => {
    if (difficulty) {
      const { gridSize, words } = DIFFICULTY_SETTINGS[difficulty];
      const data = generateGrid(gridSize, words);
      setGameData(data);
      setFoundWords([]);
      setSelection([]);
      setSelecting(false);
      setHoverCell(null);
      setGameOver(false);
      setStatusMsg("");
      setAIThinking(false);
    }
  }, [difficulty]);

  // Responsive grid cell size
  useEffect(() => {
    if (!gameData) return;
    function resize() {
      // @ts-ignore
      const gridLen = gameData.grid.length;
      const maxW = Math.min(window.innerWidth - 60, 540);
      const maxH = Math.min(window.innerHeight - 280, 380);
      const size = Math.floor(Math.min(maxW, maxH) / gridLen) - 2;
      setCellSize(Math.max(30, size));
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [gameData]);

  // Game End detection
  useEffect(() => {
    if (!gameData) return;
    const total = gameData.placedWords.length;
    const user = foundWords.filter(f => f.player === "user").length;
    const ai = foundWords.filter(f => f.player === "ai").length;
    if (foundWords.length === total && !gameOver) {
      // Game ends
      setGameOver(true);
      let status: ScoreEntry["status"];
      if (user > ai) {
        setStatusMsg("You Win! 🎉");
        status = "Win";
      } else if (ai > user) {
        setStatusMsg("AI Wins! 🤖");
        status = "Lose";
      } else {
        setStatusMsg("It's a Draw! 🟰");
        status = "Draw";
      }
      const entry: ScoreEntry = {
        date: (new Date()).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        difficulty: difficulty!,
        player: user,
        ai: ai,
        status,
      };
      addScoreHistory(entry);
      setScores(getScoreHistory());
    }
  }, [foundWords, gameData, gameOver, difficulty]);

  // ---------------- AI LOGIC ------------------
  useEffect(() => {
    if (!gameData || gameOver) return;
    // AI finds a word every N ms
    if (foundWords.length === gameData.placedWords.length) return;
    setAIThinking(true);

    // Only try to claim a word if there are words left for AI
    const aiWordsLeft = gameData.placedWords.filter(pw =>
      !foundWords.some(fw => fw.word === pw.word)
    );

    if (aiWordsLeft.length === 0) return;

    // AI will pick a word randomly that's not found
    const aiSpeed = DIFFICULTY_SETTINGS[difficulty!].aiSpeed;

    const aiTimeout = setTimeout(() => {
      if (gameOver) { setAIThinking(false); return; }
      // Randomly select a word not claimed
      const possibleWords = aiWordsLeft;
      if (possibleWords.length === 0) return;
      const wordIdx = Math.floor(Math.random() * possibleWords.length);
      const word = possibleWords[wordIdx];
      setFoundWords(fw => {
        // If already found, skip
        if (fw.some(f => f.word === word.word)) return fw;
        return [...fw, { player: "ai", word: word.word, positions: word.positions }];
      });
      setAIThinking(false);
    }, aiSpeed + Math.random() * 600);

    return () => clearTimeout(aiTimeout);
    // eslint-disable-next-line
  }, [foundWords, gameData, gameOver, difficulty]);

  // -------------- SELECTION LOGIC --------------

  function isCellSelected(i: number, j: number) {
    return selection.some(([x, y]) => x === i && y === j);
  }

  function isCellFound(i: number, j: number): "user" | "ai" | undefined {
    for (const fw of foundWords) {
      if (fw.positions.some(([x, y]) => x === i && y === j)) return fw.player;
    }
    return undefined;
  }

  function handlePointerDown(i: number, j: number) {
    if (gameOver) return;
    setSelecting(true);
    setSelection([[i, j]]);
  }

  function handlePointerEnter(i: number, j: number) {
    if (!selecting) return;

    const [si, sj] = selection[0];
    // Only allow straight lines in 8 directions
    const dx = i - si;
    const dy = j - sj;
    if (dx === 0 && dy === 0) {
      setSelection([[si, sj]]);
      return;
    }

    // Direction must be one of the allowed
    const len = Math.max(Math.abs(dx), Math.abs(dy));
    const ddx = dx === 0 ? 0 : dx / Math.abs(dx);
    const ddy = dy === 0 ? 0 : dy / Math.abs(dy);

    const newPath: [number, number][] = [];
    for (let step = 0; step <= len; step++) {
      const nx = si + ddx * step;
      const ny = sj + ddy * step;
      if (!inBounds(nx, ny, gameData!.grid.length)) break;
      newPath.push([nx, ny]);
    }
    setSelection(newPath);
    setHoverCell([i, j]);
  }

  function handlePointerUp() {
    if (!gameData) { setSelecting(false); setSelection([]); return; }
    if (!selecting || selection.length < 2) {
      setSelecting(false);
      setSelection([]);
      setHoverCell(null);
      return;
    }

    // Read selected word
    let word = "";
    for (let [x, y] of selection) {
      word += gameData.grid[x][y];
    }
    // Check if word is in placedWords and not found yet
    const match = gameData.placedWords.find(
      pw =>
        (pw.word === word || pw.word === word.split("").reverse().join("")) &&
        pw.positions.length === selection.length &&
        pw.positions.every(([px, py], idx) =>
          (px === selection[idx][0] && py === selection[idx][1]) ||
          (px === selection[selection.length - 1 - idx][0] && py === selection[selection.length - 1 - idx][1])
        )
    );
    if (match && !foundWords.some(fw => fw.word === match.word)) {
      setFoundWords(fw => [
        ...fw,
        { player: "user", word: match.word, positions: match.positions }
      ]);
    }
    setSelecting(false);
    setSelection([]);
    setHoverCell(null);
  }

  // Keyboard controls for accessibility (optional)
  // -- omitted for brevity

  // --------- RENDERING ------------

  if (!difficulty) {
    return (
      <div style={{
        minHeight: "100vh",
        background: colors.gridBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: 'system-ui, "Segoe UI", Arial, sans-serif'
      }}>
        <style>{`
          @keyframes fadeIn { from { opacity:0; transform: scale(0.96);} to{ opacity:1; transform: scale(1);} }
          @keyframes popIn { 0%{transform:scale(0.9); opacity:0;} 80%{transform:scale(1.1);} 100%{transform:scale(1); opacity:1;} }
        `}</style>
        <div style={{
          fontSize: "2.2rem",
          color: "#e0e7ff",
          fontWeight: 800,
          letterSpacing: 1,
          textShadow: "0 2px 8px #0005",
          marginBottom: 35
        }}>
          Word Search Showdown
        </div>
        <div style={{
          background: "#23264a",
          borderRadius: 16,
          padding: "28px 38px",
          boxShadow: "0 2px 16px #0008",
          color: "#dbeafe",
          fontSize: "1.12rem"
        }}>
          <div style={{ marginBottom: 20, fontWeight: 600, fontSize: "1.09rem" }}>
            Choose difficulty:
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {Object.keys(DIFFICULTY_SETTINGS).map(d => (
              <button key={d}
                onClick={() => setDifficulty(d as Difficulty)}
                style={{
                  background: colors.cellBg,
                  color: "#e0e7ff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: "1.08rem",
                  fontWeight: 700,
                  padding: "10px 28px",
                  cursor: "pointer",
                  outline: "none",
                  boxShadow: "0 1px 6px #0003",
                  transition: "background 0.13s, transform 0.13s",
                }}
                onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <Scoreboard scores={scores} />
      </div>
    );
  }

  if (!gameData) {
    return <div>Loading game...</div>;
  }

  const grid = gameData.grid;
  const userScore = foundWords.filter(f => f.player === "user").length;
  const aiScore = foundWords.filter(f => f.player === "ai").length;
  const totalWords = gameData.placedWords.length;

  return (
    <div style={{
      minHeight: "100vh",
      background: colors.gridBg,
      fontFamily: 'system-ui, "Segoe UI", Arial, sans-serif',
      paddingBottom: 60,
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform: scale(0.96);} to{ opacity:1; transform: scale(1);} }
        @keyframes popIn { 0%{transform:scale(0.9); opacity:0;} 80%{transform:scale(1.1);} 100%{transform:scale(1); opacity:1;} }
        ::selection { background: #60a5fa60;}
      `}</style>
      <header style={{
        display: "flex", alignItems: "center", gap: 14, marginBottom: 12, marginTop: 28,
        justifyContent: "center"
      }}>
        <div style={{
          color: "#e0e7ff",
          fontWeight: 800,
          fontSize: "2rem",
          textShadow: "0 2px 8px #0005",
          letterSpacing: 1
        }}>
          Word Search Showdown
        </div>
        <span style={{
          background: "#23264a",
          color: "#b8c0e0",
          borderRadius: 8,
          padding: "4px 13px",
          fontWeight: 600,
          fontSize: "1.04rem",
        }}>
          {difficulty}
        </span>
        <button
          onClick={() => setDifficulty(null)}
          style={{
            marginLeft: 14, background: "transparent", color: "#8ca5fa",
            border: "none", fontWeight: 600, fontSize: "1.04rem",
            textDecoration: "underline", cursor: "pointer"
          }}
        >
          New Game
        </button>
      </header>

      <section style={{
        display: "flex", justifyContent: "center", gap: 38, flexWrap: "wrap"
      }}>
        <div>
          <div ref={boardRef}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${grid.length}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${grid.length}, ${cellSize}px)`,
              gap: 5,
              background: colors.boardBorder,
              borderRadius: 16,
              padding: 10,
              margin: "0 auto",
              boxShadow: "0 2px 18px #0005",
              marginTop: 14,
              marginBottom: 14,
              userSelect: "none",
              touchAction: "none"
            }}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              setSelecting(false);
              setSelection([]);
              setHoverCell(null);
            }}
            tabIndex={0}
          >
            {grid.map((row, i) =>
              row.map((cell, j) => (
                <BoardCell
                  key={`${i}-${j}`}
                  letter={cell}
                  selected={isCellSelected(i, j)}
                  foundBy={isCellFound(i, j)}
                  // @ts-ignore
                  highlight={hoverCell && hoverCell[0] === i && hoverCell[1] === j}
                  onPointerDown={() => handlePointerDown(i, j)}
                  onPointerEnter={() => handlePointerEnter(i, j)}
                />
              ))
            )}
          </div>
          <div style={{
            display: "flex", justifyContent: "center", gap: 24, marginTop: 8, marginBottom: 0
          }}>
            <div style={{
              background: colors.cellFoundUser,
              width: 18, height: 18, borderRadius: 5, display: "inline-block", marginRight: 5
            }} /> <span style={{ color: colors.userColor, fontWeight: 700 }}>You: {userScore}</span>
            <div style={{
              background: colors.cellFoundAI,
              width: 18, height: 18, borderRadius: 5, display: "inline-block", marginRight: 5
            }} /> <span style={{ color: colors.aiColor, fontWeight: 700 }}>AI: {aiScore}</span>
            <span style={{
              color: "#dbeafe", fontWeight: 500
            }}>Words: {foundWords.length}/{totalWords}</span>
          </div>
          {aiThinking && !gameOver && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#f472b6", fontWeight: 600, fontSize: "1.07rem",
              marginTop: 6, animation: "fadeIn 0.5s"
            }}>
              <span className="ping" style={{
                display: "inline-block", width: 9, height: 9, borderRadius: "100%",
                background: "#f472b6", marginRight: 8, animation: "ping 1.1s infinite"
              }} />
              AI is searching...
              <style>
                {`@keyframes ping {
                  0% { box-shadow: 0 0 0 0 #f472b633;}
                  80% { box-shadow: 0 0 0 8px #f472b610;}
                  100% { box-shadow: 0 0 0 0 #f472b600;}
                }`}
              </style>
            </div>
          )}
        </div>
        <WordList
          words={gameData.placedWords.map(w => w.word)}
          foundWords={foundWords}
          placedWords={gameData.placedWords}
        />
      </section>

      <div style={{
        display: "flex", justifyContent: "center",
        marginTop: 20, height: 54
      }}>
        {gameOver && (
          <div style={{
            background: "#23264a",
            color: userScore > aiScore ? colors.userColor
              : aiScore > userScore ? colors.aiColor
                : "#fbbf24",
            borderRadius: 10,
            padding: "13px 32px",
            fontWeight: 700,
            fontSize: "1.23rem",
            letterSpacing: 0.8,
            boxShadow: "0 2px 16px #0006",
            ...popIn,
            minWidth: 200,
            textAlign: "center"
          }}>
            {statusMsg}
            <button
              style={{
                background: colors.cellBg,
                color: "#e0e7ff",
                border: "none",
                borderRadius: 7,
                fontWeight: 600,
                fontSize: "1.08rem",
                padding: "6px 21px",
                marginLeft: 20,
                cursor: "pointer",
                marginTop: 0,
                transition: "background 0.13s"
              }}
              onClick={() => setDifficulty(difficulty)}
            >
              Replay
            </button>
          </div>
        )}
      </div>
      <Scoreboard scores={scores} />
      <footer style={{ color: "#b8c0e0", fontSize: "0.89rem", textAlign: "center", marginTop: 36, opacity: 0.7 }}>
        Play against the AI and improve your word search skills!
      </footer>
    </div>
  );
};

export default WordSearchGame;