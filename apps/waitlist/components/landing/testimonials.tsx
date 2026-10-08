import { Avatar, asset, Badge, Container, canvas, revealDelay } from "./primitives";

// Figma: Waitlist / Hero (62:677), mosaic-row frame is 1240 x 500.
const row = canvas(1240, 500);

// [x, y, w, h] of the "Coworking photo" placeholders.
const PHOTOS: Array<[number, number, number, number]> = [
  [0, 73.885, 132.857, 187.687],
  [0, 280.552, 132.857, 187.687],
  [158.163, 48.579, 132.857, 137.075],
  [158.163, 202.524, 132.857, 137.075],
  [158.163, 356.47, 132.857, 137.075],
  [316.327, 73.885, 132.857, 295.238],
  [474.49, 23.273, 132.857, 297.347],
  [632.653, 23.273, 132.857, 297.347],
  [790.816, 73.885, 132.857, 295.238],
  [948.98, 48.579, 132.857, 137.075],
  [948.98, 202.524, 132.857, 137.075],
  [948.98, 356.47, 132.857, 137.075],
  [1107.143, 73.885, 132.857, 187.687],
  [1107.143, 280.552, 132.857, 187.687],
];

const AVATARS: Array<[string, number, number]> = [
  ["gallery-avatar-1.webp", 590, 250.727],
  ["gallery-avatar-2.webp", 103, 240.727],
  ["gallery-avatar-3.webp", 748, 79.727],
  ["gallery-avatar-4.webp", 274, 111.727],
  ["gallery-avatar-5.webp", 1064, 219.727],
];

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  /** Avatar image layers, bottom first, as stacked in the Figma avatar component. */
  avatar: string[];
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "The V1 resource index was pinned to my browser. If the new learning paths are as well-organized as that directory, this is going to be incredibly useful.",
    name: "Abraham O.",
    role: "UI UX Newbie",
    avatar: ["testimonial-abraham-base.webp", "testimonial-abraham.webp"],
  },
  {
    quote:
      "They always kept the fluff out of the original directory. I’m really excited to see that same level of curation applied to self-paced courses and a community.",
    name: "Faith A.",
    role: "Brand Designer",
    avatar: ["testimonial-faith-base.webp", "testimonial-faith.webp"],
  },
  {
    quote:
      "I found some of my most-used tools through the first version of Matrstudio. Adding structured learning and chat rooms feels like the perfect next step.",
    name: "Ebube V.",
    role: "Graphic Designer",
    avatar: ["testimonial-ebube.webp"],
  },
];

function Stars() {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label="Rated 5 out of 5">
      {[0, 1, 2, 3, 4].map((i) => (
        <img
          decoding="async"
          loading="lazy"
          key={i}
          alt=""
          src={asset("icon-star.svg")}
          className="block size-6 group-hover:animate-twinkle"
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}

function TestimonialCard({ quote, name, role, avatar, delay }: Testimonial & { delay: number }) {
  return (
    <figure
      data-reveal
      className="group flex flex-1 flex-col items-start gap-4"
      style={revealDelay(delay)}
    >
      <Stars />
      <blockquote className="min-h-24 text-base text-text leading-6 tracking-[-0.08px]">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="flex items-center gap-2.5">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-full ring-primary transition-all duration-500 group-hover:scale-110 group-hover:ring-2">
          {avatar.map((src) => (
            <img
              decoding="async"
              loading="lazy"
              key={src}
              alt=""
              src={asset(src)}
              className="absolute inset-0 size-full object-cover"
            />
          ))}
        </span>
        <span className="flex flex-col items-start gap-0.5 whitespace-nowrap">
          <span className="font-display font-semibold text-sm text-text leading-5 tracking-[-0.07px]">
            {name}
          </span>
          <span className="text-text-secondary text-xs leading-4">{role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  return (
    <section data-reveal="section" className="px-4 py-12">
      <Container className="flex flex-col items-center">
        <div aria-hidden data-reveal="fade" className="relative aspect-[1240/500] w-full">
          {PHOTOS.map(([x, y, w, h], i) => (
            <div
              key={`${x}-${y}`}
              data-reveal-child="pop"
              className="absolute rounded-lg bg-bg-fill2 transition-all duration-500 ease-smooth hover:-translate-y-1.5 hover:bg-bg-fill4 md:rounded-[18px]"
              style={{ ...row(x, y, w, h), ...revealDelay(i * 50) }}
            />
          ))}
          {AVATARS.map(([src, x, y], i) => (
            <Avatar
              key={src}
              src={asset(src)}
              className="absolute aspect-square ring-primary transition-all duration-500 ease-smooth hover:z-10 hover:scale-125 hover:ring-2"
              reveal="pop"
              style={{ ...row(x, y), width: `${(60 / 1240) * 100}%`, ...revealDelay(500 + i * 90) }}
            />
          ))}
        </div>

        {/* Overlaps the bottom of the mosaic on wider screens, as in the design. */}
        <div
          data-reveal
          className="mt-8 flex w-full max-w-[660px] flex-col items-center gap-3.5 text-center md:-mt-[8.688%]"
        >
          <Badge>Testimonials</Badge>
          <h2 className="font-display font-medium text-[32px] text-text leading-10 tracking-[-0.64px]">
            Built for the design community
          </h2>
          <p className="text-lg text-text-secondary leading-7 tracking-[-0.18px]">
            Join a network of UI/UX professionals, product designers, and visual artists committed
            to high-fidelity work.
          </p>
        </div>

        <div className="mt-12 flex w-full flex-col gap-12 md:mt-[62.73px] md:flex-row">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={t.name} {...t} delay={i * 120} />
          ))}
        </div>
      </Container>
    </section>
  );
}
