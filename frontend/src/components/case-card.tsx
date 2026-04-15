import Link from "next/link";
import type { CaseRecord } from "@/lib/contracts";

type CaseCardProps = {
  currentCase: CaseRecord;
};

export default function CaseCard({ currentCase }: CaseCardProps) {
  return (
    <article className="rounded-[16px] border border-[var(--line)] bg-white p-5 transition hover:border-[var(--ink)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-[8px] bg-[var(--soft)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
          {currentCase.category.replaceAll("_", " ")}
        </span>
        <span className="rounded-[8px] border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
          {currentCase.status}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold leading-7 text-[var(--ink)]">{currentCase.title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{currentCase.public_summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {currentCase.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-[999px] bg-[var(--soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
          Updated{" "}
          {new Date(currentCase.last_updated_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })}
        </p>
        <Link
          className="rounded-[10px] border border-[var(--line)] bg-[var(--soft)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--soft-strong)]"
          href={`/cases/${currentCase.slug}`}
        >
          Open case
        </Link>
      </div>
    </article>
  );
}
