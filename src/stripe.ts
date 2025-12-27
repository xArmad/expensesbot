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
  
  // Get timezone offset from environment (hours from UTC, e.g., -8 for PST, -5 for EST)
  // Default to UTC (0) if not set
  const timezoneOffsetHours = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '0', 10);
  
  const now = new Date();
  
  // Calculate local time by applying timezone offset
  const localTime = new Date(now.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));
  
  // Get local date components
  const localYear = localTime.getUTCFullYear();
  const localMonth = localTime.getUTCMonth();
  const localDate = localTime.getUTCDate();
  
  // Create start of today in local timezone (midnight local time)
  const startOfTodayLocal = new Date(Date.UTC(localYear, localMonth, localDate, 0, 0, 0, 0));
  // Subtract the offset to get the UTC equivalent
  const startOfTodayUTC = new Date(startOfTodayLocal.getTime() - (timezoneOffsetHours * 60 * 60 * 1000));
  
  // Create end of today in local timezone (11:59:59.999 PM local time)
  const endOfTodayLocal = new Date(Date.UTC(localYear, localMonth, localDate, 23, 59, 59, 999));
  // Subtract the offset to get the UTC equivalent
  const endOfTodayUTC = new Date(endOfTodayLocal.getTime() - (timezoneOffsetHours * 60 * 60 * 1000));
  
  // Convert to UTC timestamps for Stripe
  const startTimestamp = Math.floor(startOfTodayUTC.getTime() / 1000);
  const endTimestamp = Math.floor(endOfTodayUTC.getTime() / 1000);
  
  // Debug logging
  console.log(`[getTodayStats] Timezone offset: ${timezoneOffsetHours} hours`);
  console.log(`[getTodayStats] Current UTC time: ${now.toISOString()}`);
  console.log(`[getTodayStats] Local date: ${localYear}-${localMonth + 1}-${localDate}`);
  console.log(`[getTodayStats] UTC range: ${startOfTodayUTC.toISOString()} to ${endOfTodayUTC.toISOString()}`);
  console.log(`[getTodayStats] Timestamps: ${startTimestamp} to ${endTimestamp}`);
  
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
  
  // Debug logging
  console.log(`[getTodayStats] Results:`);
  console.log(`  - PaymentIntents found: ${allPaymentIntents.length} (successful: ${successfulPaymentIntents.length})`);
  console.log(`  - Charges found: ${allCharges.length} (successful: ${successfulCharges.length}, standalone: ${standaloneCharges.length})`);
  console.log(`  - Gross Volume: $${(grossVolume / 100).toFixed(2)}`);
  console.log(`  - Customers: ${customers}`);
  console.log(`  - Payments: ${payments}`);
  
  // Log sample payment times to verify they're within range
  if (successfulPaymentIntents.length > 0) {
    const samplePI = successfulPaymentIntents[0];
    console.log(`  - Sample PaymentIntent created: ${new Date(samplePI.created * 1000).toISOString()} (${samplePI.created})`);
  }
  if (standaloneCharges.length > 0) {
    const sampleCharge = standaloneCharges[0];
    console.log(`  - Sample Charge created: ${new Date(sampleCharge.created * 1000).toISOString()} (${sampleCharge.created})`);
  }
  
  return {
    grossVolume,
    customers,
    payments,
  };
}

export async function getStatsForDate(targetDate: Date): Promise<TodayStats> {
  const stripe = getStripe();
  
  // Get timezone offset from environment
  const timezoneOffsetHours = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '0', 10);
  
  // Calculate local date components for the target date
  const localTime = new Date(targetDate.getTime() + (timezoneOffsetHours * 60 * 60 * 1000));
  const localYear = localTime.getUTCFullYear();
  const localMonth = localTime.getUTCMonth();
  const localDate = localTime.getUTCDate();
  
  // Create start of target date in local timezone (midnight local time)
  const startOfDateLocal = new Date(Date.UTC(localYear, localMonth, localDate, 0, 0, 0, 0));
  const startOfDateUTC = new Date(startOfDateLocal.getTime() - (timezoneOffsetHours * 60 * 60 * 1000));
  
  // Create end of target date in local timezone (11:59:59.999 PM local time)
  const endOfDateLocal = new Date(Date.UTC(localYear, localMonth, localDate, 23, 59, 59, 999));
  const endOfDateUTC = new Date(endOfDateLocal.getTime() - (timezoneOffsetHours * 60 * 60 * 1000));
  
  // Convert to UTC timestamps for Stripe
  const startTimestamp = Math.floor(startOfDateUTC.getTime() / 1000);
  const endTimestamp = Math.floor(endOfDateUTC.getTime() / 1000);
  
  // Get all PaymentIntents for the target date
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
  
  // Get all charges for the target date
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
    return sum + (pi.amount_received || pi.amount || 0);
  }, 0);
  
  const chargesVolume = standaloneCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const grossVolume = paymentIntentsVolume + chargesVolume;
  
  // Count unique customers from both sources
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
    
    if (charge.customer) {
      if (typeof charge.customer === 'string') {
        customerIdentifier = charge.customer;
      } else if (typeof charge.customer === 'object' && charge.customer !== null && 'id' in charge.customer) {
        customerIdentifier = (charge.customer as any).id;
      }
    }
    
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
  
  // Count successful payments
  const payments = successfulPaymentIntents.length + standaloneCharges.length;
  
  return {
    grossVolume,
    customers,
    payments,
  };
}

