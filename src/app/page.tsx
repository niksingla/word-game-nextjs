"use client"

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { X } from 'lucide-react'

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
      setResultModal(true)
      const entry = {
        playerScore,
        aiScore,
        difficulty,
        date: new Date().toLocaleString(),
      };
      const scores = [entry, ...scoreboard].slice(0, 8);
      setScoreboard(scores);
      saveScoreboard(scores);
      document.body.classList.add('overflow-hidden')
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
    // eslint-disable-next-line
  }, [gameState]);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const { name, email, password } = formData;
    if (name && email && password) {
      setIsAuthenticated(true);
    } else {
      alert('Fill all the details first.')
    }
  };

  // Result Modal
  const [resultModal, setResultModal] = useState<boolean>(false);

  // UI rendering
  if (!isAuthenticated) {
    return (
      <>
        <style>{`
          button {
            cursor:pointer;
          }          
        `}</style>
        <div className="min-h-screen flex flex-col items-center p-0 bg-[linear-gradient(135deg,_#f3f8ff_0%,_#c5e4fc_55%,_#e9f8e1_100%)]">
          <div className="flex flex-col justify-center items-center gap-10">
            <div className="mt-7 mb-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-[#2a4f77] drop-shadow-lg leading-tight sm:leading-snug">
                WordPlay
              </h1>
            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-6 bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-[#d1e7f7]"
            >
              <h2 className="text-2xl sm:text-3xl font-semibold text-center text-[#2a4f77] mb-6 drop-shadow-lg leading-tight sm:leading-snug">
                Fill in your details to play
              </h2>
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-[#5b5b5b] mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-[#d1e7f7] rounded-md shadow-sm focus:outline-none focus:border-[#2a4f77] transition duration-150 text-[#333333] placeholder-[#a0a0a0]"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#5b5b5b] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-[#d1e7f7] rounded-md shadow-sm focus:outline-none focus:border-[#2a4f77] transition duration-150 text-[#333333] placeholder-[#a0a0a0]"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#5b5b5b] mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    id="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-[#d1e7f7] rounded-md shadow-sm focus:outline-none focus:border-[#2a4f77] transition duration-150 text-[#333333] placeholder-[#a0a0a0]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#2a4f77] text-white font-semibold mt-4 py-3 px-6 rounded-full border-2 border-[#2a4f77] hover:bg-transparent hover:text-[#2a4f77] transition-all duration-300 ease-in-out"
              >
                Play
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }
  return (
    <div className="min-h-screen flex flex-col items-center p-0 bg-[linear-gradient(135deg,_#f3f8ff_0%,_#c5e4fc_55%,_#e9f8e1_100%)]">
      <style>{`
        button {
          cursor:pointer;
        }
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
          .cell{
            width: ${grid.length >= 14 ? "6vw" : grid.length >= 12 ? "7vw" : "9vw"} !important;
            height: ${grid.length >= 14 ? "6vw" : grid.length >= 12 ? "7vw" : "9vw"} !important;
          }
        }
      `}</style>
      <div className="mt-7 mb-3">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-[#2a4f77] drop-shadow-lg leading-tight sm:leading-snug">
          WordPlay
        </h1>
      </div>

      {/* SETUP SCREEN */}
      {gameState === "setup" && (
        <div className="mt-6 text-center p-6 rounded-lg bg-white shadow-[0_6px_36px_#0002] min-w-[250px] w-full max-w-lg mx-auto">
          <h2 className="text-[#2a4f77] mb-6 font-semibold text-xl sm:text-2xl md:text-3xl">
            Choose Difficulty
          </h2>
          {(["Easy", "Medium", "Hard"] as Difficulty[]).map((dif) => (
            <button
              key={dif}
              className={`px-6 py-2 m-2 rounded border-0 text-white text-base sm:text-lg font-semibold cursor-pointer transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none ${difficulty === dif ? "bg-[#2a4f77] scale-105" : "bg-[#44759e]"}`}
              onClick={() => setDifficulty(dif)}
            >
              {dif}
            </button>
          ))}
          <br />
          <button
            className="mt-6 bg-[#33bf7f] text-white font-semibold text-lg px-6 py-2 m-2 rounded shadow-md border-0 cursor-pointer tracking-wider transition-all duration-200 ease-in-out hover:bg-[#28a759] focus:outline-none focus:ring-2 focus:ring-[#33bf7f] hover:scale-105"
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

          <div className="flex flex-col md:flex-row justify-center items-start w-full py-12">

            {/* Empty Div */}
            <div className="sm:w-[25%]"></div>

            {/* GRID */}
            <div className="md:flex-1 flex flex-col justify-center items-center mx-auto">
              <div className="bg-gradient-to-br from-white via-[#f7f9fb] to-[#edf2f7] rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-6 flex flex-col items-center min-w-[340px] min-h-[340px] border border-[#e2e8f0]">
                <div
                  className="wordsearch-grid grid gap-[4px] select-none"
                  style={{
                    gridTemplateColumns: `repeat(${grid.length}, 1fr)`,
                    fontSize: grid.length <= 10 ? '26px' : grid.length <= 14 ? '18px' : '14px',
                  }}
                  onMouseUp={handleCellMouseUp}
                  onMouseLeave={() => setSelected([])}
                  onTouchEnd={handleCellMouseUp}
                  onTouchCancel={() => setSelected([])}
                >
                  {grid.map((row, r) =>
                    row.map((cell, c) => {
                      const { foundBy, isSelecting, isAIHighlight } = getCellStatus(r, c);
                      let cl =
                        "cell" +
                        (isSelecting ? " selecting" : "") +
                        (foundBy === "player" ? " found-player" : "") +
                        (foundBy === "ai" ? " found-ai" : "") +
                        (isAIHighlight ? " ai-highlight" : "");
                      return (
                        <div
                          key={`${r},${c}`}
                          className={`${cl} flex items-center justify-center rounded-[8px] select-none touch-none transition-all`}
                          style={{
                            width: grid.length >= 14 ? 30 : grid.length >= 12 ? 34 : 44,
                            height: grid.length >= 14 ? 30 : grid.length >= 12 ? 34 : 44,
                            border: foundBy === "player"
                              ? "2px solid #38b2ac"
                              : foundBy === "ai"
                                ? "2px solid #f56565"
                                : "1.5px solid #d1d5db",
                            boxShadow: isSelecting
                              ? "0 0 16px 2px #fde68a"
                              : foundBy === "player"
                                ? "0 0 10px 2px #a0f0e0"
                                : foundBy === "ai"
                                  ? "0 0 10px 2px #feb2b2"
                                  : "none",
                            fontWeight: foundBy || isSelecting || isAIHighlight ? 700 : 500,
                            fontSize: isSelecting ? "1.2em" : foundBy ? "1.1em" : "1em",
                            background: foundBy === "player"
                              ? highlightColors.player
                              : foundBy === "ai"
                                ? highlightColors.ai
                                : isAIHighlight
                                  ? "#fff7e6"
                                  : isSelecting
                                    ? highlightColors.selecting
                                    : "#fdfdfd",
                            color: foundBy === "player"
                              ? "#22543d"
                              : foundBy === "ai"
                                ? "#742a2a"
                                : isSelecting
                                  ? "#975a16"
                                  : "#2d3748",
                            transition: "all 0.2s ease",
                            cursor: foundBy ? "default" : "pointer",
                          }}
                          onMouseDown={() => handleCellMouseDown(r, c)}
                          onMouseEnter={(e) => {
                            if (selected.length > 0 && e.buttons > 0) handleCellMouseEnter(r, c);
                          }}
                          onTouchStart={() => handleCellMouseDown(r, c)}
                          onTouchMove={(e) => {
                            const touch = e.touches[0];
                            if (!touch) return;
                            const gridRect = (e.target as HTMLElement).closest(".wordsearch-grid")?.getBoundingClientRect();
                            if (!gridRect) return;
                            const y = touch.clientY - gridRect.top;
                            const x = touch.clientX - gridRect.left;
                            const rowH = (gridRect.height - (grid.length - 1) * 4) / grid.length;
                            const colW = (gridRect.width - (grid.length - 1) * 4) / grid.length;
                            let rr = Math.floor(y / rowH);
                            let cc = Math.floor(x / colW);
                            if (rr >= 0 && rr < grid.length && cc >= 0 && cc < grid.length)
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
                <div className="mt-6 flex flex-wrap max-w-[340px] justify-center">
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
                        className={`${cl} inline-block mx-[6px] my-[4px] tracking-[1.5px] min-w-[52px] text-center px-2 py-1 rounded-[6px] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors duration-200`}
                        style={{
                          textDecoration: w.foundBy ? "line-through" : "none",
                          fontWeight: w.foundBy ? 700 : 500,
                          fontSize: grid.length >= 14 ? "13px" : "15px",
                          color: w.foundBy === "player"
                            ? "#276749"
                            : w.foundBy === "ai"
                              ? "#9b2c2c"
                              : "#374151",
                        }}
                      >
                        {w.word}
                      </span>
                    );
                  })}
                </div>
              </div>
              {gameState == "completed" ? (
                <div className="flex gap-6 mt-4">
                  <button
                    className="bg-[#33bf7f] text-white font-semibold text-base px-6 py-2 rounded-lg shadow-md tracking-wide transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
                    onClick={() => startGame(difficulty)}
                  >
                    Play Again
                  </button>
                  <button
                    className="bg-[#2296f3] text-white font-semibold text-base px-6 py-2 rounded-lg shadow-md tracking-wide transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
                    onClick={() => setGameState("setup")}
                  >
                    Main Menu
                  </button>
                </div>
              ) : (
                <button
                  className="mt-4 bg-[#2296f3] text-white font-semibold text-base px-6 py-2 rounded-lg shadow-md tracking-wide transition-all duration-200 ease-in-out hover:scale-105 active:scale-95"
                  onClick={() => setGameState("setup")}
                >
                  Restart
                </button>
              )}
            </div>


            {/* SCORES & SCOREBOARD */}
            <div className="w-full md:w-[25%] py-10 md:pt-0 px-8 md:px-0">
              <div className="flex flex-col space-y-3.5 md:max-w-[280px]">
                {/* SCORES */}
                <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-xl py-4 px-4 border border-[#e0e0e0]">
                  <h3 className="text-[#1769aa] tracking-wide mb-4 text-center font-extrabold text-xl">
                    Scores
                  </h3>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1 text-sm font-medium text-[#2296f3]">
                      <span>{formData.name || 'You'}</span>
                      <span>{playerScore}</span>
                    </div>
                    <div className="w-full bg-[#e3f2fd] rounded-full h-2">
                      <div className="bg-[#2296f3] h-2 rounded-full" style={{ width: `${Math.min(100, (playerScore / (playerScore + aiScore)) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1 text-sm font-medium text-[#fa2d2d]">
                      <span>AI</span>
                      <span>{aiScore}</span>
                    </div>
                    <div className="w-full bg-[#ffebee] rounded-full h-2">
                      <div className="bg-[#fa2d2d] h-2 rounded-full" style={{ width: `${Math.min(100, (aiScore / (playerScore + aiScore)) * 100)}%` }} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-center text-sm text-gray-700 mb-1 tracking-wide">
                      <span className="font-semibold text-[#1769aa]">
                        {foundWords.length}
                      </span> of
                      <span className="font-semibold text-[#1769aa]"> {wordList.length} </span>
                      words found
                    </div>
                    <div className="relative w-full bg-gray-200 h-2 rounded-full overflow-hidden mb-3">
                      <div
                        className="bg-[#1769aa] h-full transition-all duration-500"
                        style={{ width: `${(foundWords.length / wordList.length) * 100}%` }}
                      />
                    </div>

                    <div className="text-center text-base font-semibold min-h-[24px]">
                      {gameState === "completed" ? (
                        playerScore > aiScore ? (
                          <span className="text-[#4CAF50]">You Win</span> // Green for win
                        ) : playerScore < aiScore ? (
                          <span className="text-[#F44336]">AI Wins</span> // Red for AI win
                        ) : (
                          <span className="text-[#FF9800]">It's a Draw</span> // Orange for draw
                        )
                      ) : aiThinking ? (
                        <span className="text-[#9E9E9E]">AI is thinking...</span> // Gray while AI is thinking
                      ) : null}
                    </div>

                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-xl py-4 px-4 border border-[#e0e0e0]">
                  <h3 className="text-[#1769aa] tracking-wide mb-3 text-center font-extrabold text-lg">
                    Past Games
                  </h3>

                  <div className="max-h-[190px] overflow-y-auto space-y-2">
                    {scoreboard.length === 0 ? (
                      <div className="text-center text-sm text-gray-400">No games yet</div>
                    ) : (
                      scoreboard.map((s, idx) => {
                        const resultColor =
                          s.playerScore > s.aiScore
                            ? "text-green-500"
                            : s.playerScore < s.aiScore
                              ? "text-red-500"
                              : "text-yellow-500";

                        const highlightClass =
                          idx === 0 && gameState === "completed"
                            ? "bg-blue-50 border-l-4 border-blue-300"
                            : "bg-white";

                        return (
                          <div
                            key={idx}
                            className={`flex justify-between items-center px-4 py-3 rounded-lg shadow-md mb-3 transition-all duration-300 ease-in-out hover:bg-gray-50 ${highlightClass}`}
                          >
                            <span className={`font-semibold text-xl ${resultColor}`}>
                              {s.playerScore}-{s.aiScore}
                            </span>
                            <span className="text-sm text-gray-500">{s.difficulty}</span>
                            <span className="text-xs text-gray-400">{s.date.split(",")[0]}</span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {scoreboard.length > 0 && (
                    <>
                      <button
                        className="mt-4 w-full bg-gradient-to-r from-[#e35e5e] to-[#d64b4b] text-white font-semibold text-base py-2 rounded-lg shadow-md tracking-wide transition-all duration-200 ease-in-out hover:scale-105 hover:from-[#f84c4c] hover:to-[#d94c4c] active:scale-95"
                        onClick={() => {
                          setScoreboard([]);
                          saveScoreboard([]);
                        }}
                      >
                        Clear Scores
                      </button>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>

        )}
      {/* GAME OVER SCREEN */}
      {gameState === "completed" && resultModal && (
        <>
          <style>
            {`
              /* Overlay Fade-In Animation */
              @keyframes fadeIn {
                0% {
                  opacity: 0;
                }
                100% {
                  opacity: 1;
                }
              }

              /* Modal Bounce-In Animation */
              @keyframes bounceIn {
                0% {
                  opacity: 0;
                  transform: scale(0.9) translateY(-50px);
                }
                60% {
                  opacity: 1;
                  transform: scale(1.05) translateY(10px);
                }
                100% {
                  transform: scale(1) translateY(0);
                }
              }

              /* Apply Fade-In to Overlay */
              .animate-modalEntrance {
                animation: fadeIn 0.35s ease-out forwards;
              }

              /* Apply Bounce-In to Inner Modal */
              .animate-modalEntrance > div {
                animation: bounceIn 0.5s ease-out forwards;
              }
            `}
          </style>
          <div className="fixed inset-0 flex items-center justify-center bg-white/75 z-50 animate-modalEntrance">
            <div className="bg-white rounded-[13px] shadow-[0_4px_24px_rgba(0,0,0,0.125)] p-7 text-center min-w-[250px] max-w-[500px] w-full relative">
              <button className="absolute top-2 right-2 hover:bg-gray-100" onClick={() => {
                document.body.classList.remove('overflow-hidden')
                setResultModal(false)
              }}>
                <X size={20} />
              </button>
              <h2
                className={`mb-4 font-extrabold text-3xl md:text-4xl px-4 py-2 rounded-xl shadow-md transition-all ${playerScore > aiScore
                  ? "text-green-700 bg-green-100 border border-green-300"
                  : playerScore < aiScore
                    ? "text-red-700 bg-red-100 border border-red-300"
                    : "text-yellow-700 bg-yellow-100 border border-yellow-300"
                  }`}
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
                className="bg-[#33bf7f] text-white font-bold text-[1.07rem] py-2.5 px-8 rounded-[9px] shadow-[0_2px_8px_rgba(51,191,127,0.2)] border-none cursor-pointer tracking-wide transition-colors duration-150 mr-2.5"
                onClick={() => startGame(difficulty)}
              >
                Play Again
              </button>
              <button
                className="bg-[#2296f3] text-white font-bold text-[1.07rem] py-2.5 px-6 rounded-[9px] shadow-[0_2px_8px_rgba(34,150,243,0.4)] border-none cursor-pointer tracking-wide transition-colors duration-150"
                onClick={() => setGameState("setup")}
              >
                Main Menu
              </button>
            </div>
          </div>
        </>
      )}


      <div className="h-[36px]" />
      <footer className="text-center text-[0.99em] text-gray-500 mt-8 mb-4">
        &copy; 2025 WordPlay
      </footer>
    </div>
  );
}