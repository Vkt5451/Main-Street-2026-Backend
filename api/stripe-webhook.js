// backend/api/stripe-webhook.js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }, // Stripe requires raw body
};

// Initialize Supabase client
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // must be service role key for insert
);

// Helper: read raw request body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const buf = await getRawBody(req);
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const customerEmail = session.metadata.customer_email;
    const totalAmount = Number(session.metadata.total_amount);
    let items = [];
    try {
      items = JSON.parse(session.metadata.items);
    } catch (err) {
      console.error("Failed to parse items metadata:", err.message);
    }

    // Insert order into Supabase
    const { data, error } = await supabase
      .from("Orders")
      .insert({
        customer_email: customerEmail,
        order_status: "paid",
        total_amount: totalAmount,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to insert order into Supabase:", error.message);
    } else {
      console.log(`Order ${data.id} inserted into Supabase!`);
    }

    // Optional: insert order items if you add an order_items table later
  }

  res.status(200).json({ received: true });
}
