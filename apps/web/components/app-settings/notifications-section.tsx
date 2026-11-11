"use client";

import { DAY_LABELS, timeOptions, toggleDay } from "../../lib/app/settings-reminders";
import { type Prefs, type PrefsPatch, REMINDER_DAYS } from "../../lib/auth/prefs-api";
import {
  BellIcon,
  FileTextIcon,
  HelpCircleIcon,
  InboxIcon,
  MessageIcon,
  UploadIcon,
} from "../app/icons";
import { useSession } from "../app/session";
import { FOCUS } from "../app/ui";
import { LoadedView } from "./skeleton";
import { Section, SettingCard, Switch } from "./ui";
import { usePrefs } from "./use-prefs";

/** /settings/notifications (Figma 13): in-app and email switches, and the reminder days and time. */
export function NotificationsSection() {
  const { state, reload, update } = usePrefs();
  return (
    <LoadedView state={state} what="your notification settings" onRetry={reload}>
      {(prefs) => <Body prefs={prefs} save={(patch) => update(patch, prefs)} />}
    </LoadedView>
  );
}

function Body({ prefs, save }: { prefs: Prefs; save: (patch: PrefsPatch) => void }) {
  const { me } = useSession();
  const { notifications: n, email: e, reminders: r } = prefs;
  const row = (
    id: string,
    icon: React.ReactNode,
    title: string,
    description: string,
    on: boolean,
    change: (next: boolean) => void,
  ) => (
    <SettingCard
      id={id}
      icon={icon}
      title={title}
      description={description}
      on={on}
      control={
        <Switch checked={on} onChange={change} labelledBy={`${id}-t`} describedBy={`${id}-d`} />
      }
    />
  );

  return (
    <>
      <Section title="In the app" description="Shown under the bell in the top bar.">
        <div className="flex flex-col gap-3">
          {row(
            "n-sub",
            <UploadIcon />,
            "Submission updates",
            "When a curator approves, declines or asks for a change",
            n.submissions,
            (v) => save({ notifications: { submissions: v } }),
          )}
          {row(
            "n-les",
            <FileTextIcon />,
            "New lessons in your paths",
            "When a path you’re taking gets a new lesson",
            n.lessons,
            (v) => save({ notifications: { lessons: v } }),
          )}
          {row(
            "n-help",
            <HelpCircleIcon />,
            "Help centre replies",
            "When support replies or a report is fixed",
            n.helpReplies,
            (v) => save({ notifications: { helpReplies: v } }),
          )}
        </div>
      </Section>

      <Section title="Email" description={`Sent to ${me.email}.`}>
        <div className="flex flex-col gap-3">
          {row(
            "e-dig",
            <InboxIcon />,
            "Weekly digest",
            "Your progress and new resources, every Monday",
            e.digest,
            (v) => save({ email: { digest: v } }),
          )}
          {row(
            "e-rem",
            <BellIcon />,
            "Learning reminders",
            "A nudge on the days you choose below",
            e.reminders,
            (v) => save({ email: { reminders: v } }),
          )}
          {row(
            "e-news",
            <MessageIcon />,
            "Product news",
            "New features and paths, about once a month",
            e.news,
            (v) => save({ email: { news: v } }),
          )}
        </div>
        <p className="text-[13px] text-text-tertiary leading-[18px] tracking-[-0.13px]">
          Your choices are saved now. Digests, reminders and news are switched on separately as each
          one launches.
        </p>
      </Section>

      <Section title="Learning reminders" description="Pick the days and time you want a nudge.">
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="sr-only">Reminder days</legend>
          <div className="flex flex-wrap gap-2">
            {REMINDER_DAYS.map((day) => {
              const on = r.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => save({ reminders: { days: toggleDay(r.days, day) } })}
                  className={`h-9 rounded-full border px-3.5 font-medium text-[14px] leading-5 tracking-[-0.14px] ${FOCUS} ${
                    on
                      ? "border-text bg-text text-bg-base"
                      : "border-border bg-bg-base text-text-secondary hover:text-text"
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="reminder-time"
            className="font-medium text-[14px] text-text leading-5 tracking-[-0.14px]"
          >
            Time
          </label>
          <select
            id="reminder-time"
            value={r.time}
            onChange={(ev) => save({ reminders: { time: ev.target.value } })}
            className={`h-10 w-full max-w-[200px] rounded-lg border border-border bg-bg-base px-2.5 text-[16px] text-text shadow-e1 lg:text-[14px] ${FOCUS}`}
          >
            {timeOptions(r.time).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Section>
    </>
  );
}
