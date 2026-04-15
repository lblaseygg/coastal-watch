import HomeShell from "@/components/home-shell";
import { getApprovedCases, getMapMunicipalities, mapMunicipalitiesToRecords } from "@/lib/api";

export default async function HomePage() {
  const [mapMunicipalities, casesResponse] = await Promise.all([
    getMapMunicipalities(),
    getApprovedCases()
  ]);

  const municipalities = mapMunicipalitiesToRecords(mapMunicipalities);
  const cases = casesResponse.items;

  return <HomeShell approvedCases={cases} municipalities={municipalities} />;
}
