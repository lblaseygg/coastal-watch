import type { FeatureCollection } from "geojson";
import municipalityGeoJson from "@/data/geojson/puerto-rico-municipalities";
import municipalitiesJson from "../../../docs/contracts/mock-data/municipalities.json";
import casesJson from "../../../docs/contracts/mock-data/cases.json";
import articlesJson from "../../../docs/contracts/mock-data/articles.json";
import type {
  ArticleRecord,
  CaseRecord,
  MockCollection,
  MunicipalityRecord,
  SourceRecord
} from "@/lib/contracts";

const municipalities = (municipalitiesJson as MockCollection<MunicipalityRecord>).items;
const cases = (casesJson as MockCollection<CaseRecord>).items;
const articles = (articlesJson as MockCollection<ArticleRecord>).items;

export function getMunicipalities(): MunicipalityRecord[] {
  return municipalities;
}

export function getMunicipalityById(id: string): MunicipalityRecord | undefined {
  return municipalities.find((municipality) => municipality.id === id);
}

export function getApprovedCases(): CaseRecord[] {
  return cases.filter((currentCase) => currentCase.publication_status === "approved");
}

export function getApprovedCaseBySlug(slug: string): CaseRecord | undefined {
  return getApprovedCases().find((currentCase) => currentCase.slug === slug);
}

export function getPublicSourcesForCase(caseId: string): SourceRecord[] {
  const currentCase = getApprovedCases().find((entry) => entry.id === caseId);

  if (!currentCase) {
    return [];
  }

  return currentCase.source_article_ids
    .map((articleId) => articles.find((article) => article.id === articleId))
    .filter((article): article is ArticleRecord => Boolean(article))
    .map((article) => ({
      id: article.id,
      url: article.url,
      publisher: article.publisher,
      title: article.title,
      published_at: article.published_at
    }));
}

export function getMunicipalityGeoJson(): FeatureCollection {
  return municipalityGeoJson as FeatureCollection;
}
