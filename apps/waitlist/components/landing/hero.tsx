import { WaitlistForm } from "../waitlist-form";
import { asset, Badge, Container, canvas } from "./primitives";

// Figma: Waitlist / Hero (62:543), mosaic-grid frame is 606 x 670.273.
const mosaic = canvas(606, 670.273);

function Mosaic() {
  return (
    <div
      aria-hidden
      className="relative aspect-[606/670.273] w-full max-w-[606px] shrink-0 [container-type:inline-size]"
    >
      <div
        className="absolute bg-primary"
        style={{ ...mosaic(0, 0, 183.636, 183.636), borderRadius: "4% 80% 4% 4%" }}
      />
      <div
        className="absolute overflow-hidden rounded-[14.691px]"
        style={mosaic(198.327, 0, 209.345, 183.636)}
      >
        <img
          alt=""
          src={asset("hero-photo-top.jpg")}
          className="absolute top-0 left-[-0.29%] h-full w-[131.58%] max-w-none"
        />
      </div>
      <div
        className="absolute flex items-center justify-center overflow-clip rounded-lg bg-bg-fill2"
        style={mosaic(422.364, 0, 183.636, 183.636)}
      >
        <span className="font-display text-[7.273cqw] text-bg-fill4 leading-none">✦</span>
      </div>
      <div
        className="absolute rounded-lg bg-bg-fill2"
        style={mosaic(0, 198.327, 183.636, 168.945)}
      />
      <div
        className="absolute overflow-clip rounded-lg bg-ink"
        style={mosaic(198.327, 198.327, 209.345, 168.945)}
      >
        <div className="absolute inset-[-53.92%_-102.08%_0_0]">
          <img
            alt=""
            src={asset("hero-tile-professionals.svg")}
            className="block size-full max-w-none"
          />
        </div>
      </div>
      <div
        className="absolute bg-primary"
        style={{
          ...mosaic(422.364, 198.327, 183.636, 168.945),
          borderRadius: "4% 4% 4% 80% / 4.35% 4.35% 4.35% 86.96%",
        }}
      />
      <div
        className="absolute overflow-hidden rounded-[14.691px]"
        style={mosaic(0, 381.964, 209.345, 183.636)}
      >
        <img alt="" src={asset("hero-photo-bottom-left.jpg")} className="size-full object-cover" />
      </div>
      <div
        className="absolute rounded-full bg-bg-fill2"
        style={mosaic(224.036, 381.964, 183.636, 183.636)}
      />
      <div
        className="absolute overflow-clip rounded-lg bg-ink"
        style={mosaic(422.364, 381.964, 183.636, 183.636)}
      >
        <div className="absolute inset-[-30.71%_0_0_-110.76%]">
          <img
            alt=""
            src={asset("hero-tile-projects.svg")}
            className="block size-full max-w-none"
          />
        </div>
      </div>
      <div className="absolute rounded-lg bg-primary" style={mosaic(0, 580.291, 209.345, 91.818)} />
      <div
        className="absolute overflow-hidden rounded-lg"
        style={mosaic(224.036, 580.291, 381.964, 91.818)}
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
    <section className="flex flex-col items-center px-4 pt-12 pb-8">
      <Container className="flex flex-col items-center gap-12 lg:flex-row lg:justify-between lg:px-6">
        <div id="join" className="flex w-full max-w-[500px] flex-col items-start gap-8">
          <Badge dot>Built for the design community</Badge>
          <h1 className="font-display font-medium text-[40px] text-text leading-[46px] tracking-[-1.2px] sm:text-[52px] sm:leading-[58px] sm:tracking-[-1.56px]">
            The collaborative learning hub and community for product designers.
          </h1>
          <p className="text-lg text-text-secondary leading-7 tracking-[-0.18px]">
            Level up your craft with self-paced learning paths, active chat rooms, and
            peer-contributed resources.
          </p>
          <WaitlistForm variant="ink" source="waitlist-hero" className="w-full" />
        </div>
        <Mosaic />
      </Container>
    </section>
  );
}
