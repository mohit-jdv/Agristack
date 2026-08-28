// ============================================================================
// Stable procurement-centre IDs
// ----------------------------------------------------------------------------
// Recommendations, farmer Join Queue, the demo queue engine, and admin dashboards
// must share one ID per centre. Never key queues on display names.
//
// Rules:
//   1. Prefer the selling-option `id` when it is already a stable slug or UUID.
//   2. Otherwise derive `govt-procurement-<place>` from the centre name.
//   3. Lookup is ID-first, then a normalized place (place name) so "Lasalgaon",
//      "Lasalgaon Government Procurement Centre", and "govt-procurement-lasalgaon"
//      all resolve to the same record.
// ============================================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STABLE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)+$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function isStableCentreId(value: string): boolean {
  const v = value.trim();
  return isUuid(v) || STABLE_SLUG_RE.test(v);
}

/**
 * Strip boilerplate so "Lasalgaon Government Procurement Centre",
 * "govt-procurement-lasalgaon", and "Lasalgaon" share the key "lasalgaon".
 */
export function centreMatchKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/government/g, "govt")
    .replace(/\b(centre|center|procurement|govt|apmc|mandi)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function slugToken(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/government/g, "govt")
    .replace(/\b(centre|center|procurement|govt|apmc|mandi)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug;
}

/** Build a stable demo ID from a selling-option id and/or display name. */
export function stableCentreId(optionId?: string, optionName?: string): string {
  const id = (optionId ?? "").trim();
  if (id && isUuid(id)) return id;
  if (id && STABLE_SLUG_RE.test(id)) return id.toLowerCase();

  const fromName = slugToken(optionName ?? "");
  if (fromName) return `govt-procurement-${fromName}`;

  const fromId = slugToken(id);
  if (fromId) return `govt-procurement-${fromId}`;

  return "govt-procurement-centre";
}

export function humanizeCentreName(id: string, fallbackName?: string): string {
  const given = fallbackName?.trim();
  if (given) return given;
  const core = id
    .replace(/^govt-procurement-/i, "")
    .replace(/-/g, " ")
    .trim();
  if (!core) return "Government Procurement Centre";
  const titled = core.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${titled} Government Procurement Centre`;
}

export function inferDistrict(idOrName: string): string | undefined {
  const key = centreMatchKey(idOrName);
  if (!key) return undefined;
  if (/(lasalgaon|manmad|nashik)/.test(key)) return "Nashik";
  if (/pune/.test(key)) return "Pune";
  if (/nagpur/.test(key)) return "Nagpur";
  if (/jalgaon/.test(key)) return "Jalgaon";
  return undefined;
}
