export interface NotificationEmailDelivery {
  status?: 'sent' | 'failed' | 'skipped';
  providerMessageId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
export interface NotificationDispatch {
  userId?: string;
  broadcast?: boolean;
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  image?: string;
  tag?: string;
  notificationType?: 'radio' | 'podcast' | 'event' | 'blog' | 'system' | 'ticket';
  actionSection?: string;
  actionId?: string;
  dedupeKey?: string;
  persist?: boolean;
  emailDelivery?: NotificationEmailDelivery;
}

export interface NotificationDispatchResult {
  notificationId?: string;
  sent: number;
  failed?: number;
  duplicate?: boolean;
}

export async function dispatchNotification(
  body: NotificationDispatch,
): Promise<NotificationDispatchResult> {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({})) as NotificationDispatchResult & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Notification dispatch error ${response.status}`);
  }
  return data;
}
