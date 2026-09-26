import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Site Ledger palette. Each tuple is light → dark; the marked shade is the design colour.
const ink: MantineColorsTuple = ['#f4f1ea', '#e7e3da', '#d0cabd', '#b5ae9f', '#968f81', '#767166', '#5a5750', '#403f3b', '#2b2c2d', '#1b1d1f']; // 9
const ledgerGreen: MantineColorsTuple = ['#e3f0e8', '#c5e1cf', '#a2cfb3', '#7cbb95', '#55a676', '#34905c', '#267c4f', '#1e6b45', '#175637', '#10402a']; // 7
const ledgerOrange: MantineColorsTuple = ['#fbebdd', '#f6d3b8', '#efb68c', '#e7975f', '#dd793a', '#cc6120', '#b8480f', '#98390b', '#7e300a', '#5c2306']; // 6
const ledgerBlue: MantineColorsTuple = ['#e6edf6', '#c9d8ec', '#a6bfdf', '#7fa2cf', '#5a86bf', '#3a6cab', '#2a5b9a', '#1f4e8c', '#183e70', '#112d52']; // 7

export const theme = createTheme({
  primaryColor: 'ink',
  primaryShade: 9,
  colors: { ink, ledgerGreen, ledgerOrange, ledgerBlue },
  black: '#1B1D1F',
  fontFamily: '"Public Sans", system-ui, sans-serif',
  fontFamilyMonospace: '"IBM Plex Mono", ui-monospace, monospace',
  headings: { fontFamily: 'Archivo, "Public Sans", sans-serif', fontWeight: '800' },
  defaultRadius: 'md',
});
