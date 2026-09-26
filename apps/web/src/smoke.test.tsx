import { render, screen } from '@testing-library/react';
import { normalizePhone } from '@ve/shared';
import { expect, test } from 'vitest';
import { Button } from './components/ui/button';

test('shared code and the UI kit load', () => {
  expect(normalizePhone('98765 43210')).toBe('+919876543210');
  render(<Button>Save</Button>);
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});
