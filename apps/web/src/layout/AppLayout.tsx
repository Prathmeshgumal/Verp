import { AppShell, Burger, Button, Group, NavLink, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconLogout, type TablerIcon } from '@tabler/icons-react';
import { Link, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { PageError, PageLoader } from '../components/PageState';
import { useCompanySettings } from '../lib/useCompanySettings';

export const NAV: { to: string; label: string; icon: TablerIcon }[] = [{ to: '/', label: 'Today', icon: IconLayoutDashboard }];

export function AppLayout() {
  const { state, logout } = useAuth();
  const { pathname } = useLocation();
  const [opened, { toggle, close }] = useDisclosure();
  const settings = useCompanySettings();
  const userName = state.status === 'loggedIn' ? state.user.name : '';

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="lg">
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <Title order={3}>VE HR</Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text size="sm" c="dimmed" visibleFrom="xs">
              {userName}
            </Text>
            <Button variant="default" size="xs" leftSection={<IconLogout size={16} />} onClick={() => void logout()}>
              Log out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            component={Link}
            to={item.to}
            label={item.label}
            leftSection={<item.icon size={18} stroke={1.8} />}
            active={item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        {settings.data ? (
          <Outlet />
        ) : settings.isError ? (
          <PageError error={settings.error} onRetry={() => void settings.refetch()} />
        ) : (
          <PageLoader />
        )}
      </AppShell.Main>
    </AppShell>
  );
}
