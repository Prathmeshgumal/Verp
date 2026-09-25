import { describe, expect, it } from 'vitest';
import { toCsv } from '../../src/lib/csv';

describe('toCsv', () => {
  it('joins rows with CRLF and quotes special characters', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', null, 3]])).toBe('a,"b,c","say ""hi""",,3\r\n');
  });
  it('neutralizes spreadsheet formulas in text cells', () => {
    expect(toCsv([['=HYPERLINK("http://x")', '+1', '-2', '@SUM(A1)']])).toBe(
      `"'=HYPERLINK(""http://x"")",'+1,'-2,'@SUM(A1)\r\n`,
    );
  });
  it('does not alter numbers', () => {
    expect(toCsv([[-1.5, 0]])).toBe('-1.5,0\r\n');
  });
});
