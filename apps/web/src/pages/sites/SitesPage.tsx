import { PlusIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageHeader } from '../../components/PageHeader';
import { PageError, PageLoader } from '../../components/PageState';
import { Panel } from '../../components/Panel';
import { Pill } from '../../components/Pill';
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
    <div className="grid gap-6">
      <PageHeader
        title="Sites"
        description="Where workers can check in. Each site is a pin and an allowed distance around it."
        actions={
          <Button asChild>
            <Link to="/sites/new">
              <PlusIcon />
              Add site
            </Link>
          </Button>
        }
      />
      {sites.isError && !sites.data ? (
        <PageError error={sites.error} onRetry={() => void sites.refetch()} />
      ) : !sites.data ? (
        <PageLoader />
      ) : (
        <div className="ve-split">
          <div className="ve-split-map overflow-hidden rounded-xl border">
            <SitesMap sites={sites.data} selectedId={selectedId} hoveredId={hoveredId} onSelect={selectFromMap} />
          </div>
          <Panel className="ve-split-panel">
            <div className="ve-split-head flex h-12 items-center justify-between px-4">
              <h2 className="text-[15px] font-semibold">All sites</h2>
              <span className="text-muted-foreground ve-num text-xs">{sites.data.length === 1 ? '1 site' : `${sites.data.length} sites`}</span>
            </div>
            <div className="ve-split-list grid content-start gap-2 p-2">
              {sites.data.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">No sites yet</p>
              ) : (
                sites.data.map((s) => (
                  <div
                    key={s.id}
                    ref={(el: HTMLDivElement | null) => {
                      if (el) rows.current.set(s.id, el);
                      else rows.current.delete(s.id);
                    }}
                    data-testid={`site-row-${s.id}`}
                    aria-current={s.id === selectedId ? 'true' : undefined}
                    className="ve-site-row hover:bg-accent/60 flex items-start justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors"
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <div className="min-w-0">
                      <Link to={`/sites/${s.id}`} className="hover:text-brand-ink font-medium transition-colors" onClick={(event) => event.stopPropagation()}>
                        {s.name}
                      </Link>
                      <p className="text-muted-foreground truncate text-xs">{s.address ?? 'No address'}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Pill tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'In use' : 'Not in use'}</Pill>
                      <span className="ve-num text-muted-foreground text-xs">{s.radiusM} m</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
