"use client"

import React, { useState, useEffect, useRef } from 'react';

// Types
type Difficulty = 'Easy' | 'Medium' | 'Hard';

interface Cell {
  row: number;
  col: number;
  letter: string;
  selected: boolean;
  highlighted: boolean;
  wordIndex?: number;
}

interface Word {
  word: string;
  found: boolean;
  foundBy: 'player' | 'ai' | null;
  cells: { row: number; col: number }[];
}

interface Game {
  grid: Cell[][];
  words: Word[];
  difficulty: Difficulty;
  playerScore: number;
  aiScore: number;
  gameOver: boolean;
  startTime: number;
  endTime: number | null;
}

interface ScoreRecord {
  id: number;
  date: string;
  playerScore: number;
  aiScore: number;
  difficulty: Difficulty;
  duration: number;
}

// Mock data
const mockScores: ScoreRecord[] = [
  { id: 1, date: '2023-10-15', playerScore: 8, aiScore: 4, difficulty: 'Easy', duration: 120 },
  { id: 2, date: '2023-10-16', playerScore: 6, aiScore: 6, difficulty: 'Medium', duration: 180 },
  { id: 3, date: '2023-10-17', playerScore: 5, aiScore: 7, difficulty: 'Hard', duration: 240 },
  { id: 4, date: '2023-10-18', playerScore: 10, aiScore: 2, difficulty: 'Easy', duration: 100 },
  { id: 5, date: '2023-10-19', playerScore: 7, aiScore: 5, difficulty: 'Medium', duration: 160 },
];

// Mock word search grids with corresponding words
const mockGames = {
  Easy: {
    grid: [
      ['C', 'A', 'T', 'D', 'O', 'G', 'H', 'I', 'J', 'K'],
      ['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'],
      ['W', 'Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
      ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'],
      ['R', 'A', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'A'],
      ['B', 'C', 'D', 'E', 'F', 'I', 'S', 'H', 'I', 'J'],
      ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
      ['U', 'V', 'W', 'X', 'Y', 'Z', 'A', 'B', 'C', 'D'],
      ['E', 'F', 'O', 'X', 'L', 'M', 'N', 'O', 'P', 'Q'],
      ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'A'],
    ],
    words: [
      { word: 'CAT', found: false, foundBy: null, cells: [{row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2}] },
      { word: 'DOG', found: false, foundBy: null, cells: [{row: 0, col: 3}, {row: 0, col: 4}, {row: 0, col: 5}] },
      { word: 'RAT', found: false, foundBy: null, cells: [{row: 4, col: 0}, {row: 4, col: 1}, {row: 4, col: 2}] },
      { word: 'FISH', found: false, foundBy: null, cells: [{row: 5, col: 5}, {row: 5, col: 6}, {row: 5, col: 7}, {row: 5, col: 8}] },
      { word: 'FOX', found: false, foundBy: null, cells: [{row: 8, col: 2}, {row: 8, col: 3}, {row: 8, col: 4}] },
      { word: 'COW', found: false, foundBy: null, cells: [{row: 0, col: 0}, {row: 1, col: 0}, {row: 2, col: 0}] },
    ],
  },
  Medium: {
    grid: [
      ['P', 'Y', 'T', 'H', 'O', 'N', 'X', 'A', 'B', 'C'],
      ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
      ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'],
      ['X', 'Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
      ['H', 'I', 'J', 'A', 'V', 'A', 'K', 'L', 'M', 'N'],
      ['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'],
      ['Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
      ['S', 'W', 'I', 'F', 'T', 'U', 'V', 'W', 'X', 'Y'],
      ['Z', 'A', 'B', 'C', 'D', 'E', 'R', 'U', 'B', 'Y'],
    ],
    words: [
      { word: 'PYTHON', found: false, foundBy: null, cells: [{row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2}, {row: 0, col: 3}, {row: 0, col: 4}, {row: 0, col: 5}] },
      { word: 'JAVA', found: false, foundBy: null, cells: [{row: 4, col: 3}, {row: 4, col: 4}, {row: 4, col: 5}, {row: 4, col: 6}] },
      { word: 'SWIFT', found: false, foundBy: null, cells: [{row: 8, col: 0}, {row: 8, col: 1}, {row: 8, col: 2}, {row: 8, col: 3}, {row: 8, col: 4}] },
      { word: 'RUBY', found: false, foundBy: null, cells: [{row: 9, col: 6}, {row: 9, col: 7}, {row: 9, col: 8}, {row: 9, col: 9}] },
    ],
  },
  Hard: {
    grid: [
      ['J', 'A', 'V', 'A', 'S', 'C', 'R', 'I', 'P', 'T'],
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Z'],
      ['X', 'C', 'V', 'B', 'N', 'M', 'Q', 'W', 'E', 'R'],
      ['T', 'Y', 'U', 'I', 'O', 'P', 'A', 'S', 'D', 'F'],
      ['G', 'H', 'J', 'K', 'L', 'Z', 'X', 'C', 'V', 'B'],
      ['N', 'M', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I'],
      ['O', 'P', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K'],
      ['L', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Q', 'W'],
      ['G', 'O', 'L', 'A', 'N', 'G', 'R', 'E', 'A', 'C'],
    ],
    words: [
      { word: 'JAVASCRIPT', found: false, foundBy: null, cells: [{row: 0, col: 0}, {row: 0, col: 1}, {row: 0, col: 2}, {row: 0, col: 3}, {row: 0, col: 4}, {row: 0, col: 5}, {row: 0, col: 6}, {row: 0, col: 7}, {row: 0, col: 8}, {row: 0, col: 9}] },
      { word: 'GOLANG', found: false, foundBy: null, cells: [{row: 9, col: 0}, {row: 9, col: 1}, {row: 9, col: 2}, {row: 9, col: 3}, {row: 9, col: 4}, {row: 9, col: 5}] },
      { word: 'REACT', found: false, foundBy: null, cells: [{row: 9, col: 6}, {row: 9, col: 7}, {row: 9, col: 8}, {row: 9, col: 9}, {row: 8, col: 9}] },
    ],
  },
};

// AI difficulty settings
const aiSettings = {
  Easy: { minDelay: 15000, maxDelay: 25000 }, // 15-25 seconds
  Medium: { minDelay: 8000, maxDelay: 15000 }, // 8-15 seconds
  Hard: { minDelay: 3000, maxDelay: 8000 }, // 3-8 seconds
};

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '24px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
  },
  gameContainer: {
    maxWidth: '1000px',
    margin: '0 auto',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 24px',
    backgroundColor: '#4f46e5',
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: 0,
  },
  navContainer: {
    display: 'flex',
    gap: '8px',
  },
  navButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  navButtonActive: {
    backgroundColor: 'white',
    color: '#4f46e5',
  },
  navButtonInactive: {
    backgroundColor: '#4338ca',
    color: 'white',
  },
  contentArea: {
    padding: '24px',
  },
  difficultyContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  difficultyOptions: {
    display: 'flex',
    gap: '8px',
  },
  difficultyButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  startButton: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  startButtonDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed',
  },
  message: {
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    borderRadius: '4px',
    animation: 'pulse 2s infinite',
  },
  gameInfoBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  infoText: {
    fontSize: '16px',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 32px)',
    gap: '4px',
    backgroundColor: '#f3f4f6',
    padding: '8px',
    borderRadius: '8px',
    justifyContent: 'center',
  },
  cell: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: 'white',
  },
  selectedCell: {
    backgroundColor: '#fbbf24',
    color: 'white',
    transform: 'scale(1.05)',
  },
  playerFoundCell: {
    backgroundColor: '#10b981',
    color: 'white',
    animation: 'bounce 0.5s',
  },
  aiFoundCell: {
    backgroundColor: '#ef4444',
    color: 'white',
    animation: 'pulse 1s',
  },
  scoreSection: {
    marginTop: '24px',
  },
  scoreHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  progressBar: {
    height: '16px',
    width: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: '9999px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  playerProgress: {
    height: '100%',
    backgroundColor: '#10b981',
    transition: 'width 0.5s ease-out',
  },
  aiProgress: {
    height: '100%',
    backgroundColor: '#ef4444',
    transition: 'width 0.5s ease-out',
  },
  gameLayout: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  wordListContainer: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
  },
  wordListTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  wordList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  wordItem: {
    fontSize: '16px',
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: 'white',
    transition: 'all 0.2s ease',
  },
  playerFoundWord: {
    textDecoration: 'line-through',
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  aiFoundWord: {
    textDecoration: 'line-through',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  foundBy: {
    fontSize: '12px',
    marginLeft: '4px',
  },
  scoreboardTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    textAlign: 'left' as const,
    padding: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
  },
  tableCell: {
    padding: '12px',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap' as const,
  },
  resultBadge: {
    padding: '4px 8px',
    borderRadius: '9999px',
    fontSize: '12px',
    display: 'inline-block',
  },
  winBadge: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  lossBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  tieBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  placeholderContainer: {
    height: '300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  placeholderText: {
    fontSize: '18px',
    color: '#6b7280',
  },
  footer: {
    padding: '16px 24px',
    backgroundColor: '#f9fafb',
    textAlign: 'center' as const,
    color: '#6b7280',
  },
  '@keyframes bounce': {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-5px)' },
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.7 },
  },
};

const WordSearchGame: React.FC = () => {
  const [view, setView] = useState<'game' | 'score'>('game');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('Easy');
  const [scores, setScores] = useState<ScoreRecord[]>(mockScores);
  const [game, setGame] = useState<Game | null>(null);
  const [selectedCells, setSelectedCells] = useState<Cell[]>([]);
  const [aiTimers, setAiTimers] = useState<NodeJS.Timeout[]>([]);
  const [aiThinking, setAiThinking] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Add keyframe animations to document
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Initialize a new game
  const startNewGame = (difficulty: Difficulty) => {
    const mockGame = mockGames[difficulty];
    
    // Create a deep copy of the mock game to avoid modifying the original
    const grid: Cell[][] = mockGame.grid.map((row, rowIndex) => 
      row.map((letter, colIndex) => ({
        row: rowIndex,
        col: colIndex,
        letter,
        selected: false,
        highlighted: false,
      }))
    );
    
    const words = JSON.parse(JSON.stringify(mockGame.words));
    
    const newGame: Game = {
      grid,
      words,
      difficulty,
      playerScore: 0,
      aiScore: 0,
      gameOver: false,
      startTime: Date.now(),
      endTime: null,
    };
    
    setGame(newGame);
    setSelectedCells([]);
    setGameStarted(true);
    setElapsedTime(0);
    setMessage('Game started! Find the words before the AI does!');
    
    // Clear any existing AI timers
    aiTimers.forEach(timer => clearTimeout(timer));
    setAiTimers([]);
    
    // Start AI word finding based on difficulty
    const newTimers = words.map((word: string, index: number) => {
      const settings = aiSettings[difficulty];
      const delay = Math.floor(Math.random() * (settings.maxDelay - settings.minDelay + 1)) + settings.minDelay;
      
      return setTimeout(() => {
        aiFoundWord(index);
      }, delay);
    });
    
    setAiTimers(newTimers);
    
    // Start game timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };
  
  // Handle AI finding a word
  const aiFoundWord = (wordIndex: number) => {
    if (!game || game.gameOver) return;
    
    setAiThinking(true);
    
    setTimeout(() => {
      setGame(prevGame => {
        if (!prevGame) return null;
        
        // Check if the word is already found
        if (prevGame.words[wordIndex].found) {
          return prevGame;
        }
        
        const updatedWords = [...prevGame.words];
        updatedWords[wordIndex].found = true;
        updatedWords[wordIndex].foundBy = 'ai';
        
        // Update grid to highlight AI found word
        const updatedGrid = [...prevGame.grid];
        const wordCells = updatedWords[wordIndex].cells;
        
        wordCells.forEach(cell => {
          updatedGrid[cell.row][cell.col] = {
            ...updatedGrid[cell.row][cell.col],
            highlighted: true,
            wordIndex,
          };
        });
        
        const newAiScore = prevGame.aiScore + 1;
        const allWordsFound = updatedWords.every(word => word.found);
        
        setMessage(`AI found the word: ${updatedWords[wordIndex].word}!`);
        
        return {
          ...prevGame,
          grid: updatedGrid,
          words: updatedWords,
          aiScore: newAiScore,
          gameOver: allWordsFound,
          endTime: allWordsFound ? Date.now() : null,
        };
      });
      
      setAiThinking(false);
      
      // Check if game is over after AI move
      const updatedGame = game;
      if (updatedGame && updatedGame.words.every(word => word.found)) {
        endGame();
      }
    }, 1000); // AI "thinking" animation duration
  };
  
  // End the game and save score
  const endGame = () => {
    if (!game) return;
    
    setGameStarted(false);
    
    // Clear timers
    aiTimers.forEach(timer => clearTimeout(timer));
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - game.startTime) / 1000);
    
    // Create new score record
    const newScore: ScoreRecord = {
      id: scores.length + 1,
      date: new Date().toISOString().split('T')[0],
      playerScore: game.playerScore,
      aiScore: game.aiScore,
      difficulty: game.difficulty,
      duration,
    };
    
    // Add to scores
    setScores([...scores, newScore]);
    
    if (game.playerScore > game.aiScore) {
      setMessage(`Game Over! You won with ${game.playerScore} points in ${formatTime(duration)}!`);
    } else if (game.playerScore < game.aiScore) {
      setMessage(`Game Over! AI won with ${game.aiScore} points in ${formatTime(duration)}!`);
    } else {
      setMessage(`Game Over! It's a tie with ${game.playerScore} points each in ${formatTime(duration)}!`);
    }
    
    // Update game state
    setGame({
      ...game,
      gameOver: true,
      endTime,
    });
  };
  
  // Handle cell selection
  const handleCellClick = (row: number, col: number) => {
    if (!game || game.gameOver) return;
    
    const clickedCell = game.grid[row][col];
    
    // If the cell is already highlighted as part of a found word, do nothing
    if (clickedCell.highlighted) return;
    
    // If no cells are selected yet or if the clicked cell is adjacent to the last selected cell
    if (selectedCells.length === 0 || isAdjacent(selectedCells[selectedCells.length - 1], clickedCell)) {
      // Check if the cell is already selected
      const alreadySelectedIndex = selectedCells.findIndex(cell => cell.row === row && cell.col === col);
      
      if (alreadySelectedIndex !== -1) {
        // If clicking the second-last cell, deselect the last cell
        if (alreadySelectedIndex === selectedCells.length - 2) {
          setSelectedCells(selectedCells.slice(0, selectedCells.length - 1));
        } else {
          // If clicking any other previously selected cell, truncate the selection
          setSelectedCells(selectedCells.slice(0, alreadySelectedIndex + 1));
        }
      } else {
        // Add the new cell to the selection
        const updatedSelectedCells = [...selectedCells, clickedCell];
        setSelectedCells(updatedSelectedCells);
        
        // Check if the current selection forms a word
        checkForWord(updatedSelectedCells);
      }
    }
  };
  
  // Check if the current selection forms a word
  const checkForWord = (cells: Cell[]) => {
    if (!game) return;
    
    const selectedWord = cells.map(cell => cell.letter).join('');
    
    // Check if this word exists in our list and is not found yet
    const wordIndex = game.words.findIndex(
      wordObj => !wordObj.found && 
      (wordObj.word === selectedWord || wordObj.word.split('').reverse().join('') === selectedWord)
    );
    
    if (wordIndex !== -1) {
      // Word found!
      const updatedGame = { ...game };
      updatedGame.words[wordIndex].found = true;
      updatedGame.words[wordIndex].foundBy = 'player';
      updatedGame.playerScore += 1;
      
      // Highlight the cells in the grid
      const newGrid = [...updatedGame.grid];
      cells.forEach(cell => {
        newGrid[cell.row][cell.col] = {
          ...newGrid[cell.row][cell.col],
          highlighted: true,
          wordIndex,
        };
      });
      
      updatedGame.grid = newGrid;
      
      setMessage(`You found the word: ${updatedGame.words[wordIndex].word}!`);
      
      // Check if all words are found
      const allWordsFound = updatedGame.words.every(word => word.found);
      if (allWordsFound) {
        updatedGame.gameOver = true;
        updatedGame.endTime = Date.now();
        endGame();
      }
      
      setGame(updatedGame);
      setSelectedCells([]);
    }
  };
  
  // Check if two cells are adjacent (including diagonals)
  const isAdjacent = (cell1: Cell, cell2: Cell) => {
    const rowDiff = Math.abs(cell1.row - cell2.row);
    const colDiff = Math.abs(cell1.col - cell2.col);
    return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
  };
  
  // Format time from seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate progress for both player and AI
  const calculateProgress = () => {
    if (!game) return { player: 0, ai: 0 };
    
    const totalWords = game.words.length;
    if (totalWords === 0) return { player: 0, ai: 0 };
    
    const playerWords = game.words.filter(word => word.foundBy === 'player').length;
    const aiWords = game.words.filter(word => word.foundBy === 'ai').length;
    
    return {
      player: (playerWords / totalWords) * 100,
      ai: (aiWords / totalWords) * 100,
    };
  };
  
  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      aiTimers.forEach(timer => clearTimeout(timer));
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [aiTimers]);
  
  const progress = calculateProgress();
  
  return (
    <div style={styles.container}>
      <div style={styles.gameContainer}>
        <div style={styles.header}>
          <h1 style={styles.title}>Word Search Challenge</h1>
          <div style={styles.navContainer}>
            <button
              onClick={() => setView('game')}
              style={{
                ...styles.navButton,
                ...(view === 'game' ? styles.navButtonActive : styles.navButtonInactive)
              }}
            >
              Game
            </button>
            <button
              onClick={() => setView('score')}
              style={{
                ...styles.navButton,
                ...(view === 'score' ? styles.navButtonActive : styles.navButtonInactive)
              }}
            >
              Scores
            </button>
          </div>
        </div>
        
        {view === 'game' ? (
          <div style={styles.contentArea}>
            <div style={styles.difficultyContainer}>
              <div style={styles.difficultyOptions}>
                {['Easy', 'Medium', 'Hard'].map((difficulty) => (
                  <button
                    key={difficulty}
                    onClick={() => setSelectedDifficulty(difficulty as Difficulty)}
                    style={{
                      ...styles.difficultyButton,
                      backgroundColor: selectedDifficulty === difficulty ? '#4f46e5' : '#e5e7eb',
                      color: selectedDifficulty === difficulty ? 'white' : '#1f2937',
                    }}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => startNewGame(selectedDifficulty)}
                style={{
                  ...styles.startButton,
                  ...(gameStarted ? styles.startButtonDisabled : {})
                }}
                disabled={gameStarted}
              >
                {gameStarted ? 'Game in progress' : 'Start New Game'}
              </button>
            </div>
            
            {message && (
              <div style={styles.message}>
                {message}
              </div>
            )}
            
            {game ? (
              <div style={styles.gameLayout}>
                <div>
                  <div style={styles.gameInfoBar}>
                    <div style={styles.infoText}>
                      <span style={{fontWeight: 'bold'}}>Time:</span> {formatTime(elapsedTime)}
                    </div>
                    <div style={styles.infoText}>
                      <span style={{fontWeight: 'bold'}}>Difficulty:</span> {game.difficulty}
                    </div>
                  </div>
                  
                  <div style={styles.gridContainer}>
                    {game.grid.map((row, rowIndex) => (
                      <React.Fragment key={`row-${rowIndex}`}>
                        {row.map((cell, colIndex) => {
                          const isSelected = selectedCells.some(
                            selectedCell => selectedCell.row === rowIndex && selectedCell.col === colIndex
                          );
                          
                          let cellStyle = { ...styles.cell };
                          if (isSelected) {
                            cellStyle = { ...cellStyle, ...styles.selectedCell };
                          } else if (cell.highlighted) {
                            if (cell.wordIndex !== undefined && game.words[cell.wordIndex].foundBy === 'player') {
                              cellStyle = { ...cellStyle, ...styles.playerFoundCell };
                            } else {
                              cellStyle = { ...cellStyle, ...styles.aiFoundCell };
                            }
                          }
                          
                          return (
                            <div
                              key={`cell-${rowIndex}-${colIndex}`}
                              onClick={() => handleCellClick(rowIndex, colIndex)}
                              style={cellStyle}
                            >
                              {cell.letter}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                  
                  <div style={styles.scoreSection}>
                    <div style={styles.scoreHeader}>
                      <div>
                        You: {game.playerScore} points
                      </div>
                      <div>
                        AI: {game.aiScore} points
                        {aiThinking && (
                          <span style={{ marginLeft: '8px', display: 'inline-block', animation: 'bounce 0.5s infinite' }}>🤔</span>
                        )}
                      </div>
                    </div>
                    
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.playerProgress,
                          width: `${progress.player}%`
                        }}
                      ></div>
                    </div>
                    
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.aiProgress,
                          width: `${progress.ai}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div style={styles.wordListContainer}>
                  <h2 style={styles.wordListTitle}>Words to Find:</h2>
                  <ul style={styles.wordList}>
                    {game.words.map((word, index) => {
                      let wordItemStyle = { ...styles.wordItem };
                      if (word.found) {
                        if (word.foundBy === 'player') {
                          wordItemStyle = { ...wordItemStyle, ...styles.playerFoundWord };
                        } else {
                          wordItemStyle = { ...wordItemStyle, ...styles.aiFoundWord };
                        }
                      }
                      
                      return (
                        <li key={index} style={wordItemStyle}>
                          {word.word}
                          {word.found && (
                            <span style={styles.foundBy}>
                              ({word.foundBy === 'player' ? 'You' : 'AI'})
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={styles.placeholderContainer}>
                <p style={styles.placeholderText}>
                  Select a difficulty level and press "Start New Game" to begin!
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.contentArea}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Score History</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.scoreboardTable}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Date</th>
                    <th style={styles.tableHeader}>Player Score</th>
                    <th style={styles.tableHeader}>AI Score</th>
                    <th style={styles.tableHeader}>Difficulty</th>
                    <th style={styles.tableHeader}>Duration</th>
                    <th style={styles.tableHeader}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score) => (
                    <tr key={score.id} style={{ transition: 'background-color 0.2s' }}>
                      <td style={styles.tableCell}>{score.date}</td>
                      <td style={styles.tableCell}>{score.playerScore}</td>
                      <td style={styles.tableCell}>{score.aiScore}</td>
                      <td style={styles.tableCell}>{score.difficulty}</td>
                      <td style={styles.tableCell}>{formatTime(score.duration)}</td>
                      <td style={styles.tableCell}>
                        <span style={{
                          ...styles.resultBadge,
                          ...(score.playerScore > score.aiScore 
                            ? styles.winBadge
                            : score.playerScore < score.aiScore
                              ? styles.lossBadge
                              : styles.tieBadge)
                        }}>
                          {score.playerScore > score.aiScore 
                            ? 'Win' 
                            : score.playerScore < score.aiScore 
                              ? 'Loss' 
                              : 'Tie'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <div style={styles.footer}>
          <p>Challenge yourself with this Word Search Game against an AI opponent!</p>
        </div>
      </div>
    </div>
  );
};

export default WordSearchGame;