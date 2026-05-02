'use strict';

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const amqp = require('amqplib');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8005;
const EXCHANGE = 'order_events';

app.use(express.json());
app.use(morgan('combined'));
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service' }));

// Nodemailer transporter (uses SMTP or Ethereal for dev)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

async function sendEmail(to, subject, text) {
  if (!process.env.SMTP_USER) {
    console.log(`[NOTIFICATION] Mock email to=${to} subject="${subject}" body="${text}"`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@secureshop.local', to, subject, text });
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

function handleEvent(event, payload) {
  switch (event) {
    case 'ORDER_CREATED':
      sendEmail(
        `user_${payload.userId}@secureshop.local`,
        'Order Confirmed',
        `Your order #${payload.orderId} has been placed. Total: $${payload.total}`
      );
      break;
    case 'ORDER_STATUS_UPDATED':
      sendEmail(
        `user_${payload.userId || 'unknown'}@secureshop.local`,
        'Order Status Updated',
        `Order #${payload.orderId} status changed to: ${payload.status}`
      );
      break;
    default:
      console.log(`Unknown event: ${event}`);
  }
}

async function startConsumer() {
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672');
      const channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE, 'fanout', { durable: true });
      const q = await channel.assertQueue('', { exclusive: true });
      await channel.bindQueue(q.queue, EXCHANGE, '');

      console.log('Notification service listening for order events...');
      channel.consume(q.queue, (msg) => {
        if (!msg) return;
        try {
          const { event, payload } = JSON.parse(msg.content.toString());
          handleEvent(event, payload);
        } catch (err) {
          console.error('Failed to process message:', err.message);
        }
        channel.ack(msg);
      });
      return;
    } catch (err) {
      console.error(`RabbitMQ connect attempt ${attempt} failed:`, err.message);
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 5000));
    }
  }
  console.warn('RabbitMQ unavailable — running in HTTP-only mode');
}

app.listen(PORT, () => {
  console.log(`Notification service running on port ${PORT}`);
  startConsumer();
});
