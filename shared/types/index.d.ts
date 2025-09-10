export type ChannelType = 'sms' | 'email' | 'voice' | 'whatsapp' | 'facebook' | 'instagram';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'received' | 'processed' | 'failed';
export type ConversationStatus = 'active' | 'archived' | 'assigned';
export type ProviderType = 'twilio_sms' | 'gmail' | 'twilio_voice' | 'whatsapp' | 'facebook' | 'instagram';
export type ProviderStatus = 'active' | 'inactive' | 'error';
export type UserRole = 'admin' | 'staff' | 'viewer';
export type IdentityType = 'phone' | 'email' | 'social';
export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Customer extends BaseEntity {
    name: string;
    displayName: string | null;
    metadata: Record<string, any>;
    identities: Identity[];
}
export interface Identity extends BaseEntity {
    customerId: string;
    type: IdentityType;
    value: string;
    rawValue: string;
    provider: string | null;
    verified: boolean;
    linkedAt: Date;
}
export interface Message extends BaseEntity {
    providerMessageId: string;
    providerId: string;
    customerId: string | null;
    conversationId: string | null;
    channel: ChannelType;
    direction: MessageDirection;
    fromIdentifier: string;
    toIdentifier: string;
    threadKey: string | null;
    timestamp: Date;
    body: string | null;
    attachments: Attachment[];
    providerMeta: Record<string, any>;
    status: MessageStatus;
}
export interface Attachment extends BaseEntity {
    messageId: string;
    type: string;
    filename: string | null;
    size: number | null;
    storageUrl: string;
    thumbnailUrl: string | null;
    metadata: Record<string, any>;
}
export interface Conversation extends BaseEntity {
    threadKey: string;
    customerId: string;
    channel: ChannelType;
    lastMessageAt: Date | null;
    tags: string[];
    status: ConversationStatus;
    assignment: ConversationAssignment | null;
}
export interface ConversationAssignment extends BaseEntity {
    conversationId: string;
    userId: string;
    assignedAt: Date;
    assignedBy: string;
    notes: string | null;
}
export interface Provider extends BaseEntity {
    name: string;
    type: ProviderType;
    config: Record<string, any>;
    status: ProviderStatus;
    lastHealthCheck: Date | null;
    errorMessage: string | null;
}
export interface Webhook extends BaseEntity {
    providerId: string;
    endpointUrl: string;
    secret: string | null;
    events: string[];
    status: 'active' | 'inactive';
    lastReceived: Date | null;
}
export interface User extends BaseEntity {
    email: string;
    name: string;
    role: UserRole;
    metadata: Record<string, any>;
    lastLogin: Date | null;
}
export interface AuditEvent extends BaseEntity {
    timestamp: Date;
    userId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    metadata: Record<string, any>;
    ipAddress: string | null;
    userAgent: string | null;
}
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}
export interface ApiError {
    error: string;
    message: string;
    details?: Record<string, any>;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    token: string;
    user: User;
}
export interface CreateCustomerRequest {
    name: string;
    displayName?: string;
    metadata?: Record<string, any>;
}
export interface LinkIdentityRequest {
    type: IdentityType;
    value: string;
    provider?: string;
}
export interface AssignConversationRequest {
    userId: string;
    notes?: string;
}
export interface ConfigureProviderRequest {
    name: string;
    type: ProviderType;
    config: Record<string, any>;
}
export interface TwilioWebhookPayload {
    MessageSid: string;
    Body: string;
    From: string;
    To: string;
    MessageStatus: string;
    NumMedia: string;
    [key: string]: string;
}
export interface GmailWebhookPayload {
    message: {
        data: string;
        messageId: string;
    };
    subscription: string;
}
export interface WhatsAppWebhookPayload {
    object: string;
    entry: Array<{
        id: string;
        changes: Array<{
            value: {
                messaging_product: string;
                metadata: Record<string, any>;
                contacts?: Array<any>;
                messages?: Array<any>;
                statuses?: Array<any>;
            };
        }>;
    }>;
}
//# sourceMappingURL=index.d.ts.map