import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  HOME_FIXTURES,
  type HomeVariant,
  homeIntro,
  pickHomeVariant,
  progressPercent,
  SECTION_TIPS,
} from "../../lib/app/dashboard";
import { NOTIFICATION_FIXTURES } from "../../lib/app/notifications";
import { HomeError, OfflineNotice } from "./home-states";
import { ProgressHome } from "./home-variants";
import {
  NotificationFilters,
  NotificationList,
  NotificationsEmpty,
  NotificationsError,
  NotificationsLoading,
} from "./notification-list";

const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);
const now = new Date(2026, 10, 11, 14, 0, 0);
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0).toISOString();

describe("notification views", () => {
  const items = NOTIFICATION_FIXTURES.items.map((item, index) => ({
    ...item,
    createdAt: at(11 - Math.min(index, 5), 10),
  }));

  it("renders every kind with its title and unread markers", () => {
    const html = render(createElement(NotificationList, { items, now }));
    for (const item of items) expect(html).toContain(item.title);
    expect(html).toContain("Today");
    expect(html).toContain("Earlier");
    expect(html.match(/>Unread</g)).toHaveLength(2);
  });

  it("hides the group headings in the plain list", () => {
    const html = render(createElement(NotificationList, { items, now, plain: true }));
    expect(html).not.toContain(">Today<");
  });

  it("marks the active filter and shows the unread count", () => {
    const html = render(
      createElement(NotificationFilters, { filter: "unread", unread: 2, onChange: () => {} }),
    );
    expect(html).toContain("Unread 2");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("has the empty, error and loading states", () => {
    expect(render(createElement(NotificationsEmpty, {}))).toContain("You’re all caught up");
    expect(render(createElement(NotificationsEmpty, { filter: "unread" }))).toContain("No unread");
    const error = render(createElement(NotificationsError, { onRetry: () => {} }));
    expect(error).toContain("Notifications didn’t load");
    expect(error).toContain("Try again");
    const loading = render(createElement(NotificationsLoading));
    expect(loading).toContain("Loading notifications");
    expect(loading).toContain('aria-hidden="true"');
  });
});

describe("home layouts", () => {
  it("picks the layout from the data, new account without any", () => {
    expect(pickHomeVariant(null)).toBe("new-account");
    expect(pickHomeVariant(HOME_FIXTURES["in-progress"])).toBe("in-progress");
    expect(pickHomeVariant(HOME_FIXTURES["welcome-back"])).toBe("welcome-back");
    expect(pickHomeVariant(HOME_FIXTURES.finished)).toBe("finished");
    expect(pickHomeVariant({ ...HOME_FIXTURES["in-progress"], started: [] })).toBe("new-account");
  });

  it("words the intro of each layout", () => {
    const intro = (variant: Exclude<HomeVariant, "new-account">, hour = 9) =>
      homeIntro(variant, HOME_FIXTURES[variant], "Ada", hour);
    expect(intro("in-progress")).toEqual({
      title: "Good morning, Ada",
      subtitle: "You have two paths on the go. Pick up where you left off.",
    });
    expect(intro("in-progress", 20).title).toBe("Good evening, Ada");
    expect(intro("welcome-back")).toEqual({
      title: "Welcome back, Ada",
      subtitle: "It’s been 9 days. Here’s where you stopped.",
    });
    expect(intro("finished")).toEqual({
      title: "Congratulations, Ada",
      subtitle: "You finished UI/UX Foundations. Here’s what’s next.",
    });
    expect(homeIntro("finished", HOME_FIXTURES.finished, null, 9).title).toBe("Congratulations");
  });

  it("computes progress percentages safely", () => {
    expect(progressPercent(4, 10)).toBe(40);
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(12, 10)).toBe(100);
  });

  const view = (variant: Exclude<HomeVariant, "new-account">) =>
    render(
      createElement(ProgressHome, {
        variant,
        progress: HOME_FIXTURES[variant],
        firstName: "Ada",
        hour: 9,
        now,
      }),
    );

  it("renders learning in progress with one h1 and the sections", () => {
    const html = view("in-progress");
    expect(html.match(/<h1/g)).toHaveLength(1);
    for (const text of [
      "Continue learning",
      "Your paths",
      "Recommended next",
      "Continue lesson 5",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("Lesson 5 of 10 · 40%");
    expect(html).toContain('aria-valuenow="40"');
  });

  it("renders welcome back with what changed while away", () => {
    const html = view("welcome-back");
    expect(html).toContain("Pick up where you left off");
    expect(html).toContain("While you were away");
    expect(html).toContain("Your submission needs a change");
    expect(html).toContain("Last active 9 days ago");
  });

  it("renders the finished path with next steps, rating and other paths", () => {
    const html = view("finished");
    for (const text of [
      "You finished a path",
      "What to learn next",
      "Rate UI/UX Foundations",
      "Other paths in progress",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("Finished today");
  });

  it("keeps the design copy of the section tooltips", () => {
    expect(Object.keys(SECTION_TIPS)).toHaveLength(16);
    expect(SECTION_TIPS.whileAway).toContain("curator decisions on your submissions");
  });
});

describe("home states", () => {
  it("shows the offline strip only while offline", () => {
    expect(render(createElement(OfflineNotice, { offline: true }))).toContain("You’re offline");
    expect(render(createElement(OfflineNotice, { offline: false }))).not.toContain("offline");
  });

  it("offers Try again and Go to Paths when Home fails", () => {
    const html = render(createElement(HomeError, { onRetry: () => {} }));
    expect(html).toContain("We couldn’t load your home page");
    expect(html).toContain("Try again");
    expect(html).toContain("Go to Paths");
  });
});
