"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { FeatureCollection } from "geojson";
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
  municipalityGeoJson: FeatureCollection;
};

export default function HomeShell({
  approvedCases,
  municipalities,
  municipalityGeoJson
}: HomeShellProps) {
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

  return (
    <main className="page-shell">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-6">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_360px]">
          <section className="panel overflow-hidden px-6 py-8 md:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--tide)]">
              Puerto Rico Coastal Watch
            </p>
            <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
              <div>
                <h1 className="max-w-3xl font-serif text-4xl leading-tight text-[var(--ink)] md:text-6xl">
                  Map the coastline by municipality, not by rumor.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                  This MVP uses shared contract fixtures to preview a public map experience: browse
                  approved sample cases, filter by status, and inspect municipality-level activity
                  without exposing admin workflow data.
                </p>
              </div>

              <div className="rounded-[28px] border border-[var(--line)] bg-[linear-gradient(135deg,rgba(241,109,91,0.14),rgba(255,255,255,0.72))] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Current view
                </p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ink)]">
                  {filteredCases.length}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  approved sample cases {selectedMunicipalityId ? "in the selected municipality" : "across the map"}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--tide)]"
                    href="/methodology"
                  >
                    Methodology
                  </Link>
                  <button
                    className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--tide)] hover:text-[var(--tide)]"
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Search cases
              </p>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/86 px-4 py-3 text-[var(--ink)] outline-none transition focus:border-[var(--tide)] focus:ring-2 focus:ring-[rgba(13,95,115,0.12)]"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search municipality, tags, or summary"
                value={searchQuery}
              />
            </div>

            <div>
              <label
                className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
                htmlFor="status-filter"
              >
                Status
              </label>
              <select
                className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/86 px-4 py-3 text-[var(--ink)] outline-none transition focus:border-[var(--tide)] focus:ring-2 focus:ring-[rgba(13,95,115,0.12)]"
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

            <div className="rounded-[24px] border border-[var(--line)] bg-white/65 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Focus municipality
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--ink)]">
                {activeMunicipality?.name ?? "All coastal municipalities"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Hover a municipality to preview case counts. Click one to pin the sidebar and case
                list to that municipality.
              </p>
            </div>
          </section>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_390px]">
          <div className="panel overflow-hidden p-3">
            <MunicipalityMap
              hoveredMunicipalityId={hoveredMunicipalityId}
              municipalityCounts={municipalityCounts}
              municipalityGeoJson={municipalityGeoJson}
              municipalities={municipalities}
              onHoverMunicipality={setHoveredMunicipalityId}
              onSelectMunicipality={setSelectedMunicipalityId}
              selectedMunicipalityId={selectedMunicipalityId}
            />
          </div>

          <CaseSidebar
            activeMunicipality={activeMunicipality}
            cases={filteredCases}
            selectedMunicipalityId={selectedMunicipalityId}
          />
        </section>
      </div>
    </main>
  );
}
