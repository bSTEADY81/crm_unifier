import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { IdentityResolver } from '../../../src/lib/ingestion/identity-resolver.js';
const prisma = new PrismaClient();
describe('IdentityResolver', () => {
    let testCustomer1;
    let testCustomer2;
    beforeAll(async () => {
        // Create test customers
        testCustomer1 = await prisma.customer.create({
            data: {
                name: 'John Doe',
                displayName: 'John',
                metadata: { source: 'test' }
            }
        });
        testCustomer2 = await prisma.customer.create({
            data: {
                name: 'Jane Smith',
                displayName: 'Jane',
                metadata: { source: 'test' }
            }
        });
        // Create test identities (use unique values for tests)
        await prisma.identity.create({
            data: {
                customerId: testCustomer1.id,
                type: 'phone',
                value: '+1888111222',
                rawValue: '(888) 111-222',
                provider: 'twilio',
                verified: true
            }
        });
        await prisma.identity.create({
            data: {
                customerId: testCustomer1.id,
                type: 'email',
                value: 'john.resolver@example.com',
                rawValue: 'john.resolver@example.com',
                provider: 'gmail',
                verified: true
            }
        });
        await prisma.identity.create({
            data: {
                customerId: testCustomer2.id,
                type: 'phone',
                value: '+1888333444',
                rawValue: '(888) 333-444',
                provider: 'twilio',
                verified: false
            }
        });
    });
    afterAll(async () => {
        // Clean up
        await prisma.identity.deleteMany({
            where: {
                customerId: {
                    in: [testCustomer1.id, testCustomer2.id]
                }
            }
        });
        await prisma.customer.deleteMany({
            where: {
                id: {
                    in: [testCustomer1.id, testCustomer2.id]
                }
            }
        });
        await prisma.$disconnect();
    });
    describe('resolveIdentity', () => {
        it('should find exact match for existing identity', async () => {
            const contact = {
                identifier: '+1888111222',
                normalizedValue: '+1888111222',
                rawValue: '(888) 111-222',
                type: 'phone',
                provider: 'twilio'
            };
            const resolution = await IdentityResolver.resolveIdentity(contact);
            expect(resolution.customerId).toBe(testCustomer1.id);
            expect(resolution.isNewCustomer).toBe(false);
            expect(resolution.confidence).toBe(1.0);
            expect(resolution.matchedIdentities).toHaveLength(1);
            expect(resolution.matchedIdentities[0].type).toBe('phone');
            expect(resolution.matchedIdentities[0].value).toBe('+1888111222');
        });
        it('should find exact match for email identity', async () => {
            const contact = {
                identifier: 'john.resolver@example.com',
                normalizedValue: 'john.resolver@example.com',
                rawValue: 'John.Resolver@Example.com', // Different case
                type: 'email',
                provider: 'gmail'
            };
            const resolution = await IdentityResolver.resolveIdentity(contact);
            expect(resolution.customerId).toBe(testCustomer1.id);
            expect(resolution.isNewCustomer).toBe(false);
            expect(resolution.confidence).toBe(1.0);
            expect(resolution.matchedIdentities[0].type).toBe('email');
        });
        it('should return new customer result when no match found', async () => {
            const contact = {
                identifier: '+1555999888',
                normalizedValue: '+1555999888',
                rawValue: '(555) 999-888',
                type: 'phone',
                provider: 'twilio'
            };
            const resolution = await IdentityResolver.resolveIdentity(contact, {
                createNewCustomer: true
            });
            expect(resolution.customerId).toBeUndefined();
            expect(resolution.isNewCustomer).toBe(true);
            expect(resolution.confidence).toBe(0.0);
            expect(resolution.matchedIdentities).toHaveLength(0);
            expect(resolution.suggestedName).toBeUndefined(); // Phone doesn't suggest names
        });
        it('should suggest name from email address', async () => {
            const contact = {
                identifier: 'sarah.johnson@example.com',
                normalizedValue: 'sarah.johnson@example.com',
                rawValue: 'sarah.johnson@example.com',
                type: 'email',
                provider: 'gmail'
            };
            const resolution = await IdentityResolver.resolveIdentity(contact, {
                createNewCustomer: true,
                suggestNameFromContact: true
            });
            expect(resolution.isNewCustomer).toBe(true);
            expect(resolution.suggestedName).toBe('Sarah Johnson');
        });
        it('should suggest name from social handle', async () => {
            const contact = {
                identifier: 'mike_wilson',
                normalizedValue: 'mike_wilson',
                rawValue: '@mike_wilson',
                type: 'social',
                provider: 'facebook'
            };
            const resolution = await IdentityResolver.resolveIdentity(contact, {
                createNewCustomer: true,
                suggestNameFromContact: true
            });
            expect(resolution.isNewCustomer).toBe(true);
            expect(resolution.suggestedName).toBe('@mike_wilson');
        });
        it('should not create new customer when disabled', async () => {
            const contact = {
                identifier: '+1777888999',
                normalizedValue: '+1777888999',
                rawValue: '(777) 888-999',
                type: 'phone',
                provider: 'twilio'
            };
            const resolution = await IdentityResolver.resolveIdentity(contact, {
                createNewCustomer: false
            });
            expect(resolution.customerId).toBeUndefined();
            expect(resolution.isNewCustomer).toBe(false);
            expect(resolution.confidence).toBe(0.0);
            expect(resolution.matchedIdentities).toHaveLength(0);
        });
        it('should find fuzzy matches with lower confidence', async () => {
            // Create a phone identity with slight variation
            const testCustomer3 = await prisma.customer.create({
                data: {
                    name: 'Test Customer 3',
                    metadata: { source: 'test' }
                }
            });
            await prisma.identity.create({
                data: {
                    customerId: testCustomer3.id,
                    type: 'phone',
                    value: '+15551234567',
                    rawValue: '555-123-4567',
                    provider: 'twilio',
                    verified: true
                }
            });
            const contact = {
                identifier: '+15551234567',
                normalizedValue: '+15551234567',
                rawValue: '15551234567', // Different format but same number
                type: 'phone',
                provider: 'twilio'
            };
            const resolution = await IdentityResolver.resolveIdentity(contact, {
                fuzzyMatching: true,
                confidenceThreshold: 0.5
            });
            expect(resolution.customerId).toBe(testCustomer3.id);
            expect(resolution.isNewCustomer).toBe(false);
            expect(resolution.confidence).toBeGreaterThan(0.5);
            // Clean up
            await prisma.identity.deleteMany({ where: { customerId: testCustomer3.id } });
            await prisma.customer.delete({ where: { id: testCustomer3.id } });
        });
    });
    describe('createOrLinkIdentity', () => {
        it('should create new customer and identity when resolution indicates new customer', async () => {
            const contact = {
                identifier: '+1666777888',
                normalizedValue: '+1666777888',
                rawValue: '(666) 777-888',
                type: 'phone',
                provider: 'twilio'
            };
            const resolution = {
                isNewCustomer: true,
                confidence: 0.0,
                matchedIdentities: [],
                suggestedName: 'New Customer'
            };
            const result = await IdentityResolver.createOrLinkIdentity(contact, resolution);
            expect(result.customerId).toBeDefined();
            expect(result.identityId).toBeDefined();
            expect(result.isNewCustomer).toBe(true);
            // Verify customer was created
            const newCustomer = await prisma.customer.findUnique({
                where: { id: result.customerId }
            });
            expect(newCustomer).toBeDefined();
            expect(newCustomer?.name).toBe('New Customer');
            expect(newCustomer?.metadata).toEqual(expect.objectContaining({
                source: 'message_ingestion'
            }));
            // Verify identity was created
            const newIdentity = await prisma.identity.findUnique({
                where: { id: result.identityId }
            });
            expect(newIdentity).toBeDefined();
            expect(newIdentity?.type).toBe('phone');
            expect(newIdentity?.value).toBe('+1666777888');
            // Clean up
            await prisma.identity.delete({ where: { id: result.identityId } });
            await prisma.customer.delete({ where: { id: result.customerId } });
        });
        it('should link to existing customer when resolution provides customer ID', async () => {
            const contact = {
                identifier: 'john.doe.work@example.com',
                normalizedValue: 'john.doe.work@example.com',
                rawValue: 'john.doe.work@example.com',
                type: 'email',
                provider: 'gmail'
            };
            const resolution = {
                customerId: testCustomer1.id,
                isNewCustomer: false,
                confidence: 1.0,
                matchedIdentities: []
            };
            const result = await IdentityResolver.createOrLinkIdentity(contact, resolution);
            expect(result.customerId).toBe(testCustomer1.id);
            expect(result.identityId).toBeDefined();
            expect(result.isNewCustomer).toBe(false);
            // Verify identity was created and linked to existing customer
            const newIdentity = await prisma.identity.findUnique({
                where: { id: result.identityId }
            });
            expect(newIdentity).toBeDefined();
            expect(newIdentity?.customerId).toBe(testCustomer1.id);
            expect(newIdentity?.type).toBe('email');
            // Clean up
            await prisma.identity.delete({ where: { id: result.identityId } });
        });
        it('should handle duplicate identity creation gracefully', async () => {
            const contact = {
                identifier: '+1234567890', // This identity already exists
                normalizedValue: '+1234567890',
                rawValue: '(234) 567-8901',
                type: 'phone',
                provider: 'twilio'
            };
            const resolution = {
                customerId: testCustomer1.id,
                isNewCustomer: false,
                confidence: 1.0,
                matchedIdentities: []
            };
            const result = await IdentityResolver.createOrLinkIdentity(contact, resolution);
            expect(result.customerId).toBe(testCustomer1.id);
            expect(result.identityId).toBeDefined();
            expect(result.isNewCustomer).toBe(false);
            // Should return the existing identity
            const existingIdentity = await prisma.identity.findUnique({
                where: { id: result.identityId }
            });
            expect(existingIdentity?.value).toBe('+1234567890');
        });
        it('should create default customer name when no suggestion provided', async () => {
            const contact = {
                identifier: '+1888999000',
                normalizedValue: '+1888999000',
                rawValue: '(888) 999-000',
                type: 'phone',
                provider: 'twilio'
            };
            const resolution = {
                isNewCustomer: true,
                confidence: 0.0,
                matchedIdentities: []
                // No suggestedName provided
            };
            const result = await IdentityResolver.createOrLinkIdentity(contact, resolution);
            const newCustomer = await prisma.customer.findUnique({
                where: { id: result.customerId }
            });
            expect(newCustomer?.name).toBe('Phone Customer'); // Default name for phone contacts
            // Clean up
            await prisma.identity.delete({ where: { id: result.identityId } });
            await prisma.customer.delete({ where: { id: result.customerId } });
        });
    });
    describe('resolveBothContacts', () => {
        it('should resolve customer and business contacts correctly for inbound message', async () => {
            const fromContact = {
                identifier: '+1888111222',
                normalizedValue: '+1888111222',
                rawValue: '(888) 111-222',
                type: 'phone',
                provider: 'twilio'
            };
            const toContact = {
                identifier: '+1888333444',
                normalizedValue: '+1888333444',
                rawValue: '(888) 333-444',
                type: 'phone',
                provider: 'twilio'
            };
            const result = await IdentityResolver.resolveBothContacts(fromContact, toContact, 'inbound');
            expect(result.customerContact).toBe(fromContact);
            expect(result.businessContact).toBe(toContact);
            expect(result.customerResolution.customerId).toBe(testCustomer1.id);
            expect(result.businessResolution.customerId).toBe(testCustomer2.id);
        });
        it('should resolve customer and business contacts correctly for outbound message', async () => {
            const fromContact = {
                identifier: '+0987654321',
                normalizedValue: '+0987654321',
                rawValue: '(098) 765-4321',
                type: 'phone',
                provider: 'twilio'
            };
            const toContact = {
                identifier: '+1234567890',
                normalizedValue: '+1234567890',
                rawValue: '(234) 567-8901',
                type: 'phone',
                provider: 'twilio'
            };
            const result = await IdentityResolver.resolveBothContacts(fromContact, toContact, 'outbound');
            expect(result.customerContact).toBe(toContact);
            expect(result.businessContact).toBe(fromContact);
            expect(result.customerResolution.customerId).toBe(testCustomer1.id);
            expect(result.businessResolution.customerId).toBe(testCustomer2.id);
        });
        it('should create new customer for unknown customer contact', async () => {
            const fromContact = {
                identifier: '+1999888777',
                normalizedValue: '+1999888777',
                rawValue: '(999) 888-777',
                type: 'phone',
                provider: 'twilio'
            };
            const toContact = {
                identifier: '+1234567890', // Known business number
                normalizedValue: '+1234567890',
                rawValue: '(234) 567-8901',
                type: 'phone',
                provider: 'twilio'
            };
            const result = await IdentityResolver.resolveBothContacts(fromContact, toContact, 'inbound');
            expect(result.customerContact).toBe(fromContact);
            expect(result.customerResolution.isNewCustomer).toBe(true);
            expect(result.businessResolution.customerId).toBe(testCustomer1.id);
            expect(result.businessResolution.isNewCustomer).toBe(false);
        });
    });
});
//# sourceMappingURL=identity-resolver.test.js.map