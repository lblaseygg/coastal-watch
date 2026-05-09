import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import PublicNav from "@/components/public-nav";
import { getApprovedCaseBySlug, getMapMunicipalities } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-session";

type CaseDetailPageProps = {
  params: {
    slug: string;
  };
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const showAdmin = Boolean(getAdminSession(cookies()));
  const [casePayload, municipalities] = await Promise.all([
    getApprovedCaseBySlug(params.slug),
    getMapMunicipalities()
  ]);

  if (!casePayload) {
    notFound();
  }

  const currentCase = casePayload.case;
  const sources = casePayload.sources;
  const municipalityNames = currentCase.municipality_ids
    .map(
      (municipalityId) =>
        municipalities.find((currentMunicipality) => currentMunicipality.id === municipalityId)?.name ?? municipalityId
    )
    .filter(Boolean);
  const categoryLabel = currentCase.category.replaceAll("_", " ");
  const statusLabel =
    {
      reported: "Reported",
      monitoring: "Under monitoring",
      active: "Active concern",
      resolved: "Resolved",
      archived: "Archived"
    }[currentCase.status] ?? currentCase.status;
  const municipalityLabel = municipalityNames.length > 1 ? "Municipalities" : "Municipality";
  const latestSource = [...sources].sort(
    (left, right) => new Date(right.published_at).getTime() - new Date(left.published_at).getTime()
  )[0];

  return (
    <main className="page-shell detail-page-shell">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="hero-panel py-4 md:py-5">
          <div className="flex items-start justify-between gap-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-strong)]">
              Case detail
            </p>
            <PublicNav activeHref="/" showAdmin={showAdmin} />
          </div>
        </header>

        <a className="detail-back-link" href="/">
          Back to map
        </a>

        <section className="detail-shell">
          <div className="detail-hero">
            <p className="detail-kicker text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-strong)]">
              {municipalityNames.join(" · ") || "Unknown municipality"}
            </p>
            <h1 className="detail-title mt-4 max-w-4xl text-[2.3rem] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--ink-strong)] md:text-[4.4rem]">
              {currentCase.title}
            </h1>
            <p className="detail-intro">
              This case record pulls together source-backed reporting about a coastal pressure point in Puerto Rico so readers can
              quickly understand what is being reported, where it is happening, and how the public record has evolved.
            </p>
            <div className="detail-meta-row mt-5 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span className="detail-meta-pill">{categoryLabel}</span>
              <span className="detail-meta-pill">{statusLabel}</span>
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
              <section className="detail-section">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                  What’s happening
                </h2>
                <p className="detail-summary mt-4 max-w-3xl text-[1.03rem] leading-9 text-[var(--ink)]">
                  {currentCase.public_summary}
                </p>
              </section>

              <section className="detail-section detail-context-grid">
                <div className="detail-context-card">
                  <p className="detail-context-label">Case scope</p>
                  <p className="detail-context-copy">
                    {municipalityNames.length > 1
                      ? "This record spans multiple municipalities, so the reporting is being tracked as a shared coastal issue."
                      : "This record is currently scoped to one municipality, based on the reporting and source material linked below."}
                  </p>
                </div>
                <div className="detail-context-card">
                  <p className="detail-context-label">Latest reporting</p>
                  <p className="detail-context-copy">
                    {latestSource
                      ? `The most recent linked source is from ${latestSource.publisher}, published ${new Date(
                          latestSource.published_at
                        ).toLocaleDateString("en-US", { dateStyle: "long" })}.`
                      : "No linked source metadata is currently available for this record."}
                  </p>
                </div>
              </section>

              <section className="detail-section">
                <div className="detail-section-head">
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
                    Reporting timeline
                  </h2>
                  <p className="detail-section-copy">
                    These are the public sources currently tied to this case, ordered as a readable reporting trail.
                  </p>
                </div>
                <div className="detail-timeline">
                  {sources.map((source, index) => (
                    <article className="detail-timeline-item" key={source.id}>
                      <div className="detail-timeline-content">
                        <p className="detail-timeline-meta">
                          <span>{index === sources.length - 1 ? "Most recent" : `Source ${index + 1}`}</span>
                          <span>
                            {new Date(source.published_at).toLocaleDateString("en-US", {
                              dateStyle: "medium"
                            })}
                          </span>
                        </p>
                        <h3 className="detail-timeline-title">{source.title}</h3>
                        <p className="detail-timeline-publisher">{source.publisher}</p>
                        <a className="detail-timeline-link" href={source.url} rel="noreferrer" target="_blank">
                          Open source
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="detail-section">
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
              <div className="detail-sidecard">
                <p className="detail-sidecard-kicker">Case snapshot</p>
                <div className="detail-fact-list">
                  <div className="detail-fact-row">
                    <span>{municipalityLabel}</span>
                    <strong>{municipalityNames.join(", ") || "Unknown"}</strong>
                  </div>
                  <div className="detail-fact-row">
                    <span>Category</span>
                    <strong>{categoryLabel}</strong>
                  </div>
                  <div className="detail-fact-row">
                    <span>Status</span>
                    <strong>{statusLabel}</strong>
                  </div>
                  <div className="detail-fact-row">
                    <span>First reported</span>
                    <strong>
                      {new Date(currentCase.first_reported_at).toLocaleDateString("en-US", {
                        dateStyle: "medium"
                      })}
                    </strong>
                  </div>
                  <div className="detail-fact-row">
                    <span>Last updated</span>
                    <strong>
                      {new Date(currentCase.last_updated_at).toLocaleDateString("en-US", {
                        dateStyle: "medium"
                      })}
                    </strong>
                  </div>
                  <div className="detail-fact-row">
                    <span>Sources</span>
                    <strong>{sources.length}</strong>
                  </div>
                </div>
              </div>

              <div className="detail-sidecard">
                <p className="detail-sidecard-kicker">Public record standard</p>
                <p className="detail-sidecard-copy">
                  This page only shows approved case records and linked public sources. Draft notes, internal review decisions, and
                  unresolved queue items stay out of the public interface.
                </p>
                <div className="detail-sidecard-actions">
                  <Link className="toolbar-button" href="/news">
                    View all reporting
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
