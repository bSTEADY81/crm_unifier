import { BaseProviderAdapter, ProviderConfig } from './types';
import { WhatsAppAdapter } from './WhatsAppAdapter';
import { TwilioAdapter } from './TwilioAdapter';

export class ProviderFactory {
  private static adapters: Map<string, BaseProviderAdapter> = new Map();

  static createAdapter(providerId: string, config: ProviderConfig): BaseProviderAdapter {
    let adapter: BaseProviderAdapter;

    switch (config.type) {
      case 'whatsapp':
        adapter = new WhatsAppAdapter(providerId, config);
        break;
      
      case 'twilio':
        adapter = new TwilioAdapter(providerId, config);
        break;
      
      case 'facebook':
        // adapter = new FacebookAdapter(providerId, config);
        throw new Error('Facebook Messenger adapter not yet implemented');
      
      case 'instagram':
        // adapter = new InstagramAdapter(providerId, config);
        throw new Error('Instagram adapter not yet implemented');
      
      case 'gmail':
        // adapter = new GmailAdapter(providerId, config);
        throw new Error('Gmail adapter not yet implemented');
      
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }

    this.adapters.set(providerId, adapter);
    return adapter;
  }

  static getAdapter(providerId: string): BaseProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  static removeAdapter(providerId: string): void {
    this.adapters.delete(providerId);
  }

  static getAllAdapters(): BaseProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  static getSupportedProviders(): string[] {
    return ['whatsapp', 'twilio', 'facebook', 'instagram', 'gmail'];
  }
}

export class ProviderService {
  static async sendMessage(providerId: string, request: any) {
    const adapter = ProviderFactory.getAdapter(providerId);
    if (!adapter) {
      throw new Error(`Provider adapter not found for ID: ${providerId}`);
    }

    return await adapter.sendMessage(request);
  }

  static async processWebhook(providerId: string, payload: any) {
    const adapter = ProviderFactory.getAdapter(providerId);
    if (!adapter) {
      throw new Error(`Provider adapter not found for ID: ${providerId}`);
    }

    return await adapter.processWebhook(payload);
  }

  static async testConnection(providerId: string) {
    const adapter = ProviderFactory.getAdapter(providerId);
    if (!adapter) {
      throw new Error(`Provider adapter not found for ID: ${providerId}`);
    }

    return await adapter.testConnection();
  }

  static async getStatus(providerId: string) {
    const adapter = ProviderFactory.getAdapter(providerId);
    if (!adapter) {
      throw new Error(`Provider adapter not found for ID: ${providerId}`);
    }

    return await adapter.getStatus();
  }

  static validateWebhookSignature(providerId: string, payload: any): boolean {
    const adapter = ProviderFactory.getAdapter(providerId);
    if (!adapter) {
      return false;
    }

    return adapter.validateWebhookSignature(payload);
  }
}