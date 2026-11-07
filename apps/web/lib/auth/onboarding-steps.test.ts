import { describe, expect, it } from "vitest";
import type { Me } from "./api";
import {
  answersFromMe,
  canContinue,
  clampStep,
  firstMissingStep,
  initialStep,
  nextStep,
  previousStep,
  progressFraction,
  rowStates,
  stepFromHash,
  stepNumber,
  stepToHash,
} from "./onboarding-steps";

const onboarding = (partial: Partial<Me["onboarding"]> = {}): Me["onboarding"] => ({
  goal: null,
  level: null,
  topics: [],
  completed: false,
  completedAt: null,
  ...partial,
});

describe("answersFromMe", () => {
  it("keeps known values and drops unknown ones and duplicates", () => {
    expect(
      answersFromMe(
        onboarding({
          goal: "old_goal",
          level: "advanced",
          topics: ["seo", "nope", "seo", "brand"],
        }),
      ),
    ).toEqual({ goal: null, level: "advanced", topics: ["seo", "brand"] });
  });
});

describe("initialStep", () => {
  it("starts new learners at the welcome screen", () => {
    expect(initialStep(onboarding())).toBe("welcome");
  });

  it("resumes at the first unanswered question", () => {
    expect(initialStep(onboarding({ goal: "learn_new_skill" }))).toBe("level");
    expect(initialStep(onboarding({ goal: "learn_new_skill", level: "beginner" }))).toBe("topics");
    expect(initialStep(onboarding({ level: "beginner" }))).toBe("goal");
  });

  it("goes to finding when everything is answered but not completed", () => {
    expect(
      initialStep(onboarding({ goal: "grow_in_role", level: "beginner", topics: ["seo"] })),
    ).toBe("finding");
  });

  it("sends finished learners to the dashboard unless they retake", () => {
    const done = onboarding({
      goal: "grow_in_role",
      level: "beginner",
      topics: ["seo"],
      completed: true,
    });
    expect(initialStep(done)).toBe("dashboard");
    expect(initialStep(done, { retake: true })).toBe("goal");
  });
});

describe("step order", () => {
  it("walks welcome to finding", () => {
    expect(nextStep("welcome")).toBe("goal");
    expect(nextStep("goal")).toBe("level");
    expect(nextStep("level")).toBe("topics");
    expect(nextStep("topics")).toBe("finding");
    expect(nextStep("recommended")).toBeNull();
  });

  it("goes back one step, and from all paths to where we came from", () => {
    expect(previousStep("goal")).toBe("welcome");
    expect(previousStep("level")).toBe("goal");
    expect(previousStep("topics")).toBe("level");
    expect(previousStep("recommended")).toBe("topics");
    expect(previousStep("paths", true)).toBe("recommended");
    expect(previousStep("paths", false)).toBe("topics");
    expect(previousStep("welcome")).toBeNull();
  });

  it("numbers the three questions", () => {
    expect(stepNumber("goal")).toBe(1);
    expect(stepNumber("topics")).toBe(3);
    expect(stepNumber("welcome")).toBeNull();
    expect(progressFraction("level")).toBeCloseTo(2 / 3);
    expect(progressFraction("paths")).toBe(0);
  });
});

describe("canContinue", () => {
  it("needs an answer, and at least one topic", () => {
    const empty = answersFromMe(onboarding());
    expect(canContinue("goal", empty)).toBe(false);
    expect(canContinue("goal", { ...empty, goal: "switch_careers" })).toBe(true);
    expect(canContinue("level", { ...empty, level: "beginner" })).toBe(true);
    expect(canContinue("topics", empty)).toBe(false);
    expect(canContinue("topics", { ...empty, topics: ["seo"] })).toBe(true);
    expect(canContinue("welcome", empty)).toBe(true);
  });
});

describe("clampStep", () => {
  const none = answersFromMe(onboarding());
  const goalOnly = answersFromMe(onboarding({ goal: "switch_careers" }));
  const all = answersFromMe(
    onboarding({ goal: "switch_careers", level: "beginner", topics: ["seo"] }),
  );

  it("never skips an unanswered question", () => {
    expect(clampStep("level", none)).toBe("goal");
    expect(clampStep("topics", none)).toBe("goal");
    expect(clampStep("topics", goalOnly)).toBe("level");
    expect(clampStep("recommended", goalOnly)).toBe("level");
    expect(clampStep("paths", none)).toBe("goal");
  });

  it("lets complete answers reach any step", () => {
    for (const step of ["welcome", "goal", "level", "topics", "recommended", "paths"] as const) {
      expect(clampStep(step, all)).toBe(step);
    }
    expect(clampStep("level", goalOnly)).toBe("level");
  });
});

describe("hash", () => {
  it("round trips the addressable steps", () => {
    for (const step of ["welcome", "goal", "level", "topics", "recommended", "paths"] as const) {
      expect(stepFromHash(stepToHash(step))).toBe(step);
    }
  });

  it("has no address for finding and ignores unknown hashes", () => {
    expect(stepFromHash("#finding")).toBeNull();
    expect(stepFromHash("#whatever")).toBeNull();
    expect(stepFromHash("")).toBe("welcome");
  });
});

describe("firstMissingStep and rowStates", () => {
  it("names the first unanswered question", () => {
    expect(firstMissingStep(answersFromMe(onboarding()))).toBe("goal");
    expect(firstMissingStep(answersFromMe(onboarding({ goal: "switch_careers" })))).toBe("level");
  });

  it("marks answered rows done and the current one active", () => {
    expect(rowStates("level")).toEqual({
      goal: "done",
      level: "active",
      topics: "idle",
      path: "idle",
    });
    expect(rowStates("finding")).toEqual({
      goal: "done",
      level: "done",
      topics: "done",
      path: "active",
    });
    expect(rowStates("welcome").goal).toBe("idle");
  });
});
