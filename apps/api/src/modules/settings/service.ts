import type { SettingsDto, SettingsUpdate } from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import { writeAudit } from '../../lib/audit';
import { getSettings, updateSettings } from './repo';

export async function patchSettings(deps: ResolvedDeps, actorId: string, patch: SettingsUpdate): Promise<SettingsDto> {
  const now = deps.clock();
  return deps.db.transaction(async (tx) => {
    const before = await getSettings(tx);
    const after = await updateSettings(tx, patch, now);
    await writeAudit(tx, { actorId, action: 'settings.update', entityType: 'company_settings', before, after }, now);
    return after;
  });
}
