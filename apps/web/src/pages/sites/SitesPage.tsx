import { Anchor, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { PageError, PageLoader } from '../../components/PageState';
import { queryKeys } from '../../lib/queryKeys';
import { useServices } from '../../services';
import { SitesMap } from './SitesMap';

export function SitesPage() {
  const { api } = useServices();
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());

  function selectFromMap(id: string) {
    setSelectedId(id);
    rows.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1}>Sites</Title>
        <Button component={Link} to="/sites/new" leftSection={<IconPlus size={18} />}>
          Add site
        </Button>
      </Group>
      {sites.isError && !sites.data ? (
        <PageError error={sites.error} onRetry={() => void sites.refetch()} />
      ) : !sites.data ? (
        <PageLoader />
      ) : (
        <div className="ve-split">
          <div className="ve-split-map">
            <SitesMap sites={sites.data} selectedId={selectedId} hoveredId={hoveredId} onSelect={selectFromMap} />
          </div>
          <Paper withBorder radius="md" className="ve-split-panel">
            <Group justify="space-between" px="md" py="sm" className="ve-split-head">
              <Title order={4}>All sites</Title>
              <Text size="sm" c="dimmed">
                {sites.data.length === 1 ? '1 site' : `${sites.data.length} sites`}
              </Text>
            </Group>
            <Stack className="ve-split-list" gap="xs" p="sm">
              {sites.data.length === 0 ? (
                <Text c="dimmed">No sites yet</Text>
              ) : (
                sites.data.map((s) => (
                  <Paper
                    key={s.id}
                    ref={(el: HTMLDivElement | null) => {
                      if (el) rows.current.set(s.id, el);
                      else rows.current.delete(s.id);
                    }}
                    data-testid={`site-row-${s.id}`}
                    aria-current={s.id === selectedId ? 'true' : undefined}
                    withBorder
                    p="sm"
                    radius="md"
                    className="ve-site-row"
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <div>
                        <Anchor component={Link} to={`/sites/${s.id}`} fw={600} onClick={(event) => event.stopPropagation()}>
                          {s.name}
                        </Anchor>
                        <Text size="sm" c="dimmed">
                          {s.address ?? 'No address'}
                        </Text>
                      </div>
                      <Stack gap={4} align="flex-end">
                        <Badge color={s.isActive ? 'ledgerGreen' : 'gray'} variant="light">
                          {s.isActive ? 'In use' : 'Not in use'}
                        </Badge>
                        <Text size="sm" className="ve-num">
                          {s.radiusM} m
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                ))
              )}
            </Stack>
          </Paper>
        </div>
      )}
    </Stack>
  );
}
