import { useState } from 'react';

export default function GameControls({ onNewGame, onUndo, onFlipBoard, settings, onSettingsChange }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="bg-gray-800 rounded p-3">
      <div className="flex gap-2 mb-2">
        <button
          onClick={onNewGame}
          className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
        >
          New Game
        </button>
        <button
          onClick={onUndo}
          className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
        >
          Undo
        </button>
        <button
          onClick={onFlipBoard}
          className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
        >
          Flip
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium transition-colors"
        >
          Settings
        </button>
      </div>

      {showSettings && (
        <div className="space-y-3 pt-2 border-t border-gray-700">
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Engine Strength: {settings.skillLevel}
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={settings.skillLevel}
              onChange={(e) => onSettingsChange({ ...settings, skillLevel: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Beginner</span>
              <span>Master</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Blunder Warnings</span>
            <button
              onClick={() => onSettingsChange({ ...settings, blunderWarnings: !settings.blunderWarnings })}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.blunderWarnings ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${
                  settings.blunderWarnings ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Show Threats</span>
            <button
              onClick={() => onSettingsChange({ ...settings, showThreats: !settings.showThreats })}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.showThreats ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${
                  settings.showThreats ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Show Eval Bar</span>
            <button
              onClick={() => onSettingsChange({ ...settings, showEval: !settings.showEval })}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.showEval ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${
                  settings.showEval ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <span className="text-xs text-gray-400 block mb-1">Play as</span>
            <div className="flex gap-2">
              {['white', 'black', 'random'].map((color) => (
                <button
                  key={color}
                  onClick={() => onSettingsChange({ ...settings, playerColor: color })}
                  className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                    settings.playerColor === color
                      ? 'bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
