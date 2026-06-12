# Security

## Auth

- Telegram Mini App `initData` validated with HMAC-SHA256 (`@telegram-apps/init-data-node`).
- Access JWT (15 min) + Redis-backed refresh token (30 d).
- Default-deny: all routes require `@UseGuards(JwtAuthGuard)` unless `@Public()`.

## Service-to-service

- Bot → API internal routes use `Authorization: Bearer $SERVICE_JWT_SECRET`.
- Routes return 503 when secret unset (fail closed for squad link / boost confirm).

## Check-in fraud

See `docs/FRAUD_DETECTION.md` (phase 4). GPS dwell + rotating QR + distance checks.

## Payments

- Telegram Stars: idempotent `telegram_payment_charge_id` on boost activation.
- Bot validates `pre_checkout_query` against pending boost via API before approving.

## Secrets

- Never commit `.env`. Production: Doppler/Infisical.
- Rotate `JWT_*`, `CHECKIN_QR_SECRET`, `SERVICE_JWT_SECRET` on compromise.

## Headers (production)

- TLS everywhere (Cloudflare / reverse proxy).
- CORS locked to `API_CORS_ORIGINS`.
- Rate limit: `RATE_LIMIT_DEFAULT_PER_MIN` (middleware phase 10+).
