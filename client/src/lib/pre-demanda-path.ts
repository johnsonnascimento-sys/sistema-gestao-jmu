export function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

export function buildPreDemandaPath(preId: string) {
  return `/pre-demandas/${encodePathSegment(preId)}`;
}

export function buildPreDemandaApiPath(preId: string, suffix = "") {
  return `/api/pre-demandas/${encodePathSegment(preId)}${suffix}`;
}
