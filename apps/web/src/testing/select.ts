import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Opens a SelectField by its label and picks an option; the options render in a portal on the page. */
export async function pickOption(user: UserEvent, trigger: HTMLElement, option: string) {
  await user.click(trigger);
  await user.click(await screen.findByRole('option', { name: option }));
}
