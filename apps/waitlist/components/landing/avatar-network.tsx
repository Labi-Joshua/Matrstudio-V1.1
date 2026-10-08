import { Avatar, asset, canvas, revealDelay } from "./primitives";

// Figma: the avatar network shared by Waitlist / Join Us (62:794) and Our Mission / Hero
// (134:1682). A 900 x 480 frame.
const W = 900;
const H = 480;
const net = canvas(W, H);

// Network portraits 1-19: [x, y, size, photo]. Ten photos, some repeated across the two clusters.
const PEOPLE: [number, number, number, number][] = [
  [34, 100, 36, 1],
  [121, 38, 40, 2],
  [200, 70, 36, 3],
  [132, 118, 62, 4],
  [245, 140, 50, 5],
  [112, 197, 44, 6],
  [215, 228, 48, 7],
  [228, 325, 40, 8],
  [241, 393, 38, 9],
  [419, 144, 52, 10],
  [547, 73, 46, 5],
  [650, 117, 44, 4],
  [738, 83, 32, 3],
  [797, 118, 48, 2],
  [510, 190, 62, 9],
  [451, 258, 30, 10],
  [467, 316, 48, 7],
  [659, 354, 46, 6],
  [755, 396, 34, 8],
];

// Dotted connections, from the Figma layers "Dotted connection a–b": the people they join,
// then the rotated layer's bounding box [x, y, w, h], its rotation and its length. The
// endpoints sit at the portrait edges, so they are derived from this geometry, not the centres.
export type Link = [number, number, number, number, number, number, number, number];

const LINKS: Link[] = [
  [1, 2, 69.41, 70.86, 52.516, 35.404, -33.99, 63.336],
  [1, 4, 72.23, 123.65, 58.027, 16.206, 15.6, 60.248],
  [1, 6, 65.24, 134.3, 53.006, 65.288, 50.93, 84.096],
  [2, 3, 162.43, 66.35, 36.002, 14.027, 21.29, 38.638],
  [2, 4, 146.4, 80.36, 8.606, 35.596, 76.41, 36.622],
  [3, 4, 185.77, 103.6, 18.17, 20.152, 132.04, 27.134],
  [3, 5, 229.75, 105.4, 24.577, 36.393, 55.97, 43.914],
  [4, 6, 143.57, 180.41, 6.418, 15.492, 112.5, 16.769],
  [5, 7, 248.06, 191.38, 12.539, 35.191, 109.61, 37.358],
  [4, 5, 196.63, 154.03, 45.682, 6.831, 8.5, 46.19],
  [6, 7, 157.85, 226.5, 55.392, 17.409, 17.45, 58.064],
  [7, 8, 241.6, 278.87, 4.184, 43.232, 84.47, 43.434],
  [8, 9, 252.05, 367.64, 4.067, 22.705, 79.85, 23.066],
  [6, 8, 150.77, 237.54, 81.796, 90.406, 47.86, 121.918],
  [7, 9, 242.51, 278.77, 14.623, 111.417, 82.52, 112.372],
  [10, 16, 450.79, 198.42, 11.611, 56.947, 78.48, 58.119],
  [10, 15, 470.61, 183.61, 40.364, 21.443, 27.98, 45.706],
  [10, 11, 469.95, 109.25, 77.672, 45.982, -30.63, 90.262],
  [11, 12, 593.96, 106.1, 55.005, 23.188, 22.86, 59.693],
  [11, 15, 548.68, 121.33, 15.44, 66.552, 103.06, 68.32],
  [12, 13, 694.47, 107.33, 42.454, 20.709, -26, 47.236],
  [12, 14, 696.99, 139.5, 97.011, 1.953, 1.15, 97.03],
  [13, 14, 769.99, 109.26, 28.287, 18.154, 32.69, 33.612],
  [11, 13, 596, 96.42, 139.006, 2.266, 0.93, 139.024],
  [15, 16, 480.79, 240.37, 32.267, 22.371, 145.27, 39.263],
  [16, 17, 472.29, 289.86, 9.268, 24.839, 69.54, 26.512],
  [15, 17, 501.46, 252.35, 26.371, 62.762, 112.79, 68.077],
  [10, 17, 452.57, 197.99, 31.373, 115.944, 74.86, 120.114],
  [18, 19, 706.14, 386.66, 47.29, 18.916, 21.8, 50.933],
  [17, 18, 517.51, 345.13, 138.967, 26.92, 10.96, 141.551],
  [15, 18, 563.8, 246.22, 100.768, 111.488, 47.89, 150.278],
];

const toLine = ([a, b, x, y, w, h, deg, length]: Link) => {
  const rad = (deg * Math.PI) / 180;
  const dx = (Math.cos(rad) * length) / 2;
  const dy = (Math.sin(rad) * length) / 2;
  const [cx, cy] = [x + w / 2, y + h / 2];
  return { a, b, x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
};

// Hovering a portrait brings its own connections forward and fades the rest.
const highlight = [
  ".avatar-net:has([data-n]:hover) line { opacity: 0.25; }",
  ...PEOPLE.map(
    (_, i) =>
      `.avatar-net:has([data-n="${i + 1}"]:hover) [data-e~="${i + 1}"] { opacity: 1; stroke-width: 1.5; }`,
  ),
].join("\n");

/** Below md it runs edge to edge (past the 16px page gutter) so the portraits stay legible. */
export function AvatarNetwork({ extraLinks = [] }: { extraLinks?: Link[] }) {
  const lines = [...LINKS, ...extraLinks].map(toLine);
  return (
    <div
      aria-hidden
      data-reveal="fade"
      className="avatar-net relative -mx-4 aspect-[900/480] w-[calc(100%+2rem)] max-w-none md:mx-0 md:w-full md:max-w-[900px]"
    >
      <style>{highlight}</style>
      <div data-reveal-child="fade" className="absolute inset-0" style={revealDelay(700)}>
        <svg
          aria-hidden
          viewBox={`0 0 ${W} ${H}`}
          className="size-full overflow-visible stroke-primary-border"
          fill="none"
        >
          {lines.map(({ a, b, x1, y1, x2, y2 }) => (
            <line
              key={`${a}-${b}`}
              data-e={`${a} ${b}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={1}
              strokeDasharray="1 4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="opacity-55 transition-[opacity,stroke-width] duration-500 ease-smooth"
            />
          ))}
        </svg>
      </div>
      {PEOPLE.map(([x, y, size, photo], index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed composition; position is identity
          key={index}
          data-n={index + 1}
          className="absolute rounded-full ring-0 ring-border-soft transition-[scale,box-shadow] duration-500 ease-smooth hover:z-10 hover:scale-110 hover:ring-4"
          style={net(x, y, size, size)}
        >
          <Avatar
            src={asset(`cta-avatar-${photo}.jpg`)}
            reveal="pop"
            className="size-full"
            style={revealDelay(100 + index * 45)}
          />
        </span>
      ))}
    </div>
  );
}
