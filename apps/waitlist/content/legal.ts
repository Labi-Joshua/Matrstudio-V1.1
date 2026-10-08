// Copy for the legal pages (Figma: MatrStudio V 1.1 / Legal, 194:2). Kept as data so the text can
// be edited without touching the layout.
//
// Inline pieces: a plain string, { b } for an emphasised term, or { todo } for a detail that
// still has to be filled in (rendered highlighted, as in the design). Search for "todo:" to find
// every open item before publishing.

export type Inline = string | { b: string } | { todo: string };
export type Block = { p: Inline[] } | { ul: Inline[][] };
export type LegalSection = { id: string; title: string; blocks: Block[] };

export type LegalDoc = {
  slug: "privacy" | "terms";
  title: string;
  /** Shorter label for the tabs and the page <title>. */
  tab: string;
  description: string;
  intro: string;
  updated: string;
  effective: string;
  summary: string[];
  sections: LegalSection[];
  /** Last section, shown as the contact card. */
  contact: { id: string; title: string; text: string; email: string };
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  tab: "Privacy Policy",
  description:
    "What personal information Matr Studio collects during pre-launch, why, and your choices.",
  intro:
    "This policy explains what personal information Matr Studio collects while we’re in pre-launch, why we collect it, and the choices you have.",
  updated: "9 October 2026",
  effective: "9 October 2026",
  summary: [
    "We only collect what we need to run the waitlist: your email address and referral details.",
    "We never sell your data, and we don’t use advertising or tracking cookies.",
    "You can ask us to see, correct or delete your information at any time.",
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      blocks: [
        {
          p: [
            "Matr Studio (“Matr Studio”, “we”, “us”) is a community platform for designers, currently in pre-launch. We operate the service at matrstudio.com and are responsible for the personal information described in this policy. You can reach us at privacy@matrstudio.com.",
          ],
        },
      ],
    },
    {
      id: "information-we-collect",
      title: "Information we collect",
      blocks: [
        { p: ["When you join the waitlist, we collect:"] },
        {
          ul: [
            [{ b: "Email address" }, " — so we can confirm your sign-up and keep you updated."],
            [
              { b: "Referral details" },
              " — the referral code we create for you and, if someone invited you, their code.",
            ],
            [
              { b: "Sign-up status and dates" },
              " — whether you’ve confirmed your email, and when.",
            ],
          ],
        },
        {
          p: [
            "When you visit matrstudio.com, our hosting providers automatically process technical information such as your IP address, browser type and the pages you request. We use it to deliver the site securely and to block spam and abuse, including by limiting how often sign-ups can be sent.",
          ],
        },
      ],
    },
    {
      id: "how-we-use-it",
      title: "How we use your information",
      blocks: [
        {
          ul: [
            ["To confirm your email address and save your place on the waitlist."],
            [
              "To tell you when Matr Studio launches and share occasional product updates. Every update email includes an unsubscribe link.",
            ],
            ["To credit referrals to the person who invited you."],
            ["To keep the service secure, prevent fraud and limit automated sign-ups."],
          ],
        },
      ],
    },
    {
      id: "legal-bases",
      title: "Legal bases",
      blocks: [
        {
          p: [
            "Where data protection laws require a legal basis, we rely on your consent for product update emails, and on our legitimate interests to run the waitlist and keep the service secure.",
          ],
        },
      ],
    },
    {
      id: "who-we-share-it-with",
      title: "Who we share it with",
      blocks: [
        {
          p: [
            "We don’t sell your personal information or share it for advertising. We share it only with service providers who help us run Matr Studio, under contracts that require them to protect it:",
          ],
        },
        {
          ul: [
            [{ b: "Vercel" }, " — website hosting."],
            [{ b: "Cloudflare" }, " — our API, database storage and security."],
            [{ b: "Resend" }, " — sending confirmation and update emails."],
          ],
        },
        {
          p: [
            "We may also disclose information if the law requires it, or to protect the rights and safety of our users.",
          ],
        },
      ],
    },
    {
      id: "international-transfers",
      title: "International transfers",
      blocks: [
        {
          p: [
            "Our providers operate globally, so your information may be processed outside the country where you live. When that happens, we use appropriate safeguards such as standard contractual clauses.",
          ],
        },
      ],
    },
    {
      id: "how-long-we-keep-it",
      title: "How long we keep it",
      blocks: [
        {
          ul: [
            [
              { b: "Unconfirmed sign-ups" },
              " — deleted 30 days after the last confirmation email we sent.",
            ],
            [
              { b: "Waitlist information" },
              " — kept until launch, or until you ask us to remove it.",
            ],
            [{ b: "Security logs" }, " — kept only as long as needed to protect the service."],
          ],
        },
      ],
    },
    {
      id: "your-rights",
      title: "Your rights",
      blocks: [
        {
          p: [
            "Depending on where you live, you can ask us to access, correct or delete your information, object to or restrict how we use it, or receive a copy. You can withdraw consent for update emails at any time using the unsubscribe link.",
          ],
        },
        {
          p: [
            "To make a request, email privacy@matrstudio.com. You also have the right to complain to your local data protection authority.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      blocks: [
        {
          p: [
            "matrstudio.com doesn’t use cookies. Your light or dark theme choice is saved only in your own browser. We don’t use advertising or cross-site tracking. If we add analytics or anything that needs cookies in the future, we’ll update this policy first.",
          ],
        },
      ],
    },
    {
      id: "children",
      title: "Children",
      blocks: [
        {
          p: [
            "Matr Studio isn’t intended for anyone under 16. If you believe a child has joined the waitlist, contact us and we’ll delete their information.",
          ],
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [
        {
          p: [
            "If we make significant changes, we’ll update the date at the top of this page and let you know by email before they take effect.",
          ],
        },
      ],
    },
  ],
  contact: {
    id: "contact",
    title: "Questions about your privacy?",
    text: "Email privacy@matrstudio.com and we’ll get back to you.",
    email: "privacy@matrstudio.com",
  },
};

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  tab: "Terms of Service",
  description: "The terms for using matrstudio.com and the Matr Studio waitlist during pre-launch.",
  intro:
    "These terms cover your use of matrstudio.com and the Matr Studio waitlist while we’re in pre-launch. Please read them before you sign up.",
  updated: "9 October 2026",
  effective: "9 October 2026",
  summary: [
    "Joining the waitlist is free and doesn’t guarantee access or a launch date.",
    "Share your referral link with real people. No spam, bots or fake accounts.",
    "You can leave the waitlist whenever you like.",
  ],
  sections: [
    {
      id: "about-these-terms",
      title: "About these terms",
      blocks: [
        {
          p: [
            "These terms are an agreement between you and Matr Studio (“Matr Studio”, “we”, “us”). By joining the waitlist or using matrstudio.com, you agree to them. If you don’t agree, please don’t use the service.",
          ],
        },
      ],
    },
    {
      id: "joining-the-waitlist",
      title: "Joining the waitlist",
      blocks: [
        {
          ul: [
            ["Use an email address you own, and confirm it using the link we send you."],
            ["One sign-up per person. We may remove duplicate, fake or automated sign-ups."],
            [
              "A place on the waitlist doesn’t guarantee access, a launch date or any particular features.",
            ],
          ],
        },
      ],
    },
    {
      id: "referrals",
      title: "Referrals",
      blocks: [
        { p: ["After you confirm your email, you’ll get a personal referral link."] },
        {
          ul: [
            ["Share it with people who might genuinely be interested."],
            ["Don’t post it in spam, buy sign-ups, or use bots or disposable email addresses."],
            [
              "We may cancel referrals or remove sign-ups that break these rules. Any referral rewards will be explained separately when we announce them.",
            ],
          ],
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      blocks: [
        { p: ["When using matrstudio.com, you agree not to:"] },
        {
          ul: [
            ["Disrupt, overload or try to gain unauthorised access to the service."],
            ["Get around our security measures, rate limits or bot checks."],
            ["Scrape or collect other people’s information."],
            ["Impersonate anyone or misrepresent your connection to Matr Studio."],
          ],
        },
      ],
    },
    {
      id: "emails-from-us",
      title: "Emails from us",
      blocks: [
        {
          p: [
            "We’ll send you the emails needed to run the waitlist, such as your confirmation link, plus updates about the launch. You can unsubscribe from updates at any time using the link in each update email.",
          ],
        },
      ],
    },
    {
      id: "our-content",
      title: "Our content",
      blocks: [
        {
          p: [
            "The Matr Studio name, logo, website and its content belong to Matr Studio or our licensors. You may not copy or reuse them without our permission, except where the law allows.",
          ],
        },
      ],
    },
    {
      id: "privacy",
      title: "Privacy",
      blocks: [
        {
          p: [
            "Our Privacy Policy explains how we handle your personal information, and forms part of these terms.",
          ],
        },
      ],
    },
    {
      id: "pre-launch-service",
      title: "Pre-launch service",
      blocks: [
        {
          p: [
            "matrstudio.com is a pre-launch service provided “as is”. We may change, pause or stop the waitlist or the website at any time, and features described before launch may change.",
          ],
        },
      ],
    },
    {
      id: "limitation-of-liability",
      title: "Limitation of liability",
      blocks: [
        {
          p: [
            "To the extent permitted by law, Matr Studio isn’t liable for indirect or consequential losses arising from your use of the waitlist or website. Nothing in these terms limits liability that can’t be limited by law.",
          ],
        },
      ],
    },
    {
      id: "leaving-the-waitlist",
      title: "Leaving the waitlist",
      blocks: [
        {
          p: [
            "You can leave the waitlist at any time by emailing hello@matrstudio.com or using the unsubscribe link in our update emails. We may remove you from the waitlist if you break these terms.",
          ],
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to these terms",
      blocks: [
        {
          p: [
            "We may update these terms as Matr Studio grows. If the changes are significant, we’ll update the date at the top of this page and let you know by email before they take effect.",
          ],
        },
      ],
    },
    {
      id: "governing-law",
      title: "Governing law",
      blocks: [
        {
          p: [
            "These terms are governed by the laws of the country where Matr Studio is established, and disputes will be handled by its courts. This doesn’t take away any protections you have under the consumer laws of the country where you live.",
          ],
        },
      ],
    },
  ],
  contact: {
    id: "contact",
    title: "Questions about these terms?",
    text: "Email legal@matrstudio.com and we’ll get back to you.",
    email: "legal@matrstudio.com",
  },
};

export const LEGAL_DOCS = [PRIVACY, TERMS] as const;
