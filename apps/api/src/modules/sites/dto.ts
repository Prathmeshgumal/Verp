import type { SiteDto, SiteSummary } from '@ve/shared';
import type { SiteRow } from '../../db/schema';

export function toSiteSummary(s: SiteRow): SiteSummary {
  return { id: s.id, name: s.name, lat: s.lat, lng: s.lng, radiusM: s.radiusM };
}

export function toSiteDto(s: SiteRow): SiteDto {
  return {
    ...toSiteSummary(s),
    address: s.address,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
