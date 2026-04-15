import Link from "next/link";
import type { CaseRecord } from "@/lib/contracts";

type CaseCardProps = {
  currentCase: CaseRecord;
};

export default function CaseCard({ currentCase }: CaseCardProps) {
  return (
    <article className="rounded-[26px] border border-[var(--line)] bg-white/76 p-5 transition hover:-translate-y-0.5 hover:border-[var(--tide)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--surf)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--tide)]">
          {currentCase.category.replaceAll("_", " ")}
        </span>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          {currentCase.status}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-semibold leading-8 text-[var(--ink)]">{currentCase.title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{currentCase.public_summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {currentCase.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-[rgba(16,37,43,0.06)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Updated{" "}
          {new Date(currentCase.last_updated_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })}
        </p>
        <Link
          className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--tide)]"
          href={`/cases/${currentCase.slug}`}
        >
          Open case
        </Link>
      </div>
    </article>
  );
}
