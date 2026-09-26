import { useForm } from '@mantine/form';
import { CrosshairIcon, LinkIcon, SearchIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseCoordinates } from '@ve/shared';
import type { SiteDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { NumberField, SwitchField, TextField } from '../../components/Field';
import { PageHeader } from '../../components/PageHeader';
import { Panel, PanelHeader } from '../../components/Panel';
import { z } from 'zod';
import { Notice, PageError, PageLoader } from '../../components/PageState';
import { errorMessage } from '../../lib/errors';
import { locateBest, type Reading } from '../../lib/locate';
import { queryKeys } from '../../lib/queryKeys';
import { useCompanySettings } from '../../lib/useCompanySettings';
import { useServices } from '../../services';
import type { PlaceResult } from './placeSearch';
import { SiteMapPicker, type LatLng } from './SiteMapPicker';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the site name').max(120, 'Name is too long'),
  address: z.string().trim().max(300, 'Address is too long'),
  lat: z.number({ error: 'Enter the latitude' }).min(-90, 'Latitude is between -90 and 90').max(90, 'Latitude is between -90 and 90'),
  lng: z.number({ error: 'Enter the longitude' }).min(-180, 'Longitude is between -180 and 180').max(180, 'Longitude is between -180 and 180'),
  radiusM: z.number({ error: 'Enter the distance' }).int('Use whole metres').min(10, 'At least 10 m').max(1000, 'At most 1000 m'),
  isActive: z.boolean(),
});

// A type, not an interface: the zod form resolver needs values assignable to Record<string, unknown>.
type FormValues = {
  name: string;
  address: string;
  /** NumberInput gives '' while the box is empty; a new site starts empty (no pin). */
  lat: number | string;
  lng: number | string;
  radiusM: number | string;
  isActive: boolean;
};

/** The map fills what is left of the window below the location tools: 320–520 px. */
const MAP_HEIGHT = 'clamp(380px, calc(100vh - 290px), 760px)';

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const num = (v: number | string) => (typeof v === 'number' ? v : null);

export function SiteEditPage() {
  const { id } = useParams();
  const { api } = useServices();
  const settings = useCompanySettings();
  const siteQ = useQuery({ queryKey: queryKeys.site(id ?? 'new'), queryFn: () => api.getSite(id ?? ''), enabled: !!id });

  if (id && !siteQ.data) {
    return siteQ.isError ? <PageError error={siteQ.error} onRetry={() => void siteQ.refetch()} /> : <PageLoader />;
  }
  return (
    <SiteEditor
      key={id ?? 'new'}
      site={siteQ.data ?? null}
      defaultRadiusM={settings.data?.defaultRadiusM ?? 100}
      maxAccuracyM={settings.data?.maxAccuracyM ?? 50}
    />
  );
}

function SiteEditor({ site, defaultRadiusM, maxAccuracyM }: { site: SiteDto | null; defaultRadiusM: number; maxAccuracyM: number }) {
  const { api, searchPlaces } = useServices();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [recenterKey, setRecenterKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [places, setPlaces] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [progressM, setProgressM] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<Reading | null>(null);
  const [linkText, setLinkText] = useState('');
  const [resolving, setResolving] = useState(false);
  /** Bumped on every pin move; a slow lookup that started before a move must not undo it. */
  const moveSeq = useRef(0);
  const others = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites(), enabled: !site });

  const form = useForm<FormValues>({
    initialValues: site
      ? { name: site.name, address: site.address ?? '', lat: site.lat, lng: site.lng, radiusM: site.radiusM, isActive: site.isActive }
      : { name: '', address: '', lat: '', lng: '', radiusM: defaultRadiusM, isActive: true },
    validate: zod4Resolver(schema),
  });

  const lat = num(form.values.lat);
  const lng = num(form.values.lng);
  const center: LatLng | null = lat !== null && lng !== null ? { lat, lng } : null;
  const radiusM = Math.min(1000, Math.max(10, num(form.values.radiusM) ?? 10));

  function moveTo(p: LatLng, recenter: boolean) {
    moveSeq.current += 1;
    form.setValues({ lat: round6(p.lat), lng: round6(p.lng) });
    setAccuracy(null);
    setNote(null);
    if (recenter) setRecenterKey((k) => k + 1);
  }

  async function findPlaces(event: FormEvent) {
    event.preventDefault();
    if (!placeQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setPlaces(await searchPlaces(placeQuery));
    } catch (err) {
      console.warn('place search failed', err);
      setPlaces(null);
      setError('Place search is not available right now. Drag the pin instead.');
    } finally {
      setSearching(false);
    }
  }

  async function locateMe() {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share its location. Drag the pin instead.');
      return;
    }
    setLocating(true);
    setError(null);
    setNote(null);
    setProgressM(null);
    const seq = moveSeq.current;
    const result = await locateBest(navigator.geolocation, maxAccuracyM, setProgressM);
    setLocating(false);
    setProgressM(null);
    if (moveSeq.current !== seq) return;
    if (result.kind === 'ok') {
      moveTo(result.reading, true);
      setAccuracy(result.reading);
      setNote(`Your location · accurate to ±${Math.round(result.reading.accuracyM)} m`);
    } else if (result.kind === 'imprecise') {
      setError(
        `Your location is only accurate to ±${Math.round(result.reading.accuracyM)} m, more than the ±${maxAccuracyM} m allowed. ` +
          'Laptops usually cannot tell their exact position. Search, paste from Google Maps, or drag the pin.',
      );
    } else if (result.kind === 'denied') {
      setError('Location permission was refused. Allow it in the browser, or drag the pin.');
    } else {
      setError('Could not get your location. Drag the pin instead.');
    }
  }

  function placeFromGoogle(p: LatLng) {
    moveTo(p, true);
    setNote('From Google Maps · check the circle before saving.');
    setLinkText('');
  }

  async function pasteFromGoogle(event: FormEvent) {
    event.preventDefault();
    const text = linkText.trim();
    if (!text) return;
    setError(null);
    const local = parseCoordinates(text);
    if (local) return placeFromGoogle(local);
    setResolving(true);
    const seq = moveSeq.current;
    try {
      const place = await api.resolvePlaceLink(text);
      if (moveSeq.current === seq) placeFromGoogle(place);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResolving(false);
    }
  }

  const save = useMutation({
    mutationFn: (v: z.output<typeof schema>) =>
      site
        ? api.updateSite(site.id, { name: v.name, address: v.address || null, lat: v.lat, lng: v.lng, radiusM: v.radiusM, isActive: v.isActive })
        : api.createSite({ name: v.name, address: v.address || undefined, lat: v.lat, lng: v.lng, radiusM: v.radiusM }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast.success('Site saved');
      navigate('/sites');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        back={{ to: '/sites', label: 'Sites' }}
        title={site ? 'Edit site' : 'New site'}
        description="Place the pin where workers stand, then set how far from it they may check in."
      />

      <div className="ve-site-edit">
        <Panel className="ve-site-edit-map pb-4">
          <PanelHeader title="Location" />
          <div className="px-4 pt-2">
            <div className="overflow-hidden rounded-lg border">
              <SiteMapPicker
                center={center}
                radiusM={radiusM}
                recenterKey={recenterKey}
                accuracy={accuracy}
                overview={(others.data ?? []).map((s) => ({ lat: s.lat, lng: s.lng }))}
                height={MAP_HEIGHT}
                onMove={(p) => moveTo(p, false)}
              />
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {center
                ? 'Drag the pin, or click the map, to set the centre of the site.'
                : 'Set the location: search, paste from Google Maps, use my location, or tap the map.'}
            </p>
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel>
            <PanelHeader title="Find the place" />
            <div className="grid gap-4 px-4 pt-2 pb-4">
              <form className="flex items-end gap-2" onSubmit={(event) => void findPlaces(event)}>
                <TextField
                  label="Search for a place"
                  placeholder="Area, landmark or address"
                  value={placeQuery}
                  onChange={(event) => setPlaceQuery(event.currentTarget.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="outline" loading={searching}>
                  {searching ? null : <SearchIcon />}
                  Search
                </Button>
              </form>
              {places !== null ? (
                <div className="bg-muted/40 grid gap-0.5 rounded-lg border p-1.5">
                  {places.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-1.5 text-sm">No places found. Try a nearby landmark.</p>
                  ) : (
                    places.map((p) => (
                      <Button
                        key={`${p.lat},${p.lng}`}
                        variant="ghost"
                        className="h-auto justify-start py-1.5 text-left font-normal whitespace-normal"
                        onClick={() => {
                          moveTo(p, true);
                          setPlaces(null);
                        }}
                      >
                        {p.name}
                      </Button>
                    ))
                  )}
                  <p className="text-muted-foreground px-2 pt-1 text-[11px]">Search by Nominatim · © OpenStreetMap contributors</p>
                </div>
              ) : null}
              <form className="flex items-end gap-2" onSubmit={(event) => void pasteFromGoogle(event)}>
                <TextField
                  label="Paste from Google Maps"
                  description="In Google Maps, tap Share → Copy link, or long-press the spot to copy its coordinates."
                  placeholder="https://maps.app.goo.gl/… or 17.4167, 78.3664"
                  value={linkText}
                  onChange={(event) => setLinkText(event.currentTarget.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="outline" loading={resolving}>
                  {resolving ? null : <LinkIcon />}
                  Go
                </Button>
              </form>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" loading={locating} onClick={() => void locateMe()}>
                  {locating ? null : <CrosshairIcon />}
                  Use my location
                </Button>
                {locating && progressM !== null ? (
                  <span className="text-muted-foreground ve-num text-sm">{`Getting your location… ±${Math.round(progressM)} m`}</span>
                ) : null}
              </div>
              {note ? <p className="text-success text-sm font-medium">{note}</p> : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Details" />
            <form noValidate className="grid gap-4 px-4 pt-2 pb-4" onSubmit={form.onSubmit((values) => save.mutate(schema.parse(values)))}>
              <TextField label="Site name" {...form.getInputProps('name')} />
              <TextField label="Address (optional)" {...form.getInputProps('address')} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Latitude" decimalScale={6} {...form.getInputProps('lat')} />
                <NumberField label="Longitude" decimalScale={6} {...form.getInputProps('lng')} />
              </div>
              <NumberField
                label="Allowed distance (metres)"
                description="Workers must be this close to the pin to check in."
                {...form.getInputProps('radiusM')}
              />
              <div className="grid gap-2 pb-1">
                <Slider
                  min={10}
                  max={1000}
                  step={10}
                  value={[radiusM]}
                  onValueChange={([value]) => form.setFieldValue('radiusM', value ?? radiusM)}
                  aria-label="Allowed distance slider"
                />
                <div className="text-muted-foreground ve-num flex justify-between text-[11px]">
                  <span>10 m</span>
                  <span>500 m</span>
                  <span>1000 m</span>
                </div>
              </div>
              {site ? (
                <SwitchField label="Site is in use" checked={form.values.isActive} onChange={(checked) => form.setFieldValue('isActive', checked)} />
              ) : null}
              {error ? <Notice>{error}</Notice> : null}
              <div className="flex justify-end">
                <Button type="submit" loading={save.isPending} disabled={!center}>
                  Save site
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
