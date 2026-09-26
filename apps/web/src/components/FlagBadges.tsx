import { flagLabel } from '../lib/labels';
import { Pill } from './Pill';

export function FlagBadges({ flags, needsReview }: { flags: string[]; needsReview: boolean }) {
  if (!needsReview && flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {needsReview ? <Pill tone="danger">Needs review</Pill> : null}
      {flags.map((flag) => (
        <Pill key={flag} tone="neutral" dot={false}>
          {flagLabel(flag)}
        </Pill>
      ))}
    </div>
  );
}
