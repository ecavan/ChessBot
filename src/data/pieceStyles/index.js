import { neoPieces } from './neo';
import { gothicPieces } from './gothic';
import { minimalPieces } from './minimal';
import { royalPieces } from './royal';
import { stauntonPieces } from './staunton';

export const PIECE_STYLES = {
  classic: null,
  neo: neoPieces,
  gothic: gothicPieces,
  minimal: minimalPieces,
  royal: royalPieces,
  staunton: stauntonPieces,
};

export const PIECE_STYLE_NAMES = {
  classic: 'Classic',
  neo: 'Neo',
  gothic: 'Gothic',
  minimal: 'Minimal',
  royal: 'Royal',
  staunton: 'Staunton',
};
