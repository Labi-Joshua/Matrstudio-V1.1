import type { ReactNode } from "react";

/**
 * Learner auth screens (Figma "User Auth and Onboarding"): no marketing nav or footer. Split
 * screen from lg up, the form column on the left (content 400px wide, centred) and the brand art
 * on the right inside a 16px frame; on phones just the form with 24px gutters (the art is not
 * shown, as in the mobile frames). Screens render into <main>.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg-base lg:gap-4 lg:p-4">
      <main className="flex min-w-0 flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <aside aria-hidden="true" className="relative hidden flex-1 lg:block">
        <div className="sticky top-4 h-[calc(100dvh-2rem)] overflow-hidden">
          <img
            src="/images/auth/sign-in-art.png"
            alt=""
            width={1365}
            height={2048}
            className="size-full object-cover"
          />
        </div>
      </aside>
    </div>
  );
}
