import webpush from 'web-push';
import type { Notification } from '../src/shared/digest.js';
import { getDb } from './db.js';

/** Push só funciona com o par de chaves VAPID (gere com `npm run vapid`). */
export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;

function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:sisifo@example.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Envia uma notificação. Devolve false se o aparelho cancelou a inscrição
 * (404/410): aí a inscrição é apagada do banco.
 */
export async function sendPush(sub: StoredSubscription, notification: Notification): Promise<boolean> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(notification),
      { TTL: 6 * 60 * 60, urgency: 'normal' },
    );
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await getDb().pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
      return false;
    }
    throw error;
  }
}
