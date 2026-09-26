import { Alert, Anchor, Button, Group, NumberInput, Paper, SimpleGrid, Slider, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCurrentLocation, IconSearch } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SiteDto } from '@ve/shared';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { PageError, PageLoader } from '../../components/PageState';
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

/** The map fills the window below the page header, but never shrinks under 480 px. */
const MAP_HEIGHT = 'max(480px, calc(100vh - 330px))';

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
    const result = await locateBest(navigator.geolocation, maxAccuracyM, setProgressM);
    setLocating(false);
    setProgressM(null);
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

  const save = useMutation({
    mutationFn: (v: z.output<typeof schema>) =>
      site
        ? api.updateSite(site.id, { name: v.name, address: v.address || null, lat: v.lat, lng: v.lng, radiusM: v.radiusM, isActive: v.isActive })
        : api.createSite({ name: v.name, address: v.address || undefined, lat: v.lat, lng: v.lng, radiusM: v.radiusM }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      notifications.show({ color: 'ledgerGreen', message: 'Site saved' });
      navigate('/sites');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/sites" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={16} /> Sites
        </Group>
      </Anchor>
      <Title order={1}>{site ? 'Edit site' : 'New site'}</Title>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Stack>
          <form onSubmit={(event) => void findPlaces(event)}>
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                label="Search for a place"
                placeholder="Area, landmark or address"
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button type="submit" variant="default" leftSection={<IconSearch size={16} />} loading={searching}>
                Search
              </Button>
            </Group>
          </form>
          {places !== null ? (
            <Paper withBorder p="xs" radius="md">
              <Stack gap={2}>
                {places.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No places found. Try a nearby landmark.
                  </Text>
                ) : (
                  places.map((p) => (
                    <Button
                      key={`${p.lat},${p.lng}`}
                      variant="subtle"
                      justify="flex-start"
                      h="auto"
                      py={6}
                      styles={{ label: { whiteSpace: 'normal', textAlign: 'left' } }}
                      onClick={() => {
                        moveTo(p, true);
                        setPlaces(null);
                      }}
                    >
                      {p.name}
                    </Button>
                  ))
                )}
                <Text size="xs" c="dimmed">
                  Search by Nominatim · © OpenStreetMap contributors
                </Text>
              </Stack>
            </Paper>
          ) : null}
          <Group>
            <Button variant="default" leftSection={<IconCurrentLocation size={16} />} loading={locating} onClick={() => void locateMe()}>
              Use my location
            </Button>
            {locating && progressM !== null ? (
              <Text size="sm" c="dimmed">
                {`Getting your location… ±${Math.round(progressM)} m`}
              </Text>
            ) : null}
          </Group>
          {note ? (
            <Text size="sm" c="ledgerGreen">
              {note}
            </Text>
          ) : null}
          <SiteMapPicker
            center={center}
            radiusM={radiusM}
            recenterKey={recenterKey}
            accuracy={accuracy}
            overview={(others.data ?? []).map((s) => ({ lat: s.lat, lng: s.lng }))}
            height={MAP_HEIGHT}
            onMove={(p) => moveTo(p, false)}
          />
          <Text size="sm" c="dimmed">
            {center
              ? 'Drag the pin, or click the map, to set the centre of the site.'
              : 'Set the location: search, paste from Google Maps, use my location, or tap the map.'}
          </Text>
        </Stack>

        <form noValidate onSubmit={form.onSubmit((values) => save.mutate(schema.parse(values)))}>
          <Stack>
            <TextInput label="Site name" {...form.getInputProps('name')} />
            <TextInput label="Address (optional)" {...form.getInputProps('address')} />
            <Group grow>
              <NumberInput label="Latitude" decimalScale={6} hideControls {...form.getInputProps('lat')} />
              <NumberInput label="Longitude" decimalScale={6} hideControls {...form.getInputProps('lng')} />
            </Group>
            <NumberInput
              label="Allowed distance (metres)"
              description="Workers must be this close to the pin to check in."
              min={10}
              max={1000}
              step={10}
              allowDecimal={false}
              clampBehavior="none"
              {...form.getInputProps('radiusM')}
            />
            <Slider
              min={10}
              max={1000}
              step={10}
              value={radiusM}
              onChange={(value) => form.setFieldValue('radiusM', value)}
              label={(value) => `${value} m`}
              thumbLabel="Allowed distance slider"
              marks={[{ value: 50 }, { value: 100 }, { value: 200 }, { value: 500 }]}
            />
            {site ? <Switch label="Site is in use" {...form.getInputProps('isActive', { type: 'checkbox' })} /> : null}
            {error ? <Alert color="ledgerOrange">{error}</Alert> : null}
            <Group justify="flex-end">
              <Button type="submit" loading={save.isPending} disabled={!center}>
                Save site
              </Button>
            </Group>
          </Stack>
        </form>
      </SimpleGrid>
    </Stack>
  );
}
