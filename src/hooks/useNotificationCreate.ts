import { supabase } from '@/integrations/supabase/client';

interface NotificationData {
  userId: string;
  type: 'forum_reply' | 'forum_mention' | 'trade_update' | 'follow' | 'review_reply' | 'system' | 'like' | 'comment';
  title: string;
  body?: string;
  link?: string;
  referenceType?: 'forum_post' | 'forum_reply' | 'trade_proposal' | 'profile' | 'review' | 'comment' | 'anuncio';
  referenceId?: string;
}

export async function createNotification(data: NotificationData): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: data.userId,
      type: data.type,
      title: data.title,
      body: data.body || null,
      link: data.link || null,
      reference_type: data.referenceType || null,
      reference_id: data.referenceId || null,
      is_read: false,
    });
    if (error) {
      console.error('Erro ao criar notificação:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return false;
  }
}

export function useNotificationCreate() {
  return { createNotification };
}