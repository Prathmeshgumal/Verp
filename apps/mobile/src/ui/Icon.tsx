import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/tokens';

const PATHS = {
  checkIn: ['M15 4h4v16h-4', 'm10 16 4-4-4-4', 'M14 12H3'],
  checkOut: ['M9 4H5v16h4', 'm14 16 4-4-4-4', 'M18 12H8'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  home: ['M3 11 12 4l9 7', 'M5 10v10h14V10'],
  calendar: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18M8 3v4M16 3v4'],
  pin: ['M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z', 'M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
  check: ['M20 6 9 17l-5-5'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  signal: ['M4 20v-3', 'M9 20v-7', 'M14 20V9', 'M19 20V4'],
  fence: ['M4 21V6l2-2 2 2v15', 'M16 21V6l2-2 2 2v15', 'M8 10h8M8 16h8'],
  info: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', 'M12 16v-4', 'M12 8h.01'],
  person: ['M20 21a8 8 0 0 0-16 0', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'],
  wifiOff: ['M2 2l20 20', 'M8.5 16.5a5 5 0 0 1 7 0', 'M5 12.9a10 10 0 0 1 5.2-2.8', 'M19 12.9a10 10 0 0 0-2.4-1.7', 'M12 20h.01'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10 21h4'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  search: ['M21 21l-4.3-4.3', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  users: ['M16 21a6 6 0 0 0-12 0', 'M14 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M22 21a6 6 0 0 0-4-5.7', 'M16 4.1a4 4 0 0 1 0 7.8'],
  map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z', 'M9 4v14M15 6v14'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  locate: ['M12 2v3M12 19v3M2 12h3M19 12h3', 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'],
  backspace: ['M21 5H8l-6 7 6 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z', 'M17 9l-6 6M11 9l6 6'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  refresh: ['M21 12a9 9 0 1 1-2.6-6.4', 'M21 3v6h-6'],
  key: ['M2 18v3h3l7.4-7.4', 'M17 11a5 5 0 1 0-5-5 5 5 0 0 0 5 5z'],
  close: ['M18 6 6 18M6 6l12 12'],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = colors.text, strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
