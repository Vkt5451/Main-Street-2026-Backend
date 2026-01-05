// server.js
import express from 'express'
import bodyParser from 'body-parser'
import Stripe from 'stripe'
import { supabase } from './db.js'

const app = express()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

// Stripe requires raw body to validate webhook
app.use(
  '/webhook',
  bodyParser.raw({ type: 'application/json' })
)

app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
  } catch (err) {
    console.log('⚠️ Webhook signature verification failed.', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Only handle successful payments
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object
    const orderId = paymentIntent.metadata.order_id

    console.log(`✅ Payment of ${paymentIntent.amount} succeeded for order ID: ${orderId}`)

    // Update order in Supabase
    const { error } = await supabase
      .from('orders')
      .update({ order_status: 'Paid' })
      .eq('id', orderId)

    if (error) console.error('Failed to update order in Supabase', error)
  }

  res.json({ received: true })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
okay