import type { ErrorCode } from '@ve/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'UNKNOWN',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(readonly reason: 'offline' | 'timeout') {
    super(reason === 'timeout' ? 'Request timed out' : 'Network error');
    this.name = 'NetworkError';
  }
}
