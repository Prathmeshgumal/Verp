import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowUpRightIcon } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SimpleTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { Panel, PanelHeader } from '../../components/Panel';
import { Pill } from '../../components/Pill';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FlagBadges } from '../../components/FlagBadges';
import { PageError, PageLoader } from '../../components/PageState';
import { PinModal } from '../../components/PinModal';
import { StatusBadge } from '../../components/StatusBadge';
import { errorMessage } from '../../lib/errors';
import { employeeStatus, formatPhone } from '../../lib/labels';
import { queryKeys } from '../../lib/queryKeys';
import { addDays, formatDateTime, formatMinutes, formatTime, formatWorkDate, todayIn } from '../../lib/time';
import { useCompanyTz } from '../../lib/useCompanySettings';
import { useServices } from '../../services';
import { EmployeeEditForm } from './EmployeeEditForm';

type Action = 'resetPin' | 'revoke' | 'unlock' | 'toggleActive';
type Confirmable = Exclude<Action, 'unlock'>;

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { api } = useServices();
  const tz = useCompanyTz();
  const queryClient = useQueryClient();
  const today = todayIn(tz);
  const from = addDays(today, -29);
  const [confirming, setConfirming] = useState<Confirmable | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);

  const employeeQ = useQuery({ queryKey: queryKeys.employee(id), queryFn: () => api.getEmployee(id) });
  const sitesQ = useQuery({ queryKey: queryKeys.sites, queryFn: () => api.listSites() });
  const daysQ = useQuery({
    queryKey: queryKeys.attendance({ employeeId: id, from, to: today }),
    queryFn: () => api.listAttendance({ from, to: today, employeeId: id, page: 1, pageSize: 100 }),
  });

  const action = useMutation({
    mutationFn: async (kind: Action): Promise<string | null> => {
      if (kind === 'resetPin') return (await api.resetPin(id)).pin;
      if (kind === 'revoke') await api.revokeSessions(id);
      else if (kind === 'unlock') await api.unlockEmployee(id);
      else await api.updateEmployee(id, { isActive: !employeeQ.data?.isActive });
      return null;
    },
    onSuccess: (pin, kind) => {
      setConfirming(null);
      if (pin) setNewPin(pin);
      else {
        const done: Record<Exclude<Action, 'resetPin'>, string> = {
          revoke: 'Logged out on all phones',
          unlock: 'Unlocked',
          toggleActive: employeeQ.data?.isActive ? 'Employee deactivated' : 'Employee activated',
        };
        toast.success(done[kind as Exclude<Action, 'resetPin'>]);
      }
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (err) => {
      setConfirming(null);
      toast.error('Not done', { description: errorMessage(err) });
    },
  });

  if (!employeeQ.data) {
    return employeeQ.isError ? <PageError error={employeeQ.error} onRetry={() => void employeeQ.refetch()} /> : <PageLoader />;
  }
  const e = employeeQ.data;
  const status = employeeStatus(e);

  const confirmText: Record<Confirmable, { title: string; message: string; confirmLabel: string; danger?: boolean }> = {
    resetPin: {
      title: 'Reset PIN?',
      message: `${e.name} will need the new PIN to log in. They are logged out on every phone now.`,
      confirmLabel: 'Reset PIN',
    },
    revoke: {
      title: 'Log out everywhere?',
      message: `${e.name} will have to log in again with their PIN.`,
      confirmLabel: 'Log out everywhere',
    },
    toggleActive: e.isActive
      ? {
          title: 'Deactivate employee?',
          message: `${e.name} will not be able to log in or mark attendance. Past records stay.`,
          confirmLabel: 'Deactivate',
          danger: true,
        }
      : { title: 'Activate employee?', message: `${e.name} can log in again with their PIN.`, confirmLabel: 'Activate' },
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        back={{ to: '/employees', label: 'Employees' }}
        title={e.name}
        badge={<Pill tone={status.tone}>{status.label}</Pill>}
        description={
          <span className="ve-num">
            {formatPhone(e.phone)}
            {e.employeeCode ? ` · ${e.employeeCode}` : ''}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setConfirming('resetPin')}>
              Reset PIN
            </Button>
            <Button variant="outline" onClick={() => setConfirming('revoke')}>
              Log out everywhere
            </Button>
            {status.label === 'Locked' ? (
              <Button variant="outline" loading={action.isPending && action.variables === 'unlock'} onClick={() => action.mutate('unlock')}>
                Unlock
              </Button>
            ) : null}
            <Button
              variant={e.isActive ? 'outline' : 'default'}
              className={e.isActive ? 'text-danger hover:text-danger border-danger/30 hover:bg-danger-soft' : undefined}
              onClick={() => setConfirming('toggleActive')}
            >
              {e.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Details" />
          <div className="px-4 pt-2 pb-4">
            <EmployeeEditForm key={e.id} employee={e} sites={sitesQ.data ?? []} />
          </div>
        </Panel>
        <Panel className="self-start">
          <PanelHeader title="Phones logged in" />
          {e.sessions.length === 0 ? (
            <p className="text-muted-foreground px-4 pt-1 pb-5 text-sm">Not logged in on any phone.</p>
          ) : (
            <div className="pt-1 pb-2">
              <SimpleTable
                rows={e.sessions}
                rowKey={(s) => s.id}
                columns={[
                  { key: 'phone', title: 'Phone', render: (s) => s.deviceModel ?? 'Unknown phone' },
                  { key: 'created', title: 'Logged in', render: (s) => <span className="ve-num text-xs">{formatDateTime(s.createdAt, tz)}</span> },
                  { key: 'used', title: 'Last used', render: (s) => <span className="ve-num text-xs">{formatDateTime(s.lastUsedAt, tz)}</span> },
                ]}
              />
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Last 30 days">
          <Link
            to={`/attendance?from=${from}&to=${today}&employeeId=${id}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            Open in Attendance
            <ArrowUpRightIcon className="size-3.5" />
          </Link>
        </PanelHeader>
        {daysQ.isError ? (
          <div className="p-4">
            <PageError error={daysQ.error} onRetry={() => void daysQ.refetch()} />
          </div>
        ) : !daysQ.data ? (
          <PageLoader />
        ) : daysQ.data.items.length === 0 ? (
          <p className="text-muted-foreground px-4 pt-1 pb-5 text-sm">No attendance in the last 30 days.</p>
        ) : (
          <div className="pt-1 pb-2">
            <SimpleTable
              rows={daysQ.data.items}
              rowKey={(d) => d.id}
              columns={[
                { key: 'date', title: 'Date', render: (d) => formatWorkDate(d.workDate) },
                { key: 'site', title: 'Site', render: (d) => d.siteName },
                { key: 'in', title: 'In', render: (d) => <span className="ve-num">{formatTime(d.checkInAt, tz)}</span> },
                { key: 'out', title: 'Out', render: (d) => <span className="ve-num">{d.checkOutAt ? formatTime(d.checkOutAt, tz) : '—'}</span> },
                { key: 'hours', title: 'Hours', render: (d) => <span className="ve-num">{formatMinutes(d.workedMinutes)}</span> },
                {
                  key: 'status',
                  title: 'Status',
                  render: (d) => (
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={d.status} />
                      <FlagBadges flags={d.flags} needsReview={d.needsReview} />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Panel>

      {confirming ? (
        <ConfirmDialog
          opened
          {...confirmText[confirming]}
          busy={action.isPending}
          onConfirm={() => action.mutate(confirming)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
      {newPin ? <PinModal opened name={e.name} pin={newPin} onClose={() => setNewPin(null)} /> : null}
    </div>
  );
}
