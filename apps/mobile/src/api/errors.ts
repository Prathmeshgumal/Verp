/** The server answered with a 4xx and a `{ code, message }` body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** We do not know what the server did: timeout, no connection, 5xx or unreadable reply. */
export class NetworkError extends Error {
  constructor(
    readonly reason: 'timeout' | 'offline' | 'server',
    message: string = reason,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}
