import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeWithNC, cancelSubscription, getSubscription } from '../services/subscriptionService';

export default function SubscriptionManage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchSub = async () => {
      const sub = await getSubscription(user.uid);
      setSubscription(sub);
    };
    fetchSub();
  }, [user?.uid]);

  const handleSubscribe = async () => {
    if (!user?.uid) {
      setError('User not found');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await subscribeWithNC(user.uid);
      const updated = await getSubscription(user.uid);
      setSubscription(updated);
      alert('Subscribed!');
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Subscription failed';
      setError(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!user?.uid) return;
    try {
      await cancelSubscription(user.uid);
      const updated = await getSubscription(user.uid);
      setSubscription(updated);
      alert('Cancelled');
    } catch (err: any) {
      const msg = err?.message || 'Cancel failed';
      setError(msg);
    }
  };

  return (
    <div className="container">
      <h2>Manage Subscription</h2>
      {error && <div style={{ color: '#dc2626', marginBottom: 16 }}>{error}</div>}
      <div className="liquid-glass card">
        <p>{subscription?.status ? `Status: ${subscription.status}` : 'No active subscription'}</p>
        {subscription?.currentPeriodEnd && (
          <p style={{ fontSize: '0.9rem' }}>Ends: {new Date(subscription.currentPeriodEnd.toMillis?.() || subscription.currentPeriodEnd).toLocaleDateString()}</p>
        )}
        <button onClick={handleSubscribe} disabled={loading} className="btn-primary">{loading ? 'Processing...' : 'Subscribe w/ NC'}</button>
        {subscription?.status && <button onClick={handleCancel} className="btn-secondary">Cancel</button>}
      </div>
    </div>
  );
}