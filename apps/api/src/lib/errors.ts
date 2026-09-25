import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ErrorCode } from '@ve/shared';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

/** Returns the violated constraint name for a Postgres unique violation (23505), else null. */
export function uniqueViolation(err: unknown): string | null {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const e = current as { code?: string; constraint?: string; cause?: unknown };
    if (e.code === '23505') return e.constraint ?? '';
    current = e.cause;
  }
  return null;
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (error.statusCode === 429) {
    return reply.status(429).send({ code: 'RATE_LIMITED', message: 'Too many requests' });
  }
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ code: 'VALIDATION_ERROR', message: 'Invalid request' });
  }
  request.log.error({ err: error }, 'unhandled error');
  return reply.status(500).send({ code: 'INTERNAL', message: 'Something went wrong' });
}

export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found' });
}
