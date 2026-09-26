import '@fontsource/archivo/800.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-datatable/styles.css';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { Center, MantineProvider, Title } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Center h="100vh">
        <Title>VE HR</Title>
      </Center>
    </MantineProvider>
  </StrictMode>,
);
