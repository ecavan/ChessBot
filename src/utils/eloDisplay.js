export function getEloDisplay(elo) {
  if (elo >= 2200) return { color: '#22c55e', label: 'Expert' };
  if (elo >= 1800) return { color: '#4ade80', label: 'Advanced' };
  if (elo >= 1400) return { color: '#eab308', label: 'Intermediate' };
  if (elo >= 1000) return { color: '#f97316', label: 'Beginner' };
  return { color: '#ef4444', label: 'Novice' };
}
