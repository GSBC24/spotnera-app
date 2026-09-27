"use client";

import { useState } from "react";
import { HELP_CATEGORIES, HELP_FAQS, searchHelpFaqs } from "@/lib/help-faqs.mjs";
import { SupportContact } from "@/components/support-contact";

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const results = searchHelpFaqs(HELP_FAQS, query, category);

  return <>
    <section aria-labelledby="help-search-title" className="spotnera-card mt-5 rounded-[28px] p-5 sm:p-7">
      <h2 id="help-search-title" className="text-xl font-semibold">How can we help?</h2>
      <label htmlFor="help-search" className="mt-4 block text-sm font-semibold text-white/70">Search help articles</label>
      <input id="help-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Search questions, topics or answers"
        className="mt-2 min-h-12 w-full rounded-2xl border border-white/16 bg-black/25 px-4 text-sm text-white outline-none placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-[#72f0cc]" />
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Help categories">
        {["All", ...HELP_CATEGORIES].map((item) => <button key={item} type="button"
          aria-pressed={category === item} onClick={() => setCategory(item)}
          className={`min-h-10 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] ${category === item ? "border-[#72f0cc] bg-[#33d6a6]/18 text-[#a7f8de]" : "border-white/14 bg-white/6 text-white/70 hover:bg-white/12"}`}>
          {item}
        </button>)}
      </div>
    </section>

    <section aria-labelledby="help-articles-title" className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="help-articles-title" className="text-xl font-semibold">FAQs</h2>
        <p role="status" className="text-xs text-white/55">{results.length} {results.length === 1 ? "article" : "articles"}</p>
      </div>
      {results.length ? <div className="mt-4 grid gap-3">
        {results.map((faq) => <details key={faq.id} className="spotnera-card group rounded-[22px] border border-white/10 p-4 sm:p-5">
          <summary className="cursor-pointer list-none rounded text-sm font-semibold text-white/90 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc] sm:text-base">
            <span className="flex items-center justify-between gap-3">
              <span>{faq.question}</span><span aria-hidden="true" className="text-lg font-normal text-[#72f0cc] group-open:rotate-45">+</span>
            </span>
          </summary>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#72f0cc]/80">{faq.category}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">{faq.answer}</p>
        </details>)}
      </div> : <div className="spotnera-card mt-4 rounded-[22px] border border-white/10 p-5">
        <p className="font-semibold">No help articles found.</p>
        <p className="mt-1 text-sm text-white/65">Try another search, or contact support.</p>
        <a href="#contact-support" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#72f0cc] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72f0cc]">Contact Support</a>
      </div>}
    </section>
    <SupportContact />
  </>;
}
