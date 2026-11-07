// Copy for the legal pages. Both documents were rewritten on 7 November 2026 for the product site
// (accounts, Google sign-in, no waitlist or analytics wording); both are pending lawyer review.
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
    "What personal information Matr Studio collects when you create an account and use the site, why, who we share it with, and your choices.",
  intro:
    "This policy explains what personal information Matr Studio collects when you browse matrstudio.com, create an account or get in touch, why we collect it, and the choices you have.",
  updated: "7 November 2026",
  effective: "7 November 2026",
  summary: [
    "We collect only what we need to run your account: your name, email address, a securely scrambled password (or your Google sign-in) and your learning preferences.",
    "We never sell your data. We don’t use advertising cookies, and the site doesn’t use analytics at the moment.",
    "We use a few providers to run Matr Studio (Cloudflare, Resend and, if you choose it, Google sign-in), under contracts that require them to protect your data.",
    "You can ask us to see, correct or delete your information at any time.",
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      blocks: [
        {
          p: [
            "Matr Studio (“Matr Studio”, “we”, “us”) is a free learning platform for designers and developers. We operate the service at matrstudio.com and are responsible for the personal information described in this policy. You can reach us at privacy@matrstudio.com.",
          ],
        },
      ],
    },
    {
      id: "information-we-collect",
      title: "Information we collect",
      blocks: [
        { p: ["When you create an account, we collect:"] },
        {
          ul: [
            [{ b: "Your name and email address" }, " — to create your account and contact you."],
            [
              { b: "A password" },
              " — if you choose one. We never store it in readable form: we keep only a salted, one-way hash, so nobody at Matr Studio can see it.",
            ],
            [
              { b: "Google account details" },
              " — if you sign in with Google, Google tells us your name, email address and profile picture. We never receive your Google password.",
            ],
            [
              { b: "Passkeys" },
              " — if you add one, we store its public key. Your fingerprint, face or device PIN never leaves your device.",
            ],
            [
              { b: "Your learning preferences" },
              " — the goal, level and topics you pick when you set up your learning.",
            ],
          ],
        },
        { p: ["When you sign in and use the service, we also record:"] },
        {
          ul: [
            [
              { b: "Sessions" },
              " — a description of your device and browser, a shortened IP address and when you last used it, so you can see and end your own sessions.",
            ],
            [
              { b: "Security events" },
              " — for example sign-ins, password changes and blocked attempts, with a shortened IP address and the time. We use them to protect accounts and investigate abuse.",
            ],
          ],
        },
        {
          p: [
            { b: "If you contact us" },
            " — we keep the message you send and our reply. If you submit or suggest a resource, we keep what you send us.",
          ],
        },
        {
          p: [
            { b: "Technical information" },
            " — when you visit matrstudio.com, our hosting provider automatically processes technical information such as your IP address, browser type and the pages you request. We use it to deliver the site securely and to block spam and abuse, including by limiting how often sign-ups and sign-ins can be tried and by checking that a visitor is a person.",
          ],
        },
        {
          p: [
            { b: "If you joined the waitlist before launch" },
            " — we also hold your email address, your referral code (and the code of whoever invited you), and whether and when you confirmed your email.",
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
            ["To create and run your account, and keep you signed in."],
            [
              "To send you the emails the service needs, such as confirming your email address, sign-in links, password resets and security notices.",
            ],
            [
              "To suggest learning paths that fit your goal, level and topics, and to save your progress as we add that to the service.",
            ],
            [
              "To send news and product updates if you’ve asked for them or you joined the waitlist. Every update email includes an unsubscribe link.",
            ],
            [
              "To keep the service secure, prevent fraud and limit automated sign-ups and sign-ins.",
            ],
            ["To reply to your questions and review the resources you suggest."],
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
            "Where data protection laws require a legal basis, we rely on: performing our agreement with you (running your account); our legitimate interests (keeping the service secure and improving it); your consent (update emails, and signing in with Google); and legal obligations where they apply.",
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
            [
              { b: "Cloudflare" },
              " — website hosting, our API and database, queues, security and the Turnstile bot check that appears on some forms.",
            ],
            [{ b: "Resend" }, " — sending account, security and update emails."],
            [
              { b: "Google" },
              " — only if you choose to sign in with Google. Google’s own privacy policy covers what it does with that sign-in.",
            ],
          ],
        },
        {
          p: [
            "Links in learning paths take you to sites run by other people. Those sites have their own privacy practices, which we don’t control.",
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
              { b: "Account information" },
              " — kept while your account is open. If you ask us to delete it, we remove your personal data and end all your sessions.",
            ],
            [
              { b: "Sessions" },
              " — end after 7 days without use, and never last longer than 30 days.",
            ],
            [
              { b: "Sign-in and email links" },
              " — work once and expire within minutes or hours, and we keep only a scrambled copy of them.",
            ],
            [
              { b: "Security logs" },
              " — kept only as long as needed to protect the service. When you delete your account, we remove the details that identify you from them.",
            ],
            [
              { b: "Waitlist information" },
              " — kept so we can tell you about Matr Studio, until you ask us to remove it. Sign-ups that were never confirmed are deleted 30 days after the last confirmation email we sent.",
            ],
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
            "Depending on where you live, you can ask us to access, correct or delete your information, object to or restrict how we use it, or receive a copy. You can withdraw consent for update emails at any time using the unsubscribe link, and you can stop using Google sign-in by choosing another way to sign in.",
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
            "We use only the cookies and browser storage the site needs to work. When you sign in, we set one cookie that keeps you signed in; it is strictly necessary, so it doesn’t need consent. The bot check on some forms may also store a small amount of data to tell people from automated traffic.",
          ],
        },
        {
          p: [
            "We don’t use advertising cookies, and the site doesn’t use analytics at the moment. If we add analytics later, we’ll update this policy first and ask for your consent where the law requires it. Your light or dark theme choice is saved only in your own browser and isn’t a cookie.",
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
            "Matr Studio isn’t intended for anyone under 16. If you believe a child has created an account or joined the waitlist, contact us and we’ll delete their information.",
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
            "If we make significant changes, we’ll update the date at the top of this page and let you know before they take effect.",
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
            "Some features, such as saving paths or tracking your progress, need an account. You can sign in with an email and password, an emailed sign-in link, or your Google account. When you create an account:",
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
