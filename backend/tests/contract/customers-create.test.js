import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
const prisma = new PrismaClient();
describe('POST /customers - Contract Test', () => {
    let authToken;
    let testUser;
    const createdCustomerIds = [];
    beforeAll(async () => {
        // Create test user for authentication
        testUser = await prisma.user.upsert({
            where: { email: 'customer-create-test@example.com' },
            update: {},
            create: {
                email: 'customer-create-test@example.com',
                name: 'Customer Create Test User',
                role: 'staff',
                metadata: {
                    createdBy: 'contract-test',
                    passwordHash: await bcrypt.hash('TestPass123!', 12)
                }
            }
        });
        // Create auth token
        authToken = jwt.sign({ userId: testUser.id, email: testUser.email, role: testUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });
    describe('POST /api/v1/customers', () => {
        it('should create customer with minimum required fields', async () => {
            const customerData = {
                name: 'John Doe'
            };
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send(customerData)
                .expect('Content-Type', /json/)
                .expect(201);
            expect(response.body).toEqual({
                id: expect.any(String),
                name: 'John Doe',
                displayName: null,
                identities: [],
                metadata: {},
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            });
            // Validate UUID format
            expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            // Validate ISO date format
            expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
            expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
            createdCustomerIds.push(response.body.id);
            // Verify customer was actually created in database
            const dbCustomer = await prisma.customer.findUnique({
                where: { id: response.body.id }
            });
            expect(dbCustomer).toBeTruthy();
            expect(dbCustomer?.name).toBe('John Doe');
        });
        it('should create customer with all optional fields', async () => {
            const customerData = {
                name: 'Jane Smith',
                displayName: 'Jane',
                metadata: {
                    source: 'manual',
                    tags: ['vip', 'enterprise'],
                    notes: 'Important customer'
                }
            };
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send(customerData)
                .expect('Content-Type', /json/)
                .expect(201);
            expect(response.body).toEqual({
                id: expect.any(String),
                name: 'Jane Smith',
                displayName: 'Jane',
                identities: [],
                metadata: {
                    source: 'manual',
                    tags: ['vip', 'enterprise'],
                    notes: 'Important customer'
                },
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            });
            createdCustomerIds.push(response.body.id);
        });
        it('should reject request missing required name field', async () => {
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'name',
                        message: expect.stringContaining('required')
                    })
                ])
            });
        });
        it('should reject empty name field', async () => {
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: '' })
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'name',
                        message: expect.stringContaining('empty')
                    })
                ])
            });
        });
        it('should reject name that is too long', async () => {
            const longName = 'A'.repeat(256); // Assuming 255 char limit
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: longName })
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'name',
                        message: expect.stringContaining('maximum length')
                    })
                ])
            });
        });
        it('should reject displayName that is too long', async () => {
            const longDisplayName = 'B'.repeat(101); // Assuming 100 char limit
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                name: 'Valid Name',
                displayName: longDisplayName
            })
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'displayName',
                        message: expect.stringContaining('maximum length')
                    })
                ])
            });
        });
        it('should handle duplicate customer names gracefully', async () => {
            const customerData = {
                name: 'Duplicate Name Test'
            };
            // Create first customer
            const response1 = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send(customerData)
                .expect('Content-Type', /json/)
                .expect(201);
            createdCustomerIds.push(response1.body.id);
            // Create second customer with same name (should succeed)
            const response2 = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send(customerData)
                .expect('Content-Type', /json/)
                .expect(201);
            createdCustomerIds.push(response2.body.id);
            // Should have different IDs
            expect(response1.body.id).not.toBe(response2.body.id);
            expect(response1.body.name).toBe(response2.body.name);
        });
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/v1/customers')
                .send({ name: 'Test Customer' })
                .expect('Content-Type', /json/)
                .expect(401);
            expect(response.body).toEqual({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        });
        it('should reject invalid Bearer token', async () => {
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', 'Bearer invalid-token')
                .send({ name: 'Test Customer' })
                .expect('Content-Type', /json/)
                .expect(401);
            expect(response.body).toEqual({
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });
        });
        it('should require staff or admin role', async () => {
            // Create viewer user
            const viewerUser = await prisma.user.create({
                data: {
                    email: 'viewer-test@example.com',
                    name: 'Viewer Test User',
                    role: 'viewer',
                    metadata: { createdBy: 'contract-test' }
                }
            });
            const viewerToken = jwt.sign({ userId: viewerUser.id, email: viewerUser.email, role: viewerUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send({ name: 'Test Customer' })
                .expect('Content-Type', /json/)
                .expect(403);
            expect(response.body).toEqual({
                error: 'Forbidden',
                message: 'Insufficient permissions'
            });
            // Clean up viewer user
            await prisma.user.delete({
                where: { id: viewerUser.id }
            });
        });
        it('should handle malformed JSON', async () => {
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .set('Content-Type', 'application/json')
                .send('{"name": "test", }') // Invalid JSON
                .expect(400);
            expect(response.body).toEqual({
                error: 'Bad Request',
                message: expect.stringContaining('Invalid JSON')
            });
        });
        it('should require Content-Type application/json', async () => {
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send('name=TestCustomer') // form-encoded
                .expect(400);
            expect(response.body).toEqual({
                error: 'Bad Request',
                message: 'Content-Type must be application/json'
            });
        });
        it('should reject invalid metadata types', async () => {
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                name: 'Test Customer',
                metadata: 'invalid-metadata' // should be object
            })
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'metadata',
                        message: expect.stringContaining('object')
                    })
                ])
            });
        });
        it('should handle extremely large metadata gracefully', async () => {
            const largeMetadata = {
                largeField: 'x'.repeat(100000) // 100KB string
            };
            const response = await request(app)
                .post('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                name: 'Test Customer',
                metadata: largeMetadata
            })
                .expect('Content-Type', /json/)
                .expect(413); // Payload too large
            expect(response.body).toEqual({
                error: 'payload_too_large',
                message: 'payload exceeds limit'
            });
        });
    });
});
//# sourceMappingURL=customers-create.test.js.map