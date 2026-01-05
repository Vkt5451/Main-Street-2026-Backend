import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const allowedOrigin = "https://vkt5451.github.io";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { items, customer_email, total_amount } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "No items provided" });

  try {
    // Sanitize prices
    const sanitizedItems = items.map(item => ({
      ...item,
      price: typeof item.price === "string" ? parseFloat(item.price.replace("$","")) : item.price
    }));

    const orderTotal = total_amount || sanitizedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // 1️⃣ Insert order as pending
    const { data: orderData, error: orderError } = await supabase
      .from("Orders")
      .insert({
        customer_email: customer_email || "",
        order_status: "pending",
        total_amount: orderTotal
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderId = orderData.id;

    // 2️⃣ Insert items into order_items linked to order
    for (const item of sanitizedItems) {
      const { error: itemError } = await supabase.from("order_items").insert({
        order_id: orderId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        options: JSON.stringify(item.options || []),
        special_instructions: item.specialInstructions || "",
      });
      if (itemError) console.error("Item insert error:", itemError.message);
    }

    // 3️⃣ Create Stripe checkout session (only send order_id in metadata)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: sanitizedItems.map(item => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      metadata: { order_id: orderId },
      success_url: "https://vkt5451.github.io/Main-Street-2026/",
      cancel_url: "https://vkt5451.github.io/Main-Street-2026/menu-page.html",
    });

    res.status(200).json({ url: session.url, orderId });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message || "Checkout session failed" });
  }
}
