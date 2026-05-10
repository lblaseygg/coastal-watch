"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { CaseRecord, MunicipalityRecord, NewsRecord } from "@/lib/contracts";
import CaseSidebar from "@/components/case-sidebar";
import PublicNav from "@/components/public-nav";

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
  latestNews: NewsRecord[];
  municipalities: MunicipalityRecord[];
  showAdmin: boolean;
};

const DRAWER_TRANSITION_MS = 420;
const DRAWER_OPEN_DELAY_MS = 24;

export default function HomeShell({ approvedCases, latestNews, municipalities, showAdmin }: HomeShellProps) {
  const currentYear = new Date().getFullYear();
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>(null);
  const [renderedMunicipalityId, setRenderedMunicipalityId] = useState<string | null>(null);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);

  const municipalityById = useMemo(
    () => new Map(municipalities.map((municipality) => [municipality.id, municipality])),
    [municipalities]
  );

  const municipalityCounts = useMemo(() => {
    const counts = new Map<string, { total: number; active: number }>();

    for (const currentCase of approvedCases) {
      for (const municipalityId of currentCase.municipality_ids.length > 0 ? currentCase.municipality_ids : [currentCase.municipality_id]) {
        const existing = counts.get(municipalityId) ?? { total: 0, active: 0 };

        counts.set(municipalityId, {
          total: existing.total + 1,
          active: existing.active + (currentCase.status === "active" ? 1 : 0)
        });
      }
    }

    return counts;
  }, [approvedCases]);

  const municipalityCaseKinds = useMemo(() => {
    const kinds = new Map<string, "unique" | "shared" | "mixed">();

    for (const currentCase of approvedCases) {
      const municipalityIds =
        currentCase.municipality_ids.length > 0 ? currentCase.municipality_ids : [currentCase.municipality_id];
      const caseKind = municipalityIds.length > 1 ? "shared" : "unique";

      for (const municipalityId of municipalityIds) {
        const existingKind = kinds.get(municipalityId);
        if (existingKind === "mixed") {
          continue;
        }
        if (existingKind && existingKind !== caseKind) {
          kinds.set(municipalityId, "mixed");
          continue;
        }
        kinds.set(municipalityId, caseKind);
      }
    }

    return kinds;
  }, [approvedCases]);

  const newsByMunicipality = useMemo(() => {
    const grouped = new Map<string, NewsRecord[]>();

    for (const item of latestNews) {
      for (const municipalityId of item.municipality_ids) {
        const currentItems = grouped.get(municipalityId) ?? [];
        currentItems.push(item);
        grouped.set(municipalityId, currentItems);
      }
    }

    for (const [municipalityId, items] of grouped) {
      grouped.set(
        municipalityId,
        [...items].sort(
          (left, right) => new Date(right.published_at).getTime() - new Date(left.published_at).getTime()
        )
      );
    }

    return grouped;
  }, [latestNews]);

  const latestNewsPreview = useMemo(() => latestNews.slice(0, 6), [latestNews]);
  const filterCases = (municipalityId: string | null) => {
    return approvedCases.filter((currentCase) => {
      const municipalityIds = currentCase.municipality_ids.length > 0 ? currentCase.municipality_ids : [currentCase.municipality_id];
      if (municipalityId && !municipalityIds.includes(municipalityId)) {
        return false;
      }
      return true;
    });
  };

  const filteredCases = useMemo(
    () => filterCases(selectedMunicipalityId),
    [approvedCases, selectedMunicipalityId]
  );

  const drawerMunicipalityId = selectedMunicipalityId ?? renderedMunicipalityId;
  const drawerCases = useMemo(
    () => filterCases(drawerMunicipalityId),
    [approvedCases, drawerMunicipalityId]
  );

  const selectedMunicipality = drawerMunicipalityId
    ? municipalityById.get(drawerMunicipalityId) ?? null
    : null;
  const trackedCaseCount = approvedCases.length;
  const affectedMunicipalityCount = useMemo(() => {
    const municipalityIds = new Set<string>();

    for (const currentCase of approvedCases) {
      for (const municipalityId of currentCase.municipality_ids.length > 0
        ? currentCase.municipality_ids
        : [currentCase.municipality_id]) {
        municipalityIds.add(municipalityId);
      }
    }

    return municipalityIds.size;
  }, [approvedCases]);
  const latestReportingCount = latestNews.length;

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

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <header className="hero-panel py-4 md:py-5">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-strong)]">
                Puerto Rico Coastal Watch
              </p>

              <PublicNav activeHref="/" showAdmin={showAdmin} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
              <div className="max-w-4xl">
                <h1 className="max-w-4xl text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.05em] text-[var(--ink-strong)] md:text-[4.85rem]">
                  DE AQUÍ NADIE NOS SACA
                </h1>
                <p className="mt-5 max-w-[46rem] text-[1rem] leading-8 text-[var(--muted)] md:text-[1.18rem] md:leading-9">
                  Puerto Rico’s coasts belong to the public. This project documents and maps reported cases of blocked beach access, illegal construction, and development in protected coastal areas across the island. It turns scattered reporting into a public record that helps people see where coastal pressure is happening, what type of issue is being reported, and how those cases evolve over time. Through a map, case pages, and a latest reporting feed, the platform is designed to make coastal issues more visible, easier to follow, and easier to understand.
                </p>
              </div>

              <div className="home-metric-grid">
                <div className="metric-card">
                  <p className="metric-label">Cases</p>
                  <p className="metric-value">{trackedCaseCount}</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Municipalities</p>
                  <p className="metric-value">{affectedMunicipalityCount}</p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Latest</p>
                  <p className="metric-value">{latestReportingCount}</p>
                </div>
              </div>
            </div>

          </div>
        </header>

        <section>
          <div className="map-frame self-start overflow-hidden p-3 md:p-4">
            <MunicipalityMap
              municipalityCaseKinds={municipalityCaseKinds}
              municipalityNews={newsByMunicipality}
              municipalityCounts={municipalityCounts}
              onSelectMunicipality={setSelectedMunicipalityId}
              selectedMunicipalityId={selectedMunicipalityId}
            />
          </div>
        </section>

        <section className="news-preview">
          <div className="news-preview-head">
            <div>
              <p className="legal-snapshot-kicker">Latest reporting</p>
              <h2 className="news-preview-title">Automatically published coverage from trusted Puerto Rico sources.</h2>
            </div>
            <Link className="section-link-button" href="/news">
              View all reporting
            </Link>
          </div>

          <div className="news-preview-grid">
            {latestNewsPreview.map((item) => (
              <article className="news-preview-card" key={item.id}>
                <div className="news-preview-meta">
                  <span>{item.publisher}</span>
                  <span>{new Date(item.published_at).toLocaleDateString("es-PR", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <h3 className="news-preview-card-title">
                  <a href={item.url} rel="noreferrer" target="_blank">
                    {item.title}
                  </a>
                </h3>
                <p className="news-preview-card-copy">{item.excerpt}</p>
                <div className="news-preview-tags">
                  {item.municipality_names.slice(0, 2).map((municipalityName) => (
                    <span className="news-preview-tag" key={municipalityName}>
                      {municipalityName}
                    </span>
                  ))}
                  {item.category ? <span className="news-preview-tag">{item.category.replaceAll("_", " ")}</span> : null}
                </div>
                {item.linked_case_slugs[0] ? (
                  <Link className="news-preview-link" href={`/cases/${item.linked_case_slugs[0]}`}>
                    Read linked case
                  </Link>
                ) : (
                  <a className="news-preview-link" href={item.url} rel="noreferrer" target="_blank">
                    Read reporting
                  </a>
                )}
              </article>
            ))}
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
            <Link className="section-link-button" href="/legal-framework">
              Read legal framework
            </Link>
          </div>
        </section>

        <footer className="site-footer">
          <div className="site-footer-grid">
            <div className="site-footer-brand">
              <p className="site-footer-title">Puerto Rico Coastal Watch</p>
              <p className="site-footer-text">
                Communities in Puerto Rico are losing beach access and protected coastal land to 
                  illegal construction, privatization, and environmental destruction. 
                  This platform documents reported cases, tracks where they are happening, and 
                  makes that information public.
              </p>
            </div>

            <div className="site-footer-column">
              <p className="site-footer-heading">Coverage</p>
              <p className="site-footer-meta">Municipality-based public case tracking</p>
              <p className="site-footer-meta">Approved items only</p>
              <p className="site-footer-meta">Fully automated coverage (work in progress)</p>
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
              <Link className="site-footer-link" href="/news">
                News
              </Link>
              <Link className="site-footer-link" href="/methodology">
                Methodology
              </Link>
              {showAdmin ? (
                <Link className="site-footer-link" href="/admin">
                  Admin
                </Link>
              ) : null}
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
