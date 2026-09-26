import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { errorMessage } from '../lib/errors';

export function PageLoader() {
  return (
    <Center py="xl">
      <Loader aria-label="Loading" />
    </Center>
  );
}

export function PageError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert color="ledgerOrange" title="Could not load this page" icon={<IconAlertTriangle />}>
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{errorMessage(error)}</Text>
        <Button variant="light" color="ledgerOrange" onClick={onRetry}>
          Try again
        </Button>
      </Stack>
    </Alert>
  );
}
