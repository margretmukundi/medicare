import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { placeOrder, startMpesa, orderPaymentStatus, uploadPrescription } from '../lib/api';
import { kes } from '../lib/format';
import { Icon, PageHead, RxNotice } from '../components/ui/Bits';
import { useDeliveryTotals, useCartSync } from './Cart';

const POLL_MS = 3000;
const POLL_MAX = 40; // ~2 minutes

export default function Checkout() {
  const { cart, total, hasRx, dispatch } = useCart();
  const { profile, user } = useAuth();
  const s = useSettings();
  const { tr } = useLanguage();
  const t = useDeliveryTotals(total);
  useCartSync();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', notes: '' });
  const [method, setMethod] = useState('mpesa');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [rxFile, setRxFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // phase: form -> waiting (M-Pesa prompt sent) -> done
  const [phase, setPhase] = useState('form');
  const [order, setOrder] = useState(null);
  const [payState, setPayState] = useState({ state: 'idle', message: '' }); // idle | sending | waiting | failed | timeout
  const [receipt, setReceipt] = useState('');
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefilled.current || !profile) return;
    prefilled.current = true;
    setForm(f => ({ ...f, name: f.name || profile.full_name || '', email: f.email || profile.email || user?.email || '', phone: f.phone || profile.phone || '', address: f.address || profile.address || '', city: f.city || profile.city || '' }));
  }, [profile, user]);

  const set = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  function validate1() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (form.phone.replace(/\D/g, '').length < 9) e.phone = 'Enter a valid phone number';
    if (!form.address.trim()) e.address = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  }
  function validate2() {
    const e = {};
    if (method === 'mpesa' && !/^(?:\+?254|0)?(7|1)\d{8}$/.test(mpesaPhone.replace(/\s/g, ''))) e.mpesaPhone = 'Enter a valid Safaricom number, e.g. 0712 345 678';
    if (hasRx && !rxFile) e.rx = 'Upload your prescription to continue';
    if (rxFile && rxFile.size > 5 * 1024 * 1024) e.rx = 'File is larger than 5 MB';
    if (rxFile && !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(rxFile.type)) e.rx = 'Use a JPG, PNG, WebP or PDF file';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function pay(orderId, phone) {
    setPayState({ state: 'sending', message: '' });
    try {
      await startMpesa(orderId, phone);
      setPayState({ state: 'waiting', message: '' });
      for (let i = 0; i < POLL_MAX; i++) {
        await new Promise(r => setTimeout(r, POLL_MS));
        const st = await orderPaymentStatus(orderId);
        if (st?.payment_status === 'paid') { setReceipt(st.mpesa_receipt || ''); setPhase('done'); return; }
        if (st?.payment_status === 'failed') {
          setPayState({ state: 'failed', message: st.result_desc || 'The payment was not completed.' });
          return;
        }
      }
      setPayState({ state: 'timeout', message: '' });
    } catch (err) {
      setPayState({ state: 'failed', message: err.message });
    }
  }

  async function submit() {
    if (!validate2()) return;
    setBusy(true); setError('');
    try {
      const prescription_path = hasRx && rxFile ? await uploadPrescription(rxFile) : null;
      const res = await placeOrder({
        customer: form,
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
        payment_method: method,
        prescription_path,
      });
      setOrder(res);
      dispatch({ type: 'CLEAR' });
      if (method === 'mpesa') { setPhase('waiting'); pay(res.order_id, mpesaPhone); }
      else setPhase('done');
    } catch (err) {
      setError(err.message || 'Could not place your order');
    } finally { setBusy(false); }
  }

  if (cart.length === 0 && phase === 'form') return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '8rem 1.5rem 4rem', textAlign: 'center' }}>
      <div><p style={{ color: 'rgba(244,250,240,.6)' }}>{tr('Your cart is empty.')}</p><Link to="/shop" className="btn-primary">{tr('Go to shop')}</Link></div>
    </div>
  );

  if (phase === 'done') return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '8rem 1.5rem 4rem' }}>
      <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 84, height: 84, borderRadius: 999, background: 'rgba(74,140,42,.16)', border: '1px solid rgba(74,140,42,.3)', display: 'grid', placeItems: 'center', margin: '0 auto 1.5rem' }}><Icon name="solar:check-circle-bold" size={44} style={{ color: '#9FD96A' }} /></div>
        <h1 style={{ margin: '0 0 .7rem', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '-.06em' }}>{tr(method === 'mpesa' ? 'Payment received!' : 'Order placed!')}</h1>
        <p style={{ color: 'rgba(244,250,240,.7)', margin: '0 0 1.4rem' }}>{tr('Thank you')}, {form.name.split(' ')[0]}. {tr('Your order')} <strong style={{ color: '#9FD96A' }}>{order.order_number}</strong> {tr(order.has_rx_items ? 'is waiting for a pharmacist to review your prescription.' : 'is being prepared.')}</p>
        <div className="card-dark" style={{ padding: '1.2rem', textAlign: 'left', marginBottom: '1.4rem', display: 'grid', gap: '.6rem', fontSize: '.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(244,250,240,.6)' }}>{tr('Order total')}</span><strong>{kes(order.total)}</strong></div>
          {receipt && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(244,250,240,.6)' }}>{tr('M-Pesa receipt')}</span><strong>{receipt}</strong></div>}
          {method === 'cash_on_delivery' && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(244,250,240,.6)' }}>{tr('Payment')}</span><strong>{tr('Pay on delivery')}</strong></div>}
          {s.delivery_eta && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(244,250,240,.6)' }}>{tr('Estimated delivery')}</span><strong style={{ color: '#9FD96A' }}>{tr(s.delivery_eta)}</strong></div>}
        </div>
        <p style={{ fontSize: '.82rem', color: 'rgba(244,250,240,.5)', margin: '0 0 1.6rem' }}>{tr('Track it any time with your order number and phone number.')}</p>
        <div style={{ display: 'flex', gap: '.7rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/track" className="btn-primary">{tr('Track order')}</Link><Link to="/" className="btn-ghost">{tr('Back to home')}</Link>
        </div>
      </div>
    </div>
  );

  if (phase === 'waiting') return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '8rem 1.5rem 4rem' }}>
      <div className="card-dark" style={{ maxWidth: 500, width: '100%', textAlign: 'center', padding: '2.5rem 2rem', borderRadius: 28 }}>
        <div style={{ width: 76, height: 76, borderRadius: 999, margin: '0 auto 1.3rem', display: 'grid', placeItems: 'center', background: payState.state === 'failed' || payState.state === 'timeout' ? 'rgba(239,68,68,.12)' : 'rgba(74,140,42,.16)' }}>
          <Icon name={payState.state === 'failed' || payState.state === 'timeout' ? 'solar:close-circle-linear' : 'solar:smartphone-2-linear'} size={38} style={{ color: payState.state === 'failed' || payState.state === 'timeout' ? '#FCA5A5' : '#9FD96A' }} />
        </div>
        {payState.state === 'sending' && <><h1 style={{ fontSize: '1.7rem', margin: '0 0 .6rem' }}>{tr('Sending M-Pesa prompt…')}</h1><p style={{ color: 'rgba(244,250,240,.6)', margin: 0 }}>{tr('One moment.')}</p></>}
        {payState.state === 'waiting' && <><h1 style={{ fontSize: '1.7rem', margin: '0 0 .6rem' }}>{tr('Check your phone')}</h1>
          <p style={{ color: 'rgba(244,250,240,.7)', margin: '0 0 1rem' }}>{tr('We sent an M-Pesa prompt for')} <strong>{kes(order.total)}</strong> {tr('to')} <strong>{mpesaPhone}</strong>. {tr('Enter your M-Pesa PIN to complete the payment.')}</p>
          <p style={{ color: 'rgba(244,250,240,.45)', fontSize: '.82rem', margin: 0 }}>{tr('Waiting for confirmation… this page updates automatically.')}</p></>}
        {payState.state === 'failed' && <><h1 style={{ fontSize: '1.7rem', margin: '0 0 .6rem' }}>{tr('Payment not completed')}</h1><p style={{ color: 'rgba(244,250,240,.7)', margin: '0 0 1.2rem' }}>{tr(payState.message)}</p></>}
        {payState.state === 'timeout' && <><h1 style={{ fontSize: '1.7rem', margin: '0 0 .6rem' }}>{tr('Still waiting…')}</h1><p style={{ color: 'rgba(244,250,240,.7)', margin: '0 0 1.2rem' }}>{tr("We haven't received confirmation yet. If you already paid, it may take a minute to show — you can check with Track Order.")}</p></>}
        {(payState.state === 'failed' || payState.state === 'timeout') && (
          <div style={{ display: 'grid', gap: '.8rem' }}>
            <input className="field" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} aria-label={tr('M-Pesa phone number')} placeholder={tr('M-Pesa number')} style={{ textAlign: 'center' }} />
            <button className="btn-primary" onClick={() => pay(order.order_id, mpesaPhone)}>{tr('Send prompt again')}</button>
            <Link to="/track" className="btn-ghost">{tr('Track order')} {order.order_number}</Link>
          </div>
        )}
        <p style={{ marginTop: '1.4rem', fontSize: '.78rem', color: 'rgba(244,250,240,.4)' }}>{tr('Order')} {order.order_number}</p>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg-ink)', minHeight: '100vh' }}>
      <PageHead eyebrow={tr('Secure checkout')} title={tr('Checkout')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.4rem' }}>
          {['Delivery', 'Payment'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', fontSize: '.78rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: step >= i + 1 ? 'var(--text-light)' : 'rgba(244,250,240,.4)' }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: '.72rem', background: step > i + 1 ? 'linear-gradient(135deg,#9FD96A,#4A8C2A)' : step === i + 1 ? 'rgba(74,140,42,.3)' : 'rgba(244,250,240,.08)', color: step > i + 1 ? '#111A0C' : 'inherit' }}>{step > i + 1 ? '✓' : i + 1}</span>{tr(label)}
              </div>
              {i < 1 && <div style={{ width: 40, height: 1, background: step > 1 ? 'rgba(74,140,42,.6)' : 'rgba(244,250,240,.12)' }}></div>}
            </div>
          ))}
        </div>
      </PageHead>

      <div className="container-x two-col" style={{ padding: '2.5rem 1.5rem 5rem', display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(280px,.7fr)', gap: '2rem', alignItems: 'start' }}>
        <div className="card-dark" style={{ padding: '2rem', borderRadius: 26 }}>
          {step === 1 && (
            <>
              <h2 style={{ margin: '0 0 1.4rem', fontSize: '1.25rem', letterSpacing: '-.04em' }}>{tr('Delivery details')}</h2>
              {!user && <p style={{ margin: '-.6rem 0 1.2rem', fontSize: '.84rem', color: 'rgba(244,250,240,.55)' }}>{tr('Checking out as a guest.')} <Link to="/login?next=/checkout" style={{ color: '#9FD96A', fontWeight: 700 }}>{tr('Sign in')}</Link> {tr('to save your details and see your order history.')}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[['name', 'Full name', 'text', 'Jane Wanjiru', 2], ['phone', 'Phone number', 'tel', '0712 345 678', 1], ['email', 'Email (optional)', 'email', 'jane@example.com', 1], ['address', 'Delivery address', 'text', 'Building, street, estate', 2], ['city', 'Town / city', 'text', 'Nairobi', 2]].map(([k, label, type, ph, span]) => (
                  <div key={k} style={{ gridColumn: `span ${span}` }}>
                    <label className="label" htmlFor={k}>{tr(label)}</label>
                    <input id={k} name={k} type={type} value={form[k]} onChange={set} placeholder={tr(ph)} className={`field ${errors[k] ? 'err' : ''}`} />
                    {errors[k] && <p style={{ margin: '.3rem 0 0', color: '#FCA5A5', fontSize: '.74rem' }}>{tr(errors[k])}</p>}
                  </div>
                ))}
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="label" htmlFor="notes">{tr('Delivery notes (optional)')}</label>
                  <textarea id="notes" name="notes" rows={2} value={form.notes} onChange={set} placeholder={tr('Landmark, gate code, preferred time…')} className="field" style={{ resize: 'none' }} />
                </div>
              </div>
              <button className="btn-primary" style={{ marginTop: '1.6rem', width: '100%' }} onClick={() => { if (validate1()) { setStep(2); setMpesaPhone(p => p || form.phone); window.scrollTo(0, 0); } }}>{tr('Continue to payment')} <Icon name="solar:arrow-right-linear" size={15} /></button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ margin: '0 0 1.4rem', fontSize: '1.25rem', letterSpacing: '-.04em' }}>{tr('Payment')}</h2>
              {hasRx && (
                <div style={{ marginBottom: '1.6rem' }}>
                  <RxNotice><strong>{tr('Upload your prescription.')}</strong> {tr("Your cart has prescription-only medicine. A pharmacist will verify the prescription before dispatch; if it can't be verified the order is cancelled and refunded.")}</RxNotice>
                  <label className="label" htmlFor="rx" style={{ marginTop: '1rem' }}>{tr('Prescription (JPG, PNG, WebP or PDF, max 5 MB)')}</label>
                  <input id="rx" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setRxFile(e.target.files?.[0] || null)} className={`field ${errors.rx ? 'err' : ''}`} />
                  {errors.rx && <p style={{ margin: '.3rem 0 0', color: '#FCA5A5', fontSize: '.74rem' }}>{tr(errors.rx)}</p>}
                </div>
              )}

              <div style={{ display: 'grid', gap: '.8rem', marginBottom: '1.4rem' }}>
                {[['mpesa', 'M-Pesa', 'Get a payment prompt on your phone', 'solar:smartphone-2-linear'], ...(s.cod_enabled ? [['cash_on_delivery', 'Pay on delivery', 'Pay the rider when your order arrives', 'solar:wallet-money-linear']] : [])].map(([id, title, sub, icon]) => (
                  <label key={id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem 1.1rem', borderRadius: 16, cursor: 'pointer', border: `1px solid ${method === id ? '#4A8C2A' : 'rgba(244,250,240,.12)'}`, background: method === id ? 'rgba(74,140,42,.1)' : 'transparent' }}>
                    <input type="radio" name="method" checked={method === id} onChange={() => setMethod(id)} />
                    <Icon name={icon} size={26} style={{ color: '#6DB33F' }} />
                    <div><div style={{ fontWeight: 700 }}>{tr(title)}</div><div style={{ fontSize: '.8rem', color: 'rgba(244,250,240,.5)' }}>{tr(sub)}</div></div>
                  </label>
                ))}
              </div>

              {method === 'mpesa' && (
                <div>
                  <label className="label" htmlFor="mp">{tr('M-Pesa phone number')}</label>
                  <input id="mp" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} placeholder="0712 345 678" className={`field ${errors.mpesaPhone ? 'err' : ''}`} inputMode="tel" />
                  {errors.mpesaPhone && <p style={{ margin: '.3rem 0 0', color: '#FCA5A5', fontSize: '.74rem' }}>{tr(errors.mpesaPhone)}</p>}
                  <p style={{ margin: '.6rem 0 0', fontSize: '.78rem', color: 'rgba(244,250,240,.45)' }}>{tr("You'll receive a prompt for")} <strong>{t.loaded ? kes(t.total) : tr('Loading…')}</strong>. {tr('We never see or store your PIN.')}</p>
                </div>
              )}

              {error && <div style={{ marginTop: '1.2rem', padding: '.85rem 1rem', borderRadius: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)', color: '#FCA5A5', fontSize: '.86rem' }}>{tr(error)}</div>}
              <div style={{ display: 'flex', gap: '.8rem', marginTop: '1.6rem' }}>
                <button className="btn-ghost" onClick={() => setStep(1)} disabled={busy}>{tr('Back')}</button>
                <button className="btn-primary" style={{ flex: 1, opacity: busy || !t.loaded ? .7 : 1 }} disabled={busy || !t.loaded} onClick={submit}>
                  {!t.loaded ? tr('Loading totals…') : busy ? tr('Placing order…') : method === 'mpesa' ? `${tr('Pay')} ${kes(t.total)} ${tr('with M-Pesa')}` : tr('Place order')}
                </button>
              </div>
            </>
          )}
        </div>

        <aside className="card-dark sticky-side" style={{ padding: '1.4rem', position: 'sticky', top: 90, borderRadius: 24 }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', letterSpacing: '-.03em' }}>{tr('Your order')}</h3>
          {cart.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '.45rem 0', fontSize: '.86rem', color: 'rgba(244,250,240,.75)' }}>
              <span>{tr(i.name)} <span style={{ color: 'rgba(244,250,240,.4)' }}>× {i.qty}</span></span><span>{kes(i.price * i.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(244,250,240,.1)', margin: '.8rem 0', paddingTop: '.8rem', display: 'grid', gap: '.4rem', fontSize: '.88rem', color: 'rgba(244,250,240,.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('Subtotal')}</span><span>{kes(total)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('Delivery')}</span><span>{t.loaded ? (t.delivery === 0 ? tr('Free') : kes(t.delivery)) : tr('Loading…')}</span></div>
            {t.loaded && t.taxRate > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('VAT')} ({t.taxRate}%)</span><span>{kes(t.tax)}</span></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Sora,sans-serif', fontSize: '1.2rem', fontWeight: 700 }}><span>{tr('Total')}</span><span>{t.loaded ? kes(t.total) : tr('Loading…')}</span></div>
          <p style={{ margin: '1rem 0 0', fontSize: '.72rem', color: 'rgba(244,250,240,.38)' }}>{tr('Final prices are confirmed by our system when you place the order.')}</p>
        </aside>
      </div>
    </div>
  );
}
