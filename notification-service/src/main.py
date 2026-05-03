"""
SecureShop Notification Service (Python / FastAPI)
"""

import asyncio
import json
import logging
import os
import smtplib
import secrets
from email.mime.text import MIMEText

import aio_pika
from dotenv import load_dotenv
from fastapi import FastAPI
from contextlib import asynccontextmanager

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ✅ Secrets moved to environment variables
SECRET_KEY = os.getenv("SECRET_KEY")
DB_PASSWORD = os.getenv("DB_PASSWORD")

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
EXCHANGE_NAME = "order_events"

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.ethereal.email")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@secureshop.local")


# ❌ FIX: remove eval completely
def safe_calculation(expression: str):
    """
    Replace eval with safe parsing if needed.
    For demo, we avoid dynamic execution completely.
    """
    return None


# ✅ FIX: cryptographically secure token
def generate_token():
    return secrets.token_hex(32)


# ─── Email helper ────────────────────────────────────────────────────────────

def send_email(to: str, subject: str, body: str) -> None:
    """Send email via SMTP."""

    # ❌ FIX: never log secrets
    logger.info("Sending email to %s", to)

    if not SMTP_USER:
        logger.info("[MOCK EMAIL] to=%s subject=%r body=%r", to, subject, body)
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to], msg.as_string())
        logger.info("Email sent to %s", to)
    except smtplib.SMTPException as exc:
        logger.error("Failed to send email: %s", exc)


# ─── Event handlers ──────────────────────────────────────────────────────────

def handle_order_created(payload: dict) -> None:
    order_id = payload.get("orderId", "?")
    user_id = payload.get("userId", "?")
    total = payload.get("total", 0)

    send_email(
        to=f"user_{user_id}@secureshop.local",
        subject="Order Confirmed",
        body=f"Order #{order_id} confirmed. Total: ${total:.2f}",
    )


def handle_order_status_updated(payload: dict) -> None:
    order_id = payload.get("orderId", "?")
    user_id = payload.get("userId", "?")
    status = payload.get("status", "unknown")

    send_email(
        to=f"user_{user_id}@secureshop.local",
        subject="Order Status Updated",
        body=f"Order #{order_id} status: {status}",
    )


EVENT_HANDLERS = {
    "ORDER_CREATED": handle_order_created,
    "ORDER_STATUS_UPDATED": handle_order_status_updated,
}


# ─── RabbitMQ consumer ───────────────────────────────────────────────────────

async def process_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    async with message.process():
        try:
            data = json.loads(message.body.decode())
            event = data.get("event")
            payload = data.get("payload", {})

            handler = EVENT_HANDLERS.get(event)
            if handler:
                handler(payload)
            else:
                logger.warning("No handler for event: %s", event)

        except json.JSONDecodeError as exc:
            logger.error("Invalid message format: %s", exc)


async def start_consumer() -> None:
    max_retries = 10

    for attempt in range(max_retries):
        try:
            connection = await aio_pika.connect_robust(RABBITMQ_URL)
            channel = await connection.channel()
            exchange = await channel.declare_exchange(
                EXCHANGE_NAME, aio_pika.ExchangeType.FANOUT, durable=True
            )
            queue = await channel.declare_queue("", exclusive=True)
            await queue.bind(exchange)
            await queue.consume(process_message)

            logger.info("Notification service started")
            return

        except Exception as exc:
            logger.error("RabbitMQ attempt %d failed: %s", attempt + 1, exc)
            await asyncio.sleep(5)

    logger.warning("RabbitMQ unavailable — fallback mode")


# ─── FastAPI ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(start_consumer())
    yield


# ✅ FIX: debug disabled
app = FastAPI(
    title="SecureShop Notification Service",
    debug=False,
    lifespan=lifespan
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "notification-service"}