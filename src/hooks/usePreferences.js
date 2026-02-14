import { useState, useCallback } from 'react';

const DEFAULTS = { boardTheme: 'classic' };

export function usePreferences() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('chess-trainer-prefs')) };
    } catch {
      return DEFAULTS;
    }
  });

  const updatePrefs = useCallback((updates) => {
    setPrefs((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem('chess-trainer-prefs', JSON.stringify(next));
      return next;
    });
  }, []);

  return [prefs, updatePrefs];
}
