import Link from "next/link";

import PublicNav from "@/components/public-nav";
import { getPublicNews } from "@/lib/api";

export default async function NewsPage() {
  const items = await getPublicNews({ limit: 24 });

  return (
    <main className="page-shell news-page-shell">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="hero-panel overflow-hidden py-4 md:py-5">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                News
              </p>

              <PublicNav activeHref="/news" />
            </div>

          </div>
        </header>

        <Link className="detail-back-link" href="/">
          Back to map
        </Link>

        <section className="news-page-hero">
          <div className="news-page-hero-main">
            <p className="legal-page-kicker">Latest reporting</p>
            <h1 className="news-page-title">Verified reporting surfaced automatically.</h1>
            <p className="news-page-copy">
              This feed gathers trusted-source articles that passed the current auto-publication
              rules and are already linked to public case records. It is designed to let readers
              scan new reporting without losing the municipality and case context shown on the map.
            </p>
          </div>

          <aside className="news-page-aside">
            <p className="news-page-aside-heading">What this feed prioritizes</p>
            <ul className="news-page-list">
              <li>verified Puerto Rico reporting tied to public case records</li>
              <li>construction, access, and protected-land pressure signals</li>
              <li>source-backed summaries grouped back into the municipal map view</li>
            </ul>
          </aside>
        </section>

        <section className="news-page-framework">
          <div className="news-page-section-head">
            <p className="legal-page-section-kicker">Public reporting feed</p>
            <p className="news-page-section-copy">
              These are the articles currently visible on the public site. Each item is linked to
              at least one approved case and municipality.
            </p>
          </div>

          <div className="news-page-grid">
          {items.map((item) => (
            <article className="news-page-card" key={item.id}>
              <div className="news-preview-meta">
                <span>{item.publisher}</span>
                <span>
                  {new Date(item.published_at).toLocaleDateString("es-PR", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>
              </div>
              <h2 className="news-page-card-title">
                <a href={item.url} rel="noreferrer" target="_blank">
                  {item.title}
                </a>
              </h2>
              <p className="news-page-card-copy">{item.excerpt}</p>
              <div className="news-preview-tags">
                {item.municipality_names.map((municipalityName) => (
                  <span className="news-preview-tag" key={municipalityName}>
                    {municipalityName}
                  </span>
                ))}
                {item.category ? <span className="news-preview-tag">{item.category.replaceAll("_", " ")}</span> : null}
              </div>
              {item.linked_case_slugs[0] ? (
                <Link className="news-preview-link" href={`/cases/${item.linked_case_slugs[0]}`}>
                  Read linked case
                </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
