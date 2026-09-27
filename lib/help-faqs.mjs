export const HELP_CATEGORIES = Object.freeze([
  "Customer", "Business", "Account", "Deals", "Notifications", "Other",
]);

export const HELP_FAQS = Object.freeze([
  { id: "what-is-spotnera", category: "Customer", question: "What is Spotnera?",
    answer: "Spotnera helps you discover local businesses and their deals. You can browse publicly without signing in.", keywords: "local discovery" },
  { id: "near-me", category: "Customer", question: "How do I find businesses near me?",
    answer: "Use Map or Search to explore businesses. You can search and filter by supported location and business category. Spotnera currently focuses on Norway.", keywords: "map city country nearby filters" },
  { id: "find-deals", category: "Customer", question: "How do I find deals?",
    answer: "Open Deals to browse active promotions, or open a business profile to see its deals. If you have chosen interests in Me, they can affect the order of general Deals results.", keywords: "promotions discovery interests" },
  { id: "save-business", category: "Customer", question: "How do I save a business?",
    answer: "Sign in and choose Save on a business. Find it later under Saved. You can remove it from Saved at any time.", keywords: "favorite bookmark" },
  { id: "deal-notifications", category: "Customer", question: "How do deal notifications work?",
    answer: "After saving a business, you can choose whether to receive its deal alerts. Push delivery also requires you to enable push notifications and allow browser permission in Me. Interests alone do not turn notifications on.", keywords: "push opt in permission" },
  { id: "calendar", category: "Customer", question: "How do I add a deal to my calendar?",
    answer: "Open Deal Details and choose Add to Calendar when a valid future window is available. Review a prefilled Google Calendar event, or download an .ics file for another calendar. Spotnera does not save the event for you.", keywords: "google ics schedule" },

  { id: "create-business", category: "Business", question: "How do I create a business?",
    answer: "Sign in, open Business, and choose Create Business. Each business represents one independently managed location.", keywords: "owner location" },
  { id: "free-limit", category: "Business", question: "How many businesses can I create on the Free plan?",
    answer: "A Free owner account can create up to five independent businesses. You can continue managing existing businesses if you have reached the limit.", keywords: "five 5 owner limit" },
  { id: "create-deal", category: "Business", question: "How do I create a deal?",
    answer: "Open Business, choose a business, and create a deal. Add a title and description, set its validity period if needed, and choose continuous or weekly availability.", keywords: "promotion owner" },
  { id: "weekly-deals", category: "Business", question: "How do weekly deals work?",
    answer: "Set the days and hours when the promotion can be used. Days can have different hours, and a window can run past midnight. Overall start and end dates, when set, limit the schedule.", keywords: "schedule overnight availability" },
  { id: "opening-hours", category: "Business", question: "How do business opening hours work?",
    answer: "Set opening hours while creating or editing a business. They describe when the business is open and are separate from a deal's availability schedule.", keywords: "hours closed overnight" },
  { id: "premium", category: "Business", question: "What is Spotnera Premium?",
    answer: "Premium is being prepared. Its planned advanced tools are described on the Premium page; they are not available as an active subscription yet.", keywords: "coming soon pricing branches analytics" },

  { id: "sign-in", category: "Account", question: "How do I sign in?",
    answer: "Choose Sign in and use an available sign-in option. You can browse public businesses and deals without an account.", keywords: "login register" },
  { id: "reset-password", category: "Account", question: "How do I reset my password?",
    answer: "Choose Forgot password? on the sign-in form, enter your account email, and follow the reset link sent to you.", keywords: "forgot email" },
  { id: "interests", category: "Account", question: "How do I change my interests?",
    answer: "Open Me, find Personalization, choose up to five business categories, and save. Interests affect general Deals ordering but do not enable notifications.", keywords: "personalization preferences" },
  { id: "delete-account", category: "Account", question: "How do I delete my account?",
    answer: "Open Me and use the account deletion option. Review the information shown there before confirming.", keywords: "remove data" },

  { id: "weekly-visible", category: "Deals", question: "Why is a weekly deal shown when it is unavailable right now?",
    answer: "An active weekly promotion can remain discoverable between its scheduled windows. Open Deal Details to see its actual days and hours.", keywords: "closed schedule" },
  { id: "upcoming", category: "Deals", question: "What is an Upcoming deal?",
    answer: "Upcoming means the deal's overall start time is in the future. A weekly deal between its scheduled hours is different: it may already be active, just unavailable at that moment.", keywords: "future starts" },
  { id: "calendar-availability", category: "Deals", question: "Why is Add to Calendar missing from a deal?",
    answer: "The action appears only when Spotnera can identify a legitimate future window. An expired deal or a continuous deal without a scheduled window has no calendar action.", keywords: "google ics expired" },

  { id: "enable-push", category: "Notifications", question: "How do I enable push notifications?",
    answer: "Sign in, open Me, enable push notifications, and allow permission in your browser. Then choose the deal alerts you want in Notification preferences. Browser support and permission are required.", keywords: "opt in browser permission" },
  { id: "stop-one-business", category: "Notifications", question: "How do I stop alerts from one saved business?",
    answer: "Open Saved and turn off Deal notifications from that business. You can keep the business saved without receiving its deal alerts.", keywords: "mute per business" },
  { id: "timed-alerts", category: "Notifications", question: "What are Starting Soon and Ending Soon alerts?",
    answer: "These optional push alerts concern deal availability at businesses you saved. Choose a lead time in Me; delivery still requires push to be enabled and browser permission.", keywords: "30 60 120 minutes" },

  { id: "contact", category: "Other", question: "How can I contact Spotnera support?",
    answer: "Use the Contact Support section below, or email support@spotnera.com. You can copy the address if your device does not have an email app configured.", keywords: "help email" },
  { id: "coverage", category: "Other", question: "Where is Spotnera available?",
    answer: "Spotnera currently focuses on discovering businesses in Norway. Available businesses and deals depend on what owners have published.", keywords: "country cities norway" },
]);

function normalize(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en").trim();
}

export function searchHelpFaqs(faqs, query = "", category = "All") {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return faqs.filter((faq) => {
    if (category !== "All" && faq.category !== category) return false;
    const haystack = normalize([faq.question, faq.answer, faq.category, faq.keywords].join(" "));
    return terms.every((term) => haystack.includes(term));
  });
}
