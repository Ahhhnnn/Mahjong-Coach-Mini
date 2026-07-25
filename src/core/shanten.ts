/**
 * Shanten for standard form (4 melds + pair) and seven pairs.
 * Hand length should be 3n+1 (ready to draw) or 3n+2 (ready to discard).
 */

import {
  countTiles,
  RANKS,
  SUITS,
  type Suit,
  type Tile,
  type TileCount,
} from './tiles';

function suitArr(c: TileCount, s: Suit): number[] {
  return RANKS.map((r) => c[`${r}${s}` as Tile] ?? 0);
}

/** Standard-form shanten (no chiitoi). Lower is better; -1 = agari. */
export function shantenStandard(tiles: Tile[], fixedMelds = 0): number {
  const c = countTiles(tiles);
  let min = 8;

  const search = (
    counts: number[][],
    melds: number,
    tatsu: number,
    pairs: number,
    depth: number
  ) => {
    if (depth > 20) return;
    let si = 0;
    let ri = 0;
    outer: for (; si < 3; si++) {
      for (ri = 0; ri < 9; ri++) {
        if (counts[si][ri] > 0) break outer;
      }
    }
    if (si >= 3) {
      const m = melds;
      const p = pairs > 0 ? 1 : 0;
      const t = Math.min(tatsu, 4 - m);
      const s = 8 - 2 * m - t - p;
      if (s < min) min = s;
      return;
    }

    const v = counts[si][ri];

    if (v >= 3) {
      counts[si][ri] -= 3;
      search(counts, melds + 1, tatsu, pairs, depth + 1);
      counts[si][ri] += 3;
    }
    if (v >= 2) {
      counts[si][ri] -= 2;
      search(counts, melds, tatsu, pairs + 1, depth + 1);
      counts[si][ri] += 2;
    }
    if (ri <= 6 && counts[si][ri + 1] > 0 && counts[si][ri + 2] > 0) {
      counts[si][ri]--;
      counts[si][ri + 1]--;
      counts[si][ri + 2]--;
      search(counts, melds + 1, tatsu, pairs, depth + 1);
      counts[si][ri]++;
      counts[si][ri + 1]++;
      counts[si][ri + 2]++;
    }
    if (ri <= 7 && counts[si][ri + 1] > 0) {
      counts[si][ri]--;
      counts[si][ri + 1]--;
      search(counts, melds, tatsu + 1, pairs, depth + 1);
      counts[si][ri]++;
      counts[si][ri + 1]++;
    }
    if (ri <= 6 && counts[si][ri + 2] > 0) {
      counts[si][ri]--;
      counts[si][ri + 2]--;
      search(counts, melds, tatsu + 1, pairs, depth + 1);
      counts[si][ri]++;
      counts[si][ri + 2]++;
    }
    counts[si][ri]--;
    search(counts, melds, tatsu, pairs, depth + 1);
    counts[si][ri]++;
  };

  const counts = [suitArr(c, 'm'), suitArr(c, 'p'), suitArr(c, 's')];
  search(counts, fixedMelds, 0, 0, 0);
  return min;
}

/** Seven pairs shanten. -1 = agari. */
export function shantenChiitoi(tiles: Tile[]): number {
  const c = countTiles(tiles);
  let pairs = 0;
  let kinds = 0;
  for (const s of SUITS) {
    for (const r of RANKS) {
      const n = c[`${r}${s}` as Tile] ?? 0;
      if (n > 0) kinds++;
      pairs += Math.floor(n / 2);
    }
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

export function shanten(tiles: Tile[], fixedMelds = 0): number {
  if (fixedMelds > 0) return shantenStandard(tiles, fixedMelds);
  return Math.min(shantenStandard(tiles), shantenChiitoi(tiles));
}

/** Tiles that reduce shanten when drawn (ukeire). */
export function ukeire(
  tiles: Tile[],
  remaining?: Partial<Record<Tile, number>>,
  fixedMelds = 0
): { waits: Partial<Record<Tile, number>>; total: number; shanten: number } {
  const base = shanten(tiles, fixedMelds);
  const waits: Partial<Record<Tile, number>> = {};
  let total = 0;
  const c = countTiles(tiles);

  for (const s of SUITS) {
    for (const r of RANKS) {
      const t = `${r}${s}` as Tile;
      if ((c[t] ?? 0) >= 4) continue;
      const next = [...tiles, t];
      if (shanten(next, fixedMelds) < base) {
        const left = remaining?.[t] ?? Math.max(0, 4 - (c[t] ?? 0));
        if (left > 0) {
          waits[t] = left;
          total += left;
        }
      }
    }
  }
  return { waits, total, shanten: base };
}

/** After discarding each unique tile from 3n+2 hand, ukeire of resulting hand. */
export function discardUkeire(
  hand14: Tile[],
  remaining?: Partial<Record<Tile, number>>,
  fixedMelds = 0
): Record<
  Tile,
  { shanten: number; total: number; waits: Partial<Record<Tile, number>> }
> {
  const seen = new Set<Tile>();
  const out = {} as Record<
    Tile,
    { shanten: number; total: number; waits: Partial<Record<Tile, number>> }
  >;
  for (let i = 0; i < hand14.length; i++) {
    const d = hand14[i];
    if (seen.has(d)) continue;
    seen.add(d);
    const idx = hand14.indexOf(d);
    const hand = hand14.filter((_, j) => j !== idx);
    const u = ukeire(hand, remaining, fixedMelds);
    out[d] = { shanten: u.shanten, total: u.total, waits: u.waits };
  }
  return out;
}
