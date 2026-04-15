"use client";

import { useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import type { LeafletMouseEvent, PathOptions } from "leaflet";
import type { MunicipalityRecord } from "@/lib/contracts";

type MunicipalityMapProps = {
  hoveredMunicipalityId: string | null;
  municipalityCounts: Map<string, { total: number; active: number }>;
  municipalityGeoJson: FeatureCollection;
  municipalities: MunicipalityRecord[];
  onHoverMunicipality: (municipalityId: string | null) => void;
  onSelectMunicipality: (municipalityId: string | null) => void;
  selectedMunicipalityId: string | null;
};

function getFeatureId(feature: Feature | undefined): string | null {
  if (!feature?.properties || typeof feature.properties !== "object") {
    return null;
  }

  const key = feature.properties.geojson_key;
  return typeof key === "string" ? key : null;
}

export default function MunicipalityMap({
  hoveredMunicipalityId,
  municipalityCounts,
  municipalityGeoJson,
  municipalities,
  onHoverMunicipality,
  onSelectMunicipality,
  selectedMunicipalityId
}: MunicipalityMapProps) {
  const bounds = useMemo(
    () => [
      [17.88, -67.35],
      [18.55, -65.77]
    ] as [[number, number], [number, number]],
    []
  );

  const municipalityNameById = useMemo(
    () => new Map(municipalities.map((municipality) => [municipality.id, municipality.name])),
    [municipalities]
  );

  return (
    <div className="relative h-[680px] overflow-hidden rounded-[28px]">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-[500] flex justify-between gap-4">
        <div className="rounded-full border border-white/40 bg-[rgba(16,37,43,0.82)] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          Hover to preview, click to pin
        </div>
        {selectedMunicipalityId ? (
          <button
            className="pointer-events-auto rounded-full border border-white/40 bg-[rgba(241,109,91,0.92)] px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[rgba(241,109,91,1)]"
            onClick={() => onSelectMunicipality(null)}
            type="button"
          >
            Clear municipality
          </button>
        ) : null}
      </div>

      <MapContainer
        bounds={bounds}
        className="h-full w-full"
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={municipalityGeoJson as GeoJsonObject}
          key={`${selectedMunicipalityId ?? "none"}-${hoveredMunicipalityId ?? "none"}`}
          onEachFeature={(feature, layer) => {
            const featureId = getFeatureId(feature);

            if (!featureId) {
              return;
            }

            const municipalityName = municipalityNameById.get(featureId) ?? featureId;
            const counts = municipalityCounts.get(featureId) ?? { total: 0, active: 0 };

            layer.bindTooltip(
              `${municipalityName} • ${counts.total} case${counts.total === 1 ? "" : "s"}`,
              {
                className: "map-tooltip",
                direction: "top",
                sticky: true
              }
            );

            layer.on({
              mouseover: () => onHoverMunicipality(featureId),
              mouseout: () => onHoverMunicipality(null),
              click: (event: LeafletMouseEvent) => {
                event.originalEvent.preventDefault();
                onSelectMunicipality(featureId === selectedMunicipalityId ? null : featureId);
              }
            });
          }}
          style={(feature): PathOptions => {
            const featureId = getFeatureId(feature);
            const counts = featureId ? municipalityCounts.get(featureId) : null;
            const isSelected = featureId === selectedMunicipalityId;
            const isHovered = featureId === hoveredMunicipalityId;
            const hasCases = Boolean(counts && counts.total > 0);

            return {
              color: isSelected ? "#f16d5b" : isHovered ? "#0d5f73" : "#3f6571",
              weight: isSelected ? 3 : isHovered ? 2.5 : 1.4,
              opacity: 1,
              fillOpacity: isSelected ? 0.72 : isHovered ? 0.56 : hasCases ? 0.42 : 0.22,
              fillColor: isSelected ? "#f16d5b" : hasCases ? "#0d5f73" : "#b3ced4"
            };
          }}
        />
      </MapContainer>
    </div>
  );
}
