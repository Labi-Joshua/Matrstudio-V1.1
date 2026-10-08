// Figma: MatrStudio V 1.1 / Email Templates (180:2): "Confirm your email" light (180:13334),
// dark (181:43) and the inbox preview (180:13704: subject + preview text).
//
// Both text styles use Manrope (the email's Body and Header font families in Figma).
//
// Email-client HTML: table layout and inline styles (Gmail strips most <style> rules), PNG
// images (Gmail and Outlook do not render SVG) hosted on the website, and dark mode through
// prefers-color-scheme for the clients that support it (Apple Mail, Outlook for Mac, iOS).
// Gmail ignores it and applies its own dark adjustments to the light version.

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const FONT_BODY =
  "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_HEAD =
  "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Light values inline; the dark ones (Figma Email · Dark) are applied by the media query below.
const C = {
  page: "#f7f7f8", // background/bg-fill1
  card: "#ffffff", // background/bg-base
  border: "#e9eaec", // border/border-soft
  text: "#26282c",
  muted: "#5e636e",
  primary: "#d65c1f",
  accent: "#ffeee5", // primary/accent (icon tile)
  accentBorder: "#f68851", // primary/border
  focus: "#ffe4d6", // primary/focus (badge)
  note: "#f7f7f8", // security note background
};

const DARK_CSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (max-width: 480px) {
    .m-pad { padding: 32px 20px 24px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .m-page { background-color: #131416 !important; }
    .m-card { background-color: #090a0b !important; border-color: #1c1e21 !important; }
    .m-text { color: #f7f7f8 !important; }
    .m-muted { color: #9ca1ab !important; }
    .m-tile { background-color: #361e12 !important; border-color: #d65c1f !important; }
    .m-badge { background-color: #522914 !important; color: #f68851 !important; }
    .m-rule { border-color: #1c1e21 !important; }
    .m-note { background-color: #131416 !important; }
    .m-logo { background-color: #131416 !important; background-image: linear-gradient(#131416, #131416) !important; }
    .m-light { display: none !important; }
    .m-dark { display: block !important; max-height: none !important; overflow: visible !important; }
  }
  /* Outlook.com and the Outlook apps recolour dark mode themselves and mark it with these attributes. */
  [data-ogsc] .m-light { display: none !important; }
  [data-ogsc] .m-dark { display: block !important; max-height: none !important; overflow: visible !important; }
  [data-ogsb] .m-logo { background-color: #131416 !important; background-image: linear-gradient(#131416, #131416) !important; }
`;

/** An image with a dark-mode twin: the twin is hidden inline and shown only by the media query. */
function themedImg(base: string, name: string, w: number, h: number, alt: string, extra = "") {
  const common = `width="${w}" height="${h}" alt="${esc(alt)}" style="display:block;border:0;outline:none;width:${w}px;height:${h}px;${extra}"`;
  return (
    `<img class="m-light" src="${base}/${name}.png" ${common}>` +
    `<!--[if !mso]><!--><img class="m-dark" src="${base}/${name}-dark.png" width="${w}" height="${h}" alt="${esc(alt)}" style="display:none;max-height:0;overflow:hidden;border:0;outline:none;width:${w}px;height:${h}px;${extra}"><!--<![endif]-->`
  );
}

export type ConfirmEmailInput = {
  /** Verification link (the API's /api/waitlist/verify?token=...). */
  link: string;
  /** Recipient, shown in the footer ("You're receiving this because ..."). */
  email: string;
  /** Public website origin, used for hosted images and footer links. */
  webUrl: string;
  /** How long the link stays valid, in words ("7 days"). */
  expiresIn: string;
};

export function confirmEmail({ link, email, webUrl, expiresIn }: ConfirmEmailInput) {
  const subject = "Confirm your email to join Matr Studio";
  const preview = "One click and your spot on the waitlist is saved.";
  const img = `${webUrl}/images/email`;
  const year = new Date().getUTCFullYear();
  const href = esc(link);

  const p = (cls: string, style: string, body: string) =>
    `<p class="${cls}" style="margin:0;${style}">${body}</p>`;

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500&display=swap" rel="stylesheet">
<style>${DARK_CSS}</style>
</head>
<body class="m-page" style="margin:0;padding:0;background-color:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preview)}${"&nbsp;&zwnj;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="m-page" style="background-color:${C.page};">
<tr><td align="center" style="padding:40px 16px 48px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

    <!-- Logo. Gmail ignores the dark-mode CSS and darkens the page itself but never images, so the
         dark wordmark would vanish on its dark background. It sits on a pill painted with a
         gradient, which Gmail does not recolour: in light mode the pill matches the page and is
         invisible, in Gmail dark mode it keeps the logo on light grey, and Apple Mail / Outlook
         switch it to dark with the white logo. 8px padding; outer spacing reduced to match. -->
    <tr><td align="center" style="padding:0 0 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="m-logo" style="background-color:${C.page};background-image:linear-gradient(${C.page}, ${C.page});border-radius:999px;padding:8px 14px;">
          <a href="${esc(webUrl)}" style="text-decoration:none;display:block;">${themedImg(img, "logo", 95, 15, "matrstudio.")}</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- Card -->
    <tr><td class="m-card m-pad" style="background-color:${C.card};border:1px solid ${C.border};border-radius:16px;padding:40px 32px 32px;box-shadow:0 1px 1px rgba(25,24,27,0.04);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

        <!-- Icon tile -->
        <tr><td align="center" style="padding:0 0 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td class="m-tile" style="background-color:${C.accent};border:1px solid ${C.accentBorder};border-radius:12px;padding:14px;">
              <img src="${img}/mail-check.png" width="28" height="28" alt="" style="display:block;border:0;width:28px;height:28px;">
            </td>
          </tr></table>
        </td></tr>

        <!-- Badge, title, body -->
        <tr><td align="center" style="padding:0 0 12px;">
          <span class="m-badge" style="display:inline-block;background-color:${C.focus};color:${C.primary};border-radius:6px;padding:3px 8px;font-family:${FONT_HEAD};font-weight:500;font-size:13px;line-height:18px;letter-spacing:-0.13px;">One last step</span>
        </td></tr>
        <tr><td align="center" style="padding:0 0 12px;">
          ${p("m-text", `font-family:${FONT_HEAD};font-weight:500;font-size:32px;line-height:40px;letter-spacing:-0.32px;color:${C.text};text-align:center;`, "Confirm your email")}
        </td></tr>
        <tr><td align="center" style="padding:0 0 28px;">
          ${p("m-muted", `font-family:${FONT_BODY};font-size:16px;line-height:24px;letter-spacing:-0.16px;color:${C.muted};text-align:center;`, "Thanks for joining the Matr Studio waitlist. Confirm your email address to save your spot, and we’ll let you know the moment we launch.")}
        </td></tr>

        <!-- Button -->
        <tr><td align="center" style="padding:0 0 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background-color:${C.primary};border-radius:8px;">
              <a href="${href}" target="_blank" style="display:inline-block;padding:10px 14px;font-family:${FONT_BODY};font-weight:500;font-size:16px;line-height:24px;letter-spacing:-0.16px;color:#ffffff;text-decoration:none;border-radius:8px;">
                Confirm my email&nbsp;<img src="${img}/arrow-right.png" width="20" height="20" alt="" style="display:inline-block;border:0;width:20px;height:20px;vertical-align:-4px;margin-left:2px;">
              </a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:0 0 28px;">
          ${p("m-muted", `font-family:${FONT_BODY};font-size:13px;line-height:18px;letter-spacing:-0.13px;color:${C.muted};text-align:center;`, `This link expires in ${esc(expiresIn)}.`)}
        </td></tr>

        <!-- Divider -->
        <tr><td class="m-rule" style="border-top:1px solid ${C.border};font-size:0;line-height:0;padding:0 0 28px;">&nbsp;</td></tr>

        <!-- Fallback link -->
        <tr><td style="padding:0 0 6px;">
          ${p("m-muted", `font-family:${FONT_BODY};font-size:13px;line-height:18px;letter-spacing:-0.13px;color:${C.muted};`, "Button not working? Copy and paste this link into your browser:")}
        </td></tr>
        <tr><td style="padding:0 0 28px;word-break:break-all;">
          <a href="${href}" target="_blank" style="font-family:${FONT_BODY};font-weight:500;font-size:13px;line-height:18px;letter-spacing:-0.13px;color:${C.primary};text-decoration:none;word-break:break-all;">${href}</a>
        </td></tr>

        <!-- Security note -->
        <tr><td class="m-note" style="background-color:${C.note};border-radius:12px;padding:14px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="18" valign="top" style="padding:0 12px 0 0;">${themedImg(img, "shield-check", 18, 18, "")}</td>
            <td valign="top">
              ${p("m-muted", `font-family:${FONT_BODY};font-size:13px;line-height:18px;letter-spacing:-0.13px;color:${C.muted};`, "Didn’t join the Matr Studio waitlist? You can safely ignore this email. Nothing happens unless you confirm.")}
            </td>
          </tr></table>
        </td></tr>

      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" style="padding:32px 0 12px;">
      ${["Privacy", "Terms", "Help centre"]
        .map(
          (label, i) =>
            `<a class="m-muted" href="${label === "Help centre" ? "mailto:hello@matrstudio.com" : esc(webUrl)}" style="font-family:${FONT_BODY};font-weight:500;font-size:14px;line-height:20px;letter-spacing:-0.14px;color:${C.muted};text-decoration:none;${i ? "margin-left:16px;" : ""}">${label}</a>`,
        )
        .join("")}
    </td></tr>
    <tr><td align="center" style="padding:0 0 12px;">
      ${p("m-muted", `font-family:${FONT_BODY};font-size:13px;line-height:18px;letter-spacing:-0.13px;color:${C.muted};text-align:center;`, `You’re receiving this because ${esc(email)} was used to join the Matr Studio waitlist.`)}
    </td></tr>
    <tr><td align="center">
      ${p("m-muted", `font-family:${FONT_BODY};font-size:13px;line-height:18px;letter-spacing:-0.13px;color:${C.muted};text-align:center;`, `© ${year} Matr Studio. All rights reserved.`)}
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Confirm your email

Thanks for joining the Matr Studio waitlist. Confirm your email address to save your spot, and we'll let you know the moment we launch.

Confirm my email: ${link}

This link expires in ${expiresIn}.

Didn't join the Matr Studio waitlist? You can safely ignore this email. Nothing happens unless you confirm.

You're receiving this because ${email} was used to join the Matr Studio waitlist.
© ${year} Matr Studio. All rights reserved.`;

  return { subject, html, text };
}
