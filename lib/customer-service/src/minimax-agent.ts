import Anthropic from '@anthropic-ai/sdk';
import type { CustomerMessage, AgentResponse } from './types.js';
import { getConfig } from './config.js';

export interface AgentOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful customer service representative for a social media content creation company.

Your goals:
1. Provide accurate, helpful responses to customer inquiries
2. Be friendly and professional
3. Keep responses concise and actionable
4. Direct customers to appropriate resources when needed

Guidelines:
- Never make up information about products, services, or policies
- If you're unsure, say so honestly and offer to escalate
- For complex issues, suggest contacting human support
- Be patient and understanding with frustrated customers
- Focus on resolving the customer's primary concern
- Never share internal company information or other customers' data`;

export class MiniMaxAgent {
  private client: Anthropic;
  private systemPrompt: string;
  private maxTokens: number;
  private temperature: number;

  constructor(options: AgentOptions = {}) {
    const cfg = getConfig();

    this.client = new Anthropic({
      baseURL: cfg.ANTHROPIC_BASE_URL,
      apiKey: cfg.ANTHROPIC_TOKEN_KEY,
    });

    this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.maxTokens = options.maxTokens || 1024;
    this.temperature = options.temperature ?? 0.7;
  }

  async respond(
    customerMessage: CustomerMessage,
    context: { relevantKnowledge?: string; conversationHistory?: string[] }
  ): Promise<AgentResponse> {
    const { relevantKnowledge, conversationHistory = [] } = context;

    let contextSection = '';
    if (relevantKnowledge) {
      contextSection = `\n\nRelevant knowledge base information:\n${relevantKnowledge}`;
    }

    let historySection = '';
    if (conversationHistory.length > 0) {
      historySection = `\n\nRecent conversation:\n${conversationHistory.map((m) => `Customer: ${m}`).join('\n')}`;
    }

    const userMessage = `New customer message (${customerMessage.type}):\n"${customerMessage.content}"${historySection}${contextSection}

Provide a helpful response to this customer message.`;

    try {
      const response = await this.client.messages.create({
        model: 'MiniMax-M2.7',
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return {
          messageId: customerMessage.id,
          content: "I'm sorry, I had trouble generating a response.",
          confidence: 0,
          shouldRespond: false,
        };
      }

      // Simple confidence estimation based on response characteristics
      const text = content.text;
      const confidence = this.estimateConfidence(text);

      return {
        messageId: customerMessage.id,
        content: text,
        confidence,
        shouldRespond: confidence >= getConfig().CONFIDENCE_THRESHOLD,
        suggestedActions: this.extractActions(text),
      };
    } catch (error) {
      console.error('[MiniMaxAgent] Error generating response:', error);
      return {
        messageId: customerMessage.id,
        content: "I'm sorry, I'm having trouble responding right now. Please try again later.",
        confidence: 0,
        shouldRespond: false,
      };
    }
  }

  private estimateConfidence(response: string): number {
    // Simple heuristics for confidence
    let score = 0.5;

    // Longer, more detailed responses tend to be more confident
    if (response.length > 100) score += 0.1;
    if (response.length > 300) score += 0.1;

    // If it contains uncertainty phrases, lower confidence
    const uncertainPhrases = [
      "i'm not sure",
      "i don't know",
      "perhaps",
      "might be",
      "could be",
      "unclear",
    ];
    for (const phrase of uncertainPhrases) {
      if (response.toLowerCase().includes(phrase)) {
        score -= 0.15;
      }
    }

    // If it contains action items, higher confidence
    const actionPhrases = [
      "i'll help",
      "let me",
      "you should",
      "here's what",
      "to resolve",
    ];
    for (const phrase of actionPhrases) {
      if (response.toLowerCase().includes(phrase)) {
        score += 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private extractActions(response: string): string[] {
    const actions: string[] = [];

    // Extract mentioned next steps
    const actionPatterns = [
      /(?:please|kindly)\s+([^\.]+)/gi,
      /(?:i'll|i will)\s+([^\.]+)/gi,
      /(?:you can|you should)\s+([^\.]+)/gi,
    ];

    for (const pattern of actionPatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        actions.push(match[0].trim());
      }
    }

    return [...new Set(actions)].slice(0, 3);
  }
}