/**
 * Expo Push delivery.
 */
import type { NotificationAction, NotificationCandidate } from './types';

export type PushResult = {
  ok: boolean;
  ticketId?: string;
  error?: string;
};

export async function sendExpoPush(opts: {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  accessToken?: string;
}): Promise<PushResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (opts.accessToken) {
    headers.Authorization = `Bearer ${opts.accessToken}`;
  }

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: opts.token,
      title: opts.title,
      body: opts.body,
      sound: 'default',
      priority: 'high',
      channelId: 'smart_coach',
      data: opts.data,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: { status?: string; id?: string; message?: string };
    errors?: Array<{ message?: string }>;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: json.errors?.[0]?.message || `HTTP ${res.status}`,
    };
  }

  const ticket = json.data;
  if (ticket?.status === 'error') {
    return { ok: false, error: ticket.message || 'Expo push ticket error' };
  }

  return { ok: true, ticketId: ticket?.id };
}

export function pushDataForCandidate(
  candidate: NotificationCandidate,
  historyId: string
): Record<string, string> {
  return {
    type: 'smart_notification',
    category: candidate.type,
    action: candidate.action,
    screen: screenForAction(candidate.action),
    historyId,
    candidateId: candidate.id,
  };
}

function screenForAction(action: NotificationAction): string {
  switch (action) {
    case 'start_workout':
    case 'adjust_schedule':
      return 'fitness';
    case 'log_food':
      return 'fitness_log_food';
    case 'view_progress':
      return 'progress';
    case 'view_recovery':
      return 'health';
    default:
      return 'dashboard';
  }
}
