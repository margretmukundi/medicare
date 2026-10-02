import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { PageHead } from '../components/ui/Bits';

export default function ResetPassword() {
  const { tr } = useLanguage();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setHasSession(Boolean(data.session));
        setReady(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        setHasSession(true);
        setReady(true);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 12) return setError('Use at least 12 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message);
    else setSaved(true);
  }

  return (
    <div style={{ background: 'var(--bg-ink)', minHeight: '100vh' }}>
      <PageHead eyebrow={tr('Admin account')} title={tr('Set your password')} sub={tr('Choose a strong password for your account.')} />
      <div className="container-x" style={{ maxWidth: 480, padding: '2.5rem 1.5rem 5rem' }}>
        <div className="card-dark" style={{ padding: '1.8rem' }}>
          {!ready ? <p>{tr('Checking your setup link…')}</p> : saved ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <p style={{ margin: 0, color: '#9FD96A' }}>{tr('Password saved.')}</p>
              <Link to="/admin" className="btn-primary">{tr('Continue to admin')}</Link>
            </div>
          ) : !hasSession ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <p style={{ margin: 0 }}>{tr('This setup link is invalid or expired. Ask for a new invite.')}</p>
              <Link to="/login" className="btn-primary">{tr('Go to sign in')}</Link>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'grid', gap: '.9rem' }}>
              <label className="label" htmlFor="new-password">{tr('New password')}</label>
              <input id="new-password" className="field" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} />
              <label className="label" htmlFor="confirm-password">{tr('Confirm password')}</label>
              <input id="confirm-password" className="field" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} />
              {error && <p role="alert" style={{ margin: 0, color: '#FCA5A5', fontSize: '.86rem' }}>{error}</p>}
              <button className="btn-primary" disabled={busy}>{tr(busy ? 'Saving…' : 'Save password')}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
