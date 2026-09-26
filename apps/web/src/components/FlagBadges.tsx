import { Badge, Group } from '@mantine/core';
import { flagLabel } from '../lib/labels';

export function FlagBadges({ flags, needsReview }: { flags: string[]; needsReview: boolean }) {
  if (!needsReview && flags.length === 0) return null;
  return (
    <Group gap={4}>
      {needsReview ? (
        <Badge color="red" variant="filled">
          Needs review
        </Badge>
      ) : null}
      {flags.map((flag) => (
        <Badge key={flag} color="gray" variant="outline">
          {flagLabel(flag)}
        </Badge>
      ))}
    </Group>
  );
}
