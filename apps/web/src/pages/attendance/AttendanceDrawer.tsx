import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { FlagBadges } from '../../components/FlagBadges';
import { PageError, PageLoader } from '../../components/PageState';
import { StatusBadge } from '../../components/StatusBadge';
import { errorMessage } from '../../lib/errors';
import { attemptResultLabel } from '../../lib/labels';
import { queryKeys } from '../../lib/queryKeys';
import { formatDateTime, formatMinutes, formatTime, formatWorkDate } from '../../lib/time';
import { useCompanyTz } from '../../lib/useCompanySettings';
import { useServices } from '../../services';
import { DayMap } from './DayMap';
import { FixCheckoutForm } from './FixCheckoutForm';

export function AttendanceDrawer({ dayId, onClose }: { dayId: string | null; onClose: () => void }) {
  return (
    <Sheet open={dayId !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[560px]">
        <SheetHeader className="bg-card/90 sticky top-0 z-10 border-b px-5 py-4 backdrop-blur">
          <SheetTitle>Attendance day</SheetTitle>
          <SheetDescription className="sr-only">Check-in, check-out and every attempt for this day.</SheetDescription>
        </SheetHeader>
        <div className="px-5 py-5">{dayId ? <DayDetail key={dayId} dayId={dayId} /> : null}</div>
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-card rounded-xl border px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="ve-num mt-1.5 text-2xl leading-none font-medium">{value}</p>
      <p className="text-muted-foreground mt-2 text-xs leading-snug">{detail}</p>
    </div>
  );
}

const metres = (m: number | null) => (m == null ? '?' : `${Math.round(m)} m`);

function DayDetail({ dayId }: { dayId: string }) {
  const { api } = useServices();
  const tz = useCompanyTz();
  const queryClient = useQueryClient();
  const [fixing, setFixing] = useState(false);
  const detail = useQuery({ queryKey: queryKeys.attendanceDay(dayId), queryFn: () => api.getAttendance(dayId) });

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  }

  const review = useMutation({
    mutationFn: () => api.markReviewed(dayId),
    onSuccess: () => {
      toast.success('Marked as reviewed');
      refreshAll();
    },
    onError: (err) => toast.error('Not done', { description: errorMessage(err) }),
  });

  if (!detail.data) {
    return detail.isError ? <PageError error={detail.error} onRetry={() => void detail.refetch()} /> : <PageLoader />;
  }
  const { day, site, events } = detail.data;
  const clockFlagged = day.flags.includes('CLOCK_MISMATCH');

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{day.employeeName}</h3>
          <p className="text-muted-foreground mt-0.5 text-sm">{[day.employeeCode, formatWorkDate(day.workDate), day.siteName].filter(Boolean).join(' · ')}</p>
        </div>
        <StatusBadge status={day.status} />
      </div>
      <FlagBadges flags={day.flags} needsReview={day.needsReview} />

      <div className="grid gap-2">
        <DayMap day={day} site={site} />
        <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="bg-success size-2 rounded-full" /> Check-in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="bg-brand size-2 rounded-full" /> Check-out
          </span>
          <span>Circle: allowed area ({site.radiusM} m)</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Fact label="Checked in" value={formatTime(day.checkInAt, tz)} detail={`${metres(day.checkInDistanceM)} from the centre · accuracy ${metres(day.checkInAccuracyM)}`} />
        <Fact
          label="Checked out"
          value={day.checkOutAt ? formatTime(day.checkOutAt, tz) : '—'}
          detail={
            day.checkOutAt
              ? day.flags.includes('ADMIN_CORRECTED') || day.checkOutLat == null
                ? 'Set by an admin'
                : `${metres(day.checkOutDistanceM)} from the centre · accuracy ${metres(day.checkOutAccuracyM)}`
              : day.status === 'MISSED_CHECKOUT'
                ? 'No check-out recorded'
                : 'Still working'
          }
        />
      </div>
      <p className="text-sm">
        Worked: <b className="ve-num font-medium">{formatMinutes(day.workedMinutes)}</b>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {day.needsReview ? (
          <Button onClick={() => review.mutate()} loading={review.isPending}>
            Mark reviewed
          </Button>
        ) : day.reviewedAt ? (
          <p className="text-muted-foreground text-sm">Reviewed {formatDateTime(day.reviewedAt, tz)}</p>
        ) : null}
        {day.status !== 'CHECKED_IN' && !fixing ? (
          <Button variant="outline" onClick={() => setFixing(true)}>
            Fix check-out
          </Button>
        ) : null}
      </div>
      {day.status === 'CHECKED_IN' ? <p className="text-muted-foreground text-sm">Still checked in. The check-out can be fixed once the day is closed.</p> : null}
      {fixing ? (
        <FixCheckoutForm
          day={day}
          tz={tz}
          onCancel={() => setFixing(false)}
          onDone={() => {
            setFixing(false);
            refreshAll();
          }}
        />
      ) : null}

      <div className="grid gap-3 border-t pt-5">
        <h4 className="text-[15px] font-semibold">Attempts</h4>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No attempts recorded.</p>
        ) : (
          <ol className="grid">
            {events.map((ev, i) => (
              <li key={ev.id} className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                {i < events.length - 1 ? <span aria-hidden className="bg-border absolute top-4 bottom-0 left-[7px] w-px" /> : null}
                <span aria-hidden className={cn('ring-card mt-1 size-3.5 rounded-full ring-4', ev.result === 'ACCEPTED' ? 'bg-success' : 'bg-brand')} />
                <div>
                  <p className="text-sm font-medium">{`${ev.type === 'IN' ? 'Check-in' : 'Check-out'} · ${attemptResultLabel(ev.result)}`}</p>
                  <p className="ve-num mt-0.5 text-xs">{formatDateTime(ev.serverTime, tz)}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {[
                      ev.distanceM != null ? `${metres(ev.distanceM)} from the centre` : null,
                      `accuracy ${metres(ev.accuracyM)}`,
                      ev.isMock ? 'fake GPS app' : null,
                      clockFlagged && ev.deviceTime ? `phone clock ${formatTime(ev.deviceTime, tz)}` : null,
                      ev.deviceModel,
                      ev.appVersion ? `app ${ev.appVersion}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
