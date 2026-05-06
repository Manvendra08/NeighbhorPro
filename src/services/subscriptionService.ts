import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { z } from "zod";

const subscribeNCSchema = z.object({
  uid: z.string(),
  monthKey: z.string(),
});

export async function getSubscription(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.data()?.subscription || null;
}

export async function subscribeWithNC(uid: string) {
  const monthKey = new Date().toISOString().slice(0,7).replace("-","");
  subscribeNCSchema.parse({ uid, monthKey });
  
  return runTransaction(db, async (tx) => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");
    
    let cashableBalance = (userSnap.data()?.cashableBalance as number) || 0;
    const price = 500; // Hardcoded fallback or fetch from config
    
    if (cashableBalance < price) throw new Error("INSUFFICIENT_CASHABLE_BALANCE");
    
    cashableBalance -= price;
    
    const subId = "sub__";
    const subRef = doc(db, "subscriptions", subId);
    const now = new Date();
    const end = new Date(now.getTime() + 30*24*60*60*1000);
    
    tx.update(userRef, { 
      cashableBalance, 
      subscription: { status: "active", currentPeriodEnd: end, plan: "business_monthly_v1", autoRenewCoins: true } 
    });
    
    tx.set(subRef, {
      uid, plan: "business_monthly_v1", status: "active", currency: "NC", amount: price,
      currentPeriodStart: now, currentPeriodEnd: end, autoRenewCoins: true,
      cancelAtPeriodEnd: false, source: "coins", createdAt: serverTimestamp()
    });
    
    const ledgerRef = doc(db, "coinLedger", uid, "entries", subId);
    tx.set(ledgerRef, {
      uid, type: "subscription_debit", amount: -price, balanceAfter: cashableBalance, description: "Monthly Business Subscription", createdAt: serverTimestamp()
    });
    
    return true;
  });
}

export async function cancelSubscription(uid: string) {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, { subscription: { cancelAtPeriodEnd: true } }, { merge: true });
  return true;
}