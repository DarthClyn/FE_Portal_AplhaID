// Guided demo: a spotlight tour over the real pages. Manual mode waits for the viewer (Next, or doing the highlighted
// action); auto mode reads each step for a few seconds, then a visible cursor moves to the button and clicks it.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MousePointerClick, Pause, Play, X } from 'lucide-react';
import { setVerifyHandoff } from '@/shared/services/session';
import { parseCredentialText } from '@/shared/services/verification';
import { STEPS, type DemoStep } from './steps';
import './Demo.css';

export type DemoMode = 'manual' | 'auto';
interface Ctx { mode: DemoMode | null; start: (m: DemoMode) => void; stop: () => void }
const DemoCtx = createContext<Ctx>({ mode: null, start: () => undefined, stop: () => undefined });
export const useDemo = () => useContext(DemoCtx);

const SAMPLE = '/demo/sample-pila-elc.jwt';
const FLOWS = { 1: 'Flow 1 · Issue an eLC', 2: 'Flow 2 · Verify eLCs from other banks' } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const q = (sel?: string) => (sel ? document.querySelector<HTMLElement>(sel) : null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DemoMode | null>(null);
  const [index, setIndex] = useState(0);
  const start = useCallback((m: DemoMode) => { setIndex(0); setMode(m); }, []);
  const stop = useCallback(() => setMode(null), []);
  return (
    <DemoCtx.Provider value={{ mode, start, stop }}>
      {children}
      {mode && <Tour key={mode} mode={mode} index={index} setIndex={setIndex} stop={stop} />}
    </DemoCtx.Provider>
  );
}

interface Box { top: number; left: number; width: number; height: number }
const boxOf = (el: HTMLElement): Box => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, width: r.width, height: r.height }; };
/** One box around every element the selector matches. */
const unionBox = (els: HTMLElement[]): Box => {
  const bs = els.map(boxOf);
  const top = Math.min(...bs.map((b) => b.top)), left = Math.min(...bs.map((b) => b.left));
  return { top, left, width: Math.max(...bs.map((b) => b.left + b.width)) - left, height: Math.max(...bs.map((b) => b.top + b.height)) - top };
};
const all = (sel?: string) => (sel ? Array.from(document.querySelectorAll<HTMLElement>(sel)) : []);

function Tour({ mode, index, setIndex, stop }: { mode: DemoMode; index: number; setIndex: (i: number) => void; stop: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const step: DemoStep = STEPS[index];
  const last = index === STEPS.length - 1;
  const [box, setBox] = useState<Box | null>(null);
  const [anchor, setAnchor] = useState<Box | null>(null);
  const [paused, setPaused] = useState(false);
  const [acting, setActing] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; click: boolean; on: boolean }>({ x: window.innerWidth / 2, y: window.innerHeight / 2, click: false, on: false });
  const run = useRef(0); // bumps on every step change so stale timers give up
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const next = useCallback(() => (last ? stop() : setIndex(index + 1)), [index, last, setIndex, stop]);
  const back = () => index > 0 && setIndex(index - 1);

  // Enter the step: open its page, find and scroll to the highlighted element, keep the spotlight on it.
  useEffect(() => {
    const id = ++run.current;
    setBox(null);
    setAnchor(null);
    setActing(false);
    if (step.route && !location.pathname.startsWith(step.route)) navigate(step.route);
    let found: HTMLElement | null = null;
    const t0 = Date.now();
    const tick = setInterval(() => {
      if (id !== run.current) return;
      const el = q(step.target);
      if (el && el !== found) {
        found = el;
        el.scrollIntoView({ behavior: 'smooth', block: all(step.target).length > 1 || el.offsetHeight > window.innerHeight * 0.7 ? 'start' : 'center' });
      }
      const els = all(step.target);
      if (el) setBox(els.length > 1 ? unionBox(els) : boxOf(el));
      const a = q(step.cardAnchor);
      setAnchor(a ? boxOf(a) : null);
      if (!el && Date.now() - t0 > 400) setBox(null);
    }, 120);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Move on by itself once the step's action has worked.
  useEffect(() => {
    if (!step.waitFor) return;
    const id = run.current;
    const tick = setInterval(() => {
      if (id === run.current && q(step.waitFor)) { clearInterval(tick); setTimeout(() => id === run.current && next(), mode === 'auto' ? 1200 : 700); }
    }, 200);
    return () => clearInterval(tick);
  }, [index, step.waitFor, next, mode]);

  /** Do the step's action: glide the cursor to the button and click it (or use the fallback). */
  const act = useCallback(async () => {
    if (!step.action) return next();
    const id = run.current;
    setActing(true);
    let el = q(step.action.selector);
    if (!el && step.fallback === 'verify-sample') {
      const text = await fetch(SAMPLE).then((r) => r.text());
      setVerifyHandoff(parseCredentialText(text, 'sample-pila-elc.jwt'), 'sample-pila-elc.jwt');
      navigate('/verify');
      return;
    }
    if (!el) { setActing(false); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(550);
    if (id !== run.current) return;
    el = q(step.action.selector) ?? el;
    const r = el.getBoundingClientRect();
    setCursor((c) => ({ ...c, on: true }));
    await sleep(60);
    setCursor({ x: r.left + Math.min(r.width / 2, 60), y: r.top + r.height / 2, click: false, on: true });
    await sleep(1000);
    if (id !== run.current) return;
    setCursor((c) => ({ ...c, click: true }));
    await sleep(180);
    el.click();
    if (step.waitTimeout) setTimeout(() => { if (id === run.current) next(); }, step.waitTimeout * 1000);
    await sleep(700);
    setCursor((c) => ({ ...c, click: false, on: false }));
  }, [step, next, navigate]);

  // Auto mode: read for a few seconds, then act or move on.
  useEffect(() => {
    if (mode !== 'auto' || paused || acting) return;
    const id = run.current;
    const t = setTimeout(() => {
      if (id !== run.current || pausedRef.current) return;
      if (step.action) void act();
      else next();
    }, (step.dwell ?? 5) * 1000);
    return () => clearTimeout(t);
  }, [mode, paused, acting, index, step, act, next]);

  // Keyboard: Esc exits; arrows step in manual mode.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
      else if (mode === 'manual' && e.key === 'ArrowRight' && !step.action) next();
      else if (mode === 'manual' && e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const pad = 8;
  const spot = box && { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 };

  return (
    <div className={`tour tour--${mode}`} aria-live="polite">
      {mode === 'auto' && <div className="tour__block" />}
      {spot ? <div className="tour__spot" style={spot} /> : <div className="tour__dim" />}
      <TourCard step={step} index={index} box={anchor ?? spot} mode={mode} paused={paused} acting={acting}
        onNext={step.action ? () => void act() : next} onBack={back} onPause={() => setPaused((p) => !p)} onExit={stop} last={last} />
      {cursor.on || cursor.x !== window.innerWidth / 2 ? (
        <div className={`tour__cursor${cursor.click ? ' tour__cursor--click' : ''}${cursor.on ? '' : ' tour__cursor--off'}`} style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path d="M4 2.5l15.5 9.2-6.6 1.5 3.9 6.9-2.9 1.6-3.9-6.9-4.9 4.6z" fill="#0f172a" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          <span className="tour__ripple" />
        </div>
      ) : null}
    </div>
  );
}

interface CardProps {
  step: DemoStep; index: number; box: Box | null; mode: DemoMode; paused: boolean; acting: boolean; last: boolean;
  onNext: () => void; onBack: () => void; onPause: () => void; onExit: () => void;
}

function TourCard({ step, index, box, mode, paused, acting, last, onNext, onBack, onPause, onExit }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Place the card next to the highlighted element: below, above, beside, or bottom-right for very tall ones.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth, vh = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight, gap = 14, m = 16;
    const clampX = (x: number) => Math.max(m, Math.min(vw - w - m, x));
    const clampY = (y: number) => Math.max(m, Math.min(vh - h - m, y));
    if (!box) { setPos({ top: (vh - h) / 2, left: (vw - w) / 2 }); return; }
    if (box.top + box.height + gap + h < vh - m) setPos({ top: box.top + box.height + gap, left: clampX(box.left) });
    else if (box.top - gap - h > m) setPos({ top: box.top - gap - h, left: clampX(box.left) });
    else if (box.left + box.width + gap + w < vw - m) setPos({ top: clampY(box.top), left: box.left + box.width + gap });
    else if (box.left - gap - w > m) setPos({ top: clampY(box.top), left: box.left - gap - w });
    else setPos({ top: vh - h - 24, left: vw - w - 24 });
  }, [box?.top, box?.left, box?.width, box?.height, index, acting]);

  const waiting = !!step.action && acting;
  return (
    <div ref={ref} className={`tour__card${box ? '' : ' tour__card--center'}`} style={pos} role="dialog" aria-label={step.title}>
      <div className="tour__meta">
        <span className={`tour__flow tour__flow--${step.flow}`}>{FLOWS[step.flow]}</span>
        <span>{index + 1} / {STEPS.length}</span>
      </div>
      <h3 className="tour__title">{step.title}</h3>
      <p className="tour__body">{step.body}</p>
      {step.action && (
        <p className="tour__do"><MousePointerClick size={15} /> {waiting ? 'Working…' : mode === 'auto' ? step.action.label.replace(/^Click/, 'Clicking') : step.action.label}</p>
      )}
      {mode === 'auto' && !waiting && (
        <div className="tour__bar"><span key={index} style={{ animationDuration: `${step.dwell ?? 5}s`, animationPlayState: paused ? 'paused' : 'running' }} /></div>
      )}
      <div className="tour__actions">
        {mode === 'manual' ? (
          <>
            <button className="tour__btn tour__btn--ghost" onClick={onBack} disabled={index === 0}><ChevronLeft size={15} /> Back</button>
            <span className="grow" />
            <button className="tour__btn tour__btn--ghost" onClick={onExit}>Exit</button>
            <button className="tour__btn tour__btn--primary" onClick={onNext} disabled={waiting}>
              {step.action ? 'Do it for me' : last ? 'Finish' : 'Next'} {!last && !step.action && <ChevronRight size={15} />}
            </button>
          </>
        ) : (
          <>
            <span className="tour__auto">{waiting ? 'Waiting for the result…' : paused ? 'Paused' : 'Auto demo'}</span>
            <span className="grow" />
            <button className="tour__btn tour__btn--ghost" onClick={onPause} disabled={waiting}>{paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}</button>
            <button className="tour__btn tour__btn--ghost" onClick={onExit}><X size={14} /> Exit</button>
          </>
        )}
      </div>
    </div>
  );
}
