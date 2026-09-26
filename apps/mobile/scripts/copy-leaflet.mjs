// Copies Leaflet's built files into the Android assets next to our map page.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('leaflet/dist/leaflet.js'));
const out = join(dirname(fileURLToPath(import.meta.url)), '../android/app/src/main/assets/map');

mkdirSync(out, { recursive: true });
for (const file of ['leaflet.js', 'leaflet.css']) copyFileSync(join(dist, file), join(out, file));
copyFileSync(join(dist, '..', 'LICENSE'), join(out, 'LEAFLET-LICENSE.txt'));
console.log(`copied Leaflet into ${out}`);
