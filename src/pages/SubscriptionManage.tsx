import { useAuth } from '../contexts/AuthContext';
import { subscribeWithNC, cancelSubscription } from '../services/subscriptionService';

export default function SubscriptionManage() {
  const { user } = useAuth();

  const handleSubscribe = async () => {
    if(!user?.uid) return;
    try {
      await subscribeWithNC(user.uid);
      alert('Subscribed!');
    } catch(err) {
      alert(err);
    }
  };

  return (
    <div className="container">
      <h2>Manage Subscription</h2>
      <div className="liquid-glass card">
        <p>Active Plan: Business</p>
        <button onClick={handleSubscribe} className="btn-primary">Subscribe w/ NC</button>
        <button onClick={() => user?.uid && cancelSubscription(user.uid)} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}