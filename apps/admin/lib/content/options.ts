import type { Level, ResourceStatus, ResourceType } from "./types";

export const TYPE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "article", label: "Article" },
  { value: "tool", label: "Tool" },
  { value: "course", label: "Course" },
  { value: "template", label: "Template" },
  { value: "book", label: "Book" },
];

export const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "all", label: "All levels" },
];

/** Topics are managed in Settings (taxonomy); until that screen ships these are the seeded ones. */
export const TOPIC_OPTIONS = [
  "UI and UX",
  "Brand",
  "Design systems",
  "Product",
  "Motion",
  "Research",
];

export const LICENSE_OPTIONS = [
  "YouTube standard (link only)",
  "Open licence (CC BY)",
  "Public web page (link only)",
  "Free tool (link only)",
  "Other free to link",
];

export const STATUS_LABEL: Record<ResourceStatus, string> = {
  live: "Live",
  draft: "Draft",
  needs_fix: "Needs fix",
  retired: "Retired",
};

export const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? value;
