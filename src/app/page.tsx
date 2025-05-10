"use client"

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Gamepad2, HandMetal, Home, Loader, RefreshCcw, RotateCcw, Scale, Search, Trash2, Trophy, User, X } from 'lucide-react'

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
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const { name, email } = formData;
    if (name && email) {
      setIsAuthenticated(true);
    } else {
      alert('Fill all the details first.')
    }
  };

  // Result Modal
  const [resultModal, setResultModal] = useState<boolean>(false);

  // UI rendering
  return (
    <div className="bg-[#4f64e6] relative overflow-hidden">
      <span className="ball"></span>
      <span className="ball"></span>
      <span className="ball"></span>
      <span className="ball"></span>
      <span className="ball"></span>
      <span className="ball"></span>
      <style>{`
        @keyframes move {
          100% {
            transform: translate3d(0, 0, 1px) rotate(360deg);
          }
        }

        .ball {
          position: absolute;
          width: 20vmin;
          height: 20vmin;
          border-radius: 50%;
          backface-visibility: hidden;
          animation: move 40s linear infinite;
          z-index: 0;
        }

        .ball:nth-child(odd) {
          color: #51238c;
        }

        .ball:nth-child(even) {
          color: #2fd158;
        }

        .ball:nth-child(1) {
          top: 77%;
          left: 88%;
          animation-duration: 40s;
          animation-delay: -3s;
          transform-origin: 16vw -2vh;
          box-shadow: 40vmin 0 5.703076368487546vmin currentColor;
        }

        .ball:nth-child(2) {
          top: 42%;
          left: 2%;
          animation-duration: 42s;
          animation-delay: -28s;
          transform-origin: -19vw 21vh;
          box-shadow: -40vmin 0 5.17594621519026vmin currentColor;
        }

        .ball:nth-child(3) {
          top: 28%;
          left: 18%;
          animation-duration: 45s;
          animation-delay: -10s;
          transform-origin: -22vw 3vh;
          box-shadow: 40vmin 0 5.248179047256236vmin currentColor;
        }

        .ball:nth-child(4) {
          top: 50%;
          left: 79%;
          animation-duration: 37s;
          animation-delay: -18s;
          transform-origin: -17vw -6vh;
          box-shadow: 40vmin 0 5.279749632220298vmin currentColor;
        }

        .ball:nth-child(5) {
          top: 46%;
          left: 15%;
          animation-duration: 35s;
          animation-delay: -33s;
          transform-origin: 4vw 0vh;
          box-shadow: -40vmin 0 5.964309466052033vmin currentColor;
        }

        .ball:nth-child(6) {
          top: 77%;
          left: 16%;
          animation-duration: 33s;
          animation-delay: -6s;
          transform-origin: 18vw 4vh;
          box-shadow: 40vmin 0 5.178483653434181vmin currentColor;
        }

        .ball:nth-child(7) {
          top: 22%;
          left: 17%;
          animation-duration: 60s;
          animation-delay: -15s;
          transform-origin: 1vw -23vh;
          box-shadow: -40vmin 0 5.703026794398318vmin currentColor;
        }

        .ball:nth-child(8) {
          top: 41%;
          left: 47
        }

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
          .ball{
            display:none;
          }
          .wordsearch-grid {
            font-size: ${grid.length >= 14 ? "10px" : "12px"} !important;
          }
          .cell{
            width: ${grid.length >= 14 ? "3.5vw" : grid.length >= 12 ? "5vw" : "8vw"} !important;
            height: ${grid.length >= 14 ? "3.5vw" : grid.length >= 12 ? "5vw" : "8vw"} !important;
          }
        }
      `}</style>
      <div className="z-1 min-h-screen flex flex-col items-center px-8 md:px-0 relative">
        <div className="mt-7 mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-center text-white drop-shadow-lg leading-tight sm:leading-snug transform hover:scale-105 transition-all duration-300">
            WordPlay
          </h1>
        </div>

        {/* User Details */}
        {!isAuthenticated ? (
          <form
            onSubmit={handleLogin}
            className="space-y-6 mt-8 bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-[#d1e7f7] hover:shadow-lg transition-all duration-300"
          >
            <h2 className="text-2xl sm:text-3xl font-semibold text-center text-[#34238c] mb-6 drop-shadow-lg leading-tight sm:leading-snug flex items-center justify-center gap-3">
              Enter your details
              <Gamepad2 size={24} className="text-[#2FD1CC]" />
            </h2>

            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[#4f64e6] mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-[#c7d5f9] rounded-md shadow-sm focus:outline-none focus:border-[#34238c] transition duration-150 text-[#333333] placeholder-gray-400"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#4f64e6] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-[#c7d5f9] rounded-md shadow-sm focus:outline-none focus:border-[#34238c] transition duration-150 text-[#333333] placeholder-gray-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 bg-[#2FD1CC] text-white font-semibold text-lg px-8 py-3 rounded-full shadow-2xl border-0 cursor-pointer tracking-wider transition-all duration-300 ease-in-out hover:bg-[#34238c] focus:outline-none focus:ring-4 focus:ring-[#2FD1CC] hover:scale-110"
            >
              Play
            </button>
          </form>
        ) : (
          <>
            {/* SETUP SCREEN */}
            {gameState === "setup" && (
              <div className="mt-6 text-center p-8 rounded-lg bg-[#F5F5F5] shadow-xl min-w-[250px] w-full max-w-lg mx-auto border-2 border-[#8636EE]">
                <h2 className="text-[#34238c] mb-6 font-semibold text-xl sm:text-2xl md:text-3xl drop-shadow-md">
                  Choose Difficulty
                </h2>
                {(["Easy", "Medium", "Hard"] as Difficulty[]).map((dif) => (
                  <button
                    key={dif}
                    className={`px-8 py-3 m-3 rounded-full border-0 text-white text-base sm:text-lg font-semibold cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none shadow-md ${difficulty === dif ? "bg-[#34238c] scale-105" : "bg-[#8636EE]"}`}
                    onClick={() => setDifficulty(dif)}
                  >
                    {dif}
                  </button>
                ))}
                <br />
                <button
                  className="mt-6 bg-[#2FD1CC] text-white font-semibold text-lg px-8 py-3 rounded-full shadow-2xl border-0 cursor-pointer tracking-wider transition-all duration-300 ease-in-out hover:bg-[#34238c] focus:outline-none focus:ring-4 focus:ring-[#2FD1CC] hover:scale-110"
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

                <div className="flex flex-col md:flex-row justify-center items-start w-full py-10 overflow-hidden">

                  {/* Empty Div */}
                  <div className="sm:w-[25%]"></div>

                  {/* GRID */}
                  <div className="md:flex-1 flex flex-col justify-center items-center mx-auto md:p-0 overflow-hidden">
                    <div className="bg-[#ffffff] rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-6 flex flex-col items-center md:min-w-[340px] md:min-h-[340px] border border-[#e2e8f0]">
                      <div
                        className="wordsearch-grid grid gap-[4px] select-none"
                        style={{
                          gridTemplateColumns: `repeat(${grid.length}, 1fr)`,
                          fontSize: grid.length <= 10 ? "26px" : grid.length <= 14 ? "18px" : "14px",
                        }}
                        onMouseUp={handleCellMouseUp}
                        onMouseLeave={() => setSelected([])}
                        onTouchEnd={handleCellMouseUp}
                        onTouchCancel={() => setSelected([])}
                      >
                        {grid.map((row, r) =>
                          row.map((cell, c) => {
                            const { foundBy, isSelecting, isAIHighlight } = getCellStatus(r, c);
                            const cl =
                              "cell" +
                              (isSelecting ? " selecting" : "") +
                              (foundBy === "player" ? " found-player" : "") +
                              (foundBy === "ai" ? " found-ai" : "") +
                              (isAIHighlight ? " ai-highlight" : "");

                            const bgColor =
                              foundBy === "player"
                                ? "#2fd1cc"
                                : foundBy === "ai"
                                  ? "#8636EE"
                                  : isAIHighlight
                                    ? "#fefcbf"
                                    : isSelecting
                                      ? "#e0f7f5"
                                      : "#eceded";

                            const borderColor =
                              foundBy === "player"
                                ? "#2fd1cc"
                                : foundBy === "ai"
                                  ? "#8636EE"
                                  : "#d1d5db";

                            const textColor =
                              foundBy === "player"
                                ? "#ffffff"
                                : foundBy === "ai"
                                  ? "#ffffff"
                                  : isSelecting
                                    ? "#34238c"
                                    : "#2d3748";

                            return (
                              <div
                                key={`${r},${c}`}
                                className={`${cl} flex items-center justify-center rounded-[8px] transition-all`}
                                style={{
                                  width: grid.length >= 14 ? 30 : grid.length >= 12 ? 34 : 44,
                                  height: grid.length >= 14 ? 30 : grid.length >= 12 ? 34 : 44,
                                  border: `2px solid ${borderColor}`,
                                  boxShadow: isSelecting
                                    ? "0 0 10px 2px rgba(47, 209, 204, 0.5)"
                                    : foundBy === "ai"
                                      ? "0 0 10px 2px rgba(134, 54, 238, 0.4)"
                                      : foundBy === "player"
                                        ? "0 0 10px 2px rgba(47, 209, 204, 0.4)"
                                        : "none",
                                  fontWeight: foundBy || isSelecting || isAIHighlight ? 700 : 500,
                                  fontSize: isSelecting
                                    ? "1.2em"
                                    : foundBy
                                      ? "1.1em"
                                      : grid.length >= 14
                                        ? "0.8em"
                                        : "1em",
                                  backgroundColor: bgColor,
                                  color: textColor,
                                  cursor: foundBy ? "default" : "pointer",
                                  userSelect: "none",
                                  touchAction: "none",
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
                                  const target = e.target as HTMLElement;
                                  const gridElement = target.closest(".wordsearch-grid") as HTMLElement | null;
                                  if (!gridElement) return;

                                  const gridRect = gridElement.getBoundingClientRect();
                                  const y = touch.clientY - gridRect.top;
                                  const x = touch.clientX - gridRect.left;
                                  const rowH = (gridRect.height - (grid.length - 1) * 4) / grid.length;
                                  const colW = (gridRect.width - (grid.length - 1) * 4) / grid.length;
                                  let rr = Math.floor(y / rowH);
                                  let cc = Math.floor(x / colW);
                                  if (rr >= 0 && rr < grid.length && cc >= 0 && cc < grid.length) {
                                    handleCellMouseEnter(rr, cc);
                                  }
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
                          const isPlayer = w.foundBy === "player";
                          const isAI = w.foundBy === "ai";
                          return (
                            <span
                              key={w.word}
                              className="inline-block mx-[6px] my-[4px] tracking-[1.5px] min-w-[52px] text-center px-2 py-1 rounded-[6px] transition-colors duration-200"
                              style={{
                                backgroundColor: isPlayer
                                  ? "#2fd1cc"
                                  : isAI
                                    ? "#8636EE"
                                    : "#f1f5f9",
                                color: isPlayer
                                  ? "#ffffff"
                                  : isAI
                                    ? "#ffffff"
                                    : "#374151",
                                textDecoration: w.foundBy ? "line-through" : "none",
                                fontWeight: w.foundBy ? 700 : 500,
                                fontSize: grid.length >= 14 ? "13px" : "15px",
                              }}
                            >
                              {w.word}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {gameState === "completed" ? (
                      <div className="flex gap-4 mt-5 flex-wrap justify-center">
                        <button
                          className="flex items-center gap-2 bg-gradient-to-r from-[#2fd1cc] to-[#34d399] text-white font-bold text-base px-6 py-2 rounded-2xl shadow-lg tracking-wide transition-all duration-300 ease-in-out hover:scale-105 hover:from-[#2fd1cc] hover:to-[#10b981] active:scale-95"
                          onClick={() => startGame(difficulty)}
                        >
                          <RefreshCcw size={18} />
                          Play Again
                        </button>
                        <button
                          className="flex items-center gap-2 bg-gradient-to-r from-[#8636EE] to-[#34238c] text-white font-bold text-base px-6 py-2 rounded-2xl shadow-lg tracking-wide transition-all duration-300 ease-in-out hover:scale-105 hover:from-[#a855f7] hover:to-[#4338ca] active:scale-95"
                          onClick={() => setGameState("setup")}
                        >
                          <Home size={18} />
                          Main Menu
                        </button>
                      </div>
                    ) : (
                      <button
                        className="mt-5 flex items-center gap-2 bg-gradient-to-r from-[#8636EE] to-[#34238c] text-white font-bold text-base px-6 py-2 rounded-2xl shadow-lg tracking-wide transition-all duration-300 ease-in-out hover:scale-105 hover:from-[#a855f7] hover:to-[#4338ca] active:scale-95"
                        onClick={() => setGameState("setup")}
                      >
                        <RotateCcw size={18} />
                        Restart
                      </button>
                    )}
                  </div>


                  {/* SCORES & SCOREBOARD */}
                  <div className="w-full md:w-[25%] py-10 md:pt-0 md:px-0">
                    <div className="flex flex-col space-y-3.5 md:max-w-[280px]">
                      {/* SCORES - Gamified */}
                      <div className="bg-white backdrop-blur-md rounded-2xl shadow-2xl py-6 px-6 border border-[#d1d5db] relative">
                        <h3 className="text-[#34238c] tracking-wide mb-6 text-center font-extrabold text-2xl flex items-center justify-center gap-2">
                          <Trophy /> Scores
                        </h3>

                        {/* Player */}
                        <div className="mb-5">
                          <div className="flex justify-between items-center mb-1 text-sm font-semibold text-[#2fd1cc]">
                            <span className="flex items-center gap-1">
                              <User size={20} /> {formData.name || 'You'}
                              <span className="ml-2 text-xs bg-[#2fd1cc]/10 text-[#2fd1cc] px-2 py-0.5 rounded-full">
                                Level {Math.floor(playerScore / 10) + 1}
                              </span>
                            </span>
                            <span>{playerScore}</span>
                          </div>
                          <div className="w-full bg-[#d9f9f8] rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-[#2fd1cc] to-[#63fcd7] h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (playerScore / (playerScore + aiScore || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* AI */}
                        <div className="mb-5">
                          <div className="flex justify-between items-center mb-1 text-sm font-semibold text-[#8636EE]">
                            <span className="flex items-center gap-1">
                              <Bot size={20} /> AI
                              <span className="ml-2 text-xs bg-[#8636EE]/10 text-[#8636EE] px-2 py-0.5 rounded-full">
                                Difficulty: Smart
                              </span>
                            </span>
                            <span>{aiScore}</span>
                          </div>
                          <div className="w-full bg-[#f0e7fc] rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-[#8636EE] to-[#b784fa] h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (aiScore / (playerScore + aiScore || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Word Progress */}
                        <div className="mt-6">
                          <div className="text-center text-sm text-gray-700 mb-2 tracking-wide flex items-center justify-center">
                            <Search className="mr-2" size={16} />
                            <span className="font-bold text-[#34238c]">{foundWords.length}</span> /
                            <span className="font-bold text-[#34238c]"> {wordList.length} </span>&nbsp;words found
                          </div>

                          <div className="relative w-full bg-[#e2e8f0] h-3 rounded-full overflow-hidden mb-3">
                            <div
                              className="bg-gradient-to-r from-[#2fd1cc] to-[#63fcd7] h-full transition-all duration-500"
                              style={{ width: `${(foundWords.length / wordList.length) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Result / Status */}
                        <div className="text-center text-base font-semibold min-h-[24px] mt-8">
                          {gameState === "completed" ? (
                            playerScore > aiScore ? (
                              <span className="text-white text-xl font-bold animate-bounce bg-[#2fd1cc] py-2 px-6 rounded-full shadow-lg border-2 border-[#2fd1cc]">
                                <Trophy className="inline-block mr-2" size={18} />
                                You Win!
                              </span>
                            ) : playerScore < aiScore ? (
                              <span className="text-white text-xl font-bold animate-pulse bg-[#8636EE] py-2 px-6 rounded-full shadow-lg border-2 border-[#8636EE]">
                                <Bot className="inline-block mr-2" size={18} />
                                AI Wins
                              </span>
                            ) : (
                              <span className="text-[#34238c] text-xl font-bold animate-pulse bg-[#FF9800] py-2 px-6 rounded-full shadow-lg border-2 border-[#FF9800]">
                                <HandMetal className="inline-block mr-2" size={18} />
                                It's a Draw
                              </span>
                            )
                          ) : aiThinking ? (
                            <span className="text-[#4f64e6] text-lg font-semibold italic">
                              <Loader className="inline-block mr-2 animate-spin" size={18} />
                              AI is thinking...
                            </span>
                          ) : null}

                        </div>
                      </div>

                      <div className="bg-white backdrop-blur-md rounded-2xl shadow-2xl py-6 px-6 border border-[#e0e0e0]">
                        <h3 className="text-[#34238c] tracking-wide mb-6 text-center font-extrabold text-2xl flex items-center justify-center gap-2">
                          <Gamepad2 /> Past Games
                        </h3>

                        <div className="max-h-[190px] overflow-y-auto space-y-3">
                          {scoreboard.length === 0 ? (
                            <div className="text-center text-sm text-gray-400">No games yet</div>
                          ) : (
                            scoreboard.map((s, idx) => {
                              const resultIcon = s.playerScore > s.aiScore ? (
                                <Trophy size={20} />
                              ) : s.playerScore < s.aiScore ? (
                                <Bot size={20} />
                              ) : (
                                <Scale size={20} />
                              );

                              const resultColor =
                                s.playerScore > s.aiScore
                                  ? "text-[#2fd1cc]"
                                  : s.playerScore < s.aiScore
                                    ? "text-[#8636EE]"
                                    : "text-yellow-500";

                              const highlightClass =
                                idx === 0 && gameState === "completed"
                                  ? "bg-blue-50 border-l-4 border-blue-400"
                                  : "bg-white";

                              return (
                                <div
                                  key={idx}
                                  className={`flex justify-between items-center px-4 py-3 rounded-lg shadow-sm border border-gray-200 ${highlightClass}`}
                                >
                                  <span className={`font-semibold text-lg flex items-center gap-1 ${resultColor}`}>
                                    {resultIcon} {s.playerScore}-{s.aiScore}
                                  </span>
                                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                                    {s.difficulty}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {new Date(s.date).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {scoreboard.length > 0 && (
                          <button
                            className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#8636EE] to-[#2fd1cc] text-white font-bold text-base py-3 rounded-2xl shadow-lg tracking-wide transition-all duration-300 ease-in-out hover:scale-105 hover:brightness-110 active:scale-95 group"
                            onClick={() => {
                              if (confirm("Are you sure you want to clear all scores?")) {
                                setScoreboard([]);
                                saveScoreboard([]);
                              }
                            }}
                          >
                            <Trash2 size={18} className="group-hover:rotate-6 transition-transform duration-300" />
                            Clear All Scores
                          </button>

                        )}
                      </div>

                    </div>
                  </div>
                </div>

              )}
            {/* GAME OVER SCREEN */}
            {gameState === "completed"
              && resultModal
              && (
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
                    <div className="bg-[#ffffff] rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.125)] p-8 text-center min-w-[280px] max-w-[520px] w-full relative">
                      <button
                        className="absolute top-2 right-2 transition-colors duration-150"
                        onClick={() => {
                          document.body.classList.remove('overflow-hidden');
                          setResultModal(false);
                        }}
                      >
                        <X size={20} className="text-[#34238c] hover:text-gray-500" />
                      </button>
                      <h2
                        className={`mb-4 font-extrabold text-3xl md:text-4xl px-6 py-3 rounded-[12px] shadow-xl transition-all transform ${playerScore > aiScore
                            ? "bg-[#e0fdfb] text-[#2fd1cc] border-2 border-[#92f1ea]"
                            : playerScore < aiScore
                              ? "bg-[#f0e5ff] text-[#8636EE] border-2 border-[#c8a8f4]"
                              : "bg-[#e2e8fc] text-[#34238c] border-2 border-[#a5b4fc]"
                          }`}
                      >
                        {playerScore > aiScore ? (
                          <Trophy className="inline-block mr-3 text-[#2fd1cc]" size={28} />
                        ) : playerScore < aiScore ? (
                          <Bot className="inline-block mr-3 text-[#8636EE]" size={28} />
                        ) : (
                          <HandMetal className="inline-block mr-3 text-[#34238c]" size={28} />
                        )}
                        {playerScore > aiScore
                          ? "You Win!"
                          : playerScore < aiScore
                            ? "AI Wins!"
                            : "It's a Draw!"}
                      </h2>

                      <p
                        style={{
                          fontSize: "1.1rem",
                          color: "#34238c",
                          margin: "0 0 18px 0",
                          fontWeight: "500",
                        }}
                      >
                        Final Score:{" "}
                        <span style={{ color: "#2fd1cc", fontWeight: 700 }}>{playerScore}</span>
                        {" : "}
                        <span style={{ color: "#8636EE", fontWeight: 700 }}>{aiScore}</span>
                      </p>
                      <div className="flex justify-center gap-5">
                        <button
                          className="flex items-center gap-2 bg-gradient-to-r from-[#33bf7f] to-[#28a56b] text-white font-bold text-base px-6 py-2 rounded-2xl shadow-lg tracking-wide transition-all duration-300 ease-in-out hover:scale-105 hover:from-[#2fd1cc] hover:to-[#10b981] active:scale-95"
                          onClick={() => startGame(difficulty)}
                        >
                          <RefreshCcw size={18} />
                          Play Again
                        </button>

                        <button
                          className="flex items-center gap-2 bg-gradient-to-r from-[#2296f3] to-[#1a87d4] text-white font-bold text-base px-6 py-2 rounded-2xl shadow-lg tracking-wide transition-all duration-300 ease-in-out hover:scale-105 hover:from-[#a855f7] hover:to-[#4338ca] active:scale-95"
                          onClick={() => setGameState("setup")}
                        >
                          <Home size={18} />
                          Main Menu
                        </button>

                      </div>
                    </div>
                  </div>
                </>
              )}
          </>
        )}

        <footer className="w-full mt-auto text-center text-[0.99em] text-white mb-4">
          &copy; 2025 WordPlay
        </footer>
      </div>
    </div>
  );
}