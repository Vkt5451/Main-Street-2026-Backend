// backend/api/create-checkout-session.js
import Stripe from "stripe";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const allowedOrigin = "https://vkt5451.github.io";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { items, customer_email } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "No items provided" });
  }

  try {
    // Generate a unique temporary order ID for metadata
    const orderId = `order_${Date.now()}`;

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: items.map(item => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      success_url: "https://vkt5451.github.io/Main-Street-2026/",
      cancel_url: "https://vkt5451.github.io/Main-Street-2026/menu-page.html",
      metadata: {
        order_id: orderId,
        customer_email: customer_email || "",
        total_amount: totalAmount.toString(),
        items: JSON.stringify(items), // so webhook knows what was ordered
      },
    });

    // NO global.orders needed — remove pending storage

    res.status(200).json({ url: session.url, orderId });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message || "Stripe checkout failed" });
  }
}
