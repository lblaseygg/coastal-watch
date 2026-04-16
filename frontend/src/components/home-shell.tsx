"use client";

import { useEffect, useMemo, useState } from "react";
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

const DRAWER_TRANSITION_MS = 420;
const DRAWER_OPEN_DELAY_MS = 24;

export default function HomeShell({ approvedCases, municipalities }: HomeShellProps) {
  const currentYear = new Date().getFullYear();
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>(null);
  const [renderedMunicipalityId, setRenderedMunicipalityId] = useState<string | null>(null);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
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

  const filterCases = (municipalityId: string | null) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return approvedCases.filter((currentCase) => {
      if (municipalityId && currentCase.municipality_id !== municipalityId) {
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
  };

  const filteredCases = useMemo(
    () => filterCases(selectedMunicipalityId),
    [approvedCases, searchQuery, selectedMunicipalityId, statusFilter]
  );

  const drawerMunicipalityId = selectedMunicipalityId ?? renderedMunicipalityId;
  const drawerCases = useMemo(
    () => filterCases(drawerMunicipalityId),
    [approvedCases, drawerMunicipalityId, searchQuery, statusFilter]
  );

  const activeMunicipalityId = selectedMunicipalityId ?? hoveredMunicipalityId;
  const activeMunicipality = activeMunicipalityId
    ? municipalityById.get(activeMunicipalityId) ?? null
    : null;
  const selectedMunicipality = drawerMunicipalityId
    ? municipalityById.get(drawerMunicipalityId) ?? null
    : null;
  const activeCaseCount = useMemo(
    () => approvedCases.filter((currentCase) => currentCase.status === "active").length,
    [approvedCases]
  );
  const monitoredCaseCount = useMemo(
    () => approvedCases.filter((currentCase) => currentCase.status === "monitoring").length,
    [approvedCases]
  );

  const closeDrawer = () => {
    setSelectedMunicipalityId(null);
    setIsDrawerVisible(false);
  };

  useEffect(() => {
    if (selectedMunicipalityId) {
      setRenderedMunicipalityId(selectedMunicipalityId);
      return;
    }

    setIsDrawerVisible(false);
  }, [selectedMunicipalityId]);

  useEffect(() => {
    if (!renderedMunicipalityId || !selectedMunicipalityId) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setIsDrawerVisible(true);
    }, DRAWER_OPEN_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [renderedMunicipalityId, selectedMunicipalityId]);

  useEffect(() => {
    if (selectedMunicipalityId || !renderedMunicipalityId) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setRenderedMunicipalityId(null);
    }, DRAWER_TRANSITION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [renderedMunicipalityId, selectedMunicipalityId]);

  useEffect(() => {
    if (!selectedMunicipalityId) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest(".case-drawer")) {
        return;
      }

      if (target.closest(".municipality-svg-shell")) {
        return;
      }

      setSelectedMunicipalityId(null);
      setIsDrawerVisible(false);
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [selectedMunicipalityId]);

  return (
    <main className="page-shell">
      <div className="ambient-orb ambient-orb-left" />
      <div className="ambient-orb ambient-orb-right" />

      <div className="relative mx-auto flex max-w-[1360px] flex-col gap-5">
        <header className="hero-panel overflow-hidden px-2 py-4 md:px-3 md:py-5">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                Title/Name of page goes here
              </p>

              <div className="hero-nav">
                <Link className="hero-nav-link" href="/legal-framework">
                  Legal framework
                </Link>
                <Link className="hero-nav-link" href="/methodology">
                  Methodology
                </Link>
                <Link className="hero-nav-link" href="/admin">
                  Admin
                </Link>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
              <div className="max-w-4xl">
                <h1 className="max-w-4xl text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.05em] text-[var(--ink-strong)] md:text-[4.85rem]">
                  Lorem ipsum dolor sit amet consectetur adipisicing elit.
                </h1>
                <p className="mt-5 max-w-[46rem] text-[1rem] leading-8 text-[var(--muted)] md:text-[1.18rem] md:leading-9">
                  Lorem ipsum dolor sit amet consectetur adipisicing elit. 
                  Earum aperiam sint iusto error distinctio nemo, accusamus rerum 
                  beatae nesciunt laboriosam, consequuntur quisquam cumque rem sunt repellat repellendus 
                  et laudantium recusandae.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="metric-card">
                  <p className="metric-label">Visible</p>
                  <p className="metric-value">{filteredCases.length}</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Active</p>
                  <p className="metric-value">{activeCaseCount}</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Monitoring</p>
                  <p className="metric-value">{monitoredCaseCount}</p>
                </div>
              </div>
            </div>

            <div className="toolbar-row">
              <label className="toolbar-search" htmlFor="search-cases">
                <span className="sr-only">Search cases</span>
                <input
                  className="toolbar-search-input"
                  id="search-cases"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search municipality, tags, or summary"
                  value={searchQuery}
                />
              </label>

              <label className="toolbar-select-wrap" htmlFor="status-filter">
                <span className="sr-only">Filter by status</span>
                <select
                  className="toolbar-select"
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
              </label>

              <div className="toolbar-actions-inline">
                <button
                  className="toolbar-link"
                  onClick={() => {
                    closeDrawer();
                    setHoveredMunicipalityId(null);
                    setStatusFilter("all");
                    setSearchQuery("");
                  }}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </header>

        <section>
          <div className="map-frame self-start overflow-hidden p-3 md:p-4">
            <MunicipalityMap
              hoveredMunicipalityId={hoveredMunicipalityId}
              municipalityCounts={municipalityCounts}
              onHoverMunicipality={setHoveredMunicipalityId}
              onSelectMunicipality={setSelectedMunicipalityId}
              selectedMunicipalityId={selectedMunicipalityId}
            />
          </div>
        </section>

        <section className="legal-snapshot">
          <div className="legal-snapshot-intro">
            <p className="legal-snapshot-kicker">Legal framework</p>
            <h2 className="legal-snapshot-title">What Puerto Rico law says about beach access and coastal protection.</h2>
            <p className="legal-snapshot-copy">
              Read the legal basics behind the map: why beach access is public, how the
              maritime-terrestrial zone works, and why permits, dunes, mangroves, reefs, and other
              protected coastal systems matter in shoreline disputes.
            </p>
          </div>

          <div className="legal-snapshot-grid">
            <article className="legal-snapshot-card">
              <p className="legal-snapshot-card-title">Public access</p>
              <p className="legal-snapshot-card-copy">
                Under Puerto Rico law, beach access is free and open to the public. Cases involving
                gates, barriers, or restrictions are read against that public-access baseline, not
                only against adjacent private property claims.
              </p>
            </article>

            <article className="legal-snapshot-card">
              <p className="legal-snapshot-card-title">Maritime-terrestrial zone</p>
              <p className="legal-snapshot-card-copy">Puerto Rico coastal law treats the maritime-terrestrial zone as part of the public coastal domain. Many disputes turn on whether an access barrier, structure, or intervention affects that public strip.</p>
            </article>

            <article className="legal-snapshot-card">
              <p className="legal-snapshot-card-title">Permits and enforcement</p>
              <p className="legal-snapshot-card-copy">Construction in sensitive coastal areas can trigger permits, environmental review, and agency enforcement. Puerto Rico policy also aims to avoid damage to dunes, mangroves, reefs, and other critical systems.</p>
            </article>
          </div>

          <div className="legal-snapshot-actions">
            <p className="legal-snapshot-note">
              The public app shows only the legal context needed to understand cases. Full citations
              and explanatory material live in a dedicated reference page.
            </p>
            <Link className="toolbar-button" href="/legal-framework">
              Read legal framework
            </Link>
          </div>
        </section>

        <footer className="site-footer">
          <div className="site-footer-grid">
            <div className="site-footer-brand">
              <p className="site-footer-title">Title/Name of page goes here</p>
              <p className="site-footer-text">
                A detailed description of the project, its mission, and its impact goes here. This is a placeholder for now, 
                but it should be replaced with real copy that captures the essence of the project and invites users to explore further.
              </p>
            </div>

            <div className="site-footer-column">
              <p className="site-footer-heading">Coverage</p>
              <p className="site-footer-meta">Municipality-based public case tracking</p>
              <p className="site-footer-meta">Approved items only</p>
              <p className="site-footer-meta">Fully automated coverage (soon)</p>
            </div>

            <div className="site-footer-column">
              <p className="site-footer-heading">Standards</p>
              <p className="site-footer-meta">Source-backed reporting</p>
              <p className="site-footer-meta">Admin-reviewed publication flow</p>
            </div>

            <nav aria-label="Footer" className="site-footer-column site-footer-nav">
              <p className="site-footer-heading">Navigate</p>
              <Link className="site-footer-link" href="/legal-framework">
                Legal framework
              </Link>
              <Link className="site-footer-link" href="/methodology">
                Methodology
              </Link>
              <Link className="site-footer-link" href="/admin">
                Admin
              </Link>
            </nav>
          </div>

          <div className="site-footer-bottom">
            <p className="site-footer-note">
              Public pages surface approved records only. Sensitive or unclear updates remain in
              review until verified.
            </p>
            <p className="site-footer-copyright">
              © {currentYear} Puerto Rico Coastal Watch
            </p>
          </div>
        </footer>
      </div>

      {renderedMunicipalityId ? (
        <CaseSidebar
          isVisible={isDrawerVisible}
          activeMunicipality={selectedMunicipality}
          cases={drawerCases}
          onClose={closeDrawer}
          selectedMunicipalityId={drawerMunicipalityId}
        />
      ) : null}
    </main>
  );
}
