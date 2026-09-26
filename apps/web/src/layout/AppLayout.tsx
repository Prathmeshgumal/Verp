import { CalendarCheckIcon, LayoutDashboardIcon, LogOutIcon, MapPinIcon, MenuIcon, MonitorIcon, MoonIcon, SettingsIcon, SunIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/AuthContext';
import { PageError, PageLoader } from '../components/PageState';
import { useCompanySettings } from '../lib/useCompanySettings';

export const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Today', icon: LayoutDashboardIcon },
  { to: '/employees', label: 'Employees', icon: UsersIcon },
  { to: '/sites', label: 'Sites', icon: MapPinIcon },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheckIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2">
      <span aria-hidden className="bg-brand grid size-7 place-items-center rounded-lg font-[Archivo] text-[11px] font-bold tracking-tight text-white">
        VE
      </span>
      <span className="font-heading text-[15px] font-bold tracking-tight">VE HR</span>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="grid gap-0.5">
      {NAV.map((item) => {
        const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors',
              active ? 'bg-card text-foreground font-medium shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <item.icon className={cn('size-4', active ? 'text-brand' : undefined)} strokeWidth={1.9} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const THEME_ICON: Record<ThemeMode, LucideIcon> = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

function ThemeMenu() {
  const { mode, setMode } = useTheme();
  const Icon = THEME_ICON[mode];
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Theme">
              <Icon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" side="top" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as ThemeMode)}>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
}

function UserBar({ name, onLogout }: { name: string; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-2 border-t px-2 pt-3">
      <span aria-hidden className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={name}>
        {name}
      </span>
      <ThemeMenu />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Log out" onClick={onLogout}>
            <LogOutIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Log out</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AppLayout() {
  const { state, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useCompanySettings();
  const userName = state.status === 'loggedIn' ? state.user.name : '';

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="bg-sidebar sticky top-0 hidden h-screen flex-col gap-6 border-r px-3 py-4 md:flex">
        <Brand />
        <NavItems />
        <div className="mt-auto">
          <UserBar name={userName} onLogout={() => void logout()} />
        </div>
      </aside>

      <header className="bg-sidebar sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 md:hidden">
        <Brand />
        <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </Button>
      </header>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="bg-sidebar flex w-64 flex-col gap-6 px-3 py-4">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          <NavItems onNavigate={() => setMenuOpen(false)} />
          <div className="mt-auto">
            <UserBar name={userName} onLogout={() => void logout()} />
          </div>
        </SheetContent>
      </Sheet>

      <main className="min-w-0 px-4 py-6 md:px-8 md:py-7">
        {settings.data ? (
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        ) : settings.isError ? (
          <PageError error={settings.error} onRetry={() => void settings.refetch()} />
        ) : (
          <PageLoader />
        )}
      </main>
    </div>
  );
}
