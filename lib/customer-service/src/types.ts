export interface CustomerMessage {
  id: string;
  type: 'comment' | 'dm';
  authorId: string;
  authorUsername: string;
  content: string;
  timestamp: Date;
  parentId?: string; // for threaded comments
}

export interface AgentResponse {
  messageId: string;
  content: string;
  confidence: number;
  shouldRespond: boolean;
  suggestedActions?: string[];
}

export interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: 'faq' | 'policy' | 'product' | 'troubleshooting';
  metadata?: Record<string, string>;
  embedding?: number[];
}

export interface VectorSearchResult {
  entry: KnowledgeEntry;
  score: number;
}

export interface AutomationConfig {
  autoRespond: boolean;
  confidenceThreshold: number;
  maxResponsesPerHour: number;
  ignoredKeywords: string[];
  responseDelayMs: number;
}

export interface TikTokComment {
  comment_id: string;
  text: string;
  user_id: string;
  username: string;
  create_time: number;
  parent_comment_id?: string;
}

export interface TikTokDM {
  dm_id: string;
  text: string;
  sender_id: string;
  receiver_id: string;
  create_time: number;
  is_from_me: boolean;
}