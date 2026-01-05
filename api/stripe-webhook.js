// backend/api/stripe-webhook.js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export const config = { api: { bodyParser: false } };

// Supabase service role client
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to get raw request body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const buf = await getRawBody(req);
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata.order_id;

    try {
      // 1️⃣ Mark order as paid
      const { error: orderError, data: orderData } = await supabase
        .from("Orders")
        .update({ order_status: "paid" })
        .eq("id", orderId)
        .select()
        .single();

      if (orderError) throw orderError;
      console.log(`Order ${orderId} marked as paid`);

      // 2️⃣ Insert items into order_items
      const items = JSON.parse(orderData.raw_items || "[]");

      for (const item of items) {
        const { error: itemError } = await supabase.from("order_items").insert({
          order_id: orderId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          options: JSON.stringify(item.options || []),
          special_instructions: item.specialInstructions || "",
        });
        if (itemError) console.error("Failed to insert item:", itemError.message);
      }

      console.log(`Inserted ${items.length} items into order_items`);
    } catch (err) {
      console.error("Webhook processing error:", err.message);
    }
  }

  res.status(200).json({ received: true });
}
