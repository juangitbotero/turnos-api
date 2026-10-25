/**
 * Address → coordinates for shift posting, via Nominatim (OpenStreetMap).
 */
export type GeoResult = { lat: number; lng: number; display: string } | null;

// NOTE: this header goes to Nominatim (OpenStreetMap), NOT the Turnos API — it
// picks the language of the returned place names. Kept at 'pt' deliberately:
// the address is stored and shown to workers who will physically go there, and
// a Portuguese street name is what the signage and their map app will say.
export async function geocodeAddress(address: string): Promise<GeoResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=pt`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt' } });
  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
  const first = data[0];
  if (!first) return null;
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), display: first.display_name };
}
