import type { Bot } from 'grammy';

import { ApiClientError, confirmBoostPayment, getBoostStatus } from '../api-client/client.js';

export function registerPaymentHandlers(bot: Bot) {
  bot.on('pre_checkout_query', async (context) => {
    const payload = context.preCheckoutQuery.invoice_payload;
    try {
      const boost = await getBoostStatus(payload);
      if (boost.status !== 'pending') {
        await context.answerPreCheckoutQuery(false, 'Boost is no longer available');
        return;
      }
      if (context.preCheckoutQuery.total_amount !== boost.starsAmount) {
        await context.answerPreCheckoutQuery(false, 'Price mismatch');
        return;
      }
      await context.answerPreCheckoutQuery(true);
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : 'Payment validation failed';
      await context.answerPreCheckoutQuery(false, message);
    }
  });

  bot.on('message:successful_payment', async (context) => {
    const payment = context.message.successful_payment;
    if (!payment) {
      return;
    }

    try {
      await confirmBoostPayment({
        boostId: payment.invoice_payload,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        totalAmount: payment.total_amount,
      });
      await context.reply('Boost активирован — событие поднялось в выдаче.');
    } catch (error) {
      console.error('Boost confirmation failed', error);
      await context.reply('Оплата прошла, но активация задерживается — напиши в поддержку.');
    }
  });
}
