import HomeShell from "@/components/home-shell";
import { getApprovedCases, getMapMunicipalities, getPublicNews, mapMunicipalitiesToRecords } from "@/lib/api";

export default async function HomePage() {
  const [mapMunicipalities, casesResponse, latestNews] = await Promise.all([
    getMapMunicipalities(),
    getApprovedCases(),
    getPublicNews({ limit: 18 })
  ]);

  const municipalities = mapMunicipalitiesToRecords(mapMunicipalities);
  const cases = casesResponse.items;

  return <HomeShell approvedCases={cases} latestNews={latestNews} municipalities={municipalities} />;
}
