import { getConfig } from '../config.js';
import type { TikTokComment, TikTokDM } from '../types.js';

// TikTok API client for comments and DMs
export class TikTokClient {
  private accessToken?: string;
  private appId: string;
  private clientKey: string;
  private clientSecret: string;

  constructor() {
    const cfg = getConfig();
    this.appId = cfg.TIKTOK_APP_ID;
    this.clientKey = cfg.TIKTOK_CLIENT_KEY;
    this.clientSecret = cfg.TIKTOK_CLIENT_SECRET;
  }

  async getAccessToken(): Promise<string> {
    // In production, this would use OAuth flow
    // For now, we'll use the app credentials directly
    return `dummy_access_token_${this.clientKey}`;
  }

  async getComments(videoId: string, maxResults: number = 20): Promise<TikTokComment[]> {
    // TikTok Comments API endpoint
    // POST /comment/list/ - Get comments for a video
    const endpoint = 'https://open.tiktokapis.com/v2/comment/list/';

    try {
      const response = await fetch(`${endpoint}?video_id=${videoId}&max_count=${maxResults}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken || await this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: videoId,
          max_count: maxResults,
        }),
      });

      if (!response.ok) {
        console.error('[TikTokClient] Failed to fetch comments:', response.statusText);
        return [];
      }

      const data = await response.json() as {
        comments?: Array<{
          comment_id: string;
          text: string;
          user: { user_id: string; username: string };
          create_time: number;
          parent_comment_id?: string;
        }>;
      };

      return (data.comments || []).map((c) => ({
        comment_id: c.comment_id,
        text: c.text,
        user_id: c.user.user_id,
        username: c.user.username,
        create_time: c.create_time,
        parent_comment_id: c.parent_comment_id,
      }));
    } catch (error) {
      console.error('[TikTokClient] Error fetching comments:', error);
      return [];
    }
  }

  async postComment(videoId: string, text: string, parentCommentId?: string): Promise<string | null> {
    const endpoint = 'https://open.tiktokapis.com/v2/comment/create/';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken || await this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: videoId,
          comment_text: text,
          parent_comment_id: parentCommentId || undefined,
        }),
      });

      if (!response.ok) {
        console.error('[TikTokClient] Failed to post comment:', response.statusText);
        return null;
      }

      const data = await response.json() as { comment_id: string };
      return data.comment_id;
    } catch (error) {
      console.error('[TikTokClient] Error posting comment:', error);
      return null;
    }
  }

  async replyToComment(commentId: string, text: string): Promise<string | null> {
    return this.postComment('', text, commentId);
  }

  async getDMs(maxResults: number = 20): Promise<TikTokDM[]> {
    const endpoint = 'https://open.tiktokapis.com/v2/im/messages/';

    try {
      const response = await fetch(`${endpoint}?max_count=${maxResults}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken || await this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_count: maxResults,
        }),
      });

      if (!response.ok) {
        console.error('[TikTokClient] Failed to fetch DMs:', response.statusText);
        return [];
      }

      const data = await response.json() as {
        messages?: Array<{
          im_msg_id: string;
          text: string;
          sender_id: { user_id: string };
          receiver_id: { user_id: string };
          create_time: number;
          msg_status: string;
        }>;
      };

      return (data.messages || []).map((m) => ({
        dm_id: m.im_msg_id,
        text: m.text,
        sender_id: m.sender_id.user_id,
        receiver_id: m.receiver_id.user_id,
        create_time: m.create_time,
        is_from_me: m.msg_status === '1', // Simplified
      }));
    } catch (error) {
      console.error('[TikTokClient] Error fetching DMs:', error);
      return [];
    }
  }

  async sendDM(userId: string, text: string): Promise<string | null> {
    const endpoint = 'https://open.tiktokapis.com/v2/im/messages/';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken || await this.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { user_id: userId },
          message_type: 'text',
          content: text,
        }),
      });

      if (!response.ok) {
        console.error('[TikTokClient] Failed to send DM:', response.statusText);
        return null;
      }

      const data = await response.json() as { message_id: string };
      return data.message_id;
    } catch (error) {
      console.error('[TikTokClient] Error sending DM:', error);
      return null;
    }
  }
}