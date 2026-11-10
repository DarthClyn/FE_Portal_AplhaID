import { useRef, useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import './FileDrop.css';

interface Props {
  accept: string;
  multiple?: boolean;
  hint: ReactNode;
  title?: ReactNode;
  onFiles: (files: File[]) => void;
  large?: boolean;
}

/** Dashed drop area with a "browse" link. */
export function FileDrop({ accept, multiple, hint, title, onFiles, large }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop${over ? ' drop--over' : ''}${large ? ' drop--large' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
    >
      <Upload size={large ? 22 : 18} />
      <span className="drop__title">{title ?? <>Drop files here or <span className="drop__link">browse</span></>}</span>
      <span className="drop__hint">{hint}</span>
      <input ref={input} type="file" hidden accept={accept} multiple={multiple}
        onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    </div>
  );
}
