import { AlertTriangleIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '../lib/errors';

export function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Loader2Icon role="status" aria-label="Loading" className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}

export function PageError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="border-warning/30 bg-warning-soft flex gap-3 rounded-xl border p-4">
      <AlertTriangleIcon className="text-warning mt-0.5 size-5 shrink-0" />
      <div className="grid gap-2">
        <p className="font-semibold">Could not load this page</p>
        <p className="text-sm">{errorMessage(error)}</p>
        <div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

/** An inline message inside a form or panel. */
export function Notice({ tone = 'warning', children }: { tone?: 'warning' | 'info'; children: React.ReactNode }) {
  const style = tone === 'info' ? 'border-info/25 bg-info-soft text-info' : 'border-warning/30 bg-warning-soft text-warning';
  return (
    <div role="alert" className={`rounded-lg border px-3 py-2 text-sm font-medium ${style}`}>
      {children}
    </div>
  );
}
