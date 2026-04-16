"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { CaseRecord, MunicipalityRecord } from "@/lib/contracts";
import CaseSidebar from "@/components/case-sidebar";

const MunicipalityMap = dynamic(() => import("@/components/municipality-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[480px] items-center justify-center rounded-[28px] bg-[rgba(13,95,115,0.08)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--tide)]">
      Loading map
    </div>
  )
});

type HomeShellProps = {
  approvedCases: CaseRecord[];
  municipalities: MunicipalityRecord[];
};

export default function HomeShell({ approvedCases, municipalities }: HomeShellProps) {
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>(null);
  const [hoveredMunicipalityId, setHoveredMunicipalityId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const municipalityById = useMemo(
    () => new Map(municipalities.map((municipality) => [municipality.id, municipality])),
    [municipalities]
  );

  const municipalityCounts = useMemo(() => {
    const counts = new Map<string, { total: number; active: number }>();

    for (const currentCase of approvedCases) {
      const existing = counts.get(currentCase.municipality_id) ?? { total: 0, active: 0 };

      counts.set(currentCase.municipality_id, {
        total: existing.total + 1,
        active: existing.active + (currentCase.status === "active" ? 1 : 0)
      });
    }

    return counts;
  }, [approvedCases]);

  const filteredCases = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return approvedCases.filter((currentCase) => {
      if (selectedMunicipalityId && currentCase.municipality_id !== selectedMunicipalityId) {
        return false;
      }

      if (statusFilter !== "all" && currentCase.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [currentCase.title, currentCase.public_summary, currentCase.category, ...currentCase.tags]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [approvedCases, searchQuery, selectedMunicipalityId, statusFilter]);

  const activeMunicipalityId = selectedMunicipalityId ?? hoveredMunicipalityId;
  const activeMunicipality = activeMunicipalityId
    ? municipalityById.get(activeMunicipalityId) ?? null
    : null;
  const selectedMunicipality = selectedMunicipalityId
    ? municipalityById.get(selectedMunicipalityId) ?? null
    : null;

  return (
    <main className="page-shell">
      <div className="relative mx-auto flex max-w-[1460px] flex-col gap-6">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_360px]">
          <section className="panel overflow-hidden px-6 py-7 md:px-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Puerto Rico Coastal Watch
            </p>
            <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_240px] md:items-start">
              <div>
                <h1 className="max-w-3xl text-[2rem] font-semibold leading-tight text-[var(--ink)] md:text-[3.25rem]">
                  Coastal cases, organized like a working document.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                  Browse approved public cases by municipality, keep the interface quiet, and let
                  the information carry the visual weight.
                </p>
              </div>

              <div className="rounded-[18px] border border-[var(--line)] bg-[var(--soft)] p-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                  Public cases
                </p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ink)]">
                  {filteredCases.length}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {selectedMunicipalityId
                    ? "matching the selected municipality and filters"
                    : "matching the current filters across the map"}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--soft)]"
                    href="/methodology"
                  >
                    Methodology
                  </Link>
                  <Link
                    className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                    href="/admin"
                  >
                    Admin review
                  </Link>
                  <button
                    className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                    onClick={() => {
                      setSelectedMunicipalityId(null);
                      setHoveredMunicipalityId(null);
                      setStatusFilter("all");
                      setSearchQuery("");
                    }}
                    type="button"
                  >
                    Reset view
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="panel flex flex-col gap-4 px-6 py-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Search cases
              </p>
              <input
                className="mt-2 w-full rounded-[12px] border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none transition focus:border-[var(--ink)]"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search municipality, tags, or summary"
                value={searchQuery}
              />
            </div>

            <div>
              <label
                className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]"
                htmlFor="status-filter"
              >
                Status
              </label>
              <select
                className="mt-2 w-full rounded-[12px] border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none transition focus:border-[var(--ink)]"
                id="status-filter"
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                <option value="reported">Reported</option>
                <option value="monitoring">Monitoring</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="rounded-[16px] border border-[var(--line)] bg-[var(--soft)] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Focus municipality
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                {activeMunicipality?.name ?? "All coastal municipalities"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Hover to preview. Click a municipality to open its case list in a side panel.
              </p>
            </div>
          </section>
        </header>

        <section>
          <div className="panel self-start overflow-hidden p-3">
            <MunicipalityMap
              hoveredMunicipalityId={hoveredMunicipalityId}
              municipalityCounts={municipalityCounts}
              onHoverMunicipality={setHoveredMunicipalityId}
              onSelectMunicipality={setSelectedMunicipalityId}
              selectedMunicipalityId={selectedMunicipalityId}
            />
          </div>
        </section>
      </div>

      {selectedMunicipalityId ? (
        <CaseSidebar
          activeMunicipality={selectedMunicipality}
          cases={filteredCases}
          onClose={() => setSelectedMunicipalityId(null)}
          selectedMunicipalityId={selectedMunicipalityId}
        />
      ) : null}
    </main>
  );
}
