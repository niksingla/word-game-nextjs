"use client"

import { useState, useEffect, useRef } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Word {
  word: string;
  found: boolean;
  foundBy: 'player' | 'ai' | null;
  positions?: { row: number; col: number }[];
}

interface GameState {
  board: string[][];
  words: Word[];
  playerScore: number;
  aiScore: number;
  difficulty: 'easy' | 'medium' | 'hard';
  gameOver: boolean;
  selected: { row: number; col: number }[];
  currentSelection: { row: number; col: number }[];
}

interface HistoricalScore {
  playerScore: number;
  aiScore: number;
  difficulty: 'easy' | 'medium' | 'hard';
  date: string;
  winner: 'player' | 'ai' | 'draw';
}

// Mock data for word lists
const wordLists = {
  easy: ['CAT', 'DOG', 'RAT', 'BIRD', 'FISH', 'LION', 'BEAR', 'WOLF', 'FOX', 'DEER'],
  medium: ['APPLE', 'BANANA', 'ORANGE', 'GRAPE', 'LEMON', 'PEACH', 'MANGO', 'KIWI', 'PLUM', 'MELON'],
  hard: ['ELEPHANT', 'GIRAFFE', 'LEOPARD', 'PANTHER', 'DOLPHIN', 'PENGUIN', 'ZEBRA', 'TIGER', 'GORILLA', 'JAGUAR'],
};

const WordSearchGame: NextPage = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [historicalScores, setHistoricalScores] = useState<HistoricalScore[]>([
    { playerScore: 15, aiScore: 10, difficulty: 'easy', date: '6/1/2023, 2:30 PM', winner: 'player' },
    { playerScore: 12, aiScore: 14, difficulty: 'medium', date: '6/1/2023, 3:15 PM', winner: 'ai' },
    { playerScore: 18, aiScore: 18, difficulty: 'hard', date: '6/1/2023, 4:00 PM', winner: 'draw' },
  ]);
  const [aiInterval, setAiInterval] = useState<NodeJS.Timeout | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [lastFoundWord, setLastFoundWord] = useState<{ word: string, foundBy: 'player' | 'ai' } | null>(null);
  
  // Refs for measuring element dimensions
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Generate the game board with given difficulty
  const generateGame = (difficulty: 'easy' | 'medium' | 'hard'): GameState => {
    const sizeMap = { easy: 8, medium: 10, hard: 12 };
    const wordCountMap = { easy: 5, medium: 7, hard: 9 };
    
    const size = sizeMap[difficulty];
    const wordCount = wordCountMap[difficulty];
    
    // Create an empty board
    const board = Array(size).fill(null).map(() => Array(size).fill(''));
    
    // Shuffle words and select a subset
    const availableWords = [...wordLists[difficulty]];
    const shuffledWords = availableWords.sort(() => 0.5 - Math.random()).slice(0, wordCount);
    
    // Place words on the board and track their positions
    const placedWords: Word[] = [];
    
    for (const word of shuffledWords) {
      const result = placeWordOnBoard(board, word);
      if (result.success && result.positions) {
        placedWords.push({ 
          word, 
          found: false, 
          foundBy: null,
          positions: result.positions
        });
      }
    }
    
    // Fill empty cells with random letters
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (board[i][j] === '') {
          board[i][j] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
        }
      }
    }
    
    return {
      board,
      words: placedWords,
      playerScore: 0,
      aiScore: 0,
      difficulty,
      gameOver: false,
      selected: [],
      currentSelection: [],
    };
  };
  
  // Place word on board and return positions
  const placeWordOnBoard = (board: string[][], word: string): { 
    success: boolean; 
    positions?: { row: number; col: number }[] 
  } => {
    const directions = [
      { row: 0, col: 1 }, // right
      { row: 1, col: 0 }, // down
      { row: 1, col: 1 }, // diagonal down-right
      { row: 1, col: -1 }, // diagonal down-left
      { row: 0, col: -1 }, // left
      { row: -1, col: 0 }, // up
      { row: -1, col: -1 }, // diagonal up-left
      { row: -1, col: 1 }, // diagonal up-right
    ];
    
    const size = board.length;
    
    // Try different directions and positions
    for (let attempt = 0; attempt < 100; attempt++) {
      const direction = directions[Math.floor(Math.random() * directions.length)];
      const startRow = Math.floor(Math.random() * size);
      const startCol = Math.floor(Math.random() * size);
      
      // Check if word fits in this direction
      let fits = true;
      const positions: { row: number; col: number }[] = [];
      
      for (let i = 0; i < word.length; i++) {
        const row = startRow + i * direction.row;
        const col = startCol + i * direction.col;
        
        if (row < 0 || row >= size || col < 0 || col >= size || 
            (board[row][col] !== '' && board[row][col] !== word[i])) {
          fits = false;
          break;
        }
        
        positions.push({ row, col });
      }
      
      if (fits) {
        // Place the word on the board
        for (let i = 0; i < word.length; i++) {
          const row = startRow + i * direction.row;
          const col = startCol + i * direction.col;
          board[row][col] = word[i];
        }
        
        return { success: true, positions };
      }
    }
    
    return { success: false };
  };
  
  // AI opponent making a move
  const aiMove = (state: GameState): GameState => {
    // Find words that haven't been found yet
    const unfoundWords = state.words.filter(word => !word.found);
    if (unfoundWords.length === 0) return state;
    
    // AI randomly selects a word to find
    const wordToFind = unfoundWords[Math.floor(Math.random() * unfoundWords.length)];
    
    // Update the word as found by AI
    const updatedWords = state.words.map(word => 
      word.word === wordToFind.word 
        ? { ...word, found: true, foundBy: 'ai' } 
        : word
    );
    
    // Calculate new score and check if game is over
    const newAiScore = state.aiScore + wordToFind.word.length;
    const gameOver = updatedWords.every(word => word.found);
    
    // Set animation for last found word
    setLastFoundWord({ word: wordToFind.word, foundBy: 'ai' });
    setTimeout(() => setLastFoundWord(null), 2000);
    
    // Return updated state
    return {
      ...state,
      // @ts-ignore
      words: updatedWords,
      aiScore: newAiScore,
      gameOver,
      selected: [...state.selected, ...(wordToFind.positions || [])],
    };
  };
  
  // Start a new game with specified difficulty
  const startNewGame = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (aiInterval) {
      clearInterval(aiInterval);
    }
    
    const newGame = generateGame(difficulty);
    setGameState(newGame);
    setGameStarted(true);
    setLastFoundWord(null);
    
    // Set up AI to find words at intervals based on difficulty
    const intervalMap = { easy: 10000, medium: 6000, hard: 3000 };
    
    const interval = setInterval(() => {
      setGameState(prevState => {
        if (!prevState || prevState.gameOver) return prevState;
        
        const updatedState = aiMove(prevState);
        
        // If game is over after AI move, save to history
        if (updatedState.gameOver) {
          clearInterval(interval);
          addToHistory(updatedState);
        }
        
        return updatedState;
      });
    }, intervalMap[difficulty]);
    
    setAiInterval(interval);
  };
  
  // Add completed game to history
  const addToHistory = (finalState: GameState) => {
    const { playerScore, aiScore, difficulty } = finalState;
    const winner = 
      playerScore > aiScore ? 'player' :
      aiScore > playerScore ? 'ai' : 'draw';
    
    const newScore: HistoricalScore = {
      playerScore,
      aiScore,
      difficulty,
      date: new Date().toLocaleString(),
      winner,
    };
    
    setHistoricalScores(prev => [newScore, ...prev].slice(0, 10)); // Keep last 10 scores
  };
  
  // Handle cell selection
  const handleCellClick = (row: number, col: number) => {
    if (!gameState || gameState.gameOver) return;
    
    setGameState(prevState => {
      if (!prevState) return null;
      
      const { currentSelection } = prevState;
      
      // If this is the first cell selected
      if (currentSelection.length === 0) {
        return {
          ...prevState,
          currentSelection: [{ row, col }],
        };
      }
      
      // If this is the second cell selected
      if (currentSelection.length === 1) {
        const start = currentSelection[0];
        const end = { row, col };
        
        // Check if selection is valid (straight line)
        const isHorizontal = start.row === end.row;
        const isVertical = start.col === end.col;
        const isDiagonal = Math.abs(start.row - end.row) === Math.abs(start.col - end.col);
        
        if (!isHorizontal && !isVertical && !isDiagonal) {
          return {
            ...prevState,
            currentSelection: [{ row, col }], // Start a new selection
          };
        }
        
        // Get the selected word
        let word = '';
        let selection: { row: number; col: number }[] = [];
        
        if (isHorizontal) {
          const r = start.row;
          const startCol = Math.min(start.col, end.col);
          const endCol = Math.max(start.col, end.col);
          
          for (let c = startCol; c <= endCol; c++) {
            word += prevState.board[r][c];
            selection.push({ row: r, col: c });
          }
        } else if (isVertical) {
          const c = start.col;
          const startRow = Math.min(start.row, end.row);
          const endRow = Math.max(start.row, end.row);
          
          for (let r = startRow; r <= endRow; r++) {
            word += prevState.board[r][c];
            selection.push({ row: r, col: c });
          }
        } else if (isDiagonal) {
          const rowDir = end.row > start.row ? 1 : -1;
          const colDir = end.col > start.col ? 1 : -1;
          const steps = Math.abs(end.row - start.row);
          
          for (let i = 0; i <= steps; i++) {
            const r = start.row + i * rowDir;
            const c = start.col + i * colDir;
            word += prevState.board[r][c];
            selection.push({ row: r, col: c });
          }
        }
        
        // Check if the selected word is in the list
        const foundWordIndex = prevState.words.findIndex(
          w => w.word === word && !w.found
        );
        
        // If word is found, update the game state
        if (foundWordIndex !== -1) {
          const updatedWords = [...prevState.words];
          updatedWords[foundWordIndex] = {
            ...updatedWords[foundWordIndex],
            found: true,
            foundBy: 'player',
          };
          
          const newPlayerScore = prevState.playerScore + word.length;
          const gameOver = updatedWords.every(w => w.found);
          
          // Show animation for found word
          setLastFoundWord({ word, foundBy: 'player' });
          setTimeout(() => setLastFoundWord(null), 2000);
          
          // If game is over, add to history and clear interval
          if (gameOver && aiInterval) {
            clearInterval(aiInterval);
            setAiInterval(null);
            
            setTimeout(() => {
              addToHistory({
                ...prevState,
                words: updatedWords,
                playerScore: newPlayerScore,
                selected: [...prevState.selected, ...selection],
                currentSelection: [],
                gameOver,
              });
            }, 0);
          }
          
          return {
            ...prevState,
            words: updatedWords,
            playerScore: newPlayerScore,
            selected: [...prevState.selected, ...selection],
            currentSelection: [],
            gameOver,
          };
        }
        
        // If word is not found, clear the current selection
        return {
          ...prevState,
          currentSelection: [],
        };
      }
      
      return prevState;
    });
  };
  
  // Initialize the game state when component mounts
  useEffect(() => {
    if (!gameState) {
      setGameState(generateGame('easy'));
    }
    
    return () => {
      if (aiInterval) {
        clearInterval(aiInterval);
      }
    };
  }, []);
  
  if (!gameState) return <div>Loading...</div>;
  
  return (
    <div className="game-container">
      <Head>
        <title>Word Search Game</title>
        <meta name="description" content="Word Search Game with AI Opponent" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <header>
        <h1>Word Search Challenge</h1>
        <p>Find words before the AI does!</p>
      </header>
      
      <div className="difficulty-controls">
        <motion.button 
          className={gameState.difficulty === 'easy' ? 'active' : ''}
          onClick={() => startNewGame('easy')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Easy
        </motion.button>
        <motion.button 
          className={gameState.difficulty === 'medium' ? 'active' : ''}
          onClick={() => startNewGame('medium')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Medium
        </motion.button>
        <motion.button 
          className={gameState.difficulty === 'hard' ? 'active' : ''}
          onClick={() => startNewGame('hard')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Hard
        </motion.button>
      </div>
      
      <div className="game-info">
        <div className="scores">
          <div className="score player">
            <span>Your Score</span>
            <motion.div
              key={gameState.playerScore}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.3 }}
            >
              {gameState.playerScore}
            </motion.div>
          </div>
          <div className="score ai">
            <span>AI Score</span>
            <motion.div
              key={gameState.aiScore}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.3 }}
            >
              {gameState.aiScore}
            </motion.div>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {lastFoundWord && (
          <motion.div 
            className={`word-notification ${lastFoundWord.foundBy}`}
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.5 }}
          >
            <span>{lastFoundWord.foundBy === 'player' ? 'You' : 'AI'} found:</span> 
            <strong>{lastFoundWord.word}</strong>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="game-content">
        <div className="board-container">
          <div className="board" ref={boardRef}>
            {gameState.board.map((row, rowIndex) => (
              <div key={rowIndex} className="row">
                {row.map((cell, colIndex) => {
                  const isSelected = gameState.selected.some(
                    pos => pos.row === rowIndex && pos.col === colIndex
                  );
                  const isCurrentlySelected = gameState.currentSelection.some(
                    pos => pos.row === rowIndex && pos.col === colIndex
                  );
                  
                  return (
                    <motion.div
                      key={`${rowIndex}-${colIndex}`}
                      className={`cell ${isSelected ? 'selected' : ''} ${isCurrentlySelected ? 'current-selection' : ''}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1,
                        backgroundColor: isSelected ? '#4caf50' : '#fff',
                        color: isSelected ? '#fff' : '#000',
                      }}
                      transition={{ 
                        delay: (rowIndex * gameState.board.length + colIndex) * 0.01,
                        duration: 0.2
                      }}
                    >
                      {cell}
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
          
          <div className="word-list">
            <h3>Words to Find:</h3>
            <div className="words">
              {gameState.words.map((word, index) => (
                <motion.div
                  key={index}
                  className={`word ${word.found ? 'found ' + word.foundBy : ''}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    backgroundColor: word.found 
                      ? word.foundBy === 'player' ? '#e8f5e9' : '#ffebee' 
                      : '#f5f5f5'
                  }}
                  transition={{ delay: index * 0.1 }}
                >
                  {word.word}
                  {word.found && (
                    <motion.span
                      className="found-by"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      {word.foundBy === 'player' ? '(You)' : '(AI)'}
                    </motion.span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="scoreboard">
          <h3>Game History</h3>
          <div className="history-list">
            {historicalScores.map((score, index) => (
              <motion.div 
                key={index}
                className={`history-item ${score.winner}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="history-header">
                  <span className="difficulty">{score.difficulty.toUpperCase()}</span>
                  <span className="date">{score.date}</span>
                </div>
                <div className="history-score">
                  <span className="player">You: {score.playerScore}</span>
                  <span className="ai">AI: {score.aiScore}</span>
                </div>
                <div className="history-result">
                  {score.winner === 'player' ? '🏆 You won!' : 
                   score.winner === 'ai' ? '🤖 AI won!' : '🤝 Draw!'}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      
      {gameState.gameOver && (
        <motion.div 
          className="game-over"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <h2>Game Over!</h2>
          <p className="result">
            {gameState.playerScore > gameState.aiScore 
              ? '🎉 You Won!' 
              : gameState.aiScore > gameState.playerScore 
                ? '🤖 AI Won!' 
                : "🤝 It's a Draw!"}
          </p>
          <div className="final-score">
            <span>You: {gameState.playerScore}</span>
            <span>AI: {gameState.aiScore}</span>
          </div>
          <motion.button 
            onClick={() => startNewGame(gameState.difficulty)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="play-again"
          >
            Play Again
          </motion.button>
        </motion.div>
      )}
      
      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          color: #333;
          min-height: 100vh;
        }
        
        .game-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          position: relative;
        }
        
        header {
          text-align: center;
          margin-bottom: 20px;
        }
        
        h1 {
          color: #2c3e50;
          margin-bottom: 5px;
        }
        
        header p {
          color: #7f8c8d;
        }
        
        .difficulty-controls {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 20px;
        }
        
        button {
          background: #3498db;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.3s;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        button:hover {
          background: #2980b9;
        }
        
        button.active {
          background: #2c3e50;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        
        .game-info {
          margin-bottom: 20px;
        }
        
        .scores {
          display: flex;
          justify-content: center;
          gap: 40px;
        }
        
        .score {
          background: white;
          padding: 15px 25px;
          border-radius: 10px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          min-width: 120px;
        }
        
        .score span {
          display: block;
          font-size: 14px;
          margin-bottom: 5px;
          color: #7f8c8d;
        }
        
        .score div {
          font-size: 24px;
          font-weight: bold;
        }
        
        .score.player div {
          color: #27ae60;
        }
        
        .score.ai div {
          color: #e74c3c;
        }
        
        .game-content {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .board-container {
          flex: 1;
          min-width: 320px;
        }
        
        .board {
          background: white;
          border-radius: 10px;
          padding: 15px;
          box-shadow: 0 6px 15px rgba(0,0,0,0.1);
          margin-bottom: 20px;
          display: grid;
          grid-gap: 2px;
        }
        
        .row {
          display: flex;
        }
        
        .cell {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          cursor: pointer;
          border-radius: 5px;
          user-select: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .cell.selected {
          background-color: #4caf50;
          color: white;
        }
        
        .cell.current-selection {
          background-color: #3498db;
          color: white;
        }
        
        .word-list {
          background: white;
          border-radius: 10px;
          padding: 15px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .word-list h3 {
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .words {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .word {
          background: #f5f5f5;
          padding: 8px 12px;
          border-radius: 15px;
          font-size: 14px;
          position: relative;
          transition: all 0.3s;
        }
        
        .word.found {
          text-decoration: line-through;
        }
        
        .word.found.player {
          color: #27ae60;
          background-color: #e8f5e9;
        }
        
        .word.found.ai {
          color: #e74c3c;
          background-color: #ffebee;
        }
        
        .found-by {
          font-size: 12px;
          margin-left: 5px;
          opacity: 0.8;
        }
        
        .scoreboard {
          width: 320px;
        }
        
        .scoreboard h3 {
          margin-bottom: 15px;
          color: #2c3e50;
        }
        
        .history-list {
          max-height: 400px;
          overflow-y: auto;
          background: white;
          border-radius: 10px;
          padding: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .history-item {
          background: #f9f9f9;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .history-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        
        .difficulty {
          font-weight: bold;
          color: #3498db;
        }
        
        .date {
          font-size: 12px;
          color: #95a5a6;
        }
        
        .history-score {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        
        .history-score .player {
          color: #27ae60;
        }
        
        .history-score .ai {
          color: #e74c3c;
        }
        
        .history-result {
          text-align: center;
          font-weight: bold;
        }
        
        .history-item.player .history-result {
          color: #27ae60;
        }
        
        .history-item.ai .history-result {
          color: #e74c3c;
        }
        
        .history-item.draw .history-result {
          color: #f39c12;
        }
        
        .word-notification {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 10px 20px;
          border-radius: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          z-index: 100;
        }
        
        .word-notification.player {
          background: #e8f5e9;
          color: #27ae60;
          border-left: 4px solid #27ae60;
        }
        
        .word-notification.ai {
          background: #ffebee;
          color: #e74c3c;
          border-left: 4px solid #e74c3c;
        }
        
        .word-notification strong {
          margin-left: 5px;
        }
        
        .game-over {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(44, 62, 80, 0.95);
          color: white;
          padding: 30px;
          border-radius: 15px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          z-index: 100;
          min-width: 300px;
        }
        
        .game-over h2 {
          margin-bottom: 15px;
        }
        
        .game-over .result {
          font-size: 24px;
          margin-bottom: 20px;
          font-weight: bold;
        }
        
        .final-score {
          display: flex;
          justify-content: space-around;
          margin-bottom: 25px;
          font-size: 18px;
        }
        
        .play-again {
          background: #27ae60;
          font-size: 18px;
          padding: 12px 25px;
        }
        
        .play-again:hover {
          background: #219653;
        }
        
        @media (max-width: 768px) {
          .game-content {
            flex-direction: column;
          }
          
          .scoreboard {
            width: 100%;
          }
          
          .cell {
            width: 35px;
            height: 35px;
            font-size: 14px;
          }
          
          .difficulty-controls {
            flex-direction: column;
            align-items: center;
          }
          
          button {
            width: 200px;
          }
        }
      `}</style>
    </div>
  );
};

export default WordSearchGame;