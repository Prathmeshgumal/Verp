import { z } from 'zod';

export const idParamsSchema = z.strictObject({ id: z.uuid() });
