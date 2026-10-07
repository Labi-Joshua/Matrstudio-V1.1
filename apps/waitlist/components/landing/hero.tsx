import { cn } from "@matr/ui";
import { WaitlistForm } from "../waitlist-form";
import { asset, Badge, Container, canvas, revealDelay, ThemedImg } from "./primitives";

// Figma: Waitlist / Hero (62:543), mosaic-grid frame is 606 x 670.273.
const mosaic = canvas(606, 670.273);

// Orange shapes lift on hover (extra effects noted inline). Photos gain a light frame, grey
// shapes only change colour, and the black tiles have no hover state.
const tile =
  "group absolute transition-all duration-500 ease-smooth hover:z-10 hover:-translate-y-1.5";
const greyTile = "group absolute bg-bg-fill2 transition-colors duration-500 ease-smooth";
// Photos stay put and gain a light frame (border/border soft), drawn as an outside ring so
// nothing shifts.
const photoTile =
  "absolute overflow-hidden ring-0 ring-border-soft transition-shadow duration-500 ease-smooth hover:ring-4";

function Mosaic() {
  return (
    <div
      aria-hidden
      className="relative aspect-[606/670.273] w-full max-w-[606px] shrink-0 [container-type:inline-size]"
    >
      {/* Quarter-circle swings its curve from the top-right corner to the top-left. */}
      <div
        className={cn(
          tile,
          "rounded-[4%_80%_4%_4%] bg-primary duration-500 hover:rounded-[80%_4%_4%_4%]",
        )}
        data-reveal="pop"
        style={{ ...mosaic(0, 0, 183.636, 183.636), ...revealDelay(200) }}
      />
      <div
        className={cn(photoTile, "rounded-[14.691px]")}
        data-reveal="pop"
        style={{ ...mosaic(198.327, 0, 209.345, 183.636), ...revealDelay(270) }}
      >
        <img
          alt=""
          src={asset("hero-photo-top.jpg")}
          className="absolute top-0 left-[-0.29%] h-full w-[131.58%] max-w-none"
        />
      </div>
      <div
        className={cn(
          greyTile,
          "flex items-center justify-center overflow-clip rounded-lg hover:bg-primary-accent",
        )}
        data-reveal="pop"
        style={{ ...mosaic(422.364, 0, 183.636, 183.636), ...revealDelay(340) }}
      >
        <span className="font-display text-[7.273cqw] text-bg-fill4 leading-none transition-colors duration-500 ease-smooth group-hover:text-primary">
          ✦
        </span>
      </div>
      <div
        className={cn(greyTile, "rounded-lg hover:bg-primary-focus")}
        data-reveal="pop"
        style={{ ...mosaic(0, 198.327, 183.636, 168.945), ...revealDelay(410) }}
      />
      <div
        className="absolute overflow-clip rounded-lg bg-ink"
        data-reveal="pop"
        style={{ ...mosaic(198.327, 198.327, 209.345, 168.945), ...revealDelay(480) }}
      >
        <div className="absolute inset-[-53.92%_-102.08%_0_0]">
          <ThemedImg name="hero-tile-professionals.svg" className="block size-full max-w-none" />
        </div>
      </div>
      {/* Quarter-circle swings its curve from the bottom-left corner to the bottom-right. */}
      <div
        className={cn(
          tile,
          "rounded-[4%_4%_4%_80%/4.35%_4.35%_4.35%_86.96%] bg-primary duration-500 hover:rounded-[4%_4%_80%_4%/4.35%_4.35%_86.96%_4.35%]",
        )}
        data-reveal="pop"
        style={{ ...mosaic(422.364, 198.327, 183.636, 168.945), ...revealDelay(550) }}
      />
      <div
        className={cn(photoTile, "rounded-[14.691px]")}
        data-reveal="pop"
        style={{ ...mosaic(0, 381.964, 209.345, 183.636), ...revealDelay(620) }}
      >
        <img alt="" src={asset("hero-photo-bottom-left.jpg")} className="size-full object-cover" />
      </div>
      <div
        className={cn(greyTile, "rounded-full hover:bg-primary-focus")}
        data-reveal="pop"
        style={{ ...mosaic(224.036, 381.964, 183.636, 183.636), ...revealDelay(690) }}
      />
      <div
        className="absolute overflow-clip rounded-lg bg-ink"
        data-reveal="pop"
        style={{ ...mosaic(422.364, 381.964, 183.636, 183.636), ...revealDelay(760) }}
      >
        <div className="absolute inset-[-30.71%_0_0_-110.76%]">
          <ThemedImg name="hero-tile-projects.svg" className="block size-full max-w-none" />
        </div>
      </div>
      <div
        className={cn(tile, "rounded-lg bg-primary hover:rounded-[40px]")}
        data-reveal="pop"
        style={{ ...mosaic(0, 580.291, 209.345, 91.818), ...revealDelay(830) }}
      />
      <div
        className={cn(photoTile, "rounded-lg")}
        data-reveal="pop"
        style={{ ...mosaic(224.036, 580.291, 381.964, 91.818), ...revealDelay(900) }}
      >
        <img
          alt=""
          src={asset("hero-photo-bottom-right.jpg")}
          className="absolute top-[-456.11%] left-0 h-[624.41%] w-full max-w-none"
        />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    // Figma 62:543: 56px from the navbar to the hero body.
    <section className="flex flex-col items-center px-4 pt-14 pb-8">
      <Container className="flex flex-col items-center gap-12 lg:flex-row lg:justify-between lg:px-6">
        {/* Spacing per Figma: badge→headline 20px, headline→body 32px, copy→form 32px. */}
        <div
          id="join"
          data-reveal="left"
          className="flex w-full max-w-[500px] flex-col items-start gap-8"
        >
          <div className="flex w-full flex-col items-start gap-8">
            <div className="flex w-full flex-col items-start gap-5">
              <Badge dot>Built for the design community</Badge>
              <h1 className="font-display font-medium text-[40px] text-text leading-[46px] tracking-[-1.2px] sm:text-[52px] sm:leading-[58px] sm:tracking-[-1.56px]">
                The collaborative learning hub and community for product designers.
              </h1>
            </div>
            <p className="text-lg text-text-secondary leading-7 tracking-[-0.18px]">
              Level up your craft with self-paced learning paths, active chat rooms, and
              peer-contributed resources.
            </p>
          </div>
          <WaitlistForm variant="ink" source="waitlist-hero" className="w-full" />
        </div>
        <Mosaic />
      </Container>
    </section>
  );
}
