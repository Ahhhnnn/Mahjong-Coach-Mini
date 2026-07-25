import type { Tile } from '../core/tiles';

export type PuzzleAnalysis = {
  summary: string;
  lines: string[];
  tip?: string;
};

export type DiscardPuzzle = {
  id: string;
  mode: 'discard';
  variant?: 'basic' | 'advanced';
  title?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  hand: Tile[];
  melds?: { type: 'peng' | 'gang'; tiles: Tile[] }[];
  recommendedDiscards: Tile[];
  discussableDiscards?: Tile[];
  analysis: PuzzleAnalysis;
  rewards?: { xp: number; score: number };
};
