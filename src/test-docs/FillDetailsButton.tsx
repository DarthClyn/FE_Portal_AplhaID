// Issue eLC header button: fill the form with sample details (shown while Test docs is on, or during the demo).
import { Sparkles } from 'lucide-react';
import { Button } from '@/shared/components';
import { useTestDocs } from './testDocs';

export function FillDetailsButton({ onFill, force, disabled }: { onFill: () => void; force?: boolean; disabled?: boolean }) {
  const on = useTestDocs();
  if (!on && !force) return null;
  return <Button size="sm" variant="ghost" data-tour="fill-sample" icon={<Sparkles size={15} />} onClick={onFill} disabled={disabled}>Fill details</Button>;
}
