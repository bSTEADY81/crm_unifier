import { IdentityModel } from '../../models/identity.js';
import { CustomerModel } from '../../models/customer.js';
import { 
  NormalizedContact, 
  IdentityResolution,
  IngestionError
} from './types.js';

export interface MatchingOptions {
  fuzzyMatching?: boolean;
  confidenceThreshold?: number;
  createNewCustomer?: boolean;
  suggestNameFromContact?: boolean;
}

export class IdentityResolver {
  private static defaultOptions: Required<MatchingOptions> = {
    fuzzyMatching: true,
    confidenceThreshold: 0.7,
    createNewCustomer: true,
    suggestNameFromContact: true
  };

  static async resolveIdentity(
    contact: NormalizedContact, 
    options: MatchingOptions = {}
  ): Promise<IdentityResolution> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // First, try exact match on normalized value
      const exactMatch = await this.findExactMatch(contact);
      if (exactMatch) {
        return {
          customerId: exactMatch.customer.id,
          isNewCustomer: false,
          confidence: 1.0,
          matchedIdentities: [{
            identityId: exactMatch.id,
            type: exactMatch.type,
            value: exactMatch.value,
            customerId: exactMatch.customer.id
          }]
        };
      }

      // If no exact match and fuzzy matching is enabled, try fuzzy matching
      if (opts.fuzzyMatching) {
        const fuzzyMatches = await this.findFuzzyMatches(contact);
        const bestMatch = this.selectBestMatch(fuzzyMatches, opts.confidenceThreshold);
        
        if (bestMatch) {
          return {
            customerId: bestMatch.customer.id,
            isNewCustomer: false,
            confidence: bestMatch.confidence,
            matchedIdentities: [{
              identityId: bestMatch.identity.id,
              type: bestMatch.identity.type,
              value: bestMatch.identity.value,
              customerId: bestMatch.customer.id
            }],
            suggestedName: opts.suggestNameFromContact ? this.extractNameFromContact(contact) : undefined
          };
        }
      }

      // No match found - prepare for new customer creation if enabled
      if (opts.createNewCustomer) {
        return {
          isNewCustomer: true,
          confidence: 0.0,
          matchedIdentities: [],
          suggestedName: opts.suggestNameFromContact ? this.extractNameFromContact(contact) : undefined
        };
      }

      // No match and not creating new customer
      return {
        isNewCustomer: false,
        confidence: 0.0,
        matchedIdentities: []
      };
    } catch (error) {
      throw new IngestionError(
        'IDENTITY_RESOLUTION_FAILED',
        `Failed to resolve identity for ${contact.type}:${contact.normalizedValue}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'identity-resolver',
        undefined,
        { contact, error }
      );
    }
  }

  static async createOrLinkIdentity(
    contact: NormalizedContact,
    resolution: IdentityResolution
  ): Promise<{ customerId: string; identityId: string; isNewCustomer: boolean }> {
    try {
      let customerId: string;
      let isNewCustomer = false;

      if (resolution.customerId) {
        // Link to existing customer
        customerId = resolution.customerId;
      } else if (resolution.isNewCustomer) {
        // Create new customer
        const customerData = {
          name: resolution.suggestedName || `${contact.type.charAt(0).toUpperCase()}${contact.type.slice(1)} Customer`,
          metadata: {
            source: 'message_ingestion',
            createdFrom: contact.type,
            originalContact: contact.rawValue
          }
        };
        
        const newCustomer = await CustomerModel.create(customerData);
        customerId = newCustomer.id;
        isNewCustomer = true;
      } else {
        throw new IngestionError(
          'IDENTITY_RESOLUTION_FAILED',
          'No customer ID provided and new customer creation disabled',
          'identity-resolver',
          undefined,
          { contact, resolution }
        );
      }

      // Create the identity record
      let identityId: string;
      
      // Check if identity already exists for this customer
      const existingIdentity = resolution.matchedIdentities.find(
        mi => mi.customerId === customerId && mi.type === contact.type && mi.value === contact.normalizedValue
      );
      
      if (existingIdentity) {
        identityId = existingIdentity.identityId;
      } else {
        // Create new identity
        try {
          const newIdentity = await IdentityModel.create({
            customerId,
            type: contact.type,
            value: contact.normalizedValue,
            rawValue: contact.rawValue,
            provider: contact.provider,
            verified: contact.verified || false
          });
          identityId = newIdentity.id;
        } catch (error) {
          // If identity creation fails due to uniqueness constraint, find the existing one
          const existingByValue = await IdentityModel.findByTypeAndValue(contact.type, contact.normalizedValue);
          if (existingByValue) {
            identityId = existingByValue.id;
            customerId = existingByValue.customer.id;
            isNewCustomer = false;
          } else {
            throw error;
          }
        }
      }

      return {
        customerId,
        identityId,
        isNewCustomer
      };
    } catch (error) {
      throw new IngestionError(
        'IDENTITY_RESOLUTION_FAILED',
        `Failed to create or link identity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'identity-resolver',
        undefined,
        { contact, resolution, error }
      );
    }
  }

  private static async findExactMatch(contact: NormalizedContact) {
    return await IdentityModel.findByTypeAndValue(contact.type, contact.normalizedValue);
  }

  private static async findFuzzyMatches(contact: NormalizedContact) {
    // Use the existing potential matches method from IdentityModel
    return await IdentityModel.findPotentialMatches(contact.type, contact.normalizedValue);
  }

  private static selectBestMatch(matches: any[], threshold: number) {
    if (matches.length === 0) return null;

    // Calculate confidence scores for each match
    const scoredMatches = matches.map(match => ({
      identity: match,
      customer: match.customer,
      confidence: this.calculateConfidenceScore(match)
    }));

    // Sort by confidence and return best match if above threshold
    scoredMatches.sort((a, b) => b.confidence - a.confidence);
    const bestMatch = scoredMatches[0];

    return bestMatch.confidence >= threshold ? bestMatch : null;
  }

  private static calculateConfidenceScore(identity: any): number {
    let score = 0.5; // Base score

    // Boost score if identity is verified
    if (identity.verified) {
      score += 0.3;
    }

    // Boost score based on how recent the identity was linked
    const daysSinceLinked = (Date.now() - new Date(identity.linkedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLinked < 30) {
      score += 0.2;
    } else if (daysSinceLinked < 90) {
      score += 0.1;
    }

    // Ensure score doesn't exceed 1.0
    return Math.min(score, 1.0);
  }

  private static extractNameFromContact(contact: NormalizedContact): string | undefined {
    switch (contact.type) {
      case 'email':
        // Try to extract name from email local part
        const localPart = contact.normalizedValue.split('@')[0];
        if (localPart.includes('.')) {
          return localPart
            .split('.')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        }
        return localPart.charAt(0).toUpperCase() + localPart.slice(1);
        
      case 'social':
        // Social handles might contain names
        return contact.rawValue.replace('@', '').replace(/[_-]/g, ' ');
        
      case 'phone':
        // Phone numbers don't contain names
        return undefined;
        
      default:
        return undefined;
    }
  }

  static async resolveBothContacts(
    fromContact: NormalizedContact,
    toContact: NormalizedContact,
    direction: 'inbound' | 'outbound'
  ): Promise<{
    customerResolution: IdentityResolution;
    businessResolution: IdentityResolution;
    customerContact: NormalizedContact;
    businessContact: NormalizedContact;
  }> {
    // Determine which contact is the customer and which is the business
    let customerContact: NormalizedContact;
    let businessContact: NormalizedContact;

    if (direction === 'inbound') {
      customerContact = fromContact;
      businessContact = toContact;
    } else {
      customerContact = toContact;
      businessContact = fromContact;
    }

    // Resolve customer identity (always create if not found)
    const customerResolution = await this.resolveIdentity(customerContact, {
      createNewCustomer: true,
      suggestNameFromContact: true
    });

    // Resolve business identity (don't create new customer, these should exist)
    const businessResolution = await this.resolveIdentity(businessContact, {
      createNewCustomer: false,
      suggestNameFromContact: false
    });

    return {
      customerResolution,
      businessResolution,
      customerContact,
      businessContact
    };
  }
}

export default IdentityResolver;