import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripe;
}

export interface StripeBalance {
  available: number;
  pending: number;
  total: number;
}

export interface StripePayout {
  id: string;
  amount: number;
  status: string;
  arrivalDate: number;
  description?: string;
}

export async function getBalance(): Promise<StripeBalance> {
  const stripe = getStripe();
  const balance = await stripe.balance.retrieve();
  
  return {
    available: balance.available[0]?.amount || 0,
    pending: balance.pending[0]?.amount || 0,
    total: (balance.available[0]?.amount || 0) + (balance.pending[0]?.amount || 0),
  };
}

export async function getPayouts(limit: number = 10): Promise<StripePayout[]> {
  const stripe = getStripe();
  const payouts = await stripe.payouts.list({
    limit: limit,
  });
  
  return payouts.data.map(payout => ({
    id: payout.id,
    amount: payout.amount,
    status: payout.status,
    arrivalDate: payout.arrival_date,
    description: payout.description || undefined,
  }));
}

export async function getPendingPayouts(): Promise<StripePayout[]> {
  const stripe = getStripe();
  const payouts = await stripe.payouts.list({
    limit: 100,
    status: 'pending',
  });
  
  return payouts.data.map(payout => ({
    id: payout.id,
    amount: payout.amount,
    status: payout.status,
    arrivalDate: payout.arrival_date,
    description: payout.description || undefined,
  }));
}

export function formatCurrency(amount: number): string {
  // Stripe amounts are in cents, convert to dollars
  return `$${(amount / 100).toFixed(2)}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

export interface TodayStats {
  grossVolume: number;
  customers: number;
  payments: number;
}

export async function getTodayStats(): Promise<TodayStats> {
  const stripe = getStripe();
  
  // Get start and end of today in local timezone, then convert to UTC for Stripe
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  
  // Create start of today in local timezone
  const startOfTodayLocal = new Date(year, month, date, 0, 0, 0, 0);
  // Create end of today in local timezone
  const endOfTodayLocal = new Date(year, month, date, 23, 59, 59, 999);
  
  // Convert to UTC timestamps for Stripe (Stripe uses UTC)
  const startTimestamp = Math.floor(startOfTodayLocal.getTime() / 1000);
  const endTimestamp = Math.floor(endOfTodayLocal.getTime() / 1000);
  
  // Get all PaymentIntents for today (modern Stripe approach)
  let allPaymentIntents: Stripe.PaymentIntent[] = [];
  let hasMorePIs = true;
  let startingAfterPIs: string | undefined = undefined;
  
  while (hasMorePIs) {
    const params: Stripe.PaymentIntentListParams = {
      limit: 100,
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
    };
    
    if (startingAfterPIs) {
      params.starting_after = startingAfterPIs;
    }
    
    const paymentIntents = await stripe.paymentIntents.list(params);
    allPaymentIntents = allPaymentIntents.concat(paymentIntents.data);
    
    hasMorePIs = paymentIntents.has_more;
    if (hasMorePIs && paymentIntents.data.length > 0) {
      startingAfterPIs = paymentIntents.data[paymentIntents.data.length - 1].id;
    } else {
      hasMorePIs = false;
    }
  }
  
  // Get all charges for today - fetch all pages if needed
  let allCharges: Stripe.Charge[] = [];
  let hasMoreCharges = true;
  let startingAfterCharges: string | undefined = undefined;
  
  while (hasMoreCharges) {
    const params: Stripe.ChargeListParams = {
      limit: 100,
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
    };
    
    if (startingAfterCharges) {
      params.starting_after = startingAfterCharges;
    }
    
    const charges = await stripe.charges.list(params);
    allCharges = allCharges.concat(charges.data);
    
    hasMoreCharges = charges.has_more;
    if (hasMoreCharges && charges.data.length > 0) {
      startingAfterCharges = charges.data[charges.data.length - 1].id;
    } else {
      hasMoreCharges = false;
    }
  }
  
  // Filter successful payment intents
  const successfulPaymentIntents = allPaymentIntents.filter(pi => pi.status === 'succeeded');
  
  // Filter successful charges
  const successfulCharges = allCharges.filter(charge => charge.status === 'succeeded' && charge.paid);
  
  // Get charge IDs from payment intents to avoid double counting
  const chargeIdsFromPIs = new Set<string>();
  successfulPaymentIntents.forEach(pi => {
    if (pi.latest_charge) {
      const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge.id;
      if (chargeId) {
        chargeIdsFromPIs.add(chargeId);
      }
    }
  });
  
  // Filter out charges that are already counted via PaymentIntents
  const standaloneCharges = successfulCharges.filter(charge => !chargeIdsFromPIs.has(charge.id));
  
  // Calculate gross volume from both sources
  const paymentIntentsVolume = successfulPaymentIntents.reduce((sum, pi) => {
    // Use amount_received if available (actual amount received), otherwise use amount
    return sum + (pi.amount_received || pi.amount || 0);
  }, 0);
  
  const chargesVolume = standaloneCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const grossVolume = paymentIntentsVolume + chargesVolume;
  
  // Count unique customers from both sources
  // Priority: Customer ID > Billing Email (normalized)
  const uniqueCustomers = new Set<string>();
  
  // Add customers from PaymentIntents
  successfulPaymentIntents.forEach(pi => {
    let customerIdentifier: string | null = null;
    
    if (pi.customer) {
      if (typeof pi.customer === 'string') {
        customerIdentifier = pi.customer;
      } else if (typeof pi.customer === 'object' && pi.customer !== null && 'id' in pi.customer) {
        customerIdentifier = (pi.customer as any).id;
      }
    }
    
    // Use receipt_email as fallback for PaymentIntents
    if (!customerIdentifier && pi.receipt_email) {
      const email = pi.receipt_email.toLowerCase().trim();
      if (email) {
        customerIdentifier = `email:${email}`;
      }
    }
    
    if (customerIdentifier) {
      uniqueCustomers.add(customerIdentifier);
    }
  });
  
  // Add customers from standalone charges
  standaloneCharges.forEach(charge => {
    let customerIdentifier: string | null = null;
    
    // Check for customer ID (can be string or expanded Customer object)
    if (charge.customer) {
      if (typeof charge.customer === 'string') {
        customerIdentifier = charge.customer;
      } else if (typeof charge.customer === 'object' && charge.customer !== null && 'id' in charge.customer) {
        customerIdentifier = (charge.customer as any).id;
      }
    }
    
    // Use billing email for one-time payments (normalize to lowercase)
    if (!customerIdentifier && charge.billing_details?.email) {
      const email = charge.billing_details.email.toLowerCase().trim();
      if (email) {
        customerIdentifier = `email:${email}`;
      }
    }
    
    if (customerIdentifier) {
      uniqueCustomers.add(customerIdentifier);
    }
  });
  
  const customers = uniqueCustomers.size;
  
  // Count successful payments (payment intents + standalone charges)
  const payments = successfulPaymentIntents.length + standaloneCharges.length;
  
  return {
    grossVolume,
    customers,
    payments,
  };
}

