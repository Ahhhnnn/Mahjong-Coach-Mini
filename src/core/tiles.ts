/** Sichuan mahjong: 108 tiles, suits only (no honors). */

export type Suit = 'm' | 'p' | 's'; // 万 筒 条
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Tile = `${Rank}${Suit}`;
export type Seat = 'self' | 'xiajia' | 'duijia' | 'shangjia';

export const SUITS: Suit[] = ['m', 'p', 's'];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const SUIT_LABEL: Record<Suit, string> = {
  m: '万',
  p: '筒',
  s: '条',
};

export const RANK_CN: Record<Rank, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
};

export function isTile(v: string): v is Tile {
  return /^[1-9][mps]$/.test(v);
}

export function parseTile(t: Tile): { rank: Rank; suit: Suit } {
  return { rank: Number(t[0]) as Rank, suit: t[1] as Suit };
}

export function tileLabel(t: Tile): string {
  const { rank, suit } = parseTile(t);
  return `${RANK_CN[rank]}${SUIT_LABEL[suit]}`;
}

/** Sort: m < p < s, then rank. */
export function sortTiles(tiles: Tile[]): Tile[] {
  const order = (t: Tile) => {
    const { rank, suit } = parseTile(t);
    const si = suit === 'm' ? 0 : suit === 'p' ? 1 : 2;
    return si * 10 + rank;
  };
  return [...tiles].sort((a, b) => order(a) - order(b));
}

export function allTiles(): Tile[] {
  const out: Tile[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) out.push(`${r}${s}` as Tile);
  }
  return out;
}

/** Count map: key tile -> 0..4 */
export type TileCount = Record<Tile, number>;

export function emptyCount(): TileCount {
  const c = {} as TileCount;
  for (const t of allTiles()) c[t] = 0;
  return c;
}

export function countTiles(tiles: Tile[]): TileCount {
  const c = emptyCount();
  for (const t of tiles) c[t] = (c[t] ?? 0) + 1;
  return c;
}

export function countToList(c: TileCount): Tile[] {
  const out: Tile[] = [];
  for (const t of allTiles()) {
    for (let i = 0; i < (c[t] ?? 0); i++) out.push(t);
  }
  return out;
}

export function cloneCount(c: TileCount): TileCount {
  return { ...c };
}
