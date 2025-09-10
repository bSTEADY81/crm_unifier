import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import { resetDbContract } from '../utils/db';
const prisma = new PrismaClient();
describe('GET /customers - Contract Test', () => {
    let authToken;
    let testUser;
    let testCustomer1;
    let testCustomer2;
    beforeAll(async () => {
        // Create test user for authentication
        testUser = await prisma.user.upsert({
            where: { email: 'customers-test@example.com' },
            update: {},
            create: {
                email: 'customers-test@example.com',
                name: 'Customers Test User',
                role: 'staff',
                metadata: {
                    createdBy: 'contract-test',
                    passwordHash: await bcrypt.hash('TestPass123!', 12)
                }
            }
        });
        // Create auth token
        authToken = jwt.sign({ userId: testUser.id, email: testUser.email, role: testUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        // Create test customers
        testCustomer1 = await prisma.customer.create({
            data: {
                name: 'Alice Johnson',
                displayName: 'Alice',
                metadata: { source: 'contract-test', tags: ['vip'] }
            }
        });
        testCustomer2 = await prisma.customer.create({
            data: {
                name: 'Bob Smith',
                displayName: 'Bob',
                metadata: { source: 'contract-test', tags: ['new'] }
            }
        });
        // Create identities for test customers
        await prisma.identity.create({
            data: {
                customerId: testCustomer1.id,
                type: 'email',
                value: 'alice@example.com',
                rawValue: 'alice@example.com',
                verified: true
            }
        });
        await prisma.identity.create({
            data: {
                customerId: testCustomer1.id,
                type: 'phone',
                value: '+12345678901',
                rawValue: '(234) 567-8901',
                verified: true
            }
        });
        await prisma.identity.create({
            data: {
                customerId: testCustomer2.id,
                type: 'email',
                value: 'bob@example.com',
                rawValue: 'bob@example.com',
                verified: false
            }
        });
    });
    afterAll(async () => {
        await resetDbContract();
        await prisma.$disconnect();
    });
    describe('GET /api/v1/customers', () => {
        it('should return paginated customer list with identities', async () => {
            const response = await request(app)
                .get('/api/v1/customers')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual({
                data: expect.arrayContaining([
                    {
                        id: testCustomer1.id,
                        name: 'Alice Johnson',
                        displayName: 'Alice',
                        identities: expect.arrayContaining([
                            {
                                id: expect.any(String),
                                type: 'email',
                                value: 'alice@example.com',
                                verified: true
                            },
                            {
                                id: expect.any(String),
                                type: 'phone',
                                value: '+12345678901',
                                verified: true
                            }
                        ]),
                        metadata: expect.objectContaining({
                            source: 'contract-test',
                            tags: ['vip']
                        }),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String)
                    },
                    {
                        id: testCustomer2.id,
                        name: 'Bob Smith',
                        displayName: 'Bob',
                        identities: expect.arrayContaining([
                            {
                                id: expect.any(String),
                                type: 'email',
                                value: 'bob@example.com',
                                verified: false
                            }
                        ]),
                        metadata: expect.objectContaining({
                            source: 'contract-test',
                            tags: ['new']
                        }),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String)
                    }
                ]),
                pagination: {
                    page: 1,
                    limit: expect.any(Number),
                    total: expect.any(Number),
                    totalPages: expect.any(Number)
                }
            });
            // Validate UUID format for customer IDs
            response.body.data.forEach((customer) => {
                expect(customer.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                customer.identities.forEach((identity) => {
                    expect(identity.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                });
            });
        });
        it('should handle pagination parameters', async () => {
            const response = await request(app)
                .get('/api/v1/customers?page=1&limit=1')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual({
                data: expect.any(Array),
                pagination: {
                    page: 1,
                    limit: 1,
                    total: expect.any(Number),
                    totalPages: expect.any(Number)
                }
            });
            expect(response.body.data).toHaveLength(1);
        });
        it('should handle search by name', async () => {
            const response = await request(app)
                .get('/api/v1/customers?search=Alice')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body.data).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'Alice Johnson'
                })
            ]));
            // Should not contain Bob
            expect(response.body.data.find((c) => c.name === 'Bob Smith')).toBeUndefined();
        });
        it('should handle search by email', async () => {
            const response = await request(app)
                .get('/api/v1/customers?search=alice@example.com')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body.data).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'Alice Johnson',
                    identities: expect.arrayContaining([
                        expect.objectContaining({
                            value: 'alice@example.com'
                        })
                    ])
                })
            ]));
        });
        it('should handle search by phone', async () => {
            const response = await request(app)
                .get('/api/v1/customers?search=+12345678901')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body.data).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: 'Alice Johnson',
                    identities: expect.arrayContaining([
                        expect.objectContaining({
                            value: '+12345678901'
                        })
                    ])
                })
            ]));
        });
        it('should return empty results for no matches', async () => {
            const response = await request(app)
                .get('/api/v1/customers?search=nonexistent@example.com')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual({
                data: [],
                pagination: {
                    page: 1,
                    limit: expect.any(Number),
                    total: 0,
                    totalPages: 0
                }
            });
        });
        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/v1/customers')
                .expect('Content-Type', /json/)
                .expect(401);
            expect(response.body).toEqual({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        });
        it('should reject invalid Bearer token', async () => {
            const response = await request(app)
                .get('/api/v1/customers')
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
                .get('/api/v1/customers')
                .set('Authorization', 'Basic invalid')
                .expect('Content-Type', /json/)
                .expect(401);
            expect(response.body).toEqual({
                error: 'Unauthorized',
                message: 'Bearer token required'
            });
        });
        it('should validate pagination parameters', async () => {
            const response = await request(app)
                .get('/api/v1/customers?page=0&limit=101')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'page',
                        message: 'Page must be at least 1'
                    }),
                    expect.objectContaining({
                        field: 'limit',
                        message: 'Limit must be between 1 and 100'
                    })
                ])
            });
        });
        it('should handle large search queries gracefully', async () => {
            const longSearch = 'a'.repeat(1000);
            const response = await request(app)
                .get(`/api/v1/customers?search=${encodeURIComponent(longSearch)}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'search',
                        message: 'Search query must be less than 255 characters'
                    })
                ])
            });
        });
    });
});
//# sourceMappingURL=customers-list.test.js.map