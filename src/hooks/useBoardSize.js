import { useState, useEffect } from 'react';

function computeSize() {
  const maxW = window.innerWidth - 340;
  const maxH = window.innerHeight - 160;
  return Math.max(280, Math.min(560, maxW, maxH));
}

export function useBoardSize() {
  const [size, setSize] = useState(computeSize);

  useEffect(() => {
    const onResize = () => setSize(computeSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}
