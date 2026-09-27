/** An env value, or the fallback when it is missing or blank (e.g. set to "" in a hosting dashboard). */
export function envOr(value: string | undefined, fallback: string): string {
  return value?.trim() ? value.trim() : fallback;
}

export const config = {
  apiUrl: envOr(import.meta.env.VITE_API_URL, 'http://localhost:3000'),
  tileUrl: envOr(import.meta.env.VITE_TILE_URL, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
};
