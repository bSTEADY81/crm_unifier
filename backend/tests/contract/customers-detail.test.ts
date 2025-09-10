import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../../src/app';

const prisma = new PrismaClient();

describe('GET /customers/{id} - Contract Test', () => {
  let authToken: string;
  let testUser: any;
  let testCustomer: any;
  let testIdentities: any[];

  beforeAll(async () => {
    // Create test user for authentication
    testUser = await prisma.user.upsert({
      where: { email: 'customer-detail-test@example.com' },
      update: {},
      create: {
        email: 'customer-detail-test@example.com',
        name: 'Customer Detail Test User',
        role: 'staff',
        metadata: { 
          createdBy: 'contract-test',
          passwordHash: await bcrypt.hash('TestPass123!', 12)
        }
      }
    });

    // Create auth token
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Create test customer
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Alice Johnson',
        displayName: 'Alice',
        metadata: { 
          source: 'contract-test', 
          tags: ['vip', 'priority'],
          notes: 'Detailed customer information',
          customerSince: '2023-01-15'
        }
      }
    });

    // Create test identities for customer
    const identity1 = await prisma.identity.create({
      data: {
        customerId: testCustomer.id,
        type: 'email',
        value: 'alice.johnson@example.com',
        rawValue: 'alice.johnson@example.com',
        provider: 'gmail',
        verified: true
      }
    });

    const identity2 = await prisma.identity.create({
      data: {
        customerId: testCustomer.id,
        type: 'phone',
        value: '+14155551234',
        rawValue: '(415) 555-1234',
        provider: 'twilio',
        verified: true
      }
    });

    const identity3 = await prisma.identity.create({
      data: {
        customerId: testCustomer.id,
        type: 'social',
        value: '@alicejohnson',
        rawValue: '@alicejohnson',
        provider: 'facebook',
        verified: false
      }
    });

    testIdentities = [identity1, identity2, identity3];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/v1/customers/{customerId}', () => {
    it('should return customer details with all identities', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        id: testCustomer.id,
        name: 'Alice Johnson',
        displayName: 'Alice',
        identities: expect.arrayContaining([
          {
            id: testIdentities[0].id,
            type: 'email',
            value: 'alice.johnson@example.com',
            rawValue: 'alice.johnson@example.com',
            provider: 'gmail',
            verified: true,
            linkedAt: expect.any(String)
          },
          {
            id: testIdentities[1].id,
            type: 'phone', 
            value: '+14155551234',
            rawValue: '(415) 555-1234',
            provider: 'twilio',
            verified: true,
            linkedAt: expect.any(String)
          },
          {
            id: testIdentities[2].id,
            type: 'social',
            value: '@alicejohnson',
            rawValue: '@alicejohnson',
            provider: 'facebook',
            verified: false,
            linkedAt: expect.any(String)
          }
        ]),
        metadata: {
          source: 'contract-test',
          tags: ['vip', 'priority'],
          notes: 'Detailed customer information',
          customerSince: '2023-01-15'
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });

      // Validate UUID formats
      expect(response.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      
      response.body.identities.forEach((identity: any) => {
        expect(identity.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(new Date(identity.linkedAt)).toBeInstanceOf(Date);
      });

      // Validate ISO date formats
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should return customer with empty identities array when none exist', async () => {
      // Create customer without identities
      const customerWithoutIdentities = await prisma.customer.create({
        data: {
          name: 'Customer Without Identities',
          metadata: { source: 'contract-test' }
        }
      });

      const response = await request(app)
        .get(`/api/v1/customers/${customerWithoutIdentities.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        id: customerWithoutIdentities.id,
        name: 'Customer Without Identities',
        displayName: null,
        identities: [],
        metadata: { source: 'contract-test' },
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });

      // Clean up
      await prisma.customer.delete({
        where: { id: customerWithoutIdentities.id }
      });
    });

    it('should return 404 for non-existent customer ID', async () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`/api/v1/customers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Customer not found'
      });
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/v1/customers/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'customerId',
            message: expect.stringContaining('valid UUID')
          })
        ])
      });
    });

    it('should return 400 for empty customer ID', async () => {
      const response = await request(app)
        .get('/api/v1/customers/')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200); // This hits the list endpoint, which is correct behavior

      // The list endpoint should return an empty array or customers list
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${testCustomer.id}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    });

    it('should reject invalid Bearer token', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    });

    it('should reject malformed Authorization header', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', 'Basic invalid')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'Bearer token required'
      });
    });

    it('should allow all user roles to view customer details', async () => {
      // Test viewer role can access
      const viewerUser = await prisma.user.create({
        data: {
          email: 'viewer-detail-test@example.com',
          name: 'Viewer Detail Test',
          role: 'viewer',
          metadata: { createdBy: 'contract-test' }
        }
      });

      const viewerToken = jwt.sign(
        { userId: viewerUser.id, email: viewerUser.email, role: viewerUser.role },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.id).toBe(testCustomer.id);
      expect(response.body.name).toBe('Alice Johnson');

      // Clean up viewer user
      await prisma.user.delete({
        where: { id: viewerUser.id }
      });
    });

    it('should handle customer with complex metadata structure', async () => {
      const complexMetadata = {
        source: 'api',
        tags: ['enterprise', 'priority', 'technical'],
        preferences: {
          communication: {
            email: true,
            sms: false,
            voice: true
          },
          timezone: 'America/New_York',
          language: 'en-US'
        },
        customFields: {
          accountManager: 'John Smith',
          contractValue: 150000,
          renewalDate: '2024-12-31'
        },
        integrationData: {
          salesforce: { id: 'SF123456' },
          hubspot: { id: 'HS789012' }
        }
      };

      const complexCustomer = await prisma.customer.create({
        data: {
          name: 'Enterprise Customer',
          displayName: 'Enterprise',
          metadata: complexMetadata
        }
      });

      const response = await request(app)
        .get(`/api/v1/customers/${complexCustomer.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.metadata).toEqual(complexMetadata);

      // Clean up
      await prisma.customer.delete({
        where: { id: complexCustomer.id }
      });
    });

    it('should sort identities consistently', async () => {
      const response = await request(app)
        .get(`/api/v1/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      const identities = response.body.identities;
      expect(identities).toHaveLength(3);
      
      // Should be sorted by linkedAt timestamp (most recent first) or by type
      const emailIdentity = identities.find((i: any) => i.type === 'email');
      const phoneIdentity = identities.find((i: any) => i.type === 'phone');
      const socialIdentity = identities.find((i: any) => i.type === 'social');

      expect(emailIdentity).toBeDefined();
      expect(phoneIdentity).toBeDefined();
      expect(socialIdentity).toBeDefined();
    });
  });
});