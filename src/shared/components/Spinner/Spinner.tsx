import './Spinner.css';

export const Spinner = ({ size = 18 }: { size?: number }) => (
  <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />
);
