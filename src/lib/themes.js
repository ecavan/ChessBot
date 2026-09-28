/** Board colour themes (light, dark, highlight overlay) and piece sets. */
import { defaultPieces } from '../data/pieceStyles/classic.js';
import { neoPieces } from '../data/pieceStyles/neo.jsx';
import { gothicPieces } from '../data/pieceStyles/gothic.jsx';
import { minimalPieces } from '../data/pieceStyles/minimal.jsx';
import { royalPieces } from '../data/pieceStyles/royal.jsx';
import { stauntonPieces } from '../data/pieceStyles/staunton.jsx';

export const BOARDS = {
  green: { name: 'Green', light: '#ebecd0', dark: '#739552', hl: 'rgba(255, 255, 51, .45)' },
  brown: { name: 'Brown', light: '#f0d9b5', dark: '#b58863', hl: 'rgba(155, 199, 0, .45)' },
  blue: { name: 'Blue', light: '#dee3e6', dark: '#8ca2ad', hl: 'rgba(155, 199, 0, .45)' },
  slate: { name: 'Slate', light: '#c9d1dc', dark: '#5d7087', hl: 'rgba(251, 191, 36, .45)' },
  night: { name: 'Night', light: '#8b95a5', dark: '#3f4a5c', hl: 'rgba(52, 211, 153, .40)' },
  wood: { name: 'Wood', light: '#e8c99b', dark: '#a8764a', hl: 'rgba(255, 238, 88, .45)' },
  purple: { name: 'Purple', light: '#e4dcf1', dark: '#8877b7', hl: 'rgba(255, 238, 88, .45)' },
  ice: { name: 'Ice', light: '#dfeef5', dark: '#7fa7c0', hl: 'rgba(255, 238, 88, .45)' },
};
export const boardOf = (k) => BOARDS[k] || BOARDS.green;

export const PIECE_SETS = {
  classic: { name: 'Classic', set: defaultPieces },
  neo: { name: 'Neo', set: neoPieces },
  staunton: { name: 'Staunton', set: stauntonPieces },
  royal: { name: 'Royal', set: royalPieces },
  minimal: { name: 'Minimal', set: minimalPieces },
  gothic: { name: 'Gothic', set: gothicPieces },
};
export const piecesOf = (k) => (PIECE_SETS[k] || PIECE_SETS.classic).set;
