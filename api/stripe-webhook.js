// backend/api/stripe-webhook.js
import Stripe from "stripe";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Disable body parsing so we can read raw Stripe payload
export const config = {
  api: {
    bodyParser: false,
  },
};

import { buffer } from "micro"; // optional helper to parse raw body

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read raw body
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET // set this in Vercel
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata.order_id;

    // Update your in-memory order status
    global.orders = global.orders || [];
    const order = global.orders.find(o => o.id === orderId);
    if (order) order.status = "paid";

    console.log(`Order ${orderId} marked as paid!`);
  }

  res.status(200).json({ received: true });
}
