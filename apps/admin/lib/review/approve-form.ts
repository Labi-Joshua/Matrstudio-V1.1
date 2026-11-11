import type { ApproveBody, SubmissionDetail } from "./types";

export type ApproveForm = ApproveBody["record"] & { credit: boolean };
export type ApproveErrors = Partial<Record<keyof ApproveBody["record"], string>>;

export function initialForm(s: SubmissionDetail): ApproveForm {
  return {
    title: s.title,
    creator: s.creator ?? s.source,
    type: s.type,
    topic: s.topic ?? "",
    level: s.level ?? "",
    intro: s.note,
    placement: "library",
    credit: true,
  };
}

const LIMITS = { title: 140, creator: 100, intro: 400 } as const;

export function validate(form: ApproveForm): ApproveErrors {
  const errors: ApproveErrors = {};
  if (!form.title.trim()) errors.title = "Add a title.";
  else if (form.title.length > LIMITS.title)
    errors.title = `Keep it under ${LIMITS.title} characters.`;
  if (!form.creator.trim()) errors.creator = "Say who made it.";
  else if (form.creator.length > LIMITS.creator)
    errors.creator = `Keep it under ${LIMITS.creator} characters.`;
  if (!form.type) errors.type = "Pick a type.";
  if (!form.topic) errors.topic = "Pick a topic.";
  if (!form.level) errors.level = "Pick a level.";
  if (!form.intro.trim()) errors.intro = "Write the intro learners will see.";
  else if (form.intro.length > LIMITS.intro)
    errors.intro = `Keep it under ${LIMITS.intro} characters.`;
  return errors;
}

export function toBody(form: ApproveForm): ApproveBody {
  const { credit, ...record } = form;
  return {
    record: {
      ...record,
      title: record.title.trim(),
      creator: record.creator.trim(),
      intro: record.intro.trim(),
    },
    credit,
  };
}

/** "4 of 4" for the From the submission panel. */
export function checklistSummary(s: Pick<SubmissionDetail, "autoChecks">): string {
  const passed = s.autoChecks.filter((c) => c.status === "pass").length;
  return `${passed} of ${s.autoChecks.length}`;
}
