// Auth emails. Copy (subjects, preview text, body, button labels) is taken from the Figma file
// rT5liCfJz3U8isIiaGF7OO, page "User Auth and Onboarding", email frames 668:11133 (sign-in
// paused), 668:11203 (confirm your email), 668:11261 (reset), 668:11319 (password changed) and
// their inbox previews. Layout reuses the branded shell from email-templates.ts.
// Deviations: the reset link lives 15 minutes (spec section 4), not the 60 minutes drawn in Figma.
// The magic-link and "email changed" emails have no Figma frame; their copy follows the same voice.
import { C, DARK_CSS, esc, FONT_BODY, FONT_HEAD, themedImg } from "./email-templates";

export type AuthEmailMessage =
  | { type: "confirm-email"; to: string; link: string }
  | { type: "confirm-email-change"; to: string; link: string }
  | { type: "magic-link"; to: string; link: string }
  | { type: "reset-password"; to: string; link: string }
  | { type: "password-updated"; to: string; when: string; device: string }
  | { type: "too-many-attempts"; to: string; when: string; device: string }
  | { type: "email-changed"; to: string; newEmailHint: string; when: string; device: string }
  // Support. `subject` is the learner's own ticket subject (escaped when rendered).
  | { type: "support-received"; to: string; subject: string; kind: "support" | "report" }
  | { type: "support-reply"; to: string; subject: string; message: string }
  | {
      type: "support-closed";
      to: string;
      subject: string;
      status: "resolved" | "fixed" | "cant_reproduce";
      /** What the admin told the learner (fixed, can't reproduce). */
      message?: string;
    }
  // Waitlist invites sent from the admin portal (14 days; one reminder).
  | { type: "waitlist-invite"; to: string; link: string }
  | { type: "waitlist-reminder"; to: string; link: string }
  // Account moderation by an admin. `reason` is a short phrase chosen from a fixed list.
  | { type: "account-suspended"; to: string; reason: string; message?: string }
  | { type: "account-restored"; to: string }
  // Admin portal. The link is built by the producer on PUBLIC_ADMIN_URL.
  | { type: "admin-invite"; to: string; link: string; invitedBy: string | null; role: string }
  | { type: "admin-signin-paused"; to: string; when: string; device: string }
  // Plain staff-written message (review outcomes, template test sends). Escaped when rendered.
  | { type: "staff-message"; to: string; subject: string; message: string };

type Layout = {
  subject: string;
  preview: string;
  tag: string;
  title: string;
  body: string;
  details?: Array<[string, string]>;
  button?: { label: string; href: string };
  expires?: string;
  note?: string;
  fallbackLink?: string;
  footerReason: string;
};

function render(webUrl: string, l: Layout) {
  const img = `${webUrl}/images/email`;
  const year = new Date().getUTCFullYear();
  const p = (cls: string, style: string, body: string) =>
    `<p class="${cls}" style="margin:0;${style}">${body}</p>`;
  const muted = (size: number, lh: number, extra = "") =>
    `font-family:${FONT_BODY};font-size:${size}px;line-height:${lh}px;color:${C.muted};${extra}`;
  const row = (inner: string, pad = "0 0 24px") =>
    `<tr><td align="left" style="padding:${pad};">${inner}</td></tr>`;

  const details = l.details
    ? `<tr><td style="padding:0 0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="m-note" style="background-color:${C.note};border-radius:12px;">${l.details
        .map(
          ([k, v]) =>
            `<tr><td class="m-muted" style="padding:12px 16px;${muted(14, 20)}">${esc(k)}</td><td align="right" class="m-text" style="padding:12px 16px;font-family:${FONT_BODY};font-weight:500;font-size:14px;line-height:20px;color:${C.text};">${esc(v)}</td></tr>`,
        )
        .join("")}</table></td></tr>`
    : "";
  const button = l.button
    ? row(
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${C.primary};border-radius:8px;"><a href="${esc(l.button.href)}" target="_blank" style="display:inline-block;padding:10px 14px;font-family:${FONT_BODY};font-weight:500;font-size:16px;line-height:24px;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(l.button.label)}</a></td></tr></table>`,
        "0 0 12px",
      )
    : "";
  const fallback = l.fallbackLink
    ? `${row(p("m-muted", muted(13, 18), "Button not working? Paste this link into your browser:"), "0 0 6px")}${row(
        `<a href="${esc(l.fallbackLink)}" target="_blank" style="font-family:${FONT_BODY};font-weight:500;font-size:13px;line-height:18px;color:${C.primary};text-decoration:none;word-break:break-all;">${esc(l.fallbackLink)}</a>`,
        "0 0 24px",
      )}`
    : "";

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(l.subject)}</title>
<style>${DARK_CSS}</style>
</head>
<body class="m-page" style="margin:0;padding:0;background-color:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(l.preview)}${"&nbsp;&zwnj;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="m-page" style="background-color:${C.page};">
<tr><td align="center" style="padding:40px 16px 48px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td align="center" style="padding:0 0 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="m-logo" style="background-color:${C.page};background-image:linear-gradient(${C.page}, ${C.page});border-radius:999px;padding:8px 14px;">
          <a href="${esc(webUrl)}" style="text-decoration:none;display:block;">${themedImg(img, "logo", 95, 15, "matrstudio.")}</a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td class="m-card m-pad" style="background-color:${C.card};border:1px solid ${C.border};border-radius:16px;padding:40px 32px 32px;box-shadow:0 1px 1px rgba(25,24,27,0.04);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row(`<span class="m-badge" style="display:inline-block;background-color:${C.focus};color:${C.primary};border-radius:6px;padding:3px 8px;font-family:${FONT_HEAD};font-weight:500;font-size:13px;line-height:18px;">${esc(l.tag)}</span>`, "0 0 12px")}
        ${row(p("m-text", `font-family:${FONT_HEAD};font-weight:500;font-size:32px;line-height:40px;color:${C.text};`, esc(l.title)), "0 0 12px")}
        ${row(p("m-muted", muted(16, 24), esc(l.body)), "0 0 24px")}
        ${details}
        ${button}
        ${l.expires ? row(p("m-muted", muted(13, 18), esc(l.expires)), "0 0 24px") : ""}
        ${l.note ? row(p("m-muted", muted(16, 24), esc(l.note)), "0 0 24px") : ""}
        ${fallback}
        <tr><td style="border-top:1px solid ${C.rule};font-size:0;line-height:0;padding:0 0 24px;">&nbsp;</td></tr>
        <tr><td>
          ${p("m-text", `font-family:${FONT_HEAD};font-weight:500;font-size:16px;line-height:24px;color:${C.text};`, "The Matr Studio Team")}
          ${p("m-muted", muted(13, 18), `Here if you need us: <a href="mailto:support@matrstudio.com" style="color:${C.primary};text-decoration:none;">support@matrstudio.com</a>`)}
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:32px 0 12px;">
      ${p("m-muted", muted(13, 18, "text-align:center;"), esc(l.footerReason))}
    </td></tr>
    <tr><td align="center">
      ${p("m-muted", muted(13, 18, "text-align:center;"), `Matr Studio · <a href="${esc(webUrl)}" style="color:${C.muted};">matrstudio.com</a> · <a href="${esc(`${webUrl}/privacy`)}" style="color:${C.muted};">Privacy</a> · © ${year}`)}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    l.title,
    "",
    l.body,
    ...(l.details ? ["", ...l.details.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(l.button ? ["", `${l.button.label}: ${l.button.href}`] : []),
    ...(l.expires ? ["", l.expires] : []),
    ...(l.note ? ["", l.note] : []),
    "",
    "The Matr Studio Team",
    "Here if you need us: support@matrstudio.com",
    "",
    l.footerReason,
  ].join("\n");
  return { subject: l.subject, html, text };
}

/** User text inside a sentence: no line breaks, bounded length. */
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 120);

const ACCOUNT_REASON = "You’re getting this because you have a Matr Studio account.";

/** Renders a queued message. Links in `msg` were built by the producer from PUBLIC_WEB_URL. */
export function renderAuthEmail(webUrl: string, msg: AuthEmailMessage) {
  switch (msg.type) {
    case "confirm-email":
      return render(webUrl, {
        subject: "Confirm your email to finish setting up Matr Studio",
        preview: "One click and your account is ready.",
        tag: "Welcome",
        title: "Welcome aboard.",
        body: "You’re one step away from your first learning path. Confirm your email to finish setting up your account:",
        button: { label: "Confirm my email", href: msg.link },
        expires: "This link expires in 24 hours.",
        note: "Then pick a goal and we’ll match you with a free path in UI/UX, brand or product design.",
        fallbackLink: msg.link,
        footerReason: `You’re getting this because ${msg.to} was used to create a Matr Studio account.`,
      });
    case "confirm-email-change":
      return render(webUrl, {
        subject: "Confirm your new email for Matr Studio",
        preview: "One click and your new address is saved.",
        tag: "Email change",
        title: "Confirm your new email.",
        body: "Confirm this address to finish changing the email on your Matr Studio account:",
        button: { label: "Confirm my email", href: msg.link },
        expires: "This link expires in 24 hours.",
        note: "Didn’t ask for this? Ignore it. Your email stays the same until you confirm.",
        fallbackLink: msg.link,
        footerReason: `You’re getting this because ${msg.to} was entered as a new email on a Matr Studio account.`,
      });
    case "magic-link":
      return render(webUrl, {
        subject: "Your Matr Studio sign-in link",
        preview: "Use this link within 15 minutes to sign in.",
        tag: "Sign in",
        title: "Sign in to Matr Studio.",
        body: "Use the button below to sign in. No password needed:",
        button: { label: "Sign in", href: msg.link },
        expires: "This link expires in 15 minutes and works once.",
        note: "Didn’t ask for this? Ignore it. Nothing happens unless you open the link.",
        fallbackLink: msg.link,
        footerReason: ACCOUNT_REASON,
      });
    case "reset-password":
      return render(webUrl, {
        subject: "Reset your Matr Studio password",
        preview: "Use this link within 15 minutes to choose a new password.",
        tag: "Reset password",
        title: "Reset your password.",
        body: "Someone, hopefully you, asked to reset your Matr Studio password. Use the button below to pick a new one:",
        button: { label: "Reset password", href: msg.link },
        expires: "This link expires in 15 minutes.",
        note: "Didn’t ask for this? Ignore it. Your password stays the same.",
        fallbackLink: msg.link,
        footerReason: ACCOUNT_REASON,
      });
    case "password-updated":
      return render(webUrl, {
        subject: "Your Matr Studio password was changed",
        preview: "If this was you, there’s nothing else to do.",
        tag: "Password changed",
        title: "Password changed.",
        body: "Your Matr Studio password was just changed. Here’s when and where:",
        details: [
          ["When", msg.when],
          ["Device", msg.device],
        ],
        button: { label: "Reset password", href: `${webUrl}/forgot-password` },
        note: "Wasn’t you? Reset your password right away and reply to this email so we can help.",
        footerReason: ACCOUNT_REASON,
      });
    case "too-many-attempts":
      return render(webUrl, {
        subject: "Unusual sign-in activity on your Matr Studio account",
        preview: "We paused sign-in for 15 minutes to keep your account safe.",
        tag: "Sign-in paused",
        title: "Sign-in paused.",
        body: "We saw 5 wrong passwords on your account, so we’ve paused sign-in for 15 minutes to keep it safe.",
        details: [
          ["When", msg.when],
          ["Device", msg.device],
        ],
        button: { label: "Reset password", href: `${webUrl}/forgot-password` },
        note: "If this was you, wait 15 minutes and try again. If it wasn’t, reset your password now.",
        footerReason: ACCOUNT_REASON,
      });
    case "email-changed":
      return render(webUrl, {
        subject: "Your Matr Studio email address was changed",
        preview: "If this wasn’t you, secure your account now.",
        tag: "Email changed",
        title: "Email changed.",
        body: `The email on your Matr Studio account was just changed to ${msg.newEmailHint}. Here’s when and where:`,
        details: [
          ["When", msg.when],
          ["Device", msg.device],
        ],
        button: { label: "This wasn’t me", href: `${webUrl}/forgot-password` },
        note: "Wasn’t you? Reset your password right away and reply to this email so we can help. We’ve signed you out everywhere.",
        footerReason: ACCOUNT_REASON,
      });
    case "support-received":
      return render(webUrl, {
        subject: msg.kind === "report" ? "We got your report" : "We got your message",
        preview: "We’ll get back to you here and in the app.",
        tag: msg.kind === "report" ? "Report received" : "Message received",
        title: "We’ve got it.",
        body: `Thanks for writing to us. We received “${oneLine(msg.subject)}” and we’ll reply in the app and by email.`,
        button: { label: "Open help centre", href: `${webUrl}/learn/help` },
        footerReason: ACCOUNT_REASON,
      });
    case "support-reply":
      return render(webUrl, {
        subject: "Matr Studio support replied to you",
        preview: "There’s a new reply on your message.",
        tag: "Support reply",
        title: "We replied.",
        body: `Our reply on “${oneLine(msg.subject)}”:`,
        note: msg.message,
        button: { label: "Open help centre", href: `${webUrl}/learn/help` },
        footerReason: ACCOUNT_REASON,
      });
    case "support-closed": {
      const copy = {
        resolved: ["We’ve marked this as resolved.", "Resolved"],
        fixed: ["Good news: we fixed what you reported.", "Fixed"],
        cant_reproduce: [
          "We couldn’t reproduce this one. If it still happens, send us a new report with more detail.",
          "Can’t reproduce",
        ],
      } as const;
      const [line, tag] = copy[msg.status];
      return render(webUrl, {
        subject: `Update on your Matr Studio message: ${tag.toLowerCase()}`,
        preview: line,
        tag,
        title: {
          resolved: "All sorted.",
          fixed: "It’s fixed.",
          cant_reproduce: "We couldn’t reproduce it.",
        }[msg.status],
        body: `${line} Your message: “${oneLine(msg.subject)}”.`,
        ...(msg.message ? { note: msg.message } : {}),
        button: { label: "Open help centre", href: `${webUrl}/learn/help` },
        footerReason: ACCOUNT_REASON,
      });
    }
    case "waitlist-invite":
      return render(webUrl, {
        subject: "You’re in: your Matr Studio invite",
        preview: "Your spot is ready. Create your account in a minute.",
        tag: "Invite",
        title: "You’re in.",
        body: "Thanks for waiting. Your spot on Matr Studio is ready. Create your account to pick a goal and start your first free path:",
        button: { label: "Create my account", href: msg.link },
        expires: "This invite link works for 14 days and can be used once.",
        note: "If you haven’t joined after 7 days we’ll send one reminder, then stop.",
        fallbackLink: msg.link,
        footerReason: `You’re getting this because ${msg.to} joined the Matr Studio waitlist.`,
      });
    case "waitlist-reminder":
      return render(webUrl, {
        subject: "Your Matr Studio invite is still waiting",
        preview: "Your spot is held. Here’s a fresh link.",
        tag: "Invite",
        title: "Your invite is still waiting.",
        body: "You haven’t joined yet, so here’s a fresh link to create your account:",
        button: { label: "Create my account", href: msg.link },
        expires: "This link works for 14 days and can be used once.",
        note: "This is the only reminder. After that, the invite just expires.",
        fallbackLink: msg.link,
        footerReason: `You’re getting this because ${msg.to} joined the Matr Studio waitlist.`,
      });
    case "account-suspended":
      return render(webUrl, {
        subject: "Your Matr Studio account was suspended",
        preview: "You’re signed out everywhere and can’t sign in for now.",
        tag: "Account suspended",
        title: "Your account is suspended.",
        body: `We suspended your Matr Studio account because of ${oneLine(msg.reason)}. You’re signed out everywhere and can’t sign in until we restore access.`,
        note:
          msg.message ??
          "If you think this is a mistake, reply to this email and we’ll take another look.",
        footerReason: ACCOUNT_REASON,
      });
    case "account-restored":
      return render(webUrl, {
        subject: "Your Matr Studio account is back",
        preview: "You can sign in again.",
        tag: "Account restored",
        title: "Welcome back.",
        body: "We restored access to your Matr Studio account. You can sign in again.",
        button: { label: "Sign in", href: `${webUrl}/sign-in` },
        footerReason: ACCOUNT_REASON,
      });
    case "admin-invite":
      return render(webUrl, {
        subject: "You’ve been invited to the Matr Studio admin",
        preview: "Set a password and a 2-step code to get started.",
        tag: "Admin invite",
        title: "You’re invited to the admin.",
        body: `${msg.invitedBy ?? "A Super admin"} added you to the Matr Studio admin as ${msg.role}. Accept the invite to set a password and a 2-step code:`,
        button: { label: "Accept invite", href: msg.link },
        expires: "This invite expires in 72 hours and works once.",
        note: "Sign in to Cloudflare Access with this same email when asked. Didn’t expect this? Ignore it and tell a Super admin.",
        fallbackLink: msg.link,
        footerReason: `You’re getting this because ${msg.to} was invited to the Matr Studio admin.`,
      });
    case "staff-message":
      return render(webUrl, {
        subject: oneLine(msg.subject),
        preview: oneLine(msg.message).slice(0, 90),
        tag: "Matr Studio",
        title: oneLine(msg.subject),
        body: msg.message,
        footerReason: ACCOUNT_REASON,
      });
    case "admin-signin-paused":
      return render(webUrl, {
        subject: "Sign-in paused on your Matr Studio admin account",
        preview: "We paused admin sign-in for 15 minutes to keep your account safe.",
        tag: "Sign-in paused",
        title: "Sign-in paused.",
        body: "We saw too many wrong attempts on your admin account, so we’ve paused sign-in for 15 minutes to keep it safe.",
        details: [
          ["When", msg.when],
          ["Device", msg.device],
        ],
        note: "If this was you, wait 15 minutes and try again, or ask a Super admin to unlock it. If it wasn’t, tell a Super admin right away.",
        footerReason: "You’re getting this because you have a Matr Studio admin account.",
      });
  }
}
