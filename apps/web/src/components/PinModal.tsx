import { Button, CopyButton, Group, Modal, Stack, Text } from '@mantine/core';

interface Props {
  opened: boolean;
  name: string;
  pin: string;
  onClose: () => void;
}

/** The server never returns a PIN again, so this is the only time the admin sees it. */
export function PinModal({ opened, name, pin, onClose }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="New PIN" closeOnClickOutside={false}>
      <Stack>
        <Text>
          Give this PIN to <b>{name}</b>. It will not be shown again.
        </Text>
        <Text data-testid="pin-value" className="ve-num" fz={40} fw={600} ta="center" style={{ letterSpacing: '0.2em' }}>
          {pin}
        </Text>
        <Group justify="flex-end">
          <CopyButton value={pin}>
            {({ copied, copy }) => (
              <Button variant="default" onClick={copy}>
                {copied ? 'Copied' : 'Copy PIN'}
              </Button>
            )}
          </CopyButton>
          <Button onClick={onClose}>Done</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
