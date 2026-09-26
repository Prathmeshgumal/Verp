import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  opened: boolean;
  name: string;
  pin: string;
  onClose: () => void;
}

/** The server never returns a PIN again, so this is the only time the admin sees it. */
export function PinModal({ opened, name, pin, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={opened} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New PIN</DialogTitle>
          <DialogDescription>
            Give this PIN to <b className="text-foreground">{name}</b>. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <p data-testid="pin-value" className="ve-num bg-muted rounded-xl py-5 text-center text-4xl font-medium tracking-[0.3em]">
          {pin}
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(pin).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copied' : 'Copy PIN'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
