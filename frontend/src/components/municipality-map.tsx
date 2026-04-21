"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { NewsRecord } from "@/lib/contracts";

type MunicipalityMapProps = {
  municipalityNews: Map<string, NewsRecord[]>;
  municipalityCounts: Map<string, { total: number; active: number }>;
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

function MunicipalityMap({
  municipalityNews,
  municipalityCounts,
  onSelectMunicipality,
  selectedMunicipalityId
}: MunicipalityMapProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipTitleRef = useRef<HTMLParagraphElement | null>(null);
  const tooltipListRef = useRef<HTMLDivElement | null>(null);
  const tooltipEmptyRef = useRef<HTMLParagraphElement | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>("");

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

    const applyRegionStyle = (region: SVGElement, options: { isSelected: boolean; isHovered: boolean; hasCases: boolean }) => {
      const { isSelected, isHovered, hasCases } = options;

      region.setAttribute(
        "style",
        [
          "vector-effect: non-scaling-stroke",
          "cursor: pointer",
          "pointer-events: visibleFill",
          `stroke: ${isSelected ? "#003049" : isHovered ? "#003049" : hasCases ? "#003049" : "#8b8a86"}`,
          `stroke-width: ${isSelected ? "1.9" : isHovered ? "1.55" : "1.15"}`,
          `fill: ${
            isSelected
              ? "rgba(102, 155, 188, 0.82)"
              : isHovered
                ? "rgba(102, 155, 188, 0.64)"
                : hasCases
                  ? "rgba(102, 155, 188, 0.52)"
                  : "rgba(255,255,255,0.45)"
          }`,
          `opacity: ${isSelected ? "1" : isHovered ? "0.98" : "0.92"}`,
          "transition: fill 160ms ease, stroke 160ms ease, opacity 160ms ease"
        ].join("; ")
      );
    };

    for (const region of regions) {
      const title = region.getAttribute("title") ?? "";
      const municipalityId = slugifyMunicipalityName(title);
      const counts = municipalityCounts.get(municipalityId);
      const isSelected = municipalityId === selectedMunicipalityId;
      const hasCases = Boolean(counts && counts.total > 0);

      applyRegionStyle(region, { isSelected, isHovered: false, hasCases });

      const existingTitleNode = region.querySelector("title");
      if (existingTitleNode) {
        existingTitleNode.remove();
      }

      const handleMouseEnter = () => {
        applyRegionStyle(region, {
          isSelected: municipalityId === selectedMunicipalityId,
          isHovered: municipalityId !== selectedMunicipalityId,
          hasCases
        });

        const tooltip = tooltipRef.current;
        const tooltipTitle = tooltipTitleRef.current;
        const tooltipList = tooltipListRef.current;
        const tooltipEmpty = tooltipEmptyRef.current;

        if (!tooltip || !tooltipTitle || !tooltipList || !tooltipEmpty) {
          return;
        }

        const newsItems = municipalityNews.get(municipalityId) ?? [];
        tooltip.classList.add("is-visible");
        tooltipTitle.textContent = title;
        tooltipList.replaceChildren();

        if (newsItems.length > 0) {
          tooltipList.style.display = "grid";
          tooltipEmpty.style.display = "none";

          for (const item of newsItems.slice(0, 2)) {
            const itemNode = document.createElement("div");
            itemNode.className = "municipality-news-tooltip-item";

            const itemTitle = document.createElement("p");
            itemTitle.className = "municipality-news-tooltip-item-title";
            itemTitle.textContent = item.title;

            const itemMeta = document.createElement("p");
            itemMeta.className = "municipality-news-tooltip-item-meta";
            itemMeta.textContent = item.publisher;

            itemNode.append(itemTitle, itemMeta);
            tooltipList.appendChild(itemNode);
          }
        } else {
          tooltipList.style.display = "none";
          tooltipEmpty.style.display = "block";
        }
      };

      const handleMouseLeave = () => {
        applyRegionStyle(region, {
          isSelected: municipalityId === selectedMunicipalityId,
          isHovered: false,
          hasCases
        });

        const tooltip = tooltipRef.current;
        if (tooltip) {
          tooltip.classList.remove("is-visible");
        }
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
    municipalityNews,
    municipalityCounts,
    onSelectMunicipality,
    selectedMunicipalityId,
    svgMarkup
  ]);

  return (
    <div className="municipality-svg-shell relative h-[680px] overflow-hidden rounded-[28px]" ref={shellRef}>
      <div className="municipality-svg-canvas h-full w-full">
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svgMarkup }} ref={containerRef} />
      </div>

      <div className="municipality-cursor-tooltip municipality-news-tooltip" ref={tooltipRef}>
        <div className="municipality-news-tooltip-inner">
          <p className="municipality-news-tooltip-title" ref={tooltipTitleRef} />
          <div className="municipality-news-tooltip-list" ref={tooltipListRef} />
          <p className="municipality-news-tooltip-empty" ref={tooltipEmptyRef}>
            No verified reporting yet.
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(
  MunicipalityMap,
  (previousProps, nextProps) =>
    previousProps.municipalityNews === nextProps.municipalityNews &&
    previousProps.selectedMunicipalityId === nextProps.selectedMunicipalityId &&
    previousProps.municipalityCounts === nextProps.municipalityCounts &&
    previousProps.onSelectMunicipality === nextProps.onSelectMunicipality
);
