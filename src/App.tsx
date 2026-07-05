/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Trophy, 
  Gamepad2, 
  RefreshCw, 
  HelpCircle,
  Activity,
  Music,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Zap,
  Radio,
  Clock
} from 'lucide-react';
import { audioEngine, TRACKS, Track } from './utils/audioEngine';

// Represent 2D coordinates for the 20x20 Snake Game
interface Position {
  x: number;
  y: number;
}

type GameState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export default function App() {
  // --- SNAKE GAME STATE ---
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);
  const [direction, setDirection] = useState<Position>({ x: 0, y: -1 }); // Default UP
  const [lastDirection, setLastDirection] = useState<Position>({ x: 0, y: -1 });
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('synth-snake-highscore');
    return saved ? parseInt(saved, 10) : 1200; // Retro standard baseline
  });
  const [level, setLevel] = useState<number>(1);
  const [gameState, setGameState] = useState<GameState>('IDLE');
  
  // --- MUSIC ENGINE INTEGRATION STATE ---
  const [currentTrack, setCurrentTrack] = useState<Track>(audioEngine.getCurrentTrack());
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.4);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [prevVolume, setPrevVolume] = useState<number>(0.4);
  const [audioEngineUnlocked, setAudioEngineUnlocked] = useState<boolean>(false);

  // Keyboard active key indicator state (for W A S D / Arrow visual response)
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});

  // Help Modal state
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // --- SNAKE MOVEMENT ENGINE ---
  const spawnNewFood = (currentSnake: Position[]) => {
    let newFood: Position;
    let attempts = 0;
    do {
      newFood = {
        x: Math.floor(Math.random() * 20),
        y: Math.floor(Math.random() * 20),
      };
      attempts++;
    } while (
      attempts < 400 && 
      currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)
    );
    setFood(newFood);
  };

  const startGame = () => {
    // Initialize Web Audio Engine if not done (to bypass browser policy)
    unlockAudioEngine();

    const initialSnake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ];
    setSnake(initialSnake);
    setDirection({ x: 0, y: -1 });
    setLastDirection({ x: 0, y: -1 });
    setScore(0);
    setLevel(1);
    setGameState('PLAYING');
    spawnNewFood(initialSnake);

    // If music is not playing yet, let's play it automatically for ambient immersion!
    if (!audioEngine.getIsPlaying()) {
      audioEngine.play();
    }
  };

  const moveSnake = () => {
    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const nextX = head.x + direction.x;
      const nextY = head.y + direction.y;

      // 1. Boundary Crash Check (Wall Collision is terminal in Synth OS!)
      if (nextX < 0 || nextX >= 20 || nextY < 0 || nextY >= 20) {
        setGameState('GAME_OVER');
        audioEngine.playGameOverSound();
        return prevSnake;
      }

      const newHead = { x: nextX, y: nextY };

      // 2. Self Crash Check (Exclude the very tail segment if not eating, but include for safety)
      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameState('GAME_OVER');
        audioEngine.playGameOverSound();
        return prevSnake;
      }

      // Record last successfully processed move direction to avoid fast double keypress self-collision
      setLastDirection(direction);

      // 3. Check if eaten the core food particle
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((prevScore) => {
          const nextScore = prevScore + 100;
          if (nextScore > highScore) {
            setHighScore(nextScore);
            localStorage.setItem('synth-snake-highscore', nextScore.toString());
          }
          // Level Up: Every 500 points (5 meals), increase difficulty and synth tempo visuals!
          const nextLevel = Math.floor(nextScore / 500) + 1;
          setLevel(nextLevel);
          return nextScore;
        });

        // Trigger interactive chiptune synthesizer SFX
        audioEngine.playEatSound();

        // Spawn next food particle
        spawnNewFood(prevSnake);

        // Prepend new head, keep whole body (grow tail)
        return [newHead, ...prevSnake];
      } else {
        // Prepend new head, discard tail
        return [newHead, ...prevSnake.slice(0, -1)];
      }
    });
  };

  // --- SNAKE GAME CLOCK ---
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    // Linear speed ramp: Lvl 1 = 150ms, Lvl 10 = 50ms
    const speedMs = Math.max(50, 150 - (level - 1) * 11);
    
    const interval = setInterval(() => {
      moveSnake();
    }, speedMs);

    return () => clearInterval(interval);
  }, [gameState, direction, level, food]);

  // --- KEYBOARD LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Prevent browser scroll defaults for gaming layout stability
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 's', 'a', 'd'].includes(key)) {
        e.preventDefault();
      }

      // Track active keys for glowing mechanical keyboard effect
      setActiveKeys((prev) => ({ ...prev, [key]: true }));

      // Global Spacebar key handlers depending on state
      if (e.key === ' ') {
        if (gameState === 'IDLE' || gameState === 'GAME_OVER') {
          startGame();
        } else if (gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (gameState === 'PAUSED') {
          setGameState('PLAYING');
        }
        return;
      }

      if (e.key === 'Enter' && (gameState === 'IDLE' || gameState === 'GAME_OVER')) {
        startGame();
        return;
      }

      if (gameState !== 'PLAYING') return;

      // Handle Directional Control with anti-suicide checks (cannot turn 180 degrees instantly)
      switch (key) {
        case 'arrowup':
        case 'w':
          if (lastDirection.y === 0) {
            setDirection({ x: 0, y: -1 });
          }
          break;
        case 'arrowdown':
        case 's':
          if (lastDirection.y === 0) {
            setDirection({ x: 0, y: 1 });
          }
          break;
        case 'arrowleft':
        case 'a':
          if (lastDirection.x === 0) {
            setDirection({ x: -1, y: 0 });
          }
          break;
        case 'arrowright':
        case 'd':
          if (lastDirection.x === 0) {
            setDirection({ x: 1, y: 0 });
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveKeys((prev) => ({ ...prev, [key]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, direction, lastDirection]);

  // --- AUDIO SYNCHRONIZER HOOK ---
  useEffect(() => {
    audioEngine.setVolume(volume);

    const handleAudioStateChange = () => {
      setIsPlayingMusic(audioEngine.getIsPlaying());
      setCurrentTrack(audioEngine.getCurrentTrack());
      setElapsedTime(audioEngine.getElapsedSeconds());
    };

    const handleAudioTrackEnd = () => {
      audioEngine.skipNext();
      handleAudioStateChange();
    };

    // Attach callbacks
    audioEngine.setCallbacks(handleAudioTrackEnd, handleAudioStateChange);

    // Continuous smooth scrubber poller (updates 10 times a second)
    const smoothPoller = setInterval(() => {
      if (audioEngine.getIsPlaying()) {
        setElapsedTime(audioEngine.getElapsedSeconds());
      }
    }, 100);

    return () => {
      audioEngine.setCallbacks(() => {}, () => {});
      clearInterval(smoothPoller);
    };
  }, [volume]);

  // Unlock audio engine manually if blocked
  const unlockAudioEngine = () => {
    if (!audioEngineUnlocked) {
      audioEngine.init();
      setAudioEngineUnlocked(true);
    }
  };

  // --- CONTROLS ACTION IMPLEMENTATION ---
  const handleTogglePlayMusic = () => {
    unlockAudioEngine();
    audioEngine.play();
  };

  const handleSkipNext = () => {
    unlockAudioEngine();
    audioEngine.skipNext();
  };

  const handleSkipPrev = () => {
    unlockAudioEngine();
    audioEngine.skipPrev();
  };

  const handleTrackSelect = (idx: number) => {
    unlockAudioEngine();
    audioEngine.play(idx);
  };

  const handleMuteToggle = () => {
    unlockAudioEngine();
    if (isMuted) {
      audioEngine.setVolume(prevVolume);
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      audioEngine.setVolume(0);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleVolumeSliderChange = (val: number) => {
    unlockAudioEngine();
    setVolume(val);
    audioEngine.setVolume(val);
    if (val > 0) {
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  };

  // Virtual controllers for keyboardless mobile screens or mouse clicks
  const triggerVirtualMovement = (dirKey: 'w' | 'a' | 's' | 'd') => {
    unlockAudioEngine();
    if (gameState === 'IDLE' || gameState === 'GAME_OVER') {
      startGame();
      return;
    }
    if (gameState !== 'PLAYING') return;

    switch (dirKey) {
      case 'w':
        if (lastDirection.y === 0) setDirection({ x: 0, y: -1 });
        break;
      case 's':
        if (lastDirection.y === 0) setDirection({ x: 0, y: 1 });
        break;
      case 'a':
        if (lastDirection.x === 0) setDirection({ x: -1, y: 0 });
        break;
      case 'd':
        if (lastDirection.x === 0) setDirection({ x: 1, y: 0 });
        break;
    }
  };

  // --- RETRO DISPLAY FORMATTERS ---
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatScore = (num: number) => {
    return num.toString().padStart(4, '0');
  };

  // Next level boundary calculation
  const pointsToNextLevel = level * 500;
  const currentLevelBase = (level - 1) * 500;
  const levelProgressPoints = score - currentLevelBase;
  const levelProgressPercentage = Math.min(100, Math.max(0, (levelProgressPoints / 500) * 100));

  return (
    <div id="retro-cabinet-root" className="min-h-screen bg-[#020202] text-[#00FF41] font-mono p-4 md:p-8 flex items-center justify-center relative overflow-x-hidden selection:bg-[#00FF41]/20 selection:text-[#00FF41]">
      
      {/* Background ambient neon flare */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#00FF41]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#00F0FF]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main OS Bento Grid Panel Container */}
      <div 
        id="synth-snake-cabinet" 
        className="relative w-full max-w-5xl bg-[#050505] border-4 border-[#00FF41]/20 rounded-xl p-4 md:p-6 flex flex-col gap-5 shadow-[0_0_50px_rgba(0,255,65,0.04)] overflow-hidden crt-flicker-container"
      >
        {/* Subtle Scanline CRT Overlays inside the main frame */}
        <div className="scanline-overlay" />
        <div className="scanline-light" />

        {/* --- 1. HEADER CONTROL RAIL --- */}
        <header id="control-rail" className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#00FF41]/20 pb-4 gap-4 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 bg-[#00FF41] rounded-full shadow-[0_0_12px_#00FF41] ${isPlayingMusic || gameState === 'PLAYING' ? 'animate-pulse' : 'opacity-60'}`} />
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wider text-[#00FF41] neon-text-green flex items-center gap-2">
                SYNTH-SNAKE OS <span className="text-[10px] bg-[#00FF41]/10 px-2 py-0.5 rounded border border-[#00FF41]/20 text-[#00FF41] font-normal tracking-tight">v1.0.9</span>
              </h1>
              <p className="text-[9px] text-[#00FF41]/60 uppercase tracking-widest mt-0.5">Procedural Generative Cyber Grid</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[8px] uppercase text-[#00FF41]/40">System Core</span>
                <span className="text-[#00F0FF] neon-text-cyan font-bold tracking-tight">
                  {gameState === 'PLAYING' ? 'ACTIVE / 60FPS' : 'STABLE / IDLE'}
                </span>
              </div>
              <div className="flex flex-col items-end border-l border-[#00FF41]/15 pl-4">
                <span className="text-[8px] uppercase text-[#00FF41]/40">Neural Sound</span>
                <span className="text-[#00F0FF] neon-text-cyan font-bold">
                  {isPlayingMusic ? `${currentTrack.bpm} BPM` : 'STANDBY'}
                </span>
              </div>
            </div>

            <button 
              id="help-button"
              onClick={() => setShowHelp(!showHelp)}
              className="px-3 py-1.5 border border-[#00F0FF]/30 bg-[#00F0FF]/5 hover:bg-[#00F0FF]/20 hover:border-[#00F0FF]/60 text-[#00F0FF] rounded text-[10px] uppercase font-bold tracking-widest transition-all duration-200 flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,240,255,0.05)] cursor-pointer"
            >
              <HelpCircle size={12} />
              SYSTEM MAN
            </button>
          </div>
        </header>

        {/* Help Manual Overlay */}
        {showHelp && (
          <div className="absolute inset-0 bg-black/95 border-2 border-[#00F0FF] rounded-lg z-50 p-6 flex flex-col justify-between overflow-y-auto m-6">
            <div>
              <div className="flex justify-between items-center border-b border-[#00F0FF]/30 pb-3 mb-4">
                <h3 className="text-lg font-bold text-[#00F0FF] neon-text-cyan flex items-center gap-2">
                  <Activity size={18} className="animate-pulse" />
                  SYNTH-SNAKE OS MANUAL
                </h3>
                <button 
                  onClick={() => setShowHelp(false)}
                  className="text-[#FF0055] hover:text-[#FF0055]/80 font-bold px-2 py-1 border border-[#FF0055]/30 hover:bg-[#FF0055]/10 rounded text-xs cursor-pointer"
                >
                  [CLOSE]
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div>
                  <h4 className="text-[#00FF41] font-bold uppercase mb-1">🎮 CORE DIRECTIVE: SNAKE GAME</h4>
                  <p>Guide your synthetic data probe through the virtual mainframe using the keyboard keys <span className="text-white font-bold">W, A, S, D</span> or the <span className="text-white font-bold">Arrow Keys</span>. Alternatively, tap the clickable neon keyboard legend in the bottom-left panel.</p>
                </div>

                <div>
                  <h4 className="text-[#00FF41] font-bold uppercase mb-1">🍎 NEURAL FEED: MAIN MEMORY CELLS</h4>
                  <p>Consume red memory cells (<span className="text-[#FF0055] font-bold">#FF0055</span>) to expand your code array. Each meal adds 100 points. Generating 500 points advances the system level, intensifying the movement speed and sequencer filters.</p>
                </div>

                <div>
                  <h4 className="text-[#00F0FF] font-bold uppercase mb-1">🎹 HYBRID SYNTHESIZER SOUND ENGINE</h4>
                  <p>An integrated live algorithmic sequencer generates original cybernetic synthwave music in real-time. It features dynamic low-pass filters, retro delay effects, and direct interactive sound design (eat tones, crash sirens) triggered by physical game actions.</p>
                </div>

                <div className="bg-[#00FF41]/5 p-3 rounded border border-[#00FF41]/20">
                  <p className="text-[#00FF41] font-semibold mb-1">🚀 QUICK SHORTCUTS:</p>
                  <ul className="list-disc pl-5 space-y-1 text-[11px]">
                    <li><span className="text-[#00FF41] font-bold">[Spacebar]</span> : Play/Pause Snake Game (starts game instantly if Idle/Over).</li>
                    <li><span className="text-[#00FF41] font-bold">[W / S / A / D]</span> : Instant direction maneuvers.</li>
                    <li><span className="text-[#00FF41] font-bold">[Clicks/Touches]</span> : Click/Tap any visual playlist item or controller below to interact.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t border-[#00F0FF]/20 pt-4 mt-6 text-[10px] text-slate-500 flex justify-between items-center">
              <span>DESIGN THEME: BENTO GRID OS</span>
              <span>2026 GENERAL RETRO-VIRTUAL STANDARDS</span>
            </div>
          </div>
        )}

        {/* --- 2. BENTO BODY GRID --- */}
        <main className="grid grid-cols-1 md:grid-cols-12 gap-4 z-10 flex-1">
          
          {/* LEFT BENTO BLOCK: STATS & PROGRESS (col-span-3, row-span-4 in mockup) */}
          <div id="stats-bento" className="md:col-span-3 flex flex-col gap-4">
            
            {/* Current Score Panel */}
            <div 
              id="score-panel"
              className="flex-1 min-h-[100px] border border-[#00FF41]/30 bg-[#00FF41]/5 p-4 rounded-lg flex flex-col justify-center items-center gap-1 hover:border-[#00FF41]/60 transition-all duration-300 shadow-[0_0_15px_rgba(0,255,65,0.02)] group"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#00FF41]/60">
                <Gamepad2 size={12} className="group-hover:rotate-12 transition-transform" />
                <span>CORE INDEX</span>
              </div>
              <span className="text-4xl lg:text-5xl font-black text-[#00FF41] tracking-tighter neon-text-green animate-pulse">
                {formatScore(score)}
              </span>
              <span className="text-[8px] text-[#00FF41]/40 uppercase tracking-widest mt-0.5">BYTES GATHERED</span>
            </div>

            {/* High Score Panel */}
            <div 
              id="highscore-panel"
              className="flex-1 min-h-[100px] border border-[#00FF41]/30 bg-[#00FF41]/5 p-4 rounded-lg flex flex-col justify-center items-center gap-1 hover:border-[#00FF41]/50 transition-all duration-300"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#00FF41]/60">
                <Trophy size={11} className="text-[#00FF41]" />
                <span>HIGH SCORE</span>
              </div>
              <span className="text-2xl lg:text-3xl font-bold italic text-[#00FF41]/75 tracking-tight">
                {formatScore(highScore)}
              </span>
              <span className="text-[8px] text-[#00FF41]/30 uppercase tracking-widest mt-1">MAIN CLOUD MASTER</span>
            </div>

            {/* Level & Progression Bar */}
            <div 
              id="progression-panel"
              className="border border-[#00FF41]/30 bg-[#00FF41]/5 p-4 rounded-lg flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] uppercase text-[#00FF41]/50 block mb-1 tracking-wider">Level Progression</span>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-lg font-black text-white">STAGE {level.toString().padStart(2, '0')}</span>
                  <span className="text-[10px] text-slate-400 font-bold">{levelProgressPoints}/500 PTS</span>
                </div>
              </div>

              <div>
                <div className="w-full h-2.5 bg-[#121212] rounded border border-[#00FF41]/20 overflow-hidden p-[2px]">
                  <div 
                    className="h-full bg-[#00FF41] rounded-sm shadow-[0_0_10px_#00FF41] transition-all duration-300"
                    style={{ width: `${levelProgressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] uppercase tracking-wider mt-1.5 text-[#00FF41]/50 font-bold">
                  <span>LVL {level.toString().padStart(2, '0')}</span>
                  <span>LVL {(level + 1).toString().padStart(2, '0')}</span>
                </div>
              </div>
            </div>

          </div>

          {/* CENTER BENTO BLOCK: THE CORE SNAKE GRID (col-span-6, row-span-6 in mockup) */}
          <div 
            id="game-viewport"
            onClick={unlockAudioEngine}
            className="md:col-span-6 border-2 border-[#00FF41] bg-[#020202] relative aspect-square flex items-center justify-center overflow-hidden rounded-lg shadow-[0_0_30px_rgba(0,255,65,0.12)] group transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,255,65,0.18)] min-h-[350px] md:min-h-[400px]"
          >
            {/* Vector dots grid pattern backdrop */}
            <div 
              className="absolute inset-0 opacity-[0.06] select-none pointer-events-none" 
              style={{ 
                backgroundImage: 'radial-gradient(#00FF41 1px, transparent 1.5px)', 
                backgroundSize: '18px 18px' 
              }} 
            />

            {/* Simulated background horizontal lines */}
            <div className="absolute inset-0 opacity-[0.01] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%)] bg-[length:100%_8px]" />

            {/* --- CORE SNAKE GAME ENGINE RENDERER --- */}
            <div className="relative w-[90%] h-[90%] aspect-square border border-[#00FF41]/15 rounded-sm bg-black/60 overflow-hidden">
              
              {/* Render Simulated Grid Squares in background */}
              <div className="absolute inset-0 grid grid-cols-20 grid-rows-20 pointer-events-none">
                {Array.from({ length: 400 }).map((_, i) => (
                  <div key={i} className="border-[0.5px] border-[#00FF41]/[0.02]" />
                ))}
              </div>

              {/* RENDER ACTIVE FOOD PARTICLE */}
              {gameState !== 'GAME_OVER' && (
                <div 
                  id="target-food"
                  className="absolute w-[5%] h-[5%] rounded-full bg-[#FF0055] shadow-[0_0_12px_#FF0055] border border-[#FF0055]/30 z-10 transition-all duration-75"
                  style={{
                    left: `${food.x * 5}%`,
                    top: `${food.y * 5}%`,
                  }}
                >
                  {/* Neon center core flare */}
                  <div className="absolute inset-[25%] bg-white rounded-full animate-ping opacity-75" />
                </div>
              )}

              {/* RENDER THE ACTIVE SNAKE DATA STREAM */}
              {gameState !== 'GAME_OVER' && snake.map((segment, idx) => {
                const isHead = idx === 0;
                // Calculate color fading down the tail segment
                const opacityVal = isHead ? 1 : Math.max(0.2, 1 - (idx * 0.08));
                
                return (
                  <div
                    key={`${segment.x}-${segment.y}-${idx}`}
                    className={`absolute w-[5%] h-[5%] rounded-[3px] transition-all duration-75 z-20 ${
                      isHead 
                        ? 'bg-[#00FF41] shadow-[0_0_10px_#00FF41] border border-[#00FF41]' 
                        : 'bg-[#00FF41]/80 border border-[#00FF41]/20'
                    }`}
                    style={{
                      left: `${segment.x * 5}%`,
                      top: `${segment.y * 5}%`,
                      opacity: opacityVal
                    }}
                  >
                    {/* Glowing coordinate interface dots on head */}
                    {isHead && (
                      <div className="absolute w-[35%] h-[35%] bg-black rounded-full top-[15%] left-[30%]" />
                    )}
                  </div>
                );
              })}

              {/* --- GAME VIEWER SCREEN OVERLAYS --- */}

              {/* OVERLAY 1: IDLE / PRESS START */}
              {gameState === 'IDLE' && (
                <div className="absolute inset-0 bg-black/85 flex flex-col justify-center items-center p-6 text-center z-30 select-none cursor-pointer" onClick={startGame}>
                  <div className="w-16 h-16 border-2 border-[#00FF41] rounded-full flex items-center justify-center bg-[#00FF41]/5 shadow-[0_0_20px_rgba(0,255,65,0.2)] mb-4 animate-bounce">
                    <Gamepad2 size={32} className="text-[#00FF41]" />
                  </div>
                  <h2 className="text-base md:text-lg font-black tracking-widest text-[#00FF41] neon-text-green uppercase mb-2">SYNTH MAINBOARD</h2>
                  <p className="text-[10px] text-slate-400 max-w-[280px] leading-relaxed mb-4">
                    The cyber grid is ready for injection. Synchronize neural music loops to play in real-time.
                  </p>
                  <button className="px-5 py-2 border border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41] text-xs font-bold uppercase tracking-widest hover:bg-[#00FF41]/30 transition-all rounded shadow-[0_0_15px_rgba(0,255,65,0.3)] cursor-pointer">
                    BOOT SYSTEM [SPACEBAR]
                  </button>
                </div>
              )}

              {/* OVERLAY 2: SYSTEM PAUSED */}
              {gameState === 'PAUSED' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center z-30 select-none cursor-pointer" onClick={() => setGameState('PLAYING')}>
                  <div className="w-14 h-14 border border-[#00F0FF] rounded-full flex items-center justify-center bg-[#00F0FF]/5 shadow-[0_0_15px_rgba(0,240,255,0.2)] mb-3 animate-pulse">
                    <Pause size={24} className="text-[#00F0FF]" />
                  </div>
                  <h2 className="text-base font-black tracking-widest text-[#00F0FF] neon-text-cyan uppercase mb-1">DATA STREAM HALTED</h2>
                  <p className="text-[10px] text-slate-400 mb-4">System paused in safe memory bank</p>
                  <button className="px-4 py-1.5 border border-[#00F0FF] bg-[#00F0FF]/10 text-[#00F0FF] text-[10px] font-bold uppercase tracking-widest rounded shadow-[0_0_10px_rgba(0,240,255,0.2)] cursor-pointer">
                    RESUME THREAD [SPACEBAR]
                  </button>
                </div>
              )}

              {/* OVERLAY 3: GAME OVER / CRITICAL FAILURE */}
              {gameState === 'GAME_OVER' && (
                <div className="absolute inset-0 bg-black/95 flex flex-col justify-center items-center p-6 text-center z-30 select-none">
                  <div className="w-14 h-14 border-2 border-[#FF0055] rounded-full flex items-center justify-center bg-[#FF0055]/5 shadow-[0_0_20px_rgba(255,0,85,0.3)] mb-4 animate-pulse">
                    <Sparkles size={26} className="text-[#FF0055]" />
                  </div>
                  <h2 className="text-base md:text-lg font-black tracking-widest text-[#FF0055] neon-text-red uppercase mb-1">CRITICAL COLLISION</h2>
                  <p className="text-[10px] text-[#FF0055] opacity-80 uppercase tracking-widest font-bold mb-3">CONNECTION TERMINATED</p>
                  
                  <div className="bg-[#FF0055]/10 border border-[#FF0055]/30 p-3 rounded-md mb-5 max-w-[240px] w-full">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">FINAL SCORE:</span>
                      <span className="text-white font-bold">{score} PTS</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">HIGHEST LOG:</span>
                      <span className="text-white font-bold">{highScore} PTS</span>
                    </div>
                  </div>

                  <button 
                    onClick={startGame}
                    className="px-5 py-2 border border-[#FF0055] bg-[#FF0055]/10 text-[#FF0055] text-xs font-bold uppercase tracking-widest hover:bg-[#FF0055]/20 hover:border-[#FF0055] transition-all rounded shadow-[0_0_15px_rgba(255,0,85,0.2)] cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw size={12} className="animate-spin" />
                    REBOOT SYSTEM
                  </button>
                </div>
              )}

            </div>

            {/* Active System HUD Info top left */}
            <div className="absolute top-4 left-4 bg-black/80 border border-[#00FF41]/40 px-3 py-1 text-[9px] uppercase tracking-wider font-bold z-20 shadow-[0_0_5px_rgba(0,255,65,0.2)]">
              Speed: <span className="text-white">{level === 1 ? '1.0' : (1.0 + (level - 1) * 0.15).toFixed(2)}x</span>
            </div>

            {/* Active System HUD Info top right */}
            <div className="absolute top-4 right-4 bg-black/80 border border-[#00F0FF]/40 px-3 py-1 text-[9px] uppercase tracking-wider font-bold z-20 shadow-[0_0_5px_rgba(0,240,255,0.2)]">
              Core Temp: <span className="text-white">{32 + level * 3}°C</span>
            </div>
          </div>

          {/* RIGHT BENTO BLOCK: NEURAL PLAYLIST & AUDIO DATA (col-span-3, row-span-6 in mockup) */}
          <div id="audio-bento" className="md:col-span-3 flex flex-col gap-4">
            
            {/* Playlist Container */}
            <div 
              id="playlist-box" 
              className="flex-1 border border-[#00F0FF]/30 bg-[#00F0FF]/3 p-4 rounded-lg flex flex-col hover:border-[#00F0FF]/50 transition-all duration-300"
            >
              <div className="flex items-center justify-between border-b border-[#00F0FF]/20 pb-2 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] text-[#00F0FF] uppercase tracking-widest font-black">
                  <Radio size={12} className="animate-pulse" />
                  <span>NEURAL PLAYLIST</span>
                </div>
                <span className="text-[8px] bg-[#00F0FF]/10 text-[#00F0FF] px-1.5 py-0.5 rounded border border-[#00F0FF]/20">PROCEDURAL</span>
              </div>

              <div id="playlist-tracks" className="space-y-2 flex-1 overflow-y-auto max-h-[220px] md:max-h-none pr-1">
                {TRACKS.map((track, idx) => {
                  const isActive = currentTrack.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => handleTrackSelect(idx)}
                      className={`group flex flex-col p-2.5 rounded border transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'border-l-4 border-l-[#00F0FF] border-[#00F0FF]/40 bg-[#00F0FF]/10 text-white shadow-[0_0_10px_rgba(0,240,255,0.05)]'
                          : 'border-transparent bg-white/[0.02] hover:bg-white/[0.06] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-xs font-bold ${isActive ? 'text-[#00F0FF] neon-text-cyan' : ''}`}>
                          0{idx + 1}. {track.title}
                        </span>
                        {isActive && isPlayingMusic && (
                          <div className="flex gap-[2px] items-center h-2.5 mt-0.5">
                            <div className="w-[1.5px] bg-[#00F0FF] h-full animate-bounce [animation-delay:0.1s]" />
                            <div className="w-[1.5px] bg-[#00F0FF] h-2/3 animate-bounce [animation-delay:0.3s]" />
                            <div className="w-[1.5px] bg-[#00F0FF] h-4/5 animate-bounce [animation-delay:0.5s]" />
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-[8px] opacity-60 uppercase tracking-widest mt-1">
                        <span>{track.artist}</span>
                        <span>{track.bpm} BPM</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audio Visualizer Panel */}
            <div 
              id="visualizer-box" 
              className="h-36 border border-[#00FF41]/20 bg-black rounded-lg p-3 flex flex-col gap-2 shadow-[0_0_15px_rgba(0,255,65,0.01)] hover:border-[#00FF41]/40 transition-all duration-300"
            >
              <div className="flex items-center justify-between text-[9px] uppercase tracking-widest font-black text-[#00FF41]/60 border-b border-[#00FF41]/10 pb-1.5">
                <span className="flex items-center gap-1">
                  <Activity size={10} />
                  SPECTRUM GRAPH
                </span>
                <span className="text-[8px] tracking-normal font-mono text-slate-500">64 BINS / FFT</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <AudioVisualizer isPlaying={isPlayingMusic} />
              </div>
            </div>

          </div>

          {/* BOTTOM LEFT BENTO BLOCK: KEYBOARD CONTROLS LEGEND */}
          <div 
            id="controls-bento" 
            className="md:col-span-3 border border-[#00FF41]/20 bg-white/[0.02] p-4 rounded-lg flex flex-col justify-center min-h-[140px] hover:border-[#00FF41]/40 transition-all duration-300"
          >
            <span className="text-[9px] uppercase text-[#00FF41]/50 mb-3 block tracking-widest text-center font-bold border-b border-[#00FF41]/10 pb-1.5">MAINBOARD MANUAL KEYS</span>
            
            <div className="flex justify-center items-center">
              <div className="grid grid-cols-3 gap-1.5 w-full max-w-[150px]">
                {/* Row 1 */}
                <div />
                <button 
                  onClick={() => triggerVirtualMovement('w')}
                  className={`h-9 border text-xs font-bold rounded flex flex-col justify-center items-center select-none cursor-pointer transition-all ${
                    activeKeys['w'] || activeKeys['arrowup']
                      ? 'bg-[#00FF41]/25 border-[#00FF41] text-[#00FF41] shadow-[0_0_10px_#00FF41]'
                      : 'border-[#00FF41]/30 hover:border-[#00FF41]/60 text-[#00FF41]/75 hover:bg-[#00FF41]/10'
                  }`}
                >
                  <ChevronUp size={11} className="mb-0.5" />
                  <span className="text-[9px]">W</span>
                </button>
                <div />

                {/* Row 2 */}
                <button 
                  onClick={() => triggerVirtualMovement('a')}
                  className={`h-9 border text-xs font-bold rounded flex flex-col justify-center items-center select-none cursor-pointer transition-all ${
                    activeKeys['a'] || activeKeys['arrowleft']
                      ? 'bg-[#00FF41]/25 border-[#00FF41] text-[#00FF41] shadow-[0_0_10px_#00FF41]'
                      : 'border-[#00FF41]/30 hover:border-[#00FF41]/60 text-[#00FF41]/75 hover:bg-[#00FF41]/10'
                  }`}
                >
                  <ChevronLeft size={11} className="mb-0.5" />
                  <span className="text-[9px]">A</span>
                </button>
                <button 
                  onClick={() => triggerVirtualMovement('s')}
                  className={`h-9 border text-xs font-bold rounded flex flex-col justify-center items-center select-none cursor-pointer transition-all ${
                    activeKeys['s'] || activeKeys['arrowdown']
                      ? 'bg-[#00FF41]/25 border-[#00FF41] text-[#00FF41] shadow-[0_0_10px_#00FF41]'
                      : 'border-[#00FF41]/30 hover:border-[#00FF41]/60 text-[#00FF41]/75 hover:bg-[#00FF41]/10'
                  }`}
                >
                  <ChevronDown size={11} className="mb-0.5" />
                  <span className="text-[9px]">S</span>
                </button>
                <button 
                  onClick={() => triggerVirtualMovement('d')}
                  className={`h-9 border text-xs font-bold rounded flex flex-col justify-center items-center select-none cursor-pointer transition-all ${
                    activeKeys['d'] || activeKeys['arrowright']
                      ? 'bg-[#00FF41]/25 border-[#00FF41] text-[#00FF41] shadow-[0_0_10px_#00FF41]'
                      : 'border-[#00FF41]/30 hover:border-[#00FF41]/60 text-[#00FF41]/75 hover:bg-[#00FF41]/10'
                  }`}
                >
                  <ChevronRight size={11} className="mb-0.5" />
                  <span className="text-[9px]">D</span>
                </button>
              </div>
            </div>

            <div className="text-[8px] text-center text-slate-500 uppercase mt-3 tracking-wider">
              TAP VIRTUAL KEYS TO MANEUVER
            </div>
          </div>

        </main>

        {/* --- 3. NEURAL PLAYER CONTROLS FOOTER (FOOTER PANEL in mockup) --- */}
        <footer 
          id="player-deck" 
          className="bg-[#080808] border border-[#00F0FF]/30 p-4 md:px-6 md:py-4 rounded-lg flex flex-col md:flex-row items-center gap-4 md:gap-8 z-10 hover:border-[#00F0FF]/50 transition-all duration-300"
        >
          {/* Active Track Title Box (Left) */}
          <div className="flex items-center gap-3 w-full md:w-[220px] shrink-0 justify-center md:justify-start">
            <div className="relative w-12 h-12 bg-black flex items-center justify-center border border-[#00F0FF]/40 rounded-full shadow-[0_0_10px_rgba(0,240,255,0.15)] overflow-hidden group">
              <div 
                className={`absolute w-10 h-10 border-2 border-[#00F0FF]/70 rounded-full border-dashed flex items-center justify-center ${
                  isPlayingMusic ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '10s' }}
              />
              <Music size={16} className={`text-[#00F0FF] ${isPlayingMusic ? 'animate-pulse' : ''}`} />
            </div>
            <div className="text-center md:text-left truncate">
              <div className="text-xs text-[#00F0FF] font-black tracking-tight neon-text-cyan truncate">
                {currentTrack.title}
              </div>
              <div className="text-[9px] text-[#00F0FF]/60 uppercase tracking-widest mt-0.5 truncate">
                {currentTrack.artist}
              </div>
            </div>
          </div>

          {/* Central Controls & Scrubber Progress (Center) */}
          <div className="flex-1 flex flex-col gap-2.5 w-full">
            <div className="flex justify-center items-center gap-6">
              <button 
                id="skip-prev-btn"
                onClick={handleSkipPrev}
                className="text-[#00F0FF]/70 hover:text-[#00F0FF] p-1.5 border border-[#00F0FF]/25 hover:border-[#00F0FF]/60 rounded-full bg-transparent cursor-pointer transition-all hover:scale-105 active:scale-95"
                title="Previous Neural Loop"
              >
                <SkipBack size={14} />
              </button>
              
              <button 
                id="play-pause-btn"
                onClick={handleTogglePlayMusic}
                className="w-10 h-10 rounded-full border-2 border-[#00F0FF] bg-[#00F0FF]/5 text-[#00F0FF] flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_20px_rgba(0,240,255,0.45)] hover:bg-[#00F0FF]/15 cursor-pointer transition-all hover:scale-105 active:scale-95"
                title={isPlayingMusic ? "Mute Sequencer" : "Boot Sequencer"}
              >
                {isPlayingMusic ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>

              <button 
                id="skip-next-btn"
                onClick={handleSkipNext}
                className="text-[#00F0FF]/70 hover:text-[#00F0FF] p-1.5 border border-[#00F0FF]/25 hover:border-[#00F0FF]/60 rounded-full bg-transparent cursor-pointer transition-all hover:scale-105 active:scale-95"
                title="Next Neural Loop"
              >
                <SkipForward size={14} />
              </button>
            </div>

            {/* Scrubber Timeline bar */}
            <div className="flex items-center gap-3 text-[9px] font-mono select-none">
              <span className="text-[#00F0FF]/80">{formatTime(elapsedTime)}</span>
              <div 
                id="music-progress-bar"
                onClick={(e) => {
                  // Allow quick restart loop on click
                  unlockAudioEngine();
                  audioEngine.play(currentTrack.id === TRACKS[0].id ? 0 : (currentTrack.id === TRACKS[1].id ? 1 : 2));
                }}
                className="flex-1 h-2.5 bg-[#121212] border border-[#00F0FF]/20 rounded p-[2px] relative overflow-hidden cursor-pointer group"
                title="Click to reboot active loop track"
              >
                <div 
                  className="h-full bg-[#00F0FF] rounded-sm shadow-[0_0_8px_#00F0FF] transition-all duration-300"
                  style={{ width: `${Math.min(100, (elapsedTime / currentTrack.duration) * 100)}%` }}
                />
                <div className="absolute top-0 bottom-0 left-0 right-0 flex items-center justify-center text-[7px] text-white/40 tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                  CLICK BAR TO RESTART TRACK
                </div>
              </div>
              <span className="text-[#00F0FF]/80">{formatTime(currentTrack.duration)}</span>
            </div>
          </div>

          {/* Volume Control Sliders (Right) */}
          <div className="w-full md:w-[150px] shrink-0 flex items-center gap-3 justify-center md:justify-end">
            <button 
              id="volume-toggle"
              onClick={handleMuteToggle}
              className="text-[#00F0FF]/70 hover:text-[#00F0FF] cursor-pointer transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <div className="flex-1 max-w-[100px] flex items-center relative">
              <input 
                id="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeSliderChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#121212] rounded appearance-none cursor-pointer accent-[#00F0FF] focus:outline-none border border-transparent"
                style={{
                  background: `linear-gradient(to right, #00F0FF ${volume * 100}%, #121212 ${volume * 100}%)`,
                }}
              />
            </div>
            <span className="text-[8px] text-[#00F0FF]/70 w-8 text-right font-bold uppercase tracking-widest">
              {Math.round(volume * 100)}%
            </span>
          </div>

        </footer>

      </div>
    </div>
  );
}

// --- LIGHTWEIGHT EMBEDDED SPECTRUM AUDIO VISUALIZER FOR RETRO LOOK ---
function AudioVisualizer({ isPlaying }: { isPlaying: boolean }) {
  const [barHeights, setBarHeights] = useState<number[]>(new Array(14).fill(12));
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const dataArray = new Uint8Array(32);

    const updateVisuals = (time: number) => {
      if (audioEngine.analyser && isPlaying) {
        audioEngine.analyser.getByteFrequencyData(dataArray);
        
        const newHeights = [];
        for (let i = 0; i < 14; i++) {
          // Average some index bins to keep visualizer clean
          const startIdx = Math.floor(i * (24 / 14));
          let sum = 0;
          const count = 2;
          for (let j = 0; j < count; j++) {
            sum += dataArray[startIdx + j] || 0;
          }
          const avg = sum / count;
          // Scale exponential for retro dramatic vibe, min height 10%, max 100%
          const pct = Math.max(10, Math.min(100, (avg / 255) * 100));
          newHeights.push(pct);
        }
        setBarHeights(newHeights);
      } else {
        // Soft breath-wave idle visualizer animation when music is on standby
        const newHeights = [];
        for (let i = 0; i < 14; i++) {
          const wave = Math.sin((time * 0.003) + i * 0.4) * 14 + 25;
          newHeights.push(wave);
        }
        setBarHeights(newHeights);
      }
      animationRef.current = requestAnimationFrame(updateVisuals);
    };

    animationRef.current = requestAnimationFrame(updateVisuals);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className="flex items-end justify-between gap-[2px] h-full pb-1 px-0.5">
      {barHeights.map((height, idx) => (
        <div
          key={idx}
          className="flex-1 bg-[#00FF41] rounded-t-sm transition-all duration-75 shadow-[0_0_8px_rgba(0,255,65,0.4)]"
          style={{
            height: `${height}%`,
            opacity: 0.4 + (height / 100) * 0.6,
            background: `linear-gradient(to top, rgba(0, 255, 65, 0.4) 0%, #00FF41 100%)`
          }}
        />
      ))}
    </div>
  );
}
