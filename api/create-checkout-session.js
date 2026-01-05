export default async function handler(req, res) {
  // CORS headers
  const allowedOrigin = "https://vkt5451.github.io";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") return res.status(200).end();

  // Only POST
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Parse JSON body
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (err) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { items, customer_email, total_amount } = body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "No items provided" });
  }

  try {
    // Create Stripe session
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
      metadata: {
        items: JSON.stringify(items),      // so webhook can read
        customer_email: customer_email,
        total_amount: total_amount,
      },
      success_url: "https://vkt5451.github.io/Main-Street-2026/",
      cancel_url: "https://vkt5451.github.io/Main-Street-2026/menu-page.html",
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message || "Stripe checkout failed" });
  }
}
