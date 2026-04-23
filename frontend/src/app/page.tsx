import { cookies } from "next/headers";
import HomeShell from "@/components/home-shell";
import { getApprovedCases, getMapMunicipalities, getPublicNews, mapMunicipalitiesToRecords } from "@/lib/api";
import { getAdminSession } from "@/lib/admin-session";

export default async function HomePage() {
  const showAdmin = Boolean(getAdminSession(cookies()));
  const [mapMunicipalities, casesResponse, latestNews] = await Promise.all([
    getMapMunicipalities(),
    getApprovedCases(),
    getPublicNews({ limit: 18 })
  ]);

  const municipalities = mapMunicipalitiesToRecords(mapMunicipalities);
  const cases = casesResponse.items;

  return <HomeShell approvedCases={cases} latestNews={latestNews} municipalities={municipalities} showAdmin={showAdmin} />;
}
