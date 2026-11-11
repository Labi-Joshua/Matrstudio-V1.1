/**
 * A small QR Code encoder for the 2-step set-up screen: byte mode, error correction level M,
 * versions 1 to 10 (up to 213 bytes, enough for an otpauth:// address). It exists so the shared
 * secret is drawn in the browser and never sent to a third-party QR service or added as a
 * dependency. Returns the module matrix (true = dark), without the quiet zone.
 */

type Grid = boolean[][];

// Level M, per version (index = version): [ecc codewords per block, [blocks, data codewords per block][]]
const M_TABLE: readonly (readonly [number, readonly (readonly [number, number])[]])[] = [
  [0, []],
  [10, [[1, 16]]],
  [16, [[1, 28]]],
  [26, [[1, 44]]],
  [18, [[2, 32]]],
  [24, [[2, 43]]],
  [16, [[4, 27]]],
  [18, [[4, 31]]],
  [
    22,
    [
      [2, 38],
      [2, 39],
    ],
  ],
  [
    22,
    [
      [3, 36],
      [2, 37],
    ],
  ],
  [
    26,
    [
      [4, 43],
      [1, 44],
    ],
  ],
];

const ALIGN: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

export const MAX_QR_BYTES = 213;

const dataCapacity = (version: number): number =>
  (M_TABLE[version]?.[1] ?? []).reduce((sum, [blocks, size]) => sum + blocks * size, 0);

// --- Reed-Solomon over GF(256), polynomial 0x11D -----------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] as number;
}
const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : (EXP[(LOG[a] as number) + (LOG[b] as number)] as number);

function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] as number) ^ (poly[j] as number);
      next[j + 1] = (next[j + 1] as number) ^ gfMul(poly[j] as number, EXP[i] as number);
    }
    poly = next;
  }
  return poly;
}

function eccFor(data: readonly number[], degree: number): number[] {
  const gen = generator(degree);
  const rem = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ (rem.shift() as number);
    rem.push(0);
    for (let i = 0; i < degree; i++) {
      rem[i] = (rem[i] as number) ^ gfMul(gen[i + 1] as number, factor);
    }
  }
  return rem;
}

// --- codewords ---------------------------------------------------------------------------------
function buildCodewords(bytes: readonly number[], version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, dataCapacity(version) * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let pad = 0xec; data.length < dataCapacity(version); pad ^= 0xec ^ 0x11) data.push(pad);

  const [eccLen, groups] = M_TABLE[version] as (typeof M_TABLE)[number];
  const blocks: { data: number[]; ecc: number[] }[] = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      const chunk = data.slice(at, at + size);
      at += size;
      blocks.push({ data: chunk, ecc: eccFor(chunk, eccLen) });
    }
  }
  const out: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < longest; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i] as number);
  }
  for (let i = 0; i < eccLen; i++) for (const b of blocks) out.push(b.ecc[i] as number);
  return out;
}

// --- format and version information ------------------------------------------------------------
const bitLength = (n: number) => 32 - Math.clz32(n);

/** Remainder of `value` divided by `poly` over GF(2). */
function gf2Remainder(value: number, poly: number): number {
  const polyLen = bitLength(poly);
  let rem = value;
  while (bitLength(rem) >= polyLen) rem ^= poly << (bitLength(rem) - polyLen);
  return rem;
}

/** 15-bit format information for level M (bits 00) and a mask number. */
export function formatBits(mask: number): number {
  const data = mask; // (00 << 3) | mask
  return ((data << 10) | gf2Remainder(data << 10, 0x537)) ^ 0x5412;
}

/** 18-bit version information (versions 7 and up). */
export function versionBits(version: number): number {
  return (version << 12) | gf2Remainder(version << 12, 0x1f25);
}

const MASKS: readonly ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

const at = (g: Grid, r: number, c: number): boolean => (g[r] as boolean[])[c] as boolean;

function penalty(g: Grid): number {
  const n = g.length;
  let total = 0;
  const line = (get: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i < n; i++) {
      if (get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) total += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) total += 3 + (run - 5);
    const text = Array.from({ length: n }, (_, i) => (get(i) ? "1" : "0")).join("");
    for (const pattern of ["10111010000", "00001011101"]) {
      let from = text.indexOf(pattern);
      while (from !== -1) {
        total += 40;
        from = text.indexOf(pattern, from + 1);
      }
    }
  };
  for (let r = 0; r < n; r++) line((i) => at(g, r, i));
  for (let c = 0; c < n; c++) line((i) => at(g, i, c));
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = at(g, r, c);
      if (v === at(g, r, c + 1) && v === at(g, r + 1, c) && v === at(g, r + 1, c + 1)) total += 3;
    }
  }
  let dark = 0;
  for (const row of g) for (const cell of row) if (cell) dark++;
  total += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return total;
}

/** Encodes `text`. Throws when it does not fit versions 1 to 10 at level M. */
export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  const needs = (v: number) => Math.ceil((4 + (v >= 10 ? 16 : 8) + bytes.length * 8) / 8);
  while (version <= 10 && needs(version) > dataCapacity(version)) version++;
  if (version > 10) throw new Error("QR text too long");

  const size = 17 + version * 4;
  const modules: Grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved: Grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const put = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    (modules[r] as boolean[])[c] = dark;
    (reserved[r] as boolean[])[c] = true;
  };
  const reserve = (r: number, c: number) => {
    (reserved[r] as boolean[])[c] = true;
  };

  const finder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const edge = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        put(top + dr, left + dc, !edge && (ring || core));
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    put(6, i, i % 2 === 0);
    put(i, 6, i % 2 === 0);
  }
  const centres = ALIGN[version] as readonly number[];
  for (const cr of centres) {
    for (const cc of centres) {
      const onFinder =
        (cr === 6 && cc === 6) || (cr === 6 && cc === size - 7) || (cr === size - 7 && cc === 6);
      if (onFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          put(cr + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }
  for (let i = 0; i < 9; i++) {
    reserve(8, i);
    reserve(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    reserve(8, size - 1 - i);
    reserve(size - 1 - i, 8);
  }
  put(size - 8, 8, true); // the fixed dark module
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserve(i, size - 11 + j);
        reserve(size - 11 + j, i);
      }
    }
  }

  // Data, zigzag from the bottom right.
  const bits: boolean[] = [];
  for (const cw of buildCodewords(bytes, version)) {
    for (let i = 7; i >= 0; i--) bits.push(((cw >>> i) & 1) === 1);
  }
  let next = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (at(reserved, row, c)) continue;
        (modules[row] as boolean[])[c] = next < bits.length ? (bits[next] as boolean) : false;
        next++;
      }
    }
    upward = !upward;
  }

  const drawInfo = (g: Grid, mask: number) => {
    const fmt = formatBits(mask);
    const f = (i: number) => ((fmt >>> i) & 1) === 1;
    const setBit = (r: number, c: number, v: boolean) => {
      (g[r] as boolean[])[c] = v;
    };
    for (let i = 0; i <= 5; i++) setBit(i, 8, f(i));
    setBit(7, 8, f(6));
    setBit(8, 8, f(7));
    setBit(8, 7, f(8));
    for (let i = 9; i < 15; i++) setBit(8, 14 - i, f(i));
    for (let i = 0; i < 8; i++) setBit(8, size - 1 - i, f(i));
    for (let i = 8; i < 15; i++) setBit(size - 15 + i, 8, f(i));
    if (version >= 7) {
      const info = versionBits(version);
      for (let i = 0; i < 18; i++) {
        const dark = ((info >>> i) & 1) === 1;
        const a = Math.floor(i / 3);
        const b = (i % 3) + size - 11;
        setBit(a, b, dark);
        setBit(b, a, dark);
      }
    }
  };

  let best: Grid = modules;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    const test = MASKS[mask] as (r: number, c: number) => boolean;
    const g = modules.map((row) => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!at(reserved, r, c) && test(r, c)) (g[r] as boolean[])[c] = !at(g, r, c);
      }
    }
    drawInfo(g, mask);
    const score = penalty(g);
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return best;
}
