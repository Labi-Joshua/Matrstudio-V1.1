// Catalogue entities, shaped like the first-draft data model in AGENTS.md §7 (only the fields the
// landing page needs). When packages/db exists these become its row types; nothing here is
// specific to how the data is stored.

export type TopicSlug =
  | "ui-ux"
  | "brand"
  | "product"
  | "seo"
  | "social-media"
  | "design-systems"
  | "dev-handoff";

export type Level = "beginner" | "intermediate" | "advanced";
export type ResourceFormat = "video" | "article" | "docs" | "tool";
export type ResourceStatus = "live" | "hidden" | "broken";
export type PathStatus = "draft" | "published" | "archived";

export type Topic = { slug: TopicSlug; name: string };

export type Source = { slug: string; name: string; domain: string };

export type Resource = {
  id: string;
  title: string;
  /** Lessons link out to the original free source; we never re-host the content. */
  url: string;
  sourceSlug: string;
  format: ResourceFormat;
  lengthMinutes: number;
  topicSlug: TopicSlug;
  status: ResourceStatus;
};

export type Path = {
  slug: string;
  title: string;
  /** Shown as the quote in the topic's colour panel. */
  description: string;
  topicSlug: TopicSlug;
  level: Level;
  status: PathStatus;
};

/** A lesson in a path: which resource, in which position (0-based, ascending). */
export type PathLesson = { pathSlug: string; resourceId: string; position: number };

export type Catalogue = {
  topics: Topic[];
  sources: Source[];
  resources: Resource[];
  paths: Path[];
  pathLessons: PathLesson[];
};

/** What a topic panel shows: the stat chips ("paths, lessons, hours, levels"). */
export type TopicStats = {
  paths: number;
  lessons: number;
  /** Total length of the topic's lessons, in hours, to one decimal place. */
  hours: number;
  levels: Level[];
};
