export type ReviewState =
  | "draft"
  | "pending_review"
  | "needs_edit"
  | "approved"
  | "rejected"
  | "archived";

export type PublicationStatus = "draft" | "pending_review" | "approved" | "rejected" | "archived";

export type CaseStatus = "reported" | "monitoring" | "active" | "resolved" | "archived";

export type CaseCategory =
  | "access_restriction"
  | "development"
  | "environmental_concern"
  | "policy_or_permitting";

export type LocationPrecision = "municipality" | "approximate" | "exact";

export type MunicipalityRecord = {
  id: string;
  name: string;
  region: string;
  coastal: boolean;
  centroid: {
    lat: number;
    lng: number;
  };
  geojson_key: string;
};

export type CaseRecord = {
  id: string;
  slug: string;
  title: string;
  municipality_id: string;
  status: CaseStatus;
  publication_status: PublicationStatus;
  review_state: ReviewState;
  category: CaseCategory;
  tags: string[];
  public_summary: string;
  internal_summary: string;
  location: {
    lat: number;
    lng: number;
    precision: LocationPrecision;
  };
  first_reported_at: string;
  last_updated_at: string;
  source_article_ids: string[];
  review_reason_codes: string[];
  confidence_score: number;
};

export type ArticleRecord = {
  id: string;
  url: string;
  publisher: string;
  title: string;
  published_at: string;
  accessed_at: string;
  language: string;
  fetch_status: "queued" | "fetched" | "cleaned" | "failed";
  content_hash: string;
  cleaned_text: string;
  linked_case_ids: string[];
  created_at: string;
};

export type SourceRecord = Pick<ArticleRecord, "id" | "url" | "publisher" | "title" | "published_at">;

export type MockCollection<T> = {
  schema_version: string;
  items: T[];
};
