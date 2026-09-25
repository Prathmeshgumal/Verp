import type { SiteCreate, SiteDto, SiteUpdate } from '@ve/shared';
import type { ResolvedDeps } from '../../app';
import { writeAudit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { getSettings } from '../settings/repo';
import { toSiteDto } from './dto';
import { findSiteById, insertSite, updateSiteRow } from './repo';

const notFound = () => new AppError('NOT_FOUND', 404, 'Site not found');

export async function getSite(deps: ResolvedDeps, id: string): Promise<SiteDto> {
  const site = await findSiteById(deps.db, id);
  if (!site) throw notFound();
  return toSiteDto(site);
}

export async function createSite(deps: ResolvedDeps, actorId: string, input: SiteCreate): Promise<SiteDto> {
  const now = deps.clock();
  return deps.db.transaction(async (tx) => {
    const radiusM = input.radiusM ?? (await getSettings(tx)).defaultRadiusM;
    const site = toSiteDto(
      await insertSite(tx, {
        name: input.name,
        address: input.address ?? null,
        lat: input.lat,
        lng: input.lng,
        radiusM,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await writeAudit(tx, { actorId, action: 'site.create', entityType: 'site', entityId: site.id, after: site }, now);
    return site;
  });
}

export async function updateSite(deps: ResolvedDeps, actorId: string, id: string, patch: SiteUpdate): Promise<SiteDto> {
  const now = deps.clock();
  return deps.db.transaction(async (tx) => {
    const before = await findSiteById(tx, id);
    if (!before) throw notFound();
    const after = await updateSiteRow(tx, id, { ...patch, updatedAt: now });
    const dto = toSiteDto(after!);
    await writeAudit(
      tx,
      { actorId, action: 'site.update', entityType: 'site', entityId: id, before: toSiteDto(before), after: dto },
      now,
    );
    return dto;
  });
}
