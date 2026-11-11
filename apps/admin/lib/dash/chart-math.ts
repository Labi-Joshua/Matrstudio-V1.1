/** Scales for the inline SVG charts. */

/** A round upper bound (1, 2, 5 x 10^n) and tick values from 0 to it. */
export function niceScale(max: number, ticks = 4): { max: number; ticks: number[] } {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const rough = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / pow;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return { max: top, ticks: out };
}

/** SVG path through points; a null breaks the line. */
export function linePath(points: ({ x: number; y: number } | null)[]): string {
  let d = "";
  let open = false;
  for (const p of points) {
    if (!p) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    open = true;
  }
  return d;
}

/** Evenly spaced x positions; one point sits in the middle. */
export function xAt(index: number, count: number, left: number, right: number): number {
  return count <= 1 ? (left + right) / 2 : left + ((right - left) * index) / (count - 1);
}
