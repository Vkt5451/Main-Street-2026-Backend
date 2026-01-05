// backend/api/create-checkout-session.js
import Stripe from "stripe";
import { createOrder } from "./db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const allowedOrigin = "https://vkt5451.github.io";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { items } = req.body;
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: "No items provided" });

  try {
    // 1️⃣ Create server-side order
    const total = items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
    const order = createOrder({ items, total });

    // 2️⃣ Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: items.map(item => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity || 1,
      })),
      mode: "payment",
      success_url: `https://vkt5451.github.io/Main-Street-2026/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: "https://vkt5451.github.io/Main-Street-2026/menu-page.html",
      metadata: { order_id: order.id }, // <-- link Stripe session to server order
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message || "Stripe checkout failed" });
  }
}
