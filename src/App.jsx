import { useState, useCallback } from 'react';
import { useStockfish } from './engine/useStockfish';
import { usePreferences } from './hooks/usePreferences';
import { BOARD_THEMES } from './data/boardThemes';
import PlayMode from './modes/PlayMode';
import OpeningSandbox from './modes/OpeningSandbox';
import ReviewMode from './modes/ReviewMode';
import EndgameTrainer from './modes/EndgameTrainer';
import PuzzlesTrainer from './modes/PuzzlesTrainer';
import WatchMode from './modes/WatchMode';

const MODES = [
  { key: 'play', label: 'Play' },
  { key: 'openings', label: 'Openings' },
  { key: 'endgames', label: 'Endgames' },
  { key: 'puzzles', label: 'Puzzles' },
  { key: 'review', label: 'Review' },
  { key: 'watch', label: 'Watch' },
];

const THEME_KEYS = Object.keys(BOARD_THEMES);

export default function App() {
  const engine = useStockfish();
  const [activeMode, setActiveMode] = useState('play');
  const [lastGamePgn, setLastGamePgn] = useState(null);
  const [prefs, updatePrefs] = usePreferences();

  const handleModeChange = useCallback((mode) => {
    setActiveMode(mode);
    engine.newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.newGame]);

  const handleGameEnd = useCallback((pgn) => {
    setLastGamePgn(pgn);
  }, []);

  const handleReviewGame = useCallback((pgn) => {
    setLastGamePgn(pgn);
    setActiveMode('review');
  }, []);

  if (engine.engineError) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 text-lg font-bold mb-2">Engine Failed to Load</p>
          <p className="text-gray-400 text-sm">{engine.engineError}</p>
          <p className="text-gray-500 text-xs mt-3">
            Your browser may not support cross-origin isolation. Try Chrome, Safari 15.2+, or Firefox.
          </p>
        </div>
      </div>
    );
  }

  if (!engine.isReady) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Loading Stockfish engine...</p>
          <p className="text-gray-600 text-xs mt-1">This may take a few seconds on first visit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="flex items-center gap-4 p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg font-bold mr-4">Chess Trainer</h1>
        {MODES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleModeChange(key)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeMode === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}

        {/* Theme picker */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1">Theme</span>
          {THEME_KEYS.map((key) => {
            const t = BOARD_THEMES[key];
            const isActive = prefs.boardTheme === key;
            return (
              <button
                key={key}
                onClick={() => updatePrefs({ boardTheme: key })}
                title={t.name}
                className="transition-transform hover:scale-110"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)`,
                  border: isActive ? '2px solid #60a5fa' : '2px solid transparent',
                  boxShadow: isActive ? '0 0 6px rgba(96,165,250,0.5)' : 'none',
                }}
              />
            );
          })}
        </div>
      </nav>
      <main className="p-6 flex justify-center">
        {activeMode === 'play' && (
          <PlayMode engine={engine} onGameEnd={handleGameEnd} onReviewGame={handleReviewGame} preferences={prefs} />
        )}
        {activeMode === 'openings' && (
          <OpeningSandbox engine={engine} preferences={prefs} />
        )}
        {activeMode === 'endgames' && (
          <EndgameTrainer engine={engine} preferences={prefs} />
        )}
        {activeMode === 'puzzles' && (
          <PuzzlesTrainer preferences={prefs} />
        )}
        {activeMode === 'review' && (
          <ReviewMode engine={engine} initialPgn={lastGamePgn} preferences={prefs} />
        )}
        {activeMode === 'watch' && (
          <WatchMode engine={engine} preferences={prefs} />
        )}
      </main>
    </div>
  );
}
