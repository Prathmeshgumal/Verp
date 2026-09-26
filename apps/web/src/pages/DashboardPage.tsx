import { useQuery } from '@tanstack/react-query';
import { ArrowUpRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { SwitchField } from '../components/Field';
import { PageHeader } from '../components/PageHeader';
import { PageError, PageLoader } from '../components/PageState';
import { Panel, PanelHeader } from '../components/Panel';
import { SimpleTable } from '../components/DataTable';
import { cn } from '@/lib/utils';
import { queryKeys } from '../lib/queryKeys';
import { formatTime, formatWorkDate } from '../lib/time';
import { useCompanyTz } from '../lib/useCompanySettings';
import { useServices } from '../services';
import { AttendanceDrawer } from './attendance/AttendanceDrawer';
import { visibleDays } from './today/workingMap';
import { WorkingMap } from './today/WorkingMap';

/** Earlier than any record: the dashboard's missed/review counts cover all time. */
export const ALL_TIME_FROM = '2020-01-01';

interface Stat {
  label: string;
  value: number;
  href?: string;
  /** Colours the number when it is above zero. */
  tone?: 'warning' | 'danger';
}

const TONE_TEXT = { warning: 'text-warning', danger: 'text-danger' } as const;

function StatCell({ label, value, href, tone }: Stat) {
  const body = (
    <>
      <span className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
        {label}
        {href ? <ArrowUpRightIcon aria-hidden className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" /> : null}
      </span>
      <span className={cn('ve-num mt-2 block text-[28px] leading-none font-medium tracking-tight', tone && value > 0 ? TONE_TEXT[tone] : undefined)}>{value}</span>
    </>
  );
  const cell = 'bg-card group block px-4 py-3.5';
  return href ? (
    <Link to={href} className={cn(cell, 'hover:bg-accent/60 transition-colors')}>
      {body}
    </Link>
  ) : (
    <div className={cell}>{body}</div>
  );
}

export function DashboardPage() {
  const { api } = useServices();
  const tz = useCompanyTz();
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.dashboard(), refetchInterval: 60_000 });
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const [showFinished, setShowFinished] = useState(false);
  const [openDayId, setOpenDayId] = useState<string | null>(null);

  if (!query.data) {
    return query.isError ? <PageError error={query.error} onRetry={() => void query.refetch()} /> : <PageLoader />;
  }
  const d = query.data;
  const upToToday = `from=${ALL_TIME_FROM}&to=${d.workDate}`;
  const stats: Stat[] = [
    { label: 'Active employees', value: d.activeEmployees },
    { label: 'Checked in today', value: d.checkedInToday },
    { label: 'Working now', value: d.workingNow },
    { label: 'Completed today', value: d.completedToday },
    { label: 'Not yet in', value: d.notYetIn },
    { label: 'Missed check-outs', value: d.missedCheckouts, href: `/attendance?${upToToday}&status=MISSED_CHECKOUT`, tone: 'warning' },
    { label: 'Needs review', value: d.needsReview, href: `/attendance?${upToToday}&needsReview=true`, tone: 'danger' },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Today"
        description={formatWorkDate(d.workDate)}
        actions={
          <span className="text-muted-foreground flex items-center gap-2 text-xs">
            <span aria-hidden className={cn('ve-live size-2 rounded-full', query.isError ? 'bg-warning' : 'bg-success')} />
            Updated <span className="ve-num">{formatTime(new Date(query.dataUpdatedAt).toISOString(), tz)}</span>
            {query.isError ? ' · could not refresh, retrying' : ''}
          </span>
        }
      />

      <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4 xl:grid-cols-7">
        {stats.map((stat) => (
          <StatCell key={stat.label} {...stat} />
        ))}
      </div>

      <div className="ve-today">
        <Panel className="pb-4">
          <PanelHeader title="On site today">
            <SwitchField label="Also show finished today" checked={showFinished} onChange={setShowFinished} />
          </PanelHeader>
          <div className="px-4 pt-2">
            {d.mapDays.length === 0 ? <p className="text-muted-foreground mb-3 text-sm">No one has checked in yet today.</p> : null}
            <WorkingMap
              days={visibleDays(d.mapDays, showFinished)}
              sites={sites.data ?? []}
              tz={tz}
              onOpen={setOpenDayId}
              height="clamp(360px, calc(100vh - 330px), 640px)"
            />
          </div>
        </Panel>

        <Panel className="ve-today-list">
          <PanelHeader title="Working now">
            <span className="text-muted-foreground ve-num text-xs">{d.working.length}</span>
          </PanelHeader>
          {d.working.length === 0 ? (
            <p className="text-muted-foreground px-4 pt-1 pb-5 text-sm">Nobody is checked in right now.</p>
          ) : (
            <div className="pt-1 pb-2">
              <SimpleTable
                rows={d.working}
                rowKey={(w) => w.employeeId}
                columns={[
                  { key: 'name', title: 'Name', render: (w) => <span className="font-medium">{w.name}</span> },
                  { key: 'site', title: 'Site', render: (w) => <span className="text-muted-foreground">{w.siteName}</span> },
                  { key: 'in', title: 'Checked in', className: 'text-right', render: (w) => <span className="ve-num">{formatTime(w.checkInAt, tz)}</span> },
                ]}
              />
            </div>
          )}
        </Panel>
      </div>
      {openDayId ? <AttendanceDrawer dayId={openDayId} onClose={() => setOpenDayId(null)} /> : null}
    </div>
  );
}
