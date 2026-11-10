import type { Jurisdiction } from '@/config/portal';
import './Flag.css';

/** Small flag drawn from the jurisdiction config (no image files). */
export function Flag({ j }: { j: Jurisdiction | null }) {
  if (!j) return null;
  const { stripes, background, star } = j.flag;
  return (
    <svg className="flag" viewBox="0 0 18 12" role="img" aria-label={j.name}>
      {stripes?.map((c, i) => <rect key={c + i} x="0" y={(12 / stripes.length) * i} width="18" height={12 / stripes.length} fill={c} />)}
      {background && <rect width="18" height="12" fill={background} />}
      {star && <polygon points="9,2.6 10.1,5.6 13.3,5.7 10.8,7.6 11.7,10.6 9,8.8 6.3,10.6 7.2,7.6 4.7,5.7 7.9,5.6" fill={star} />}
      <rect width="18" height="12" fill="none" stroke="rgba(0,0,0,.1)" strokeWidth="0.6" />
    </svg>
  );
}

export const WithFlag = ({ j, children }: { j: Jurisdiction | null; children: React.ReactNode }) => (
  <span className="with-flag"><Flag j={j} />{children}</span>
);
