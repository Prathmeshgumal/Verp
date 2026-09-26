import { Button, MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { normalizePhone } from '@ve/shared';
import { expect, test } from 'vitest';
import { theme } from './theme';

test('shared code and the Mantine theme load', () => {
  expect(normalizePhone('98765 43210')).toBe('+919876543210');
  render(
    <MantineProvider theme={theme} env="test">
      <Button>Save</Button>
    </MantineProvider>,
  );
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});
