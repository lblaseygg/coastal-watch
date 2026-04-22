import type { FeatureCollection } from "geojson";
import municipalityGeoJson from "@/data/geojson/puerto-rico-municipalities";
import { getApiBaseUrl } from "@/lib/api-base-url";
import type {
  CaseRecord,
  MapMunicipalityRecord,
  MunicipalityRecord,
  NewsRecord,
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

type NewsResponse = {
  items: NewsRecord[];
};

const API_RETRY_ATTEMPTS = 3;
const API_RETRY_DELAY_MS = 250;

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function fetchApi<T>(path: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= API_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${getApiBaseUrl()}${path}`, {
        cache: "no-store"
      });

      if (response.status >= 500 && attempt < API_RETRY_ATTEMPTS) {
        await wait(API_RETRY_DELAY_MS * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API request failed for ${path} with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiEnvelope<T>;

      if (payload.error) {
        throw new Error(payload.error.message);
      }

      return payload.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < API_RETRY_ATTEMPTS) {
        await wait(API_RETRY_DELAY_MS * attempt);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`API request failed for ${path}`);
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
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= API_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/cases/${slug}`, {
        cache: "no-store"
      });

      if (response.status === 404) {
        return null;
      }

      if (response.status >= 500 && attempt < API_RETRY_ATTEMPTS) {
        await wait(API_RETRY_DELAY_MS * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API request failed for case ${slug} with status ${response.status}`);
      }

      const payload = (await response.json()) as ApiEnvelope<CaseDetailResponse>;

      if (payload.error) {
        throw new Error(payload.error.message);
      }

      return payload.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < API_RETRY_ATTEMPTS) {
        await wait(API_RETRY_DELAY_MS * attempt);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`API request failed for case ${slug}`);
}

export async function getPublicNews(params?: {
  municipalityId?: string;
  limit?: number;
}): Promise<NewsRecord[]> {
  const searchParams = new URLSearchParams();

  if (params?.municipalityId) {
    searchParams.set("municipality_id", params.municipalityId);
  }

  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const queryString = searchParams.toString();
  const data = await fetchApi<NewsResponse>(`/api/news${queryString ? `?${queryString}` : ""}`);
  return data.items;
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
