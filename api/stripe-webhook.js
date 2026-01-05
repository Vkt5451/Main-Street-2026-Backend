import Stripe from 'stripe';
import { Readable } from 'stream';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }, // Stripe needs raw body
};

// Helper to convert request to raw buffer
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const sig = req.headers['stripe-signature'];
    const buf = await buffer(req);

    let event;
    try {
      event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.log('⚠️ Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle only successful payments
        if (event.type === 'payment_intent.succeeded') {
        // mark order as Paid
        console.log(`✅ Payment succeeded for order: ${paymentIntent.metadata.order_id}`);
        }

        if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        console.log(`❌ Payment failed for order: ${paymentIntent.metadata.order_id}`);
        console.log(`Reason: ${paymentIntent.last_payment_error?.message}`);
        // Optional: notify customer or flag order as unpaid
        }

    res.status(200).json({ received: true });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
