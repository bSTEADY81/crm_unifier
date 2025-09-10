import { ConversationModel } from '../../models/conversation.js';
import { MessageModel } from '../../models/message.js';
import { 
  NormalizedMessage, 
  ThreadingContext,
  ChannelType,
  IngestionError 
} from './types.js';

export interface ThreadingOptions {
  createNewConversation?: boolean;
  maxConversationAge?: number; // hours
  maxMessageGap?: number; // minutes
  preferExistingThreads?: boolean;
}

export interface ConversationMatch {
  conversationId: string;
  confidence: number;
  reason: string;
  messageCount: number;
  lastMessageAt: Date;
}

export class ConversationGrouper {
  private static defaultOptions: Required<ThreadingOptions> = {
    createNewConversation: true,
    maxConversationAge: 7 * 24, // 7 days
    maxMessageGap: 4 * 60, // 4 hours
    preferExistingThreads: true
  };

  static async groupIntoConversation(
    normalizedMessage: NormalizedMessage,
    customerId: string,
    options: ThreadingOptions = {}
  ): Promise<ThreadingContext> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // First, try to find an existing conversation based on thread key
      const existingConversation = await this.findConversationByThreadKey(
        normalizedMessage.threadKey!,
        customerId
      );

      if (existingConversation) {
        return {
          threadKey: normalizedMessage.threadKey!,
          conversationId: existingConversation.id,
          isNewConversation: false,
          relatedMessages: await this.getRelatedMessageIds(existingConversation.id)
        };
      }

      // If no exact thread match, try to find similar conversations
      if (opts.preferExistingThreads) {
        const similarConversations = await this.findSimilarConversations(
          normalizedMessage,
          customerId,
          opts
        );

        const bestMatch = this.selectBestConversationMatch(similarConversations, opts);
        
        if (bestMatch) {
          return {
            threadKey: normalizedMessage.threadKey!,
            conversationId: bestMatch.conversationId,
            isNewConversation: false,
            relatedMessages: await this.getRelatedMessageIds(bestMatch.conversationId)
          };
        }
      }

      // Create new conversation if no suitable match found
      if (opts.createNewConversation) {
        const newConversation = await this.createNewConversation(
          normalizedMessage,
          customerId
        );

        return {
          threadKey: normalizedMessage.threadKey!,
          conversationId: newConversation.id,
          isNewConversation: true,
          relatedMessages: []
        };
      }

      // Return context without conversation if creation disabled
      return {
        threadKey: normalizedMessage.threadKey!,
        isNewConversation: false,
        relatedMessages: []
      };
    } catch (error) {
      throw new IngestionError(
        'THREADING_FAILED',
        `Failed to group message into conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        normalizedMessage.providerId,
        normalizedMessage.providerMessageId,
        { error, customerId, threadKey: normalizedMessage.threadKey }
      );
    }
  }

  static generateThreadKey(
    channel: ChannelType,
    fromIdentifier: string,
    toIdentifier: string,
    additionalContext?: string
  ): string {
    switch (channel) {
      case 'sms':
      case 'whatsapp':
        // For phone-based channels, create bidirectional thread key
        const phoneNumbers = [fromIdentifier, toIdentifier].sort();
        return `${channel}:${phoneNumbers[0]}:${phoneNumbers[1]}`;
        
      case 'email':
        // For email, use additional context (like Gmail thread ID) if available
        if (additionalContext) {
          return `email:${additionalContext}`;
        }
        // Fallback to bidirectional email thread key
        const emails = [fromIdentifier, toIdentifier].sort();
        return `email:${emails[0]}:${emails[1]}`;
        
      case 'facebook':
      case 'instagram':
        // Social media typically has conversation IDs
        if (additionalContext) {
          return `${channel}:${additionalContext}`;
        }
        const socialHandles = [fromIdentifier, toIdentifier].sort();
        return `${channel}:${socialHandles[0]}:${socialHandles[1]}`;
        
      case 'voice':
        // Voice calls are typically short-lived, group by phone numbers
        const voiceNumbers = [fromIdentifier, toIdentifier].sort();
        return `voice:${voiceNumbers[0]}:${voiceNumbers[1]}`;
        
      default:
        const identifiers = [fromIdentifier, toIdentifier].sort();
        return `${channel}:${identifiers[0]}:${identifiers[1]}`;
    }
  }

  private static async findConversationByThreadKey(
    threadKey: string,
    customerId: string
  ) {
    const conversations = await ConversationModel.list({
      customerId,
      threadKey,
      limit: 1
    });

    return conversations.data.length > 0 ? conversations.data[0] : null;
  }

  private static async findSimilarConversations(
    message: NormalizedMessage,
    customerId: string,
    options: Required<ThreadingOptions>
  ): Promise<ConversationMatch[]> {
    const cutoffTime = new Date(Date.now() - (options.maxConversationAge * 60 * 60 * 1000));
    
    // Find recent conversations for this customer on the same channel
    const recentConversations = await ConversationModel.list({
      customerId,
      channel: message.channel,
      status: 'active',
      from: cutoffTime,
      limit: 20
    });

    const matches: ConversationMatch[] = [];

    for (const conversation of recentConversations.data) {
      const match = await this.evaluateConversationMatch(
        conversation,
        message,
        options
      );
      
      if (match) {
        matches.push(match);
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  private static async evaluateConversationMatch(
    conversation: any,
    message: NormalizedMessage,
    options: Required<ThreadingOptions>
  ): Promise<ConversationMatch | null> {
    // Check if conversation is too old
    const conversationAge = Date.now() - new Date(conversation.lastMessageAt || conversation.createdAt).getTime();
    const maxAgeMs = options.maxConversationAge * 60 * 60 * 1000;
    
    if (conversationAge > maxAgeMs) {
      return null;
    }

    // Check message gap
    const messageGap = Date.now() - new Date(conversation.lastMessageAt || conversation.createdAt).getTime();
    const maxGapMs = options.maxMessageGap * 60 * 1000;
    
    let confidence = 0.5; // Base confidence
    let reason = 'Similar conversation found';

    // Boost confidence if recent activity
    if (messageGap < maxGapMs) {
      confidence += 0.3;
      reason = 'Recent activity in conversation';
    }

    // Boost confidence for exact channel match (already filtered)
    confidence += 0.2;

    // Get message count for additional context
    const messageCount = await MessageModel.list({
      conversationId: conversation.id,
      limit: 1
    });

    return {
      conversationId: conversation.id,
      confidence,
      reason,
      messageCount: messageCount.pagination.total,
      lastMessageAt: new Date(conversation.lastMessageAt || conversation.createdAt)
    };
  }

  private static selectBestConversationMatch(
    matches: ConversationMatch[],
    options: Required<ThreadingOptions>
  ): ConversationMatch | null {
    if (matches.length === 0) return null;

    // Return the highest confidence match if it's above threshold
    const bestMatch = matches[0];
    return bestMatch.confidence > 0.6 ? bestMatch : null;
  }

  private static async createNewConversation(
    message: NormalizedMessage,
    customerId: string
  ) {
    const conversationData = {
      threadKey: message.threadKey!,
      customerId,
      channel: message.channel,
      tags: this.generateInitialTags(message),
      lastMessageAt: message.timestamp
    };

    return await ConversationModel.create(conversationData);
  }

  private static generateInitialTags(message: NormalizedMessage): string[] {
    const tags: string[] = [];

    // Add channel-specific tags
    tags.push(`channel:${message.channel}`);
    
    // Add direction tag
    tags.push(`direction:${message.direction}`);
    
    // Add content type tag if not text
    if (message.contentType && message.contentType !== 'text') {
      tags.push(`content:${message.contentType}`);
    }

    // Add provider tag
    tags.push(`provider:${message.providerMeta.originalPayload ? 
      Object.keys(message.providerMeta.originalPayload)[0] : 'unknown'}`);

    // Add time-based tag
    const hour = message.timestamp.getHours();
    if (hour >= 9 && hour <= 17) {
      tags.push('time:business_hours');
    } else {
      tags.push('time:after_hours');
    }

    return tags;
  }

  private static async getRelatedMessageIds(conversationId: string): Promise<string[]> {
    const messages = await MessageModel.list({
      conversationId,
      limit: 100
    });

    return messages.data.map(msg => msg.id);
  }

  static async updateConversationActivity(
    conversationId: string,
    messageTimestamp: Date,
    additionalTags?: string[]
  ): Promise<void> {
    try {
      const updateData: any = {
        lastMessageAt: messageTimestamp
      };

      // Add new tags if provided
      if (additionalTags && additionalTags.length > 0) {
        const conversation = await ConversationModel.findById(conversationId);
        if (conversation) {
          const existingTags = conversation.tags || [];
          const newTags = [...new Set([...existingTags, ...additionalTags])];
          updateData.tags = newTags;
        }
      }

      await ConversationModel.update(conversationId, updateData);
    } catch (error) {
      // Log error but don't throw - conversation activity update is not critical
      console.error('Failed to update conversation activity:', error);
    }
  }

  static async archiveInactiveConversations(
    maxInactiveHours: number = 7 * 24 // 7 days
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - (maxInactiveHours * 60 * 60 * 1000));
    
    const inactiveConversations = await ConversationModel.list({
      status: 'active',
      to: cutoffTime,
      limit: 100
    });

    let archivedCount = 0;
    for (const conversation of inactiveConversations.data) {
      try {
        await ConversationModel.update(conversation.id, { status: 'archived' });
        archivedCount++;
      } catch (error) {
        console.error(`Failed to archive conversation ${conversation.id}:`, error);
      }
    }

    return archivedCount;
  }

  static generateContextualThreadKey(
    baseThreadKey: string,
    contextData: {
      subject?: string;
      replyToMessageId?: string;
      conversationId?: string;
    }
  ): string {
    let contextualKey = baseThreadKey;

    // Add context for email subjects
    if (contextData.subject) {
      const subjectHash = require('crypto')
        .createHash('md5')
        .update(contextData.subject.toLowerCase().replace(/^(re:|fwd?:)\s*/i, ''))
        .digest('hex')
        .substring(0, 8);
      contextualKey += `:subj:${subjectHash}`;
    }

    // Add context for reply chains
    if (contextData.replyToMessageId) {
      contextualKey += `:reply:${contextData.replyToMessageId}`;
    }

    // Add context for existing conversation IDs
    if (contextData.conversationId) {
      contextualKey += `:conv:${contextData.conversationId}`;
    }

    return contextualKey;
  }
}

export default ConversationGrouper;