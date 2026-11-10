import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { JURISDICTIONS, PORTAL } from '@/config/portal';
import { Banner, Button, Checkbox, Field } from '@/shared/components';
import { useAuth } from '@/shared/services/auth';
import './Login.css';

export function LoginPage() {
  const { user, checking, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/overview';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  if (checking) return null;
  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter your user ID and password.'); return; }
    setBusy(true);
    setError(null);
    try {
      await login(username, password, remember);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message.replace('username', 'user ID'));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__brand">
          <span className="brand__logo" aria-hidden>α</span>
          <span className="brand__text">
            <span className="brand__name">{PORTAL.bank.name}</span>
            <span className="brand__sub">{JURISDICTIONS[PORTAL.bank.jurisdiction].name}</span>
          </span>
        </div>
        <h1>Sign in</h1>
        <p className="login__sub">{PORTAL.bank.product} portal</p>
        {error && <Banner tone="bad" title={error} />}
        <form onSubmit={(e) => void submit(e)} className="login__form" noValidate>
          <Field label="User ID" htmlFor="username">
            <input id="username" className="input" autoComplete="username" autoFocus value={username}
              onChange={(e) => setUsername(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Password" htmlFor="password">
            <div className="login__pw">
              <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
              <button type="button" className="login__eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <div className="login__row">
            <Checkbox label="Keep me signed in" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} />
            <button type="button" className="login__link" onClick={() => setForgot((f) => !f)}>Forgot password?</button>
          </div>
          {forgot && <p className="login__hint">Passwords are managed by your portal administrator. Ask them to reset it.</p>}
          <Button type="submit" variant="primary" size="lg" block loading={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </div>
      <div className="login__foot">
        <span><Lock size={12} /> Secure connection</span>
        <span className="login__sep">•</span>
        <span><span className="dot" /> Managed by {PORTAL.managedBy}</span>
      </div>
    </div>
  );
}
