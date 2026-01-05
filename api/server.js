const express = require('express');
const bodyParser = require('body-parser');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();

// Stripe requires the raw body to validate the webhook signature
app.use(
  '/webhook',
  bodyParser.raw({ type: 'application/json' })
);

// Minimal webhook endpoint
app.post('/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'YOUR_WEBHOOK_SECRET'; // From Stripe dashboard

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log('⚠️ Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Only handle successful payments
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log(`✅ Payment of ${paymentIntent.amount} succeeded for order ID: ${paymentIntent.metadata.order_id}`);
    
    // TODO: Update your order in your database as "Paid"
    // Example: updateOrderStatus(paymentIntent.metadata.order_id, 'Paid');
  }

  // Always respond with 2xx to acknowledge receipt
  res.json({ received: true });
});

app.listen(3000, () => console.log('Server running on port 3000'));
