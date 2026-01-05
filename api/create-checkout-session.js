// backend/api/create-checkout-session.js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Stripe & Supabase setup
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

  const { items, customer_email } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "No items provided" });

  try {
    // Sanitize prices
    const sanitizedItems = items.map(item => ({
      ...item,
      price: typeof item.price === "string" ? parseFloat(item.price.replace("$", "")) : item.price
    }));

    const orderTotal = sanitizedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // 1️⃣ Insert order immediately with status "pending"
    const { data: orderData, error: orderError } = await supabase
      .from("Orders")
      .insert({
        customer_email: customer_email || "",
        order_status: "pending", // will be updated in webhook
        total_amount: orderTotal,
        raw_items: JSON.stringify(sanitizedItems) // optional for debugging
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderId = orderData.id;

    // 2️⃣ Create Stripe checkout session
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
      metadata: { order_id: orderId }, // only send order_id to Stripe
      success_url: "https://vkt5451.github.io/Main-Street-2026/",
      cancel_url: "https://vkt5451.github.io/Main-Street-2026/menu-page.html",
    }));

    res.status(200).json({ url: session.url, orderId });
  } catch (err) {
    console.error("Checkout session error:", err);
    res.status(500).json({ error: err.message || "Checkout session failed" });
  }
}
