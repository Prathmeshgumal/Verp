import { useQuery } from '@tanstack/react-query';
import type { RefusedAttemptDto } from '@ve/shared';
import { ArrowUpRightIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { queryKeys } from '../../lib/queryKeys';
import { formatDistance, refusedTitle } from '../../lib/refused';
import { formatTime, formatWorkDate } from '../../lib/time';
import { useCompanyTz } from '../../lib/useCompanySettings';
import { useServices } from '../../services';
import { RefusedMap } from './RefusedMap';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-xl border px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="ve-num mt-1.5 text-lg leading-none font-medium">{value}</p>
    </div>
  );
}

/** One refused attempt: what happened, and a map of where the phone was. */
export function RefusedDrawer({ attempt, onClose }: { attempt: RefusedAttemptDto | null; onClose: () => void }) {
  const { api } = useServices();
  const tz = useCompanyTz();
  const sites = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const site = attempt?.siteId ? (sites.data?.find((s) => s.id === attempt.siteId) ?? null) : null;

  return (
    <Sheet open={attempt !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        <SheetHeader className="bg-card/90 sticky top-0 z-10 border-b px-5 py-4 backdrop-blur">
          <SheetTitle>Refused attempt</SheetTitle>
          <SheetDescription className="sr-only">Where the phone was when the attempt was refused.</SheetDescription>
        </SheetHeader>
        {attempt ? (
          <div className="grid gap-5 px-5 py-5">
            <div>
              <h3 className="text-xl font-bold">{attempt.name}</h3>
              <p className="text-muted-foreground mt-0.5 text-sm">{`${formatWorkDate(attempt.workDate)} · ${formatTime(attempt.serverTime, tz)}`}</p>
              <p className="text-danger mt-2 text-sm font-medium">{refusedTitle(attempt)}</p>
            </div>
            <RefusedMap key={attempt.id} attempt={attempt} site={site} />
            <div className="grid grid-cols-2 gap-3">
              <Fact label={`Distance from ${attempt.siteName ?? 'site'}`} value={attempt.distanceM != null ? formatDistance(attempt.distanceM) : '—'} />
              <Fact label="GPS accuracy" value={`±${Math.round(attempt.accuracyM)} m`} />
            </div>
            <Link
              to={`/employees/${attempt.employeeId}`}
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
            >
              Open {attempt.name}
              <ArrowUpRightIcon className="size-3.5" />
            </Link>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
