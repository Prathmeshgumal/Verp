import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeftIcon } from 'lucide-react';

interface Props {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons on the right. */
  actions?: ReactNode;
  /** Where the small back link above the title goes, e.g. { to: '/sites', label: 'Sites' }. */
  back?: { to: string; label: string };
  /** Sits beside the title, e.g. a status pill. */
  badge?: ReactNode;
}

export function PageHeader({ title, description, actions, back, badge }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-5">
      <div className="min-w-0">
        {back ? (
          <Link to={back.to} className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm transition-colors">
            <ArrowLeftIcon className="size-3.5" /> {back.label}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] leading-tight font-bold">{title}</h1>
          {badge}
        </div>
        {description ? <div className="text-muted-foreground mt-1 text-sm">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
