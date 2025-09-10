export { BaseNormalizer } from './base.js';
export { TwilioSMSNormalizer } from './twilio-sms.js';
export { WhatsAppNormalizer } from './whatsapp.js';
export { GmailNormalizer } from './gmail.js';

import { BaseNormalizer } from './base.js';
import { TwilioSMSNormalizer } from './twilio-sms.js';
import { WhatsAppNormalizer } from './whatsapp.js';
import { GmailNormalizer } from './gmail.js';
import { ChannelType, IngestionError } from '../types.js';

export interface NormalizerRegistry {
  twilio_sms: TwilioSMSNormalizer;
  whatsapp: WhatsAppNormalizer;
  gmail: GmailNormalizer;
}

export class NormalizerFactory {
  private static registry: Partial<NormalizerRegistry> = {};

  static initialize(): void {
    this.registry = {
      twilio_sms: new TwilioSMSNormalizer(),
      whatsapp: new WhatsAppNormalizer(),
      gmail: new GmailNormalizer()
    };
  }

  static getNormalizer(providerType: string): BaseNormalizer {
    if (!this.registry[providerType as keyof NormalizerRegistry]) {
      throw new IngestionError(
        'PROVIDER_NOT_SUPPORTED',
        `No normalizer found for provider type: ${providerType}`,
        'unknown',
        undefined,
        { providerType }
      );
    }

    return this.registry[providerType as keyof NormalizerRegistry]!;
  }

  static getSupportedProviders(): string[] {
    return Object.keys(this.registry);
  }

  static isProviderSupported(providerType: string): boolean {
    return providerType in this.registry;
  }

  static getChannelForProvider(providerType: string): ChannelType | null {
    const normalizer = this.registry[providerType as keyof NormalizerRegistry];
    return normalizer ? normalizer['config'].channelType : null;
  }
}

// Auto-initialize the factory
NormalizerFactory.initialize();