import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { useConfirm } from '../../ui/ConfirmDialog';

/** Confirm-then-logout, shared by the worker Profile tab and the admin Settings tab. */
export function useConfirmLogout(): () => Promise<void> {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const confirm = useConfirm();
  return async () => {
    const yes = await confirm({ title: t('menu.logoutTitle'), body: t('menu.logoutBody'), confirmLabel: t('common.logout'), icon: 'logout' });
    if (yes) await logout();
  };
}
