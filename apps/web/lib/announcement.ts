/**
 * The announcement bar under the hero. Its copy is managed from the admin dashboard (apps/admin),
 * not edited in code: the page reads it only through getAnnouncement(), and renders no bar when
 * there is none. Today this returns a placeholder; it moves to D1 with the rest of the content.
 */
export type Announcement = {
  message: string;
  /** Where the arrow button goes; an internal path or an absolute URL. */
  href: string;
  /** Accessible name of the arrow button. */
  linkLabel: string;
};

export function getAnnouncement(): Announcement | null {
  return {
    message: "New: Design systems and dev handoff paths are live.",
    href: "/paths",
    linkLabel: "See the new paths",
  };
}
