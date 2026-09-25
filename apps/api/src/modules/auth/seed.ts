import { z } from 'zod';
import type { Db } from '../../db/client';
import { users, type UserRow } from '../../db/schema';
import { uniqueViolation } from '../../lib/errors';
import { hashSecret } from '../../lib/password';

const seedSchema = z.strictObject({
  email: z.email().transform((e) => e.toLowerCase()),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(10).max(200),
});

export async function seedAdmin(
  db: Db,
  input: { email: string; name: string; password: string },
  now: Date = new Date(),
): Promise<UserRow> {
  const data = seedSchema.parse(input);
  try {
    const [user] = await db
      .insert(users)
      .values({
        role: 'admin',
        name: data.name,
        email: data.email,
        passwordHash: await hashSecret(data.password),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return user!;
  } catch (err) {
    if (uniqueViolation(err) === 'users_email_unique') {
      throw new Error(`An admin with email ${data.email} already exists`, { cause: err });
    }
    throw err;
  }
}
