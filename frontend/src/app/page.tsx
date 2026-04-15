import HomeShell from "@/components/home-shell";
import {
  getApprovedCases,
  getMapMunicipalities,
  getMunicipalityGeoJson,
  mapMunicipalitiesToRecords
} from "@/lib/api";

export default async function HomePage() {
  const [mapMunicipalities, casesResponse] = await Promise.all([
    getMapMunicipalities(),
    getApprovedCases()
  ]);

  const municipalities = mapMunicipalitiesToRecords(mapMunicipalities);
  const cases = casesResponse.items;
  const municipalityGeoJson = getMunicipalityGeoJson();

  return (
    <HomeShell
      approvedCases={cases}
      municipalities={municipalities}
      municipalityGeoJson={municipalityGeoJson}
    />
  );
}
