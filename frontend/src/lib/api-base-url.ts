export function getApiBaseUrl(): string {
  const configuredBaseUrl =
    process.env.INTERNAL_API_BASE_URL ?? process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return "http://api:8000";
  }

  return "http://localhost:8000";
}
