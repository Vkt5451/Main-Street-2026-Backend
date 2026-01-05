// backend/api/create-checkout-session.js
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid"; // for generating unique order IDs

export const config = {
  api: {
    bodyParser: true, // ensures JSON is parsed correctly on Vercel
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // ✅ Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Log for debugging
  console.log("Request body:", req.body);
  console.log("Stripe key exists:", !!process.env.STRIPE_SECRET_KEY);

  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "No items provided" });
  }

  // Generate a unique order ID
  const orderId = uuidv4();

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: items.map(item => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100), // convert dollars → cents
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      metadata: {
        order_id: orderId, // attach unique order ID to Stripe
      },
      success_url: "https://vkt5451.github.io/Main-Street-2026/",
      cancel_url: "https://vkt5451.github.io/Main-Street-2026/menu-page.html",
    });

    console.log("Created order:", orderId);
    res.status(200).json({ url: session.url, orderId });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message || "Stripe checkout failed" });
  }
}
