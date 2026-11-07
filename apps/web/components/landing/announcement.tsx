// Figma "Product landing page · V3": Announcement 740:34632. Icons are the Figma exports redrawn as
// inline SVG with currentColor, so they follow the theme.
import type { Announcement as AnnouncementData } from "../../lib/announcement";

export function Announcement({ announcement }: { announcement: AnnouncementData }) {
  return (
    <section aria-label="Announcement" className="border-border-soft border-y px-5 py-4 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-accent text-primary-text">
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6.75 14.25C6.75 15.4926 5.74264 16.5 4.5 16.5C3.25736 16.5 2.25 15.4926 2.25 14.25C2.25 13.0074 3.25736 12 4.5 12C5.74264 12 6.75 13.0074 6.75 14.25ZM6.75 14.25H13.125C13.8212 14.25 14.4889 13.9734 14.9812 13.4812C15.4734 12.9889 15.75 12.3212 15.75 11.625C15.75 10.9288 15.4734 10.2611 14.9812 9.76884C14.4889 9.27656 13.8212 9 13.125 9H4.875C4.17881 9 3.51113 8.72344 3.01884 8.23115C2.52656 7.73887 2.25 7.07119 2.25 6.375C2.25 5.67881 2.52656 5.01113 3.01884 4.51884C3.51113 4.02656 4.17881 3.75 4.875 3.75H11.25M11.25 3.75C11.25 4.99264 12.2574 6 13.5 6C14.7426 6 15.75 4.99264 15.75 3.75C15.75 2.50736 14.7426 1.5 13.5 1.5C12.2574 1.5 11.25 2.50736 11.25 3.75Z" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 font-medium text-[16px] text-text leading-6 tracking-[-0.16px]">
          {announcement.message}
        </p>
        <a
          href={announcement.href}
          className="flex shrink-0 items-center justify-center rounded-md border border-border-soft p-2 text-text-secondary hover:bg-bg-fill1 hover:text-text"
        >
          <span className="sr-only">{announcement.linkLabel}</span>
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 6V2H10M14 2L6.66667 9.33333M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333" />
          </svg>
        </a>
      </div>
    </section>
  );
}
