import CaseCard from "@/components/case-card";
import type { CaseRecord, MunicipalityRecord } from "@/lib/contracts";

type CaseSidebarProps = {
  activeMunicipality: MunicipalityRecord | null;
  cases: CaseRecord[];
  onClose: () => void;
  selectedMunicipalityId: string | null;
};

export default function CaseSidebar({
  activeMunicipality,
  cases,
  onClose,
  selectedMunicipalityId
}: CaseSidebarProps) {
  return (
    <>
      <aside className="case-drawer panel flex flex-col overflow-hidden">
        <div className="border-b border-[var(--line)] bg-[var(--soft)] px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Municipality cases
              </p>
              <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight text-[var(--ink)]">
                {activeMunicipality?.name ?? "Selected municipality"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {selectedMunicipalityId
                  ? "This drawer shows the public cases pinned to the municipality you selected."
                  : "Select a municipality to open its public cases."}
              </p>
            </div>

            <button
              className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {cases.length > 0 ? (
            cases.map((currentCase) => <CaseCard currentCase={currentCase} key={currentCase.id} />)
          ) : (
            <div className="rounded-[16px] border border-dashed border-[var(--line)] bg-[var(--soft)] p-6">
              <p className="text-lg font-semibold text-[var(--ink)]">No matching cases</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                This municipality does not have any cases that match the current filters.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
