'use strict';

const amqp = require('amqplib');

let channel = null;
const EXCHANGE = 'order_events';

async function connectRabbitMQ() {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672');
    channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, 'fanout', { durable: true });
    console.log('RabbitMQ connected');
  } catch (err) {
    console.error('RabbitMQ connection failed (non-fatal):', err.message);
  }
}

async function publishOrderEvent(event, payload) {
  if (!channel) return;
  try {
    const msg = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    channel.publish(EXCHANGE, '', Buffer.from(msg), { persistent: true });
  } catch (err) {
    console.error('Failed to publish event:', err.message);
  }
}

module.exports = { connectRabbitMQ, publishOrderEvent };
