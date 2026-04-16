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
    <main className="page-shell detail-page-shell">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <a className="detail-back-link" href="/">
          Back to map
        </a>

        <section className="detail-shell">
          <div className="max-w-4xl">
            <p className="detail-kicker text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-strong)]">
              {municipality?.name ?? "Unknown municipality"}
            </p>
            <h1 className="detail-title mt-4 max-w-4xl text-[2.3rem] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--ink-strong)] md:text-[4.4rem]">
              {currentCase.title}
            </h1>
            <div className="detail-meta-row mt-5 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span className="detail-meta-pill">
                {currentCase.category.replaceAll("_", " ")}
              </span>
              <span className="detail-meta-pill">
                {currentCase.status}
              </span>
              <span className="detail-meta-copy">
                Updated{" "}
                {new Date(currentCase.last_updated_at).toLocaleDateString("en-US", {
                  dateStyle: "long"
                })}
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.9fr)] lg:items-start">
            <div className="space-y-6">
              <section>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                  Summary
                </h2>
                <p className="detail-summary mt-4 max-w-3xl text-[1.03rem] leading-9 text-[var(--ink)]">
                  {currentCase.public_summary}
                </p>
              </section>

              <section className="grid gap-8 md:grid-cols-2">
                <div className="detail-info-block">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                    First reported
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">
                    {new Date(currentCase.first_reported_at).toLocaleDateString("en-US", {
                      dateStyle: "long"
                    })}
                  </p>
                </div>
                <div className="detail-info-block">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                    Last updated
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">
                    {new Date(currentCase.last_updated_at).toLocaleDateString("en-US", {
                      dateStyle: "long"
                    })}
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                  Source-backed tags
                </h2>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
                  {currentCase.tags.map((tag) => (
                    <span key={tag} className="detail-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <aside className="detail-sources">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                Sources
              </p>
              <div className="mt-5 space-y-5">
                {sources.map((source) => (
                  <a
                    key={source.id}
                    className="detail-source-link"
                    href={source.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                      {source.publisher}
                    </p>
                    <h3 className="mt-2 text-[1.08rem] font-semibold leading-7 text-[var(--ink-strong)]">
                      {source.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
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
