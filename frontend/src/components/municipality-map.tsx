"use client";

import { useEffect, useRef, useState } from "react";

type MunicipalityMapProps = {
  hoveredMunicipalityId: string | null;
  municipalityCounts: Map<string, { total: number; active: number }>;
  onHoverMunicipality: (municipalityId: string | null) => void;
  onSelectMunicipality: (municipalityId: string | null) => void;
  selectedMunicipalityId: string | null;
};

function slugifyMunicipalityName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function MunicipalityMap({
  hoveredMunicipalityId,
  municipalityCounts,
  onHoverMunicipality,
  onSelectMunicipality,
  selectedMunicipalityId
}: MunicipalityMapProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const [hoveredMunicipalityName, setHoveredMunicipalityName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/puerto-rico-municipios.svg")
      .then((response) => response.text())
      .then((markup) => {
        if (active) {
          setSvgMarkup(markup);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !svgMarkup) {
      return;
    }

    const svg = container.querySelector("svg");

    if (!svg) {
      return;
    }

    svg.setAttribute("class", "municipality-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    if (!svg.getAttribute("viewBox")) {
      const width = svg.getAttribute("width");
      const height = svg.getAttribute("height");

      if (width && height) {
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      }
    }

    svg.removeAttribute("width");
    svg.removeAttribute("height");

    const regions = Array.from(svg.querySelectorAll<SVGElement>('[id^="PR-"]'));

    for (const region of regions) {
      const title = region.getAttribute("title") ?? "";
      const municipalityId = slugifyMunicipalityName(title);
      const counts = municipalityCounts.get(municipalityId);
      const isSelected = municipalityId === selectedMunicipalityId;
      const isHovered = municipalityId === hoveredMunicipalityId;
      const hasCases = Boolean(counts && counts.total > 0);

      region.setAttribute(
        "style",
        [
          "vector-effect: non-scaling-stroke",
          "cursor: pointer",
          `stroke: ${isSelected ? "#6b6a65" : isHovered ? "#37352f" : "#8b8a86"}`,
          `stroke-width: ${isSelected ? "1.9" : isHovered ? "1.55" : "1.15"}`,
          `fill: ${
            isSelected
              ? "rgba(55, 53, 47, 0.16)"
              : isHovered
                ? "rgba(55, 53, 47, 0.1)"
                : hasCases
                  ? "rgba(55, 53, 47, 0.08)"
                  : "rgba(255,255,255,0.45)"
          }`,
          `opacity: ${isSelected ? "1" : isHovered ? "0.98" : "0.92"}`,
          "transition: fill 160ms ease, stroke 160ms ease, opacity 160ms ease"
        ].join("; ")
      );

      const existingTitleNode = region.querySelector("title");

      if (existingTitleNode) {
        existingTitleNode.textContent = title;
      } else if (title) {
        const titleNode = document.createElementNS("http://www.w3.org/2000/svg", "title");
        titleNode.textContent = title;
        region.prepend(titleNode);
      }

      const handleMouseEnter = () => {
        onHoverMunicipality(municipalityId);
        setHoveredMunicipalityName(title || null);
      };

      const handleMouseLeave = () => {
        onHoverMunicipality(null);
        setHoveredMunicipalityName(null);
      };

      const handleMouseMove = (event: Event) => {
        const tooltip = tooltipRef.current;
        const shell = shellRef.current;

        if (!tooltip || !shell) {
          return;
        }

        const mouseEvent = event as MouseEvent;
        const bounds = shell.getBoundingClientRect();

        tooltip.style.left = `${mouseEvent.clientX - bounds.left + 16}px`;
        tooltip.style.top = `${mouseEvent.clientY - bounds.top - 14}px`;
      };

      const handleClick = () => {
        onSelectMunicipality(municipalityId === selectedMunicipalityId ? null : municipalityId);
      };

      region.onmouseenter = handleMouseEnter;
      region.onmouseleave = handleMouseLeave;
      region.onmousemove = handleMouseMove;
      region.onclick = handleClick;
    }

    return () => {
      for (const region of regions) {
        region.onmouseenter = null;
        region.onmouseleave = null;
        region.onmousemove = null;
        region.onclick = null;
      }
    };
  }, [
    hoveredMunicipalityId,
    municipalityCounts,
    onHoverMunicipality,
    onSelectMunicipality,
    selectedMunicipalityId,
    svgMarkup
  ]);

  return (
    <div className="municipality-svg-shell relative h-[680px] overflow-hidden rounded-[20px]" ref={shellRef}>
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex justify-end gap-4">
        {selectedMunicipalityId ? (
          <button
            className="pointer-events-auto rounded-[10px] border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
            onClick={() => onSelectMunicipality(null)}
            type="button"
          >
            Clear municipality
          </button>
        ) : null}
      </div>

      <div className="municipality-svg-canvas h-full w-full">
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svgMarkup }} ref={containerRef} />
      </div>

      <div
        className={`municipality-cursor-tooltip ${hoveredMunicipalityName ? "is-visible" : ""}`}
        ref={tooltipRef}
      >
        {hoveredMunicipalityName}
      </div>
    </div>
  );
}
