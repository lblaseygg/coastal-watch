import CaseCard from "@/components/case-card";
import type { CaseRecord, MunicipalityRecord } from "@/lib/contracts";

type CaseSidebarProps = {
  activeMunicipality: MunicipalityRecord | null;
  cases: CaseRecord[];
  isVisible: boolean;
  onClose: () => void;
  selectedMunicipalityId: string | null;
};

export default function CaseSidebar({
  activeMunicipality,
  cases,
  isVisible,
  onClose,
  selectedMunicipalityId
}: CaseSidebarProps) {
  return (
    <aside
      className="case-drawer flex flex-col overflow-hidden"
      data-state={isVisible ? "open" : "closed"}
    >
      <div className="case-drawer-head px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-strong)]">
              Filed in municipality
            </p>
            <h2 className="mt-3 text-[1.4rem] font-semibold leading-tight tracking-[-0.035em] text-[var(--ink-strong)]">
              {activeMunicipality?.name ?? "Selected municipality"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {cases.length} {cases.length === 1 ? "case" : "cases"}
              {selectedMunicipalityId ? " in the current selection" : ""}
            </p>
          </div>

          <button className="toolbar-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>

      <div className="case-drawer-scroll flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {cases.length > 0 ? (
          cases.map((currentCase) => <CaseCard currentCase={currentCase} key={currentCase.id} />)
        ) : (
          <div className="px-2 py-5">
            <p className="text-base font-semibold text-[var(--ink)]">No matching cases</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              This municipality does not have any cases that match the current filters.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
