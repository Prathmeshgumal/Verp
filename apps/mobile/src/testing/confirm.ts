import { fireEvent, screen } from '@testing-library/react-native';

/** Answers the app's confirm dialog (it opens with this title) by pressing its `label` button. */
export async function answerConfirm(title: string, label: string) {
  await screen.findByRole('header', { name: title });
  const buttons = screen.getAllByRole('button', { name: label });
  // The dialog renders last, so its button is the last one with that name.
  await fireEvent.press(buttons[buttons.length - 1]!);
}
