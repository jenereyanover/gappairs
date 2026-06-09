/** Fisher–Yates shuffle. Returns a new array; does not mutate the input. */
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  let currentIndex = arr.length;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }

  return arr;
}

/** The emoji tile set. Needs at least (12 * 12) / 2 = 72 entries for the largest grid. */
export const EMOJI_SET = [
  // food
  "🍕", "🍔", "🍟", "🌭", "🍿", "🥤", "🧁", "🍰", "🍫", "🍩",
  "🍪", "🍦", "🍨", "🥛", "🍎", "🍌", "🍉", "🍇", "🍒", "🍑",
  "🍊", "🍓", "🥝", "🍍", "🥥", "🍅", "🥕", "🌽", "🥦", "🍄",
  "🥨", "🧀", "🥐", "🍞", "🥞", "🧇",
  // animals
  "🐱", "🐶", "🐸", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🐮",
  "🦁", "🐷", "🐵", "🐔", "🐧", "🐦", "🦄", "🐙", "🦋", "🐝",
  "🐞", "🦀", "🐬", "🐠", "🐢", "🦉", "🦒", "🦓", "🦔", "🐳",
  // nature
  "🔥", "🌈", "🌊", "🌍", "🌙", "🌟", "🌞", "🌻", "🌷", "🌺",
  "🌸", "🌹",
  // objects
  "⚽", "🏀", "🎈", "🎁", "🎸", "🎮", "🚀", "✈️", "🚗", "🎯",
  "💎", "🔔",
];

/**
 * Build a `dimension` x `dimension` board where every emoji appears exactly twice.
 * Picks (dimension² / 2) distinct emojis, duplicates each, shuffles, then lays
 * them row by row into the grid.
 */
export function generateTiles(
  dimension: number,
  pool: string[] = EMOJI_SET
): string[][] {
  const pairCount = Math.floor((dimension * dimension) / 2);

  if (pool.length < pairCount) {
    throw new Error(
      `Not enough emojis for a ${dimension}x${dimension} board: need ${pairCount}, have ${pool.length}.`
    );
  }

  const chosen = shuffle(pool).slice(0, pairCount);
  const deck = shuffle([...chosen, ...chosen]);

  const tiles: string[][] = [];
  for (let row = 0; row < dimension; row++) {
    tiles.push(deck.slice(row * dimension, row * dimension + dimension));
  }

  return tiles;
}

/**
 * Build exactly `pairCount` distinct tile faces. With a selected image set, use
 * ITS images only — falling back to emojis for the remainder ONLY when the set
 * doesn't have enough images for the grid. With no set, it's all emojis.
 */
export function mixFaces(images: string[], pairCount: number): string[] {
  const uniq = Array.from(new Set(images)); // de-dupe across combined sets
  if (!uniq.length) return shuffle(EMOJI_SET).slice(0, pairCount);
  const imgs = shuffle(uniq).slice(0, pairCount);
  if (imgs.length >= pairCount) return imgs; // enough images — no emojis mixed in
  const emojis = shuffle(EMOJI_SET).slice(0, pairCount - imgs.length);
  return shuffle([...imgs, ...emojis]);
}
