import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { useLanguage } from '../context/LanguageContext';
import { getProducts } from '../lib/api';
import { kes } from '../lib/format';
import { Icon, PageHead, RxNotice } from '../components/ui/Bits';

export function useDeliveryTotals(subtotal) {
  const s = useSettings();
  const free = s.free_delivery_threshold > 0 && subtotal >= s.free_delivery_threshold;
  const delivery = subtotal === 0 || free ? 0 : s.delivery_fee;
  const tax = Math.round(subtotal * s.tax_rate) / 100;
  return { delivery, tax, total: subtotal + delivery + tax, free, threshold: s.free_delivery_threshold, taxRate: s.tax_rate, loaded: s.loaded };
}

// keeps cart lines honest: refresh price / stock from the database
export function useCartSync() {
  const { cart, dispatch } = useCart();
  useEffect(() => {
    if (!cart.length) return;
    getProducts().then(products => dispatch({ type: 'SYNC', products })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default function Cart() {
  const { tr } = useLanguage();
  const { cart, dispatch, total, hasRx } = useCart();
  const t = useDeliveryTotals(total);
  useCartSync();

  if (cart.length === 0) return (
    <div style={{ background: 'var(--bg-ink)', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '8rem 1.5rem 4rem', textAlign: 'center' }}>
      <div>
        <Icon name="solar:cart-large-2-linear" size={64} style={{ color: 'rgba(244,250,240,.25)' }} />
        <h1 style={{ fontSize: '2rem', margin: '1rem 0 .4rem' }}>{tr('Your cart is empty')}</h1>
        <p style={{ color: 'rgba(244,250,240,.55)', margin: '0 0 1.5rem' }}>{tr('Add medicines and health essentials to get started.')}</p>
        <Link to="/shop" className="btn-primary">{tr('Browse the shop')}</Link>
      </div>
    </div>
  );

  const progress = t.threshold > 0 ? Math.min(100, (total / t.threshold) * 100) : 0;

  return (
    <div style={{ background: 'var(--bg-ink)', minHeight: '100vh' }}>
      <PageHead eyebrow={tr('Your cart')} title={tr('Review your order')} />
      <div className="container-x two-col" style={{ padding: '2.5rem 1.5rem 5rem', display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(300px,.8fr)', gap: '2rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {hasRx && <RxNotice><strong>{tr('Your cart has prescription-only medicine.')}</strong> {tr("You'll upload your prescription at checkout; a pharmacist verifies it before dispatch.")}</RxNotice>}
          {cart.map(i => (
            <div key={i.id} className="card-dark" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link to={`/product/${i.id}`} style={{ width: 84, height: 84, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,.05)', display: 'grid', placeItems: 'center' }}>
                {i.image_url ? <img src={i.image_url} alt={i.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="solar:pills-3-linear" size={30} style={{ color: 'rgba(244,250,240,.3)' }} />}
              </Link>
              <div style={{ flex: 1, minWidth: 180 }}>
                <Link to={`/product/${i.id}`} style={{ fontWeight: 700, letterSpacing: '-.02em' }}>{tr(i.name)}</Link>
                {i.requires_prescription && <span className="pill pill-rx" style={{ marginLeft: '.5rem' }}>Rx</span>}
                <div style={{ fontSize: '.84rem', color: 'rgba(244,250,240,.5)', marginTop: '.2rem' }}>{kes(i.price)} {tr('each')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(244,250,240,.14)', borderRadius: 999 }}>
                <button aria-label={tr('Decrease')} onClick={() => i.qty > 1 ? dispatch({ type: 'UPDATE_QTY', id: i.id, qty: i.qty - 1 }) : dispatch({ type: 'REMOVE', id: i.id })} style={{ padding: '.5rem .9rem', background: 'none', border: 0, color: 'inherit', cursor: 'pointer', fontWeight: 800 }}>−</button>
                <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{i.qty}</span>
                <button aria-label={tr('Increase')} disabled={i.qty >= i.stock_qty} onClick={() => dispatch({ type: 'UPDATE_QTY', id: i.id, qty: i.qty + 1 })} style={{ padding: '.5rem .9rem', background: 'none', border: 0, color: 'inherit', cursor: i.qty >= i.stock_qty ? 'not-allowed' : 'pointer', fontWeight: 800, opacity: i.qty >= i.stock_qty ? .35 : 1 }}>+</button>
              </div>
              <div style={{ width: 100, textAlign: 'right', fontFamily: 'Sora,sans-serif', fontWeight: 700 }}>{kes(i.price * i.qty)}</div>
              <button aria-label={`${tr('Remove')} ${tr(i.name)}`} onClick={() => dispatch({ type: 'REMOVE', id: i.id })} style={{ background: 'none', border: 0, color: 'rgba(244,250,240,.4)', cursor: 'pointer' }}><Icon name="solar:trash-bin-minimalistic-linear" size={19} /></button>
            </div>
          ))}
        </div>

        <aside className="card-dark sticky-side" style={{ padding: '1.5rem', position: 'sticky', top: 90, borderRadius: 26 }}>
          <h2 style={{ margin: '0 0 1.1rem', fontSize: '1.25rem', letterSpacing: '-.04em' }}>{tr('Order summary')}</h2>
          {t.threshold > 0 && (
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '.8rem', color: t.free ? '#9FD96A' : 'rgba(244,250,240,.65)', marginBottom: '.5rem' }}>
                {t.free ? tr('You qualify for free delivery 🎉') : `${tr('Add')} ${kes(t.threshold - total)} ${tr('more for free delivery')}`}
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(244,250,240,.1)' }}><div style={{ height: '100%', width: `${progress}%`, borderRadius: 99, background: 'linear-gradient(90deg,#9FD96A,#4A8C2A)', transition: 'width 300ms' }}></div></div>
            </div>
          )}
          {[['Subtotal', kes(total)], ['Delivery', t.loaded ? (t.delivery === 0 ? 'Free' : kes(t.delivery)) : 'Loading…'], ...(t.loaded && t.taxRate > 0 ? [[`VAT (${t.taxRate}%)`, kes(t.tax)]] : [])].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '.4rem 0', fontSize: '.9rem', color: 'rgba(244,250,240,.7)' }}><span>{tr(k)}</span><span>{tr(v)}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0 1.3rem', marginTop: '.5rem', borderTop: '1px solid rgba(244,250,240,.1)', fontFamily: 'Sora,sans-serif', fontSize: '1.3rem', fontWeight: 700 }}><span>{tr('Total')}</span><span>{t.loaded ? kes(t.total) : tr('Loading…')}</span></div>
          <Link to="/checkout" aria-disabled={!t.loaded} tabIndex={t.loaded ? 0 : -1} onClick={e => { if (!t.loaded) e.preventDefault(); }} className="btn-primary" style={{ width: '100%', opacity: t.loaded ? 1 : .55, pointerEvents: t.loaded ? 'auto' : 'none' }}>{tr(t.loaded ? 'Proceed to checkout' : 'Loading totals…')} {t.loaded && <Icon name="solar:arrow-right-linear" size={15} />}</Link>
          <Link to="/shop" style={{ display: 'block', textAlign: 'center', marginTop: '1rem', fontSize: '.84rem', color: 'rgba(244,250,240,.55)' }}>{tr('Continue shopping')}</Link>
        </aside>
      </div>
    </div>
  );
}
