import HomeShell from "@/components/home-shell";
import { getApprovedCases, getMunicipalities, getMunicipalityGeoJson } from "@/lib/mock-data";

export default function HomePage() {
  const municipalities = getMunicipalities();
  const cases = getApprovedCases();
  const municipalityGeoJson = getMunicipalityGeoJson();

  return (
    <HomeShell
      approvedCases={cases}
      municipalities={municipalities}
      municipalityGeoJson={municipalityGeoJson}
    />
  );
}
