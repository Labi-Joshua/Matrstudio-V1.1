import { z } from "zod";

// Admin content API (packages/backend/ADMIN-CONTENT.md): request schemas shared with the admin app.

const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v ?? "");

export const RESOURCE_TYPES = [
  "video",
  "article",
  "tool",
  "course",
  "template",
  "book",
  "other",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export const RESOURCE_STATUSES = ["draft", "live", "retired", "needs_fix"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];
export const RESOURCE_RIGHTS = ["free_public", "unsure"] as const;
export const PATH_STATUSES = ["draft", "live", "unpublished"] as const;
export type PathStatus = (typeof PATH_STATUSES)[number];
export const DECLINE_REASONS = [
  "duplicate",
  "not_a_fit",
  "low_quality",
  "not_free",
  "other",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];
export const PROFILE_REPORT_REASONS = ["spam", "abusive", "impersonation", "other"] as const;

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .regex(/^https:\/\/[^\s/?#]+\S*$/);

const slugList = z
  .array(text(60))
  .max(10)
  .transform((t) => [...new Set(t)]);

export const resourcePreviewSchema = z.object({ url: httpsUrl }).strict();

const resourceFields = {
  type: z.enum(RESOURCE_TYPES),
  /** A topic slug or its name. */
  topic: text(60),
  level: text(60),
  license: optText(120),
  rights: z.enum(RESOURCE_RIGHTS).default("free_public"),
  durationMin: z.number().int().min(1).max(6000).nullable().optional(),
  intro: optText(600),
  learningGoal: optText(600),
  creator: optText(80),
  tags: slugList.default([]),
};

export const createResourceSchema = z
  .object({
    url: httpsUrl,
    title: text(200),
    ...resourceFields,
    // Where to add it as a lesson: a path and one of its modules.
    paths: z
      .array(z.object({ pathId: text(64), moduleId: text(64) }).strict())
      .max(20)
      .optional(),
    status: z.enum(["draft", "live"]).default("draft"),
  })
  .strict();
export type CreateResourceBody = z.input<typeof createResourceSchema>;

export const patchResourceSchema = z
  .object({
    title: text(200),
    creator: z.string().trim().max(80),
    type: resourceFields.type,
    topic: resourceFields.topic,
    level: resourceFields.level,
    license: z.string().trim().max(120),
    rights: z.enum(RESOURCE_RIGHTS),
    durationMin: z.number().int().min(1).max(6000).nullable(),
    intro: z.string().trim().max(600),
    learningGoal: z.string().trim().max(600),
    tags: slugList,
    status: z.enum(["draft", "live"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

export const fixLinkSchema = z
  .object({ url: httpsUrl, notifyReporters: z.boolean().default(false) })
  .strict();
export const retireSchema = z
  .object({ confirm: z.literal(true), notifyOwners: z.boolean().optional() })
  .strict();

export const createPathSchema = z
  .object({
    title: text(120),
    topic: text(60),
    level: text(60),
    time: optText(40),
    description: optText(1000),
  })
  .strict();

const bullets = z.array(text(160)).max(8);
export const patchPathSchema = z
  .object({
    title: text(120),
    topic: text(60),
    level: text(60),
    time: z.string().trim().max(40),
    description: z.string().trim().max(1000),
    showInExplore: z.boolean(),
    certificate: z.boolean(),
    inviteOnly: z.boolean(),
    outcomes: bullets,
    audience: bullets,
    // Full module order. Every existing lesson id must appear exactly once.
    modules: z
      .array(
        z
          .object({
            id: text(64).optional(),
            title: text(120),
            lessonIds: z.array(text(64)).max(90),
          })
          .strict(),
      )
      .max(30),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);

export const publishPathSchema = z.object({ featureTopOfExplore: z.boolean().optional() }).strict();
export const addLessonsSchema = z
  .object({ resourceIds: z.array(text(64)).min(1).max(30), moduleId: text(64) })
  .strict();
export const patchLessonSchema = z.object({ intro: optText(600) }).strict();
export const removeLessonSchema = z
  .object({ message: z.string().trim().max(300).nullable().optional() })
  .strict();

export const assignSchema = z
  .object({ assignee: z.union([z.literal("me"), text(64), z.null()]) })
  .strict();

export const approveSubmissionSchema = z
  .object({
    record: z
      .object({
        title: text(200),
        creator: optText(80),
        type: z.enum(RESOURCE_TYPES),
        topic: text(60),
        level: text(60),
        intro: optText(600),
        placement: z.enum(["library", "library_and_path"]).default("library"),
        license: optText(120),
        rights: z.enum(RESOURCE_RIGHTS).default("free_public"),
        durationMin: z.number().int().min(1).max(6000).nullable().optional(),
        learningGoal: optText(600),
        tags: slugList.default([]),
      })
      .strict(),
    credit: z.boolean().default(true),
  })
  .strict();
export const requestChangeSchema = z.object({ message: text(500) }).strict();
export const declineSubmissionSchema = z
  .object({
    reason: z.enum(DECLINE_REASONS),
    note: optText(500),
    duplicateOf: text(64).optional(),
  })
  .strict();
export const dismissReportSchema = z.object({ note: optText(300) }).strict();
export const hideProfileSchema = z
  .object({ message: text(300), notifyReporters: z.boolean().optional() })
  .strict();

export const reportProfileSchema = z
  .object({
    username: text(30),
    reason: z.enum(PROFILE_REPORT_REASONS),
    note: optText(500),
  })
  .strict();

export const taxonomyCreateSchema = z
  .object({ kind: z.enum(["topic", "tag", "level"]), name: text(60) })
  .strict();
export const taxonomyPatchSchema = z.object({ name: text(60) }).strict();
export const taxonomyDeleteSchema = z
  .object({ mode: z.enum(["remove", "move"]).optional(), into: text(64).optional() })
  .strict();
export const taxonomyMergeSchema = z.object({ into: text(64) }).strict();

export const homeCurationSchema = z
  .object({
    featuredPaths: z.array(text(64)).max(6),
    libraryPicks: z.array(text(64)).max(12),
    popularRules: z
      .object({
        rankBy: z.enum(["opens", "saves", "completions"]),
        window: z.enum(["7d", "30d", "90d"]),
        hideReported: z.boolean(),
        minLearners: z.number().int().min(1).max(100000).nullable(),
      })
      .strict(),
  })
  .strict();

export const emailTemplateSchema = z.object({ subject: text(150), body: text(4000) }).strict();

export const nudgeRulesSchema = z
  .object({
    enabled: z.boolean(),
    firstAfterDays: z.number().int().min(1).max(60),
    secondAfterDays: z.number().int().min(1).max(60),
    maxPerWeek: z.number().int().min(1).max(7),
  })
  .strict()
  .refine((v) => v.secondAfterDays > v.firstAfterDays);

export const queueTargetsSchema = z
  .object({
    submissionDays: z.number().int().min(1).max(30),
    linkReportDays: z.number().int().min(1).max(30),
    firstReplyDays: z.number().int().min(1).max(30),
    autoResolveDays: z.number().int().min(1).max(60),
    workingDays: z
      .array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]))
      .min(1)
      .max(7)
      .transform((d) => [...new Set(d)]),
  })
  .strict();
