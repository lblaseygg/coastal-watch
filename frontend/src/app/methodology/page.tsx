import Link from "next/link";

const principles = [
  "Only approved cases appear on public pages and public API responses.",
  "Every public-facing claim keeps a traceable source behind it.",
  "Summaries stay neutral and avoid implying more than the sources support.",
  "Sensitive, ambiguous, or unclear records remain in review before publication."
];

const boundaries = [
  "The public site shows approved records only, not internal review notes or draft extractions.",
  "Cases are organized to make coastal pressure legible by municipality, not to replace official agency records.",
  "The workflow distinguishes between reported pressure, active review, and resolved outcomes so the public record remains readable."
];

export default function MethodologyPage() {
  return (
    <main className="page-shell methodology-page-shell">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <Link className="detail-back-link" href="/">
          Back to map
        </Link>

        <section className="methodology-hero">
          <div className="methodology-hero-main">
            <p className="methodology-kicker">Methodology</p>
            <h1 className="methodology-title">Public information, structured carefully.</h1>
            <p className="methodology-copy">
              Puerto Rico Coastal Watch turns scattered source material into a consistent public
              case record. The public interface is intentionally narrower than the internal review
              workflow, so readers can browse cases with confidence without seeing draft or
              unresolved material.
            </p>
          </div>

          <aside className="methodology-aside">
            <p className="methodology-aside-heading">What this means in practice</p>
            <p className="methodology-aside-copy">
              Public pages are designed for clarity. Review notes, raw extraction output, and
              uncertain records stay out of public view until they are verified.
            </p>
          </aside>
        </section>

        <section className="methodology-section">
          <div className="methodology-section-head">
            <p className="methodology-section-kicker">Publishing rules</p>
            <p className="methodology-section-copy">
              These are the standards used before a record is allowed onto the public map.
            </p>
          </div>

          <div className="methodology-grid">
            {principles.map((principle) => (
              <article className="methodology-card" key={principle}>
                <p className="methodology-card-copy">{principle}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="methodology-section">
          <div className="methodology-section-head">
            <p className="methodology-section-kicker">Current boundaries</p>
          </div>

          <div className="methodology-rule-list">
            {boundaries.map((boundary) => (
              <div className="methodology-rule" key={boundary}>
                <p>{boundary}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
