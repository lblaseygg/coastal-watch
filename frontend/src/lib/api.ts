import type { FeatureCollection } from "geojson";
import municipalityGeoJson from "@/data/geojson/puerto-rico-municipalities";
import type {
  CaseRecord,
  MapMunicipalityRecord,
  MunicipalityRecord,
  PaginationRecord,
  SourceRecord
} from "@/lib/contracts";

type ApiEnvelope<T> = {
  data: T;
  meta: {
    schema_version: string;
    request_id: string;
    generated_at: string;
  };
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
};

type MapResponse = {
  municipalities: MapMunicipalityRecord[];
};

type CasesResponse = {
  items: CaseRecord[];
  pagination: PaginationRecord;
};

type CaseDetailResponse = {
  case: CaseRecord;
  sources: SourceRecord[];
};

function getApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? "http://localhost:8000";
}

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed for ${path} with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (payload.error) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

export async function getMapMunicipalities(): Promise<MapMunicipalityRecord[]> {
  const data = await fetchApi<MapResponse>("/api/map");
  return data.municipalities;
}

export async function getApprovedCases(params?: {
  municipalityId?: string;
  query?: string;
  status?: string;
}): Promise<{ items: CaseRecord[]; pagination: PaginationRecord }> {
  const searchParams = new URLSearchParams();

  if (params?.municipalityId) {
    searchParams.set("municipality_id", params.municipalityId);
  }

  if (params?.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params?.query) {
    searchParams.set("q", params.query);
  }

  const queryString = searchParams.toString();
  const data = await fetchApi<CasesResponse>(`/api/cases${queryString ? `?${queryString}` : ""}`);

  return data;
}

export async function getApprovedCaseBySlug(slug: string): Promise<CaseDetailResponse | null> {
  const response = await fetch(`${getApiBaseUrl()}/api/cases/${slug}`, {
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`API request failed for case ${slug} with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<CaseDetailResponse>;

  if (payload.error) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

export function mapMunicipalitiesToRecords(
  municipalities: MapMunicipalityRecord[]
): MunicipalityRecord[] {
  return municipalities.map((municipality) => ({
    id: municipality.id,
    name: municipality.name,
    region: "coastal",
    coastal: true,
    centroid: municipality.centroid,
    geojson_key: municipality.geojson_key
  }));
}

export function getMunicipalityGeoJson(): FeatureCollection {
  return municipalityGeoJson as FeatureCollection;
}
