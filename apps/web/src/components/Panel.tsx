import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The one surface the app uses: white (or lifted dark) with a hairline border. */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('bg-card text-card-foreground rounded-xl border', className)} {...props} />;
}

/** A panel's title row: heading on the left, optional controls on the right. */
export function PanelHeader({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-12 items-center justify-between gap-3 px-4 pt-3', className)}>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {children}
    </div>
  );
}
