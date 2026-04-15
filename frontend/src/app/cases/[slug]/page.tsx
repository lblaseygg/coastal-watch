import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovedCaseBySlug, getPublicSourcesForCase, getMunicipalityById } from "@/lib/mock-data";

type CaseDetailPageProps = {
  params: {
    slug: string;
  };
};

export default function CaseDetailPage({ params }: CaseDetailPageProps) {
  const currentCase = getApprovedCaseBySlug(params.slug);

  if (!currentCase) {
    notFound();
  }

  const municipality = getMunicipalityById(currentCase.municipality_id);
  const sources = getPublicSourcesForCase(currentCase.id);

  return (
    <main className="page-shell">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Link
          className="w-fit rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--tide)] hover:text-[var(--tide)]"
          href="/"
        >
          Back to map
        </Link>

        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(13,95,115,0.16),rgba(255,252,247,0.2))] px-6 py-8 md:px-10">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--tide)]">
              {municipality?.name ?? "Unknown municipality"}
            </p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-[var(--ink)] md:text-5xl">
              {currentCase.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--surf)] px-3 py-1 text-sm font-semibold text-[var(--tide)]">
                {currentCase.category.replaceAll("_", " ")}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-[var(--muted)]">
                {currentCase.status}
              </span>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-8 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] md:px-10">
            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--tide)]">
                  Summary
                </h2>
                <p className="mt-3 text-lg leading-8 text-[var(--ink)]">
                  {currentCase.public_summary}
                </p>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-[var(--line)] bg-white/65 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    First reported
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                    {new Date(currentCase.first_reported_at).toLocaleDateString("en-US", {
                      dateStyle: "long"
                    })}
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--line)] bg-white/65 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Last updated
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                    {new Date(currentCase.last_updated_at).toLocaleDateString("en-US", {
                      dateStyle: "long"
                    })}
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--tide)]">
                  Source-backed tags
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentCase.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[var(--line)] bg-white/75 px-3 py-1 text-sm font-medium text-[var(--muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <aside className="rounded-[24px] border border-[var(--line)] bg-white/78 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Sources
              </p>
              <div className="mt-4 space-y-4">
                {sources.map((source) => (
                  <a
                    key={source.id}
                    className="block rounded-3xl border border-[var(--line)] bg-[var(--panel-strong)] p-4 transition hover:border-[var(--tide)] hover:-translate-y-0.5"
                    href={source.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--tide)]">
                      {source.publisher}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--ink)]">{source.title}</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Published{" "}
                      {new Date(source.published_at).toLocaleDateString("en-US", {
                        dateStyle: "medium"
                      })}
                    </p>
                  </a>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
