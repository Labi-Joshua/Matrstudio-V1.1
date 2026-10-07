import { JoinDialog } from "./join-dialog";
import { asset, Badge, Container, canvas } from "./primitives";

// Figma: Waitlist / Hero (62:794). The photo composition spans x 250-1100 of the 1240 frame,
// so it is laid out on an 850 x 402 canvas with x offset by -250.
const scene = canvas(850, 402);

export const atmosphere = {
  warm: "radial-gradient(closest-side, rgba(255,219,194,0.4), rgba(255,219,194,0))",
  cool: "radial-gradient(closest-side, rgba(194,219,255,0.55), rgba(194,219,255,0))",
};

// Outer box = Figma rotation bounding box; inner = the card's own size and rotation.
const PHOTO_CARDS = [
  {
    src: "cta-photo-1.jpg",
    box: [192.5, 64.82, 117.045, 111.324],
    card: [103.242, 96.359],
    rotate: -9,
  },
  { src: "cta-photo-2.jpg", box: [491.86, 49.82, 95.919, 94.064], card: [90, 88], rotate: 4 },
  { src: "cta-photo-3.jpg", box: [182, 229.82, 96.79, 92.992], card: [92.296, 88.283], rotate: -3 },
  { src: "cta-photo-4.jpg", box: [330, 146.82, 109, 106], card: [109, 106], rotate: 0 },
  {
    src: "cta-photo-5.jpg",
    box: [480.92, 219.92, 114.903, 110.981],
    card: [103.599, 99.095],
    rotate: 7,
  },
] as const;

export function JoinCta() {
  return (
    <section className="px-4 py-8">
      <Container className="flex flex-col items-center">
        <div aria-hidden className="relative aspect-[850/402] w-full max-w-[850px]">
          <div
            className="absolute"
            style={{ ...scene(330, 25.09, 520, 560), background: atmosphere.warm }}
          />
          <div
            className="absolute"
            style={{ ...scene(0, 25.09, 520, 560), background: atmosphere.cool }}
          />
          <div
            className="absolute rounded-[40px] border border-border bg-bg-base opacity-35"
            style={scene(230, 70.09, 310, 268)}
          />
          {PHOTO_CARDS.map(({ src, box: [x, y, w, h], card: [cw, ch], rotate }) => (
            <div
              key={src}
              className="absolute flex items-center justify-center"
              style={scene(x, y, w, h)}
            >
              <div
                className="relative overflow-hidden rounded-[18px] shadow-e2"
                style={{
                  width: `${(cw / w) * 100}%`,
                  height: `${(ch / h) * 100}%`,
                  transform: rotate ? `rotate(${rotate}deg)` : undefined,
                }}
              >
                <img alt="" src={asset(src)} className="size-full object-cover" />
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex w-full flex-col items-center">
          <Badge tone="primary">Join Us</Badge>
          <h2 className="mt-1.5 text-center font-display font-medium text-[32px] text-text leading-10 tracking-[-0.64px]">
            Your design career, accelerated.
          </h2>
          <p className="mt-4 w-full max-w-[480px] text-center text-base text-text-secondary leading-[26px] tracking-[-0.08px]">
            We are opening our doors to a new era of collaborative design education. Secure your
            spot in the early access queue.
          </p>
          <JoinDialog className="mt-[34px] rounded-full bg-primary px-3.5 py-2.5 font-medium text-sm text-white leading-5 tracking-[-0.14px] transition-opacity hover:opacity-90" />
        </div>
      </Container>
    </section>
  );
}
