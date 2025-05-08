"use client"

import React, { useEffect, useRef, useState } from "react";

type Difficulty = "Easy" | "Medium" | "Hard";

interface WordData {
  word: string;
  foundBy: null | "player" | "ai";
  positions: [number, number][];
}

interface ScoreEntry {
  playerScore: number;
  aiScore: number;
  difficulty: Difficulty;
  date: string;
}

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  {
    gridSize: number;
    words: string[];
    aiInterval: number; // ms
    aiSkill: number; // % chance to find a word per interval
  }
> = {
  Easy: {
    gridSize: 8,
    words: [
      "CAT",
      "DOG",
      "TREE",
      "BOOK",
      "FISH",
      "SUN",
      "MOON",
      "CAR",
      "BIRD",
      "STAR",
    ],
    aiInterval: 1800,
    aiSkill: 0.3,
  },
  Medium: {
    gridSize: 12,
    words: [
      "ELEPHANT",
      "COMPUTER",
      "JAVASCRIPT",
      "FLOWER",
      "MOUNTAIN",
      "PYTHON",
      "OCEAN",
      "LAPTOP",
      "SPIDER",
      "GUITAR",
      "PLANET",
      "RIVER",
    ],
    aiInterval: 1300,
    aiSkill: 0.55,
  },
  Hard: {
    gridSize: 16,
    words: [
      "ASTRONOMY",
      "MICROSCOPE",
      "ARCHITECTURE",
      "PHILOSOPHY",
      "INTERNATIONAL",
      "NEXTJS",
      "EXPERIMENT",
      "TECHNOLOGY",
      "ALGORITHM",
      "THEORY",
      "ENIGMA",
      "SYNTHESIS",
      "DEVELOPMENT",
      "QUANTUM",
      "CALCULATOR",
      "STRATEGY",
    ],
    aiInterval: 900,
    aiSkill: 0.8,
  },
};

// Directions for placing words: [rowDelta, colDelta]
const DIRECTIONS: [number, number][] = [
  [0, 1],    // right
  [1, 0],    // down
  [0, -1],   // left
  [-1, 0],   // up
  [1, 1],    // down-right
  [-1, -1],  // up-left
  [1, -1],   // down-left
  [-1, 1],   // up-right
];

function randomInt(a: number, b: number) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; --i) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Generate a word search grid and positions of all words
function generateGrid(
  size: number,
  words: string[]
): { grid: string[][]; wordData: WordData[] } {
  let grid = Array.from({ length: size }, () =>
    Array(size).fill("")
  ) as string[][];

  let wordData: WordData[] = [];

  for (let word of words) {
    let placed = false;
    let tries = 0;
    word = word.toUpperCase();
    while (!placed && tries < 100) {
      const dir = DIRECTIONS[randomInt(0, DIRECTIONS.length - 1)];
      const row = randomInt(
        0,
        size - (dir[0] === 1 ? word.length : 1) - (dir[0] === -1 ? word.length : 0)
      );
      const col = randomInt(
        0,
        size - (dir[1] === 1 ? word.length : 1) - (dir[1] === -1 ? word.length : 0)
      );
      let valid = true;
      let positions: [number, number][] = [];
      for (let i = 0; i < word.length; ++i) {
        let r = row + dir[0] * i;
        let c = col + dir[1] * i;
        if (
          r < 0 ||
          r >= size ||
          c < 0 ||
          c >= size ||
          (grid[r][c] !== "" && grid[r][c] !== word[i])
        ) {
          valid = false;
          break;
        }
        positions.push([r, c]);
      }
      if (valid) {
        for (let i = 0; i < word.length; ++i) {
          let [r, c] = positions[i];
          grid[r][c] = word[i];
        }
        wordData.push({ word, foundBy: null, positions });
        placed = true;
      }
      tries++;
    }
  }

  // Fill empty cells with random letters
  for (let r = 0; r < size; ++r) {
    for (let c = 0; c < size; ++c) {
      if (grid[r][c] === "") {
        grid[r][c] = String.fromCharCode(65 + randomInt(0, 25));
      }
    }
  }
  return { grid, wordData };
}

// Helper to check straight lines
function getLine(
  start: [number, number],
  end: [number, number]
): [number, number][] | null {
  const [r1, c1] = start;
  const [r2, c2] = end;
  const dr = r2 - r1;
  const dc = c2 - c1;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  if (
    !(
      (dr === 0 && dc !== 0) ||
      (dc === 0 && dr !== 0) ||
      Math.abs(dr) === Math.abs(dc)
    )
  ) {
    return null;
  }
  const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
  const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

  let line: [number, number][] = [];
  for (let i = 0; i <= len; ++i) {
    line.push([r1 + stepR * i, c1 + stepC * i]);
  }
  return line;
}

function arraysEqual(a: [number, number][], b: [number, number][]) {
  if (a.length !== b.length) return false;
  return a.every(([r, c], i) => r === b[i][0] && c === b[i][1]);
}

function loadScoreboard(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("ws_scoreboard") || "[]");
  } catch {
    return [];
  }
}

function saveScoreboard(scores: ScoreEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("ws_scoreboard", JSON.stringify(scores));
}

const highlightColors = {
  player: "#a4e9a7",
  ai: "#fab8b8",
  selecting: "#ffd700",
  found: "#a4e9a7",
  aiFound: "#fab8b8",
};

const animPulse = {
  animation: "pulse 0.4s",
};

const keyframes = `
@keyframes pulse {
  0% { box-shadow: 0 0 0px 0 #e0e0e0; }
  60% { box-shadow: 0 0 16px 8px #ffd70077; }
  100% { box-shadow: 0 0 0px 0 #ffd70000; }
}
`;

export default function WordSearchGame() {
  // State management
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [gameState, setGameState] = useState<
    | "setup"
    | "playing"
    | "completed"
    | "animatingAI"
    | "animatingPlayer"
  >("setup");
  const [grid, setGrid] = useState<string[][]>([]);
  const [wordList, setWordList] = useState<WordData[]>([]);
  const [selected, setSelected] = useState<[number, number][]>([]);
  const [foundWords, setFoundWords] = useState<
    { word: string; by: "player" | "ai"; positions: [number, number][] }[]
  >([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [scoreboard, setScoreboard] = useState<ScoreEntry[]>([]);
  const [aiHighlight, setAiHighlight] = useState<[number, number][]>([]);
  const [aiThinking, setAIThinking] = useState(false);

  const aiIntervalRef = useRef<any>(null);

  // Set up styles
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = keyframes;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Load scoreboard on mount
  useEffect(() => {
    setScoreboard(loadScoreboard());
  }, []);

  // Clean up AI interval
  useEffect(() => {
    return () => {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    };
  }, []);

  // Start a new game
  function startGame(dif: Difficulty) {
    const conf = DIFFICULTY_CONFIG[dif];
    const { grid, wordData } = generateGrid(conf.gridSize, conf.words);
    setGrid(grid);
    setWordList(wordData);
    setFoundWords([]);
    setSelected([]);
    setPlayerScore(0);
    setAiScore(0);
    setAiHighlight([]);
    setAIThinking(false);
    setGameState("playing");
  }

  // Helper to get word at selected positions
  function getSelectedWord(
    positions: [number, number][]
  ): { word: string; wordData: WordData | null } {
    for (let wd of wordList) {
      if (
        !wd.foundBy &&
        (arraysEqual(wd.positions, positions) ||
          arraysEqual([...wd.positions].reverse(), positions))
      ) {
        return { word: wd.word, wordData: wd };
      }
    }
    return { word: "", wordData: null };
  }

  // Handle cell selection
  function handleCellMouseDown(r: number, c: number) {
    if (gameState !== "playing") return;
    setSelected([[r, c]]);
  }

  function handleCellMouseEnter(r: number, c: number) {
    if (gameState !== "playing" || selected.length === 0) return;
    const [startR, startC] = selected[0];
    // Only allow straight lines
    let line = getLine([startR, startC], [r, c]);
    if (line) setSelected(line);
  }

  function handleCellMouseUp() {
    if (gameState !== "playing" || selected.length < 2) {
      setSelected([]);
      return;
    }
    const { word, wordData } = getSelectedWord(selected);
    if (wordData && !wordData.foundBy) {
      // Animate found word
      setGameState("animatingPlayer");
      setTimeout(() => {
        setFoundWords((fw) => [
          ...fw,
          { word: word, by: "player", positions: wordData.positions },
        ]);
        setWordList((wl) =>
          wl.map((w) =>
            w.word === word ? { ...w, foundBy: "player" } : w
          )
        );
        setPlayerScore((s) => s + 1);
        setSelected([]);
        setGameState("playing");
      }, 400);
    } else {
      setSelected([]);
    }
  }

  // Animate found words
  function getCellStatus(r: number, c: number): {
    foundBy: null | "player" | "ai";
    isSelecting: boolean;
    isAIHighlight: boolean;
  } {
    // Is part of selection?
    let isSelecting =
      selected.find(([rr, cc]) => rr === r && cc === c) !== undefined;

    // Is AI thinking?
    let isAIHighlight =
      aiHighlight.find(([rr, cc]) => rr === r && cc === c) !== undefined;

    // Is found by someone?
    let foundBy: null | "player" | "ai" = null;
    for (let fw of foundWords) {
      if (fw.positions.find(([rr, cc]) => rr === r && cc === c)) {
        foundBy = fw.by;
      }
    }
    return { foundBy, isSelecting, isAIHighlight };
  }

  // AI plays at intervals
  useEffect(() => {
    if (gameState !== "playing") return;
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);

    const conf = DIFFICULTY_CONFIG[difficulty];
    aiIntervalRef.current = setInterval(() => {
      if (gameState !== "playing") return;
      // AI "thinks" -- finds a random unfound word, with probability based on skill
      if (Math.random() < conf.aiSkill) {
        const candidates = wordList.filter((w) => !w.foundBy);
        if (candidates.length > 0) {
          // Smarter AI: On Hard, prefers longer words
          let chosen: WordData;
          if (difficulty === "Hard" && Math.random() < 0.6) {
            chosen = [...candidates].sort(
              (a, b) => b.word.length - a.word.length
            )[0];
          } else {
            chosen = candidates[randomInt(0, candidates.length - 1)];
          }
          setAIThinking(true);
          setAiHighlight(chosen.positions);
          setGameState("animatingAI");
          setTimeout(() => {
            setFoundWords((fw) => [
              ...fw,
              { word: chosen.word, by: "ai", positions: chosen.positions },
            ]);
            setWordList((wl) =>
              wl.map((w) =>
                w.word === chosen.word ? { ...w, foundBy: "ai" } : w
              )
            );
            setAiScore((s) => s + 1);
            setAiHighlight([]);
            setAIThinking(false);
            setGameState("playing");
          }, 700);
        }
      }
      // If all words found, finish game
      if (
        wordList.filter((w) => !w.foundBy).length === 0 ||
        foundWords.length + 1 >= wordList.length
      ) {
        setTimeout(() => {
          setGameState("completed");
        }, 1200);
        clearInterval(aiIntervalRef.current);
      }
    }, conf.aiInterval);

    return () => {
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    };
    // eslint-disable-next-line
  }, [gameState, wordList, difficulty, foundWords]);

  // Check for game end
  useEffect(() => {
    if (gameState !== "playing") return;
    if (wordList.filter((w) => !w.foundBy).length === 0) {
      setGameState("completed");
      if (aiIntervalRef.current) clearInterval(aiIntervalRef.current);
    }
    // eslint-disable-next-line
  }, [foundWords]);

  // Store scoreboard on finish
  useEffect(() => {
    if (gameState === "completed") {
      const entry = {
        playerScore,
        aiScore,
        difficulty,
        date: new Date().toLocaleString(),
      };
      const scores = [entry, ...scoreboard].slice(0, 8);
      setScoreboard(scores);
      saveScoreboard(scores);
    }
    // eslint-disable-next-line
  }, [gameState]);

  // UI rendering
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(155deg, #f3f8ff 0%, #c5e4fc 55%, #e9f8e1 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "'Montserrat', Arial, sans-serif",
        padding: 0,
      }}
    >
      <style>{`
        .cell {
          transition: background 0.2s, box-shadow 0.2s;
        }
        .cell.selecting {
          background: ${highlightColors.selecting}!important;
          ${Object.entries(animPulse)
            .map(([k, v]) => `${k}:${v}`)
            .join(";")}
        }
        .cell.found-player {
          background: ${highlightColors.player};
          color: #215921;
          font-weight: bold;
        }
        .cell.found-ai {
          background: ${highlightColors.ai};
          color: #a12d2d;
          font-weight: bold;
        }
        .cell.ai-highlight {
          background: #ffeabf !important;
          box-shadow: 0 0 12px 4px #fbd27b88;
        }
        .word-btn {
          margin: 2px;
          padding: 4px 10px;
          border-radius: 5px;
          font-size: 0.9rem;
          border: none;
          transition: background 0.2s, color 0.2s;
        }
        .word-btn.found-player {
          background: #a4e9a7;
          color: #215921;
        }
        .word-btn.found-ai {
          background: #fab8b8;
          color: #a12d2d;
        }
        .word-btn.unfound {
          background: #f0f0f0;
          color: #555;
        }
        .difficulty-btn {
          padding: 10px 24px;
          margin: 8px;
          border-radius: 8px;
          border: none;
          background: #2296f3;
          color: white;
          font-size: 1.13rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .difficulty-btn.selected {
          background: #1769aa;
        }
        .scoreboard-entry {
          padding: 8px 16px;
          border-radius: 8px;
          margin: 2px 0;
          background: #f0f8ff;
          box-shadow: 0 2px 8px #0002;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .scoreboard-entry.me {
          background: #d1f2e2;
        }
        @media (max-width: 600px){
          .wordsearch-grid {
            font-size: 12px !important;
          }
        }
      `}</style>
      <div style={{ marginTop: 28, marginBottom: 14 }}>
        <h1
          style={{
            letterSpacing: "2px",
            color: "#0593f7",
            fontWeight: 800,
            fontSize: "2.5rem",
            margin: 0,
            textShadow: "0 2px 10px #0001",
          }}
        >
          Word Search Showdown
        </h1>
      </div>
      {/* SETUP SCREEN */}
      {gameState === "setup" && (
        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            padding: 24,
            borderRadius: 14,
            background: "#fff",
            boxShadow: "0 6px 36px #0002",
            minWidth: 250,
          }}
        >
          <h2 style={{ color: "#193c73", marginBottom: 10 }}>
            Choose Difficulty
          </h2>
          {(["Easy", "Medium", "Hard"] as Difficulty[]).map((dif) => (
            <button
              key={dif}
              className={`difficulty-btn ${
                difficulty === dif ? "selected" : ""
              }`}
              onClick={() => setDifficulty(dif)}
            >
              {dif}
            </button>
          ))}
          <br />
          <button
            style={{
              marginTop: 26,
              background: "#33bf7f",
              color: "white",
              fontWeight: 700,
              fontSize: "1.15rem",
              padding: "12px 32px",
              borderRadius: 9,
              boxShadow: "0 2px 8px #33bf7f33",
              border: "none",
              cursor: "pointer",
              letterSpacing: "1px",
              transition: "background 0.15s",
            }}
            onClick={() => startGame(difficulty)}
          >
            Start Game
          </button>
        </div>
      )}
      {/* GAME BOARD */}
      {(gameState === "playing" ||
        gameState === "completed" ||
        gameState === "animatingAI" ||
        gameState === "animatingPlayer") && (
        <div
          style={{
            display: "flex",
            marginTop: 20,
            marginBottom: 18,
          }}
        >
          {/* GRID */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 6px 36px #0001",
              padding: 20,
              marginRight: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: 340,
              minHeight: 340,
            }}
          >
            <div
              className="wordsearch-grid"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${grid.length}, 1fr)`,
                gap: 3,
                fontSize: grid.length <= 10 ? 26 : grid.length <= 14 ? 18 : 14,
                userSelect: "none",
              }}
              onMouseUp={handleCellMouseUp}
              onMouseLeave={() => setSelected([])}
              onTouchEnd={handleCellMouseUp}
              onTouchCancel={() => setSelected([])}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  const { foundBy, isSelecting, isAIHighlight } = getCellStatus(
                    r,
                    c
                  );
                  let cl =
                    "cell" +
                    (isSelecting ? " selecting" : "") +
                    (foundBy === "player" ? " found-player" : "") +
                    (foundBy === "ai" ? " found-ai" : "") +
                    (isAIHighlight ? " ai-highlight" : "");
                  return (
                    <div
                      key={r + "," + c}
                      className={cl}
                      style={{
                        width:
                          grid.length >= 14
                            ? 30
                            : grid.length >= 12
                            ? 34
                            : 44,
                        height:
                          grid.length >= 14
                            ? 30
                            : grid.length >= 12
                            ? 34
                            : 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border:
                          foundBy === "player"
                            ? "2.5px solid #4ad087"
                            : foundBy === "ai"
                            ? "2.5px solid #f97c7c"
                            : "1.5px solid #c0c0c0",
                        boxShadow: isSelecting
                          ? "0 0 16px 2px #ffec98"
                          : foundBy === "player"
                          ? "0 0 12px 2px #9ff5c2"
                          : foundBy === "ai"
                          ? "0 0 12px 2px #ffc2c2"
                          : "0 0 0px #fff2",
                        fontWeight:
                          foundBy || isSelecting || isAIHighlight ? 700 : 500,
                        fontSize: isSelecting
                          ? "1.2em"
                          : foundBy
                          ? "1.15em"
                          : "1em",
                        background:
                          foundBy === "player"
                            ? highlightColors.player
                            : foundBy === "ai"
                            ? highlightColors.ai
                            : isAIHighlight
                            ? "#ffeabf"
                            : isSelecting
                            ? highlightColors.selecting
                            : "#fff",
                        color:
                          foundBy === "player"
                            ? "#215921"
                            : foundBy === "ai"
                            ? "#a12d2d"
                            : isSelecting
                            ? "#a38b0b"
                            : "#333",
                        transition:
                          "background 0.2s, box-shadow 0.2s, color 0.19s, font-size 0.16s",
                        cursor: foundBy ? "default" : "pointer",
                        borderRadius: 7,
                        userSelect: "none",
                        touchAction: "none",
                        ...((isSelecting || isAIHighlight) && animPulse),
                      }}
                      onMouseDown={() => handleCellMouseDown(r, c)}
                      onMouseEnter={(e) => {
                        if (selected.length > 0 && e.buttons > 0)
                          handleCellMouseEnter(r, c);
                      }}
                      onTouchStart={() => handleCellMouseDown(r, c)}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        if (!touch) return;
                        const gridRect = (
                          e.target as HTMLElement
                        ).closest(".wordsearch-grid")?.getBoundingClientRect();
                        if (!gridRect) return;
                        const y = touch.clientY - gridRect.top;
                        const x = touch.clientX - gridRect.left;
                        const rowH =
                          (gridRect.height - (grid.length - 1) * 3) /
                          grid.length;
                        const colW =
                          (gridRect.width - (grid.length - 1) * 3) /
                          grid.length;
                        let rr = Math.floor(y / rowH);
                        let cc = Math.floor(x / colW);
                        if (
                          rr >= 0 &&
                          rr < grid.length &&
                          cc >= 0 &&
                          cc < grid.length
                        )
                          handleCellMouseEnter(rr, cc);
                      }}
                    >
                      {cell}
                    </div>
                  );
                })
              )}
            </div>
            {/* WORD BANK */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexWrap: "wrap",
                maxWidth: 340,
                justifyContent: "center",
              }}
            >
              {wordList.map((w) => {
                let cl =
                  "word-btn " +
                  (w.foundBy === "player"
                    ? "found-player"
                    : w.foundBy === "ai"
                    ? "found-ai"
                    : "unfound");
                return (
                  <span
                    key={w.word}
                    className={cl}
                    style={{
                      textDecoration: w.foundBy ? "line-through" : "none",
                      margin: "4px 6px",
                      fontWeight: w.foundBy ? 700 : 500,
                      letterSpacing: "1.5px",
                      fontSize: grid.length >= 14 ? 13 : 15,
                      minWidth: 52,
                      display: "inline-block",
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          </div>
          {/* SCOREBOARD & STATUS */}
          <div>
            {/* SCORES */}
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 6px 36px #0001",
                padding: 20,
                minWidth: 180,
                marginBottom: 14,
              }}
            >
              <h3
                style={{
                  color: "#1769aa",
                  letterSpacing: "1px",
                  margin: "0 0 12px 0",
                  fontWeight: 700,
                  fontSize: "1.17rem",
                  textAlign: "center",
                }}
              >
                Scores
              </h3>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: "1.18em",
                  marginBottom: 8,
                }}
              >
                <span style={{ color: "#2296f3" }}>You</span>
                <span>{playerScore}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: "1.13em",
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "#fa2d2d" }}>AI</span>
                <span>{aiScore}</span>
              </div>
              <hr style={{ margin: "8px 0", border: "1px solid #f0f0f0" }} />
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.95em",
                  color: "#777",
                }}
              >
                {foundWords.length}/{wordList.length} words found
              </div>
              <div
                style={{
                  marginTop: 6,
                  textAlign: "center",
                  color: "#555",
                  fontWeight: 500,
                  minHeight: 24,
                }}
              >
                {gameState === "completed"
                  ? playerScore > aiScore
                    ? "🏆 You Win!"
                    : playerScore < aiScore
                    ? "🤖 AI Wins!"
                    : "🤝 Draw!"
                  : aiThinking
                  ? "AI is thinking..."
                  : ""}
              </div>
            </div>
            {/* SCOREBOARD */}
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 4px 22px #0001",
                padding: 16,
                minWidth: 180,
              }}
            >
              <h3
                style={{
                  color: "#1769aa",
                  letterSpacing: "1px",
                  margin: "0 0 10px 0",
                  fontWeight: 700,
                  fontSize: "1.09rem",
                  textAlign: "center",
                }}
              >
                Past Games
              </h3>
              <div style={{ maxHeight: 190, overflowY: "auto" }}>
                {scoreboard.length === 0 && (
                  <div
                    style={{
                      color: "#aaa",
                      textAlign: "center",
                      fontSize: "0.97em",
                    }}
                  >
                    No games yet
                  </div>
                )}
                {scoreboard.map((s, idx) => (
                  <div
                    key={idx}
                    className={
                      "scoreboard-entry" +
                      (idx === 0 && gameState === "completed" ? " me" : "")
                    }
                  >
                    <span>
                      <span
                        style={{
                          color:
                            s.playerScore > s.aiScore
                              ? "#33bf7f"
                              : s.playerScore < s.aiScore
                              ? "#fa2d2d"
                              : "#b8be3a",
                          fontWeight: 700,
                        }}
                      >
                        {s.playerScore}-{s.aiScore}
                      </span>
                    </span>
                    <span style={{ fontSize: "0.88em", color: "#666" }}>
                      {s.difficulty}
                    </span>
                    <span style={{ fontSize: "0.86em", color: "#aaa" }}>
                      {s.date.split(",")[0]}
                    </span>
                  </div>
                ))}
              </div>
              {scoreboard.length > 0 && (
                <button
                  style={{
                    marginTop: 10,
                    background: "#e35e5e",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "1em",
                    padding: "6px 16px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    letterSpacing: "1px",
                    transition: "background 0.13s",
                  }}
                  onClick={() => {
                    setScoreboard([]);
                    saveScoreboard([]);
                  }}
                >
                  Clear Scores
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* GAME OVER SCREEN */}
      {gameState === "completed" && (
        <div
          style={{
            marginTop: 12,
            background: "#fff",
            borderRadius: 13,
            boxShadow: "0 4px 24px #0002",
            padding: 28,
            textAlign: "center",
            minWidth: 250,
          }}
        >
          <h2
            style={{
              color: "#2296f3",
              margin: "0 0 12px 0",
              fontWeight: 800,
              fontSize: "2.2rem",
            }}
          >
            {playerScore > aiScore
              ? "🏆 You Win!"
              : playerScore < aiScore
              ? "🤖 AI Wins!"
              : "🤝 It's a Draw!"}
          </h2>
          <p
            style={{
              fontSize: "1.12rem",
              color: "#444",
              margin: "0 0 18px 0",
            }}
          >
            Final Score:{" "}
            <span style={{ color: "#2296f3", fontWeight: 700 }}>
              {playerScore}
            </span>
            {" : "}
            <span style={{ color: "#fa2d2d", fontWeight: 700 }}>
              {aiScore}
            </span>
          </p>
          <button
            style={{
              background: "#33bf7f",
              color: "white",
              fontWeight: 700,
              fontSize: "1.07rem",
              padding: "10px 34px",
              borderRadius: 9,
              boxShadow: "0 2px 8px #33bf7f33",
              border: "none",
              cursor: "pointer",
              letterSpacing: "1px",
              transition: "background 0.16s",
              marginRight: 10,
            }}
            onClick={() => startGame(difficulty)}
          >
            Play Again
          </button>
          <button
            style={{
              background: "#2296f3",
              color: "white",
              fontWeight: 700,
              fontSize: "1.07rem",
              padding: "10px 26px",
              borderRadius: 9,
              boxShadow: "0 2px 8px #2296f366",
              border: "none",
              cursor: "pointer",
              letterSpacing: "1px",
              transition: "background 0.15s",
            }}
            onClick={() => setGameState("setup")}
          >
            Main Menu
          </button>
        </div>
      )}
      <div style={{ height: 36 }} />
      <footer
        style={{
          fontSize: "0.99em",
          color: "#888",
          margin: "30px 0 16px 0",
          textAlign: "center",
        }}
      >
        &copy; {new Date().getFullYear()} Word Search Showdown &middot; Powered by Next.js
      </footer>
    </div>
  );
}