// API Response wrapper
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

// User types
export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'agent' | 'viewer'
  status: 'active' | 'inactive'
  avatar?: string
  preferences: {
    theme: 'light' | 'dark'
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
    timezone: string
  }
  createdAt: string
  updatedAt: string
}

// Customer types
export interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  location?: string
  status: 'active' | 'inactive' | 'pending'
  tags: string[]
  metadata: Record<string, any>
  lastContactAt?: string
  totalMessages: number
  assignedAgentId?: string
  createdAt: string
  updatedAt: string
}

// Message types
export interface Message {
  id: string
  customerId: string
  conversationId: string
  content: string
  contentType: 'text' | 'image' | 'file' | 'audio' | 'video'
  direction: 'inbound' | 'outbound'
  channel: 'whatsapp' | 'sms' | 'email' | 'messenger' | 'instagram'
  status: 'sent' | 'delivered' | 'read' | 'failed'
  metadata: {
    originalMessageId?: string
    threadId?: string
    attachments?: Array<{
      type: string
      url: string
      name: string
      size: number
    }>
    [key: string]: any
  }
  agentId?: string
  isFromAgent: boolean
  readAt?: string
  deliveredAt?: string
  sentAt: string
  createdAt: string
}

// Conversation types
export interface Conversation {
  id: string
  customerId: string
  channel: string
  status: 'open' | 'pending' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignedAgentId?: string
  lastMessageAt: string
  messageCount: number
  unreadCount: number
  tags: string[]
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Provider types
export interface Provider {
  id: string
  name: string
  type: 'whatsapp' | 'sms' | 'email' | 'messenger' | 'instagram' | 'custom'
  status: 'active' | 'inactive' | 'error' | 'pending'
  config: {
    apiKey?: string
    apiSecret?: string
    webhookUrl?: string
    phoneNumber?: string
    accountId?: string
    [key: string]: any
  }
  capabilities: {
    sendMessages: boolean
    receiveMessages: boolean
    supportAttachments: boolean
    supportReadReceipts: boolean
    supportTypingIndicators: boolean
  }
  rateLimits: {
    messagesPerMinute: number
    messagesPerHour: number
    messagesPerDay: number
  }
  health: {
    isConnected: boolean
    lastCheckAt: string
    errorMessage?: string
    uptime: number
  }
  statistics: {
    totalMessagesSent: number
    totalMessagesReceived: number
    totalMessagesToday: number
    averageResponseTime: number
  }
  createdAt: string
  updatedAt: string
}

// Webhook types
export interface WebhookEvent {
  id: string
  providerId: string
  eventType: string
  payload: Record<string, any>
  processed: boolean
  processingError?: string
  retryCount: number
  receivedAt: string
  processedAt?: string
}

// Analytics types
export interface DashboardStats {
  totalCustomers: number
  totalMessages: number
  activeProviders: number
  averageResponseTime: number
  messagesByChannel: Record<string, number>
  customersByStatus: Record<string, number>
  activityData: Array<{
    date: string
    messages: number
    customers: number
  }>
}

export interface MessageAnalytics {
  totalMessages: number
  messagesByDay: Array<{
    date: string
    count: number
  }>
  messagesByChannel: Record<string, number>
  averageResponseTime: number
  responseTimeByDay: Array<{
    date: string
    avgTime: number
  }>
}

// Filter and pagination types
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface CustomerFilters extends PaginationParams {
  search?: string
  status?: string
  tags?: string[]
  assignedAgentId?: string
}

export interface MessageFilters extends PaginationParams {
  customerId?: string
  conversationId?: string
  channel?: string
  search?: string
  startDate?: string
  endDate?: string
  status?: string
}

export interface ConversationFilters extends PaginationParams {
  status?: string
  priority?: string
  assignedAgentId?: string
  channel?: string
  tags?: string[]
}

// API request/response types
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  token: string
  refreshToken: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface SendMessageRequest {
  customerId: string
  content: string
  contentType?: string
  channel: string
  metadata?: Record<string, any>
}

export interface CreateCustomerRequest {
  name: string
  email: string
  phone?: string
  company?: string
  location?: string
  tags?: string[]
  metadata?: Record<string, any>
}

export interface UpdateCustomerRequest {
  name?: string
  email?: string
  phone?: string
  company?: string
  location?: string
  status?: string
  tags?: string[]
  metadata?: Record<string, any>
}

export interface CreateProviderRequest {
  name: string
  type: string
  config: Record<string, any>
}

export interface UpdateProviderRequest {
  name?: string
  config?: Record<string, any>
  status?: string
}

// Error types
export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

export interface ValidationError {
  field: string
  message: string
  value?: any
}

// Webhook payload types
export interface WhatsAppWebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts?: Array<{
          profile: {
            name: string
          }
          wa_id: string
        }>
        messages?: Array<{
          from: string
          id: string
          timestamp: string
          text?: {
            body: string
          }
          type: string
        }>
        statuses?: Array<{
          id: string
          status: string
          timestamp: string
          recipient_id: string
        }>
      }
      field: string
    }>
  }>
}

export interface TwilioWebhookPayload {
  MessageSid: string
  AccountSid: string
  From: string
  To: string
  Body: string
  MessageStatus: string
  SmsStatus: string
  NumMedia: string
  [key: string]: string
}