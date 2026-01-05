// backend/api/stripe-webhook.js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: { bodyParser: false }, // Stripe requires raw body
};

// Supabase client (service role key)
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
if (event.type === "checkout.session.completed") {
  const session = event.data.object;

  // Parse cart items from metadata
  let items = [];
  try {
    items = JSON.parse(session.metadata.items);
  } catch (err) {
    console.error("Failed to parse items metadata:", err.message);
  }

  const customerEmail = session.metadata.customer_email || "unknown@example.com";
  const totalAmount = Number(session.metadata.total_amount) || 0;

  try {
    // 1️⃣ Insert main order (Supabase generates UUID automatically)
    const { data: orderData, error: orderError } = await supabase
      .from("Orders")
      .insert({
        customer_email: customerEmail,
        order_status: "paid",
        total_amount: totalAmount,
      })
      .select() // return inserted row
      .single();

    if (orderError) {
      console.error("Failed to insert order:", orderError);
      return;
    }

    console.log(`Order ${orderData.id} inserted into Orders`);

    // 2️⃣ Insert individual items
    for (const item of items) {
      const { data: itemData, error: itemError } = await supabase
        .from("order_items")
        .insert({
          order_id: orderData.id, // MUST match Orders.id (UUID)
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          options: JSON.stringify(item.options || []),
          special_instructions: item.specialInstructions || "",
        });

      if (itemError) console.error("Failed to insert item:", item, itemError);
      else console.log("Inserted item:", itemData);
    }

    console.log(`Inserted ${items.length} items into order_items`);
  } catch (err) {
    console.error("Webhook insertion error:", err.message);
  }
}


  res.status(200).json({ received: true });
}
