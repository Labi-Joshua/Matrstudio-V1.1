"use client";

import { useEffect, useRef, useState } from "react";
import { stepGoal } from "../../lib/app/settings-reminders";
import {
  canSaveTopics,
  type Loaded,
  savedToast,
  saveFailureToast,
  toggleTopic,
} from "../../lib/app/settings-state";
import { getMe } from "../../lib/auth/api";
import { saveOnboarding } from "../../lib/auth/onboarding-api";
import { type Prefs, WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from "../../lib/auth/prefs-api";
import type { TopicSlug } from "../../lib/catalogue/types";
import {
  isLevelId,
  isTopicId,
  LEVEL_OPTIONS,
  type LevelId,
  TOPIC_OPTIONS,
} from "../../lib/pages/onboarding-content";
import { SparklesIcon } from "../app/icons";
import { FOCUS } from "../app/ui";
import { LEVEL_ICONS } from "../onboarding/icons";
import { LoadedView } from "./skeleton";
import { useSettingsToast } from "./toast";
import { Section, SettingCard } from "./ui";
import { useLoaded } from "./use-loaded";
import { usePrefs } from "./use-prefs";

type Onboarding = { topics: TopicSlug[]; level: LevelId | null };

async function loadOnboarding(signal: AbortSignal) {
  const result = await getMe(signal);
  if (!result.ok) return result;
  const { topics, level } = result.data.onboarding;
  return {
    ok: true as const,
    data: {
      topics: topics.filter(isTopicId),
      level: isLevelId(level) ? level : null,
    } as Onboarding,
  };
}

/** /settings/learning (Figma 14): interests, experience level and the weekly goal. */
export function LearningSection() {
  const onboarding = useLoaded(loadOnboarding);
  const prefs = usePrefs();
  const state: Loaded<{ o: Onboarding; p: Prefs }> =
    onboarding.state.status === "error"
      ? onboarding.state
      : prefs.state.status === "error"
        ? prefs.state
        : onboarding.state.status === "ready" && prefs.state.status === "ready"
          ? { status: "ready", data: { o: onboarding.state.data, p: prefs.state.data } }
          : { status: "loading" };
  return (
    <LoadedView
      state={state}
      what="your learning preferences"
      onRetry={() => {
        onboarding.reload();
        prefs.reload();
      }}
    >
      {({ o, p }) => (
        <Body
          initial={o}
          prefs={p}
          saveGoal={(goal) => prefs.update({ learning: { weeklyGoal: goal } }, p)}
        />
      )}
    </LoadedView>
  );
}

function Body({
  initial,
  prefs,
  saveGoal,
}: {
  initial: Onboarding;
  prefs: Prefs;
  saveGoal: (goal: number) => void;
}) {
  const toast = useSettingsToast();
  const [topics, setTopics] = useState(initial.topics);
  const [level, setLevel] = useState(initial.level);
  const [goal, setGoal] = useState(prefs.learning.weeklyGoal);
  const [keepOne, setKeepOne] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const saveGoalRef = useRef(saveGoal);
  saveGoalRef.current = saveGoal;
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function saveTopics(next: TopicSlug[], before: TopicSlug[]) {
    setTopics(next);
    const result = await saveOnboarding({ topics: next });
    if (result.ok) return toast(savedToast());
    setTopics(before);
    toast(saveFailureToast(result));
  }

  function pickTopic(id: TopicSlug) {
    const next = toggleTopic(topics, id) as TopicSlug[];
    if (!canSaveTopics(next)) {
      setKeepOne(true);
      return;
    }
    setKeepOne(false);
    void saveTopics(next, topics);
  }

  async function pickLevel(next: LevelId) {
    if (next === level) return;
    const before = level;
    setLevel(next);
    const result = await saveOnboarding({ level: next });
    if (result.ok) return toast(savedToast());
    setLevel(before);
    toast(saveFailureToast(result));
  }

  function step(delta: 1 | -1) {
    const next = stepGoal(goal, delta, WEEKLY_GOAL_MIN, WEEKLY_GOAL_MAX);
    if (next === goal) return;
    setGoal(next);
    window.clearTimeout(timer.current);
    // One save once the learner stops clicking.
    timer.current = window.setTimeout(() => saveGoalRef.current(next), 600);
  }

  return (
    <>
      <Section
        title="Interests"
        description="We use these for Picked for you and Recommended next on Home."
      >
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Interests</legend>
          <div className="grid gap-3 xl:grid-cols-2">
            {TOPIC_OPTIONS.map((t) => {
              const on = topics.includes(t.id);
              return (
                <SettingCard
                  key={t.id}
                  id={`topic-${t.id}`}
                  icon={<SparklesIcon />}
                  title={t.title}
                  description={on ? "Shown on Home" : "Not following"}
                  on={on}
                  control={
                    <input
                      type="checkbox"
                      checked={on}
                      aria-labelledby={`topic-${t.id}-t`}
                      aria-describedby={`topic-${t.id}-d`}
                      onChange={() => pickTopic(t.id)}
                      className={`size-5 shrink-0 accent-primary ${FOCUS}`}
                    />
                  }
                />
              );
            })}
          </div>
        </fieldset>
        <p
          role="status"
          className="min-h-[18px] text-[13px] text-text-secondary leading-[18px] tracking-[-0.13px]"
        >
          {keepOne ? "Keep at least one interest so we can recommend things." : ""}
        </p>
      </Section>

      <Section title="Experience level" description="Helps us suggest where to start.">
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="sr-only">Experience level</legend>
          {LEVEL_OPTIONS.map((l) => {
            const on = level === l.id;
            const Icon = LEVEL_ICONS[l.id];
            return (
              <SettingCard
                key={l.id}
                id={`level-${l.id}`}
                icon={<Icon />}
                title={l.title}
                description={l.description}
                on={on}
                control={
                  <input
                    type="radio"
                    name="level"
                    checked={on}
                    aria-labelledby={`level-${l.id}-t`}
                    aria-describedby={`level-${l.id}-d`}
                    onChange={() => pickLevel(l.id)}
                    className={`size-5 shrink-0 accent-primary ${FOCUS}`}
                  />
                }
              />
            );
          })}
        </fieldset>
      </Section>

      <Section title="Weekly goal" description="How many lessons you want to finish each week.">
        <div className="flex flex-col gap-1.5">
          <span
            id="goal-label"
            className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]"
          >
            Lessons per week
          </span>
          <fieldset
            aria-labelledby="goal-label"
            className="m-0 flex h-10 w-[148px] items-center overflow-hidden rounded-lg border border-border bg-bg-base shadow-e1"
          >
            <button
              type="button"
              aria-label="Fewer lessons per week"
              onClick={() => step(-1)}
              disabled={goal <= WEEKLY_GOAL_MIN}
              className={`h-full w-10 shrink-0 text-[18px] text-text-secondary hover:text-text disabled:opacity-40 ${FOCUS}`}
            >
              −
            </button>
            <output
              aria-live="polite"
              className="flex-1 text-center text-[14px] text-text leading-5 tracking-[-0.14px]"
            >
              {goal}
            </output>
            <button
              type="button"
              aria-label="More lessons per week"
              onClick={() => step(1)}
              disabled={goal >= WEEKLY_GOAL_MAX}
              className={`h-full w-10 shrink-0 text-[18px] text-text-secondary hover:text-text disabled:opacity-40 ${FOCUS}`}
            >
              +
            </button>
          </fieldset>
        </div>
      </Section>
    </>
  );
}
