export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  tileUrl: import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};
