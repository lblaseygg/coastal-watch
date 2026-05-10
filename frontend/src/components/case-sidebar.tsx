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
      className="case-drawer flex min-h-0 flex-col overflow-hidden"
      data-state={isVisible ? "open" : "closed"}
    >
      <div className="case-drawer-head px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="case-drawer-kicker">
              municipality
            </p>
            <h2 className="case-drawer-title">
              {activeMunicipality?.name ?? "Selected municipality"}
            </h2>
            <p className="case-drawer-copy">
              {cases.length} {cases.length === 1 ? "case" : "cases"}
              {selectedMunicipalityId ? " in the current selection" : ""}
            </p>
          </div>

          <button aria-label="Close municipality panel" className="case-drawer-close" onClick={onClose} type="button">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      <div className="case-drawer-scroll flex-1 min-h-0 space-y-1 overflow-y-auto px-3 py-2">
        {cases.length > 0 ? (
          cases.map((currentCase) => <CaseCard currentCase={currentCase} key={currentCase.id} />)
        ) : (
          <div className="px-2 py-5">
            <p className="text-base font-semibold text-[var(--ink)]">No matching cases</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              This municipality does not have any cases reported at the moment. Try selecting a different municipality.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
