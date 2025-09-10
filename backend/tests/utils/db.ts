import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function resetDb() {
  // Comprehensive cleanup in proper FK dependency order
  await prisma.$transaction([
    prisma.attachment.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversationAssignment.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.identity.deleteMany(),
    prisma.auditEvent.deleteMany(),
    prisma.webhookLog.deleteMany(),
    prisma.webhook.deleteMany(),
    prisma.user.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.provider.deleteMany()
  ]);
}

export async function resetTestData() {
  // Simple approach: delete all test data based on test user emails and customer patterns
  // This avoids complex metadata filtering that may not exist on all models
  
  // First, get test users
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '-test@example.com' } },
        { metadata: { path: ['createdBy'], equals: 'contract-test' } }
      ]
    }
  });
  
  const testUserIds = testUsers.map(u => u.id);
  
  // Get test customers  
  const testCustomers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'Test Customer' } },
        { metadata: { path: ['source'], equals: 'contract-test' } }
      ]
    }
  });
  
  const testCustomerIds = testCustomers.map(c => c.id);
  
  // Now delete in dependency order
  if (testCustomerIds.length > 0) {
    await prisma.$transaction([
      // Delete attachments for test customers' messages
      prisma.attachment.deleteMany({
        where: {
          message: {
            customerId: { in: testCustomerIds }
          }
        }
      }),
      // Delete messages for test customers
      prisma.message.deleteMany({
        where: {
          customerId: { in: testCustomerIds }
        }
      }),
      // Delete conversation assignments
      prisma.conversationAssignment.deleteMany({
        where: {
          OR: [
            { userId: { in: testUserIds } },
            { conversation: { customerId: { in: testCustomerIds } } }
          ]
        }
      }),
      // Delete conversations for test customers
      prisma.conversation.deleteMany({
        where: {
          customerId: { in: testCustomerIds }
        }
      }),
      // Delete identities for test customers
      prisma.identity.deleteMany({
        where: {
          customerId: { in: testCustomerIds }
        }
      }),
      // Delete audit events for test users
      prisma.auditEvent.deleteMany({
        where: {
          userId: { in: testUserIds }
        }
      }),
      // Delete test users
      prisma.user.deleteMany({
        where: {
          id: { in: testUserIds }
        }
      }),
      // Delete test customers
      prisma.customer.deleteMany({
        where: {
          id: { in: testCustomerIds }
        }
      })
    ]);
  } else if (testUserIds.length > 0) {
    // If no test customers but have test users
    await prisma.$transaction([
      prisma.auditEvent.deleteMany({
        where: {
          userId: { in: testUserIds }
        }
      }),
      prisma.user.deleteMany({
        where: {
          id: { in: testUserIds }
        }
      })
    ]);
  }
}

// Strict FK-safe cleanup for contract tests
export async function resetDbContract() {
  // deleteMany is idempotent: no error if none exist
  await prisma.$transaction([
    prisma.attachment.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversationAssignment.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.identity.deleteMany(),
    prisma.auditEvent.deleteMany()
  ]);
  await prisma.$transaction([
    prisma.user.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.provider.deleteMany()
  ]);
}

export { prisma };