// ============================================================================
// Current demo-farmer session (the person using the Farmer UI)
// ----------------------------------------------------------------------------
// Seeded queue farmers (Ramesh Patil, Savita More, …) stay in the shared
// demo queue for the admin dashboard. They are NOT the current user.
//
// The current farmer is whoever typed their name in the Farmer UI. Persist
// across dashboard → compare → join → token → refresh via localStorage + cookie.
// ============================================================================

export const FARMER_SESSION_STORAGE_KEY = "agristack.currentFarmer";
export const FARMER_NAME_COOKIE = "agristack_farmer_name";

export type CurrentFarmerSession = {
  name: string;
  crop: string;
  quantity: number;
  location: string;
};

function parseSession(raw: unknown): CurrentFarmerSession | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const quantity = Number(obj.quantity);
  return {
    name,
    crop: typeof obj.crop === "string" && obj.crop.trim() ? obj.crop : "Onion",
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 50,
    location: typeof obj.location === "string" ? obj.location : "",
  };
}

export function readFarmerSession(): CurrentFarmerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FARMER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return parseSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeFarmerSession(session: CurrentFarmerSession): void {
  if (typeof window === "undefined") return;
  const name = session.name.trim();
  if (!name) return;
  const next: CurrentFarmerSession = {
    name,
    crop: session.crop,
    quantity: session.quantity,
    location: session.location,
  };
  window.localStorage.setItem(FARMER_SESSION_STORAGE_KEY, JSON.stringify(next));
  const secure =
    typeof window.location !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${FARMER_NAME_COOKIE}=${encodeURIComponent(name)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

export function farmerNameFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === FARMER_NAME_COOKIE) {
      try {
        const value = decodeURIComponent(rest.join("=")).trim();
        return value || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
