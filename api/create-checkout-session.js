import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "No items provided" });
  }

  try {
            const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: items.map(item => ({
                price_data: {
                currency: "usd",
                product_data: { name: item.name },
                unit_amount: Math.round(item.price * 100), // make sure price is a number
                },
                quantity: item.quantity,
            })),
            mode: "payment",
            success_url: "https://vkt5451.github.io/Main-Street-2026/",
            cancel_url: "https://vkt5451.github.io/Main-Street-2026/menu-page.html",
            });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Stripe checkout failed" });
  }
}


      