// Google Analytics 4 (gtag.js), loaded async from <head> so it never blocks first paint.
// Consent Mode keeps analytics cookies off where the law requires consent first.

export const GA_ID = "G-82J9GRSB53";

/** EU/EEA, the UK and Switzerland: analytics cookies need prior consent there. */
// biome-ignore format: one compact list of ISO country codes reads better than 32 lines
const CONSENT_REGIONS = [
  // EU
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA, UK, Switzerland
  "IS", "LI", "NO", "GB", "CH",
];

/**
 * Runs inline in <head>, before gtag.js loads, so the consent defaults apply to the very first hit.
 * - Advertising storage and signals are always denied (the site shows no ads).
 * - Analytics cookies are denied in CONSENT_REGIONS (Google then sends cookieless pings only)
 *   and allowed elsewhere.
 */
export const analyticsInitScript = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:${JSON.stringify(CONSENT_REGIONS)}});
gtag('set','ads_data_redaction',true);
gtag('js',new Date());
gtag('config','${GA_ID}',{allow_google_signals:false,allow_ad_personalization_signals:false});`;

type Gtag = (command: "event", name: string, params?: Record<string, unknown>) => void;

/**
 * A completed waitlist sign-up, with the form it came from (hero, mission-join, ...).
 * Never sends the email address: GA must not receive personal data.
 */
export function trackSignUp(source: string) {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  gtag?.("event", "sign_up", { method: "waitlist", form: source });
}
