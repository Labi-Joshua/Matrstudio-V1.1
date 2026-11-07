// Copy for the legal pages. The Privacy Policy is carried over from the waitlist app (lawyer review
// still pending). The Terms were rewritten on 7 November 2026 for the product site (no waitlist
// or pre-launch wording); also pending lawyer review.
// Layout: components/pages/company/legal-page.tsx (Figma "Marketing pages (V3)").
//
// Inline pieces: a plain string, { b } for an emphasised term, or { todo } for a detail still
// to be filled in.

export type Inline = string | { b: string } | { todo: string };
export type Block = { p: Inline[] } | { ul: Inline[][] };
export type LegalSection = { id: string; title: string; blocks: Block[] };

export type LegalDoc = {
  slug: "privacy" | "terms";
  title: string;
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
  description:
    "What personal information Matr Studio collects during pre-launch, why, and your choices.",
  intro:
    "This policy explains what personal information Matr Studio collects while we’re in pre-launch, why we collect it, and the choices you have.",
  updated: "13 October 2026",
  effective: "13 October 2026",
  summary: [
    "We only collect what we need to run the waitlist: your email address and referral details.",
    "We never sell your data, and we don’t use advertising cookies. We use Google Analytics to understand how the site is used.",
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
        {
          p: [
            { b: "Usage analytics" },
            " — we use Google Analytics to understand how people use the site: the pages viewed, how you arrived (for example a search or a link), your device and browser, and your approximate location (country and city). Google Analytics never receives your email address.",
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
            [{ b: "Google" }, " — website analytics (Google Analytics)."],
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
            "We use Google Analytics cookies (named _ga and _ga_*) to count visits and understand how the site is used. They don’t identify you by name or email, and Google keeps the data for up to 14 months. Advertising features and cross-site tracking are turned off.",
          ],
        },
        {
          p: [
            "If you’re in the EU, EEA, UK or Switzerland, analytics cookies are off by default; Google only receives anonymous, cookieless signals. Everyone can opt out at any time with Google’s browser add-on (tools.google.com/dlpage/gaoptout) or by blocking cookies in their browser. Your light or dark theme choice, and the referral code from a referral link if you arrive through one, are saved only in your own browser and aren’t cookies.",
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
  description:
    "The terms for using matrstudio.com: Matr Studio’s free learning paths, resource library and the resources you suggest.",
  intro:
    "These terms cover your use of matrstudio.com and Matr Studio’s learning paths and resource library. Please read them before you use the site or send us anything.",
  updated: "7 November 2026",
  effective: "7 November 2026",
  summary: [
    "Matr Studio is free. We organise free resources from across the web into learning paths, and we link to the original creators.",
    "We don’t host or control third-party resources, so each one stays under its own creator’s terms.",
    "No spam, abuse or scraping, and only suggest resources you’re allowed to share.",
    "You can stop using Matr Studio, or unsubscribe from our emails, at any time.",
  ],
  sections: [
    {
      id: "about-these-terms",
      title: "About these terms",
      blocks: [
        {
          p: [
            "These terms are an agreement between you and Matr Studio (“Matr Studio”, “we”, “us”). By using matrstudio.com or any Matr Studio service, you agree to them. If you don’t agree, please don’t use the service.",
          ],
        },
      ],
    },
    {
      id: "what-matr-studio-is",
      title: "What Matr Studio is",
      blocks: [
        {
          p: [
            "Matr Studio is a free website that brings together free learning resources (videos, articles, documentation and tools) from around the web and arranges them into step-by-step learning paths for designers and developers. Using the site doesn’t cost anything.",
          ],
        },
        {
          p: [
            "We link to the original sources. We don’t host, copy or own the resources themselves, and we’re not affiliated with their creators unless we say so.",
          ],
        },
      ],
    },
    {
      id: "third-party-resources",
      title: "Third-party resources",
      blocks: [
        {
          ul: [
            [
              "Every resource belongs to its creator and is covered by the creator’s own terms and privacy practices, not ours.",
            ],
            [
              "We choose and order resources with care, but we don’t guarantee that any resource is accurate, complete, up to date or still available. Links may move or disappear.",
            ],
            [
              "Including a resource in a path isn’t an endorsement of its creator or anything else they publish.",
            ],
          ],
        },
      ],
    },
    {
      id: "accounts",
      title: "Accounts",
      blocks: [
        {
          p: [
            "Some features, such as saving paths or tracking your progress, will need an account. When we offer them:",
          ],
        },
        {
          ul: [
            ["Use an email address you own, and keep your sign-in details to yourself."],
            ["One account per person. You’re responsible for what happens under your account."],
            [
              "We may suspend or remove accounts that are duplicate, fake, automated or that break these terms.",
            ],
          ],
        },
      ],
    },
    {
      id: "suggesting-resources",
      title: "Suggesting resources",
      blocks: [
        {
          p: [
            "You can suggest a resource for Matr Studio to consider. When you do, you confirm that it’s publicly available or that you have the right to share it, and you give us permission to link to it, describe it and list it on Matr Studio, with credit to its creator.",
          ],
        },
        {
          ul: [
            [
              "We review suggestions and may decline, edit the description of, or remove any resource.",
            ],
            ["Suggesting a resource doesn’t entitle you to payment or to a place in a path."],
            [
              "Don’t suggest anything unlawful, misleading, infringing or harmful, or anything that’s mainly promotional.",
            ],
          ],
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      blocks: [
        { p: ["When using Matr Studio, you agree not to:"] },
        {
          ul: [
            ["Disrupt, overload or try to gain unauthorised access to the service."],
            ["Get around our security measures, rate limits or bot checks."],
            ["Scrape or collect other people’s information, or copy the site in bulk."],
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
            "We’ll email you when it’s needed to run the service, for example to reply to a message you sent us or to help you sign in. We’ll send news and updates if you’ve asked for them. You can unsubscribe from updates at any time using the link in each email.",
          ],
        },
      ],
    },
    {
      id: "earlier-sign-ups",
      title: "If you joined before launch",
      blocks: [
        {
          p: [
            "If you signed up to the Matr Studio waitlist before launch, we’ll keep emailing you about Matr Studio until you unsubscribe. Joining the waitlist didn’t guarantee access to any particular feature, and anything we offer in return for referrals will be explained to you in writing.",
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
            "The Matr Studio name, logo, website, design, and the way we select and arrange resources into paths belong to Matr Studio or our licensors. You may not copy or reuse them without our permission, except where the law allows. Resources we link to stay the property of their creators.",
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
      id: "availability",
      title: "Availability of the service",
      blocks: [
        {
          p: [
            "Matr Studio is free and provided “as is”. We’re still building it, so we may change, pause or stop any part of the service, and features and paths may be added, changed or removed at any time. We don’t promise that it will always be available or error-free.",
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
            "To the extent permitted by law, Matr Studio isn’t liable for indirect or consequential losses arising from your use of the service, or from any third-party resource we link to. Nothing in these terms limits liability that can’t be limited by law.",
          ],
        },
      ],
    },
    {
      id: "ending-your-use",
      title: "Ending your use",
      blocks: [
        {
          p: [
            "You can stop using Matr Studio at any time. To close an account or stop our emails, write to hello@matrstudio.com or use the unsubscribe link in our emails. We may suspend or end your access, or remove something you sent us, if you break these terms.",
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
            "We may update these terms as Matr Studio grows. If the changes are significant, we’ll update the date at the top of this page and let you know before they take effect.",
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
