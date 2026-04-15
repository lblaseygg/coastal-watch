import CaseCard from "@/components/case-card";
import type { CaseRecord, MunicipalityRecord } from "@/lib/contracts";

type CaseSidebarProps = {
  activeMunicipality: MunicipalityRecord | null;
  cases: CaseRecord[];
  selectedMunicipalityId: string | null;
};

export default function CaseSidebar({
  activeMunicipality,
  cases,
  selectedMunicipalityId
}: CaseSidebarProps) {
  return (
    <aside className="panel flex min-h-[640px] flex-col overflow-hidden">
      <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(13,95,115,0.12),rgba(255,255,255,0.28))] px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Case browser
        </p>
        <h2 className="mt-2 font-serif text-3xl text-[var(--ink)]">
          {activeMunicipality?.name ?? "Approved sample cases"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {selectedMunicipalityId
            ? "The list is pinned to the selected municipality."
            : "Select a municipality to focus the list, or browse all approved sample cases."}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {cases.length > 0 ? (
          cases.map((currentCase) => <CaseCard currentCase={currentCase} key={currentCase.id} />)
        ) : (
          <div className="rounded-[26px] border border-dashed border-[var(--line)] bg-white/55 p-6">
            <p className="text-lg font-semibold text-[var(--ink)]">No matching cases</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Adjust the search or status filter, or clear the selected municipality.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
