import Link from "next/link";

const principles = [
  "Only approved cases should appear on public endpoints.",
  "Every public-facing claim must retain source attribution.",
  "Summaries should remain neutral and should not imply wrongdoing beyond what sources support.",
  "Sensitive or ambiguous claims route to human review before publication."
];

export default function MethodologyPage() {
  return (
    <main className="page-shell">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Link
          className="w-fit rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--tide)] hover:text-[var(--tide)]"
          href="/"
        >
          Back to map
        </Link>

        <section className="panel px-6 py-8 md:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--tide)]">
            Methodology
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-[var(--ink)] md:text-5xl">
            Public information, structured carefully.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            Puerto Rico Coastal Watch is designed to transform scattered source material into a
            consistent, source-backed case view. The public interface is intentionally narrower than
            the internal workflow: review notes, raw extraction data, and draft records stay out of
            public responses until they are approved.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {principles.map((principle) => (
              <div
                key={principle}
                className="rounded-3xl border border-[var(--line)] bg-white/70 p-5"
              >
                <p className="text-base leading-7 text-[var(--ink)]">{principle}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(135deg,rgba(13,95,115,0.11),rgba(255,255,255,0.8))] p-6">
            <h2 className="font-serif text-2xl text-[var(--ink)]">Current MVP boundaries</h2>
            <ul className="mt-4 space-y-3 text-[var(--muted)]">
              <li>The current frontend uses mock data aligned to the shared Phase 0 contracts.</li>
              <li>Map interactions, case cards, and detail routes are implemented before API work.</li>
              <li>
                The sample data is illustrative and neutral; it exists to validate UI and contracts,
                not to publish real-world findings.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
