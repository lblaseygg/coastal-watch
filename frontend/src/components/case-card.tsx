import Link from "next/link";
import type { CaseRecord } from "@/lib/contracts";

type CaseCardProps = {
  currentCase: CaseRecord;
};

export default function CaseCard({ currentCase }: CaseCardProps) {
  return (
    <article className="case-card">
      <div className="case-card-meta">
        <span className="case-pill case-pill-soft">
          {currentCase.category.replaceAll("_", " ")}
        </span>
        <span className="case-pill">
          {currentCase.status}
        </span>
      </div>

      <h3 className="case-card-title">
        {currentCase.title}
      </h3>

      <div className="case-card-summary">
        <p className="case-card-copy">{currentCase.public_summary}</p>
      </div>

      <div className="case-card-tags">
        {currentCase.tags.map((tag) => (
          <span key={tag} className="case-tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="case-card-footer">
        <p className="case-card-updated">
          Updated{" "}
          {new Date(currentCase.last_updated_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })}
        </p>
        <Link className="case-card-link" href={`/cases/${currentCase.slug}`}>
          Read case
        </Link>
      </div>
    </article>
  );
}
