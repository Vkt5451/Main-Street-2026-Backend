// backend/api/stripe-webhook.js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }
};

// Supabase client (service role key)
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to read raw body
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

    let items = [];
    try {
      items = JSON.parse(session.metadata.items);
      console.log("Parsed items:", items);
    } catch (err) {
      console.error("Failed to parse items metadata:", err.message);
    }

    try {
      // Insert main order
      const { data: orderData, error: orderError } = await supabase
        .from("Orders")
        .insert({
          customer_email: session.metadata.customer_email || "",
          order_status: "paid",
          total_amount: Number(session.metadata.total_amount)
        })
        .select()
        .single();

      if (orderError) throw orderError;
      console.log(`Order ${orderData.id} inserted`);

      // Insert individual items
      for (const item of items) {
        await supabase.from("order_items").insert({
          order_id: orderData.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          options: JSON.stringify(item.options || []),
          special_instructions: item.specialInstructions || ""
        });
      }

      console.log(`Inserted ${items.length} items into order_items`);
    } catch (err) {
      console.error("Failed to insert order/items:", err.message);
    }
  }

  res.status(200).json({ received: true });
}
