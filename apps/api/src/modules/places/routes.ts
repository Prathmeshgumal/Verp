import type { FastifyInstance } from 'fastify';
import { placeLinkSchema, type PlaceLinkDto } from '@ve/shared';
import { AppError } from '../../lib/errors';
import { resolveMapsText, type LinkFailure } from './googleLink';

const MESSAGES: Record<LinkFailure, string> = {
  NOT_A_MAPS_LINK: "That doesn't look like a Google Maps link or coordinates.",
  NO_EXACT_PIN: 'This link shows an area, not a pin. In Google Maps, tap the exact spot, then Share → Copy link.',
  LINK_UNREACHABLE: "Couldn't open that link. Check it, or copy the coordinates instead.",
};

const lookupRateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

export async function placesRoutes(app: FastifyInstance) {
  app.post('/places/resolve-link', lookupRateLimit, async (req): Promise<PlaceLinkDto> => {
    const { text } = placeLinkSchema.parse(req.body);
    const outcome = await resolveMapsText(text, app.deps.fetch);
    // Never log the link itself: it can carry the admin's search text.
    req.log.info({ host: outcome.host, result: outcome.ok ? 'OK' : outcome.code }, 'place link');
    if (!outcome.ok) throw new AppError(outcome.code, 422, MESSAGES[outcome.code]);
    return outcome.point;
  });
}
