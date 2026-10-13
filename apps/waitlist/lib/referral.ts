// Referral links: matrstudio.com/?ref=CODE. A visitor's ?ref= is remembered in their own browser
// (localStorage, nothing is sent anywhere) and attached to their sign-up as "referred by".

const STORAGE_KEY = "matr-ref";

/** Same alphabet and length as the codes the API generates (see packages/types). */
const CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export const normaliseCode = (value: string | null | undefined): string | null => {
  const code = value?.trim().toUpperCase() ?? "";
  return CODE.test(code) ? code : null;
};

/** Remembers a valid ?ref= from the current address. */
export function captureReferral() {
  try {
    const code = normaliseCode(new URLSearchParams(window.location.search).get("ref"));
    if (code) localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Storage blocked (private mode): the referral just isn't remembered.
  }
}

/** The referral code to attach to a sign-up, if the visitor arrived through a link. */
export function storedReferral(): string | undefined {
  try {
    return normaliseCode(localStorage.getItem(STORAGE_KEY)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** The personal share link for a referral code. */
export const referralLink = (code: string) => `${window.location.origin}/?ref=${code}`;
