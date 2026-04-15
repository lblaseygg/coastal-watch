import { notFound } from "next/navigation";
import { getApprovedCaseBySlug, getMapMunicipalities } from "@/lib/api";

type CaseDetailPageProps = {
  params: {
    slug: string;
  };
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const [casePayload, municipalities] = await Promise.all([
    getApprovedCaseBySlug(params.slug),
    getMapMunicipalities()
  ]);

  if (!casePayload) {
    notFound();
  }

  const currentCase = casePayload.case;
  const sources = casePayload.sources;
  const municipality = municipalities.find(
    (currentMunicipality) => currentMunicipality.id === currentCase.municipality_id
  );

  return (
    <main className="page-shell">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <a
          className="w-fit rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
          href="/"
        >
          Back to map
        </a>

        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] bg-[var(--soft)] px-6 py-8 md:px-10">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              {municipality?.name ?? "Unknown municipality"}
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[var(--ink)] md:text-5xl">
              {currentCase.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-[8px] bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                {currentCase.category.replaceAll("_", " ")}
              </span>
              <span className="rounded-[8px] border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                {currentCase.status}
              </span>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-8 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] md:px-10">
            <div className="space-y-6">
              <section>
                <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                  Summary
                </h2>
                <p className="mt-3 text-base leading-8 text-[var(--ink)]">
                  {currentCase.public_summary}
                </p>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    First reported
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                    {new Date(currentCase.first_reported_at).toLocaleDateString("en-US", {
                      dateStyle: "long"
                    })}
                  </p>
                </div>
                <div className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
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
                <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                  Source-backed tags
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentCase.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[999px] border border-[var(--line)] bg-[var(--soft)] px-3 py-1 text-sm font-medium text-[var(--muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <aside className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-6">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Sources
              </p>
              <div className="mt-4 space-y-4">
                {sources.map((source) => (
                  <a
                    key={source.id}
                    className="block rounded-[14px] border border-[var(--line)] bg-white p-4 transition hover:bg-[var(--panel-strong)]"
                    href={source.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
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
