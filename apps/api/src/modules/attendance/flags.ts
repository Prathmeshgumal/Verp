export function computeFlags(
  body: { isMock: boolean; deviceTime: string },
  now: Date,
  mismatchMinutes: number,
): string[] {
  const flags: string[] = [];
  if (body.isMock) flags.push('MOCK_LOCATION');
  if (Math.abs(Date.parse(body.deviceTime) - now.getTime()) > mismatchMinutes * 60_000) {
    flags.push('CLOCK_MISMATCH');
  }
  return flags;
}

export function mergeFlags(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}
