import { describe, expect, it } from 'vitest';
import { parseCoordinates } from './coordinates';

describe('parseCoordinates', () => {
  it('reads decimal pairs the way Google Maps copies them', () => {
    expect(parseCoordinates('17.416682, 78.366365')).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(parseCoordinates('17.416682,78.366365')).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(parseCoordinates('  17.416682 78.366365 ')).toEqual({ lat: 17.416682, lng: 78.366365 });
    expect(parseCoordinates('-33.8688, 151.2093')).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it('reads degrees, minutes and seconds with hemispheres', () => {
    const north = parseCoordinates(`17°25'00.1"N 78°21'58.9"E`);
    expect(north?.lat).toBeCloseTo(17.416694, 5);
    expect(north?.lng).toBeCloseTo(78.366361, 5);
    const south = parseCoordinates(`33°52'07.7"S 151°12'33.5"W`);
    expect(south?.lat).toBeCloseTo(-33.868806, 5);
    expect(south?.lng).toBeCloseTo(-151.209306, 5);
  });

  it('refuses junk, out-of-range values and 0,0', () => {
    expect(parseCoordinates('Hinjewadi Phase 1')).toBeNull();
    expect(parseCoordinates('91, 10')).toBeNull();
    expect(parseCoordinates('10, 181')).toBeNull();
    expect(parseCoordinates('0, 0')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates(`17°25'00.1"N`)).toBeNull();
  });
});
