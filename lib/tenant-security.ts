export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readBusinessIdCandidate(body: Record<string, unknown> | null) {
  if (!body) {
    return "";
  }

  return normalizeText(body.businessId ?? body.business_id);
}

export function ensureNoBusinessIdSpoofing(
  body: Record<string, unknown> | null,
  expectedBusinessId: string,
) {
  const providedBusinessId = readBusinessIdCandidate(body);

  if (providedBusinessId && providedBusinessId !== expectedBusinessId) {
    throw new Error("business_id_mismatch");
  }
}
