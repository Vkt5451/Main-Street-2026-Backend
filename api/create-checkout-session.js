// backend/api/create-checkout-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    // Make sure price is a number (remove $ if any)
    const sanitizedItems = items.map(item => ({
      ...item,
      price: typeof item.price === "string" ? parseFloat(item.price.replace("$","")) : item.price
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: sanitizedItems.map(item => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round((parseFloat(item.price?.toString().replace("$", "")) || 0) * 100),
        },
        quantity: item.quantity || 1,
      })),
      mode: "payment",
      metadata: {
        items: JSON.stringify(sanitizedItems),
        customer_email: customer_email || "",
        total_amount: total_amount || sanitizedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },
      success_url: "https://vkt5451.github.io/Main-Street-2026/",
      cancel_url: "https://vkt5451.github.io/Main-Street-2026/menu-page.html"
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message || "Stripe checkout failed" });
  }
}
