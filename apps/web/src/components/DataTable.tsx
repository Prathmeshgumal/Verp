import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Paging {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty: string;
  /** Dims the rows while newer data loads. */
  fetching?: boolean;
  paging?: Paging;
}

/** Page numbers to show: first, last, and two either side of the current page, with gaps as null. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push(null);
    out.push(p);
  });
  return out;
}

function Pager({ page, pageSize, total, onPageChange }: Paging) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5">
      <p className="text-muted-foreground ve-num text-xs">
        {first}–{last} of {total}
      </p>
      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeftIcon />
          </Button>
          {pageWindow(page, pages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="text-muted-foreground px-1 text-xs">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'outline' : 'ghost'}
                size="icon-sm"
                className="ve-num text-xs"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            <ChevronRightIcon />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, fetching, paging }: Props<T>) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table aria-busy={fetching || undefined} className={cn('transition-opacity', fetching ? 'opacity-60' : undefined)}>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn('text-muted-foreground h-10 px-4 text-xs font-medium', c.className)}>
                {c.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="text-muted-foreground h-40 text-center">
                {fetching ? 'Loading…' : empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={onRowClick ? 'cursor-pointer' : undefined}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn('h-12 px-4', c.className)}>
                    {c.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {paging ? <Pager {...paging} /> : null}
    </div>
  );
}

/** A plain table inside a panel, for short lists. */
export function SimpleTable<T>({ columns, rows, rowKey }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((c) => (
            <TableHead key={c.key} className={cn('text-muted-foreground h-9 px-4 text-xs font-medium', c.className)}>
              {c.title}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)}>
            {columns.map((c) => (
              <TableCell key={c.key} className={cn('h-11 px-4', c.className)}>
                {c.render(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
