import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default admin user
  const adminPasswordHash = await bcrypt.hash('AdminPass123!', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'System Administrator',
      role: 'admin',
      metadata: {
        isDefaultAdmin: true,
        createdBy: 'seed',
        passwordHash: adminPasswordHash
      }
    }
  });
  console.log('👤 Created admin user:', adminUser.email);

  // Create sample staff user
  const staffPasswordHash = await bcrypt.hash('StaffPass123!', 12);
  
  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@example.com' },
    update: {},
    create: {
      email: 'staff@example.com',
      name: 'John Staff',
      role: 'staff',
      metadata: {
        department: 'customer_service',
        createdBy: 'seed',
        passwordHash: staffPasswordHash
      }
    }
  });
  console.log('👤 Created staff user:', staffUser.email);

  // Create sample viewer user
  const viewerPasswordHash = await bcrypt.hash('ViewerPass123!', 12);
  
  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@example.com' },
    update: {},
    create: {
      email: 'viewer@example.com',
      name: 'Jane Viewer',
      role: 'viewer',
      metadata: {
        department: 'management',
        createdBy: 'seed',
        passwordHash: viewerPasswordHash
      }
    }
  });
  console.log('👤 Created viewer user:', viewerUser.email);

  // Create sample providers (inactive by default)
  const twilioProvider = await prisma.provider.upsert({
    where: { name: 'Twilio SMS (Demo)' },
    update: {},
    create: {
      name: 'Twilio SMS (Demo)',
      type: 'twilio_sms',
      status: 'inactive',
      config: {
        accountSid: 'DEMO_ACCOUNT_SID',
        authToken: 'DEMO_AUTH_TOKEN',
        phoneNumber: '+1234567890',
        encrypted: true
      }
    }
  });
  console.log('📱 Created Twilio provider:', twilioProvider.name);

  const gmailProvider = await prisma.provider.upsert({
    where: { name: 'Gmail (Demo)' },
    update: {},
    create: {
      name: 'Gmail (Demo)',
      type: 'gmail',
      status: 'inactive',
      config: {
        clientId: 'DEMO_CLIENT_ID',
        clientSecret: 'DEMO_CLIENT_SECRET',
        refreshToken: 'DEMO_REFRESH_TOKEN',
        encrypted: true
      }
    }
  });
  console.log('📧 Created Gmail provider:', gmailProvider.name);

  // Create sample customer (or find existing)
  let sampleCustomer = await prisma.customer.findFirst({
    where: { 
      name: 'John Doe',
      metadata: { path: ['source'], equals: 'seed' }
    }
  });

  if (!sampleCustomer) {
    sampleCustomer = await prisma.customer.create({
      data: {
        name: 'John Doe',
        displayName: 'John',
        metadata: {
          source: 'seed',
          tags: ['demo', 'sample'],
          notes: 'Sample customer for development'
        }
      }
    });
  }
  console.log('👥 Created sample customer:', sampleCustomer.name);

  // Create sample identities for the customer
  const phoneIdentity = await prisma.identity.create({
    data: {
      customerId: sampleCustomer.id,
      type: 'phone',
      value: '+1234567890',
      rawValue: '(123) 456-7890',
      provider: 'twilio',
      verified: true
    }
  });

  const emailIdentity = await prisma.identity.create({
    data: {
      customerId: sampleCustomer.id,
      type: 'email',
      value: 'john.doe@example.com',
      rawValue: 'john.doe@example.com',
      provider: 'gmail',
      verified: true
    }
  });
  console.log('🆔 Created sample identities for customer');

  // Create sample conversation
  const sampleConversation = await prisma.conversation.create({
    data: {
      threadKey: 'demo-thread-001',
      customerId: sampleCustomer.id,
      channel: 'sms',
      status: 'active',
      tags: ['demo', 'welcome'],
      lastMessageAt: new Date()
    }
  });
  console.log('💬 Created sample conversation');

  // Create sample messages
  const message1 = await prisma.message.create({
    data: {
      providerMessageId: 'demo-msg-001',
      providerId: twilioProvider.id,
      customerId: sampleCustomer.id,
      conversationId: sampleConversation.id,
      channel: 'sms',
      direction: 'inbound',
      fromIdentifier: '+1234567890',
      toIdentifier: '+0987654321',
      threadKey: 'demo-thread-001',
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      body: 'Hello, I need help with my account.',
      status: 'processed',
      providerMeta: {
        twilioSid: 'demo-msg-001',
        numSegments: 1
      }
    }
  });

  const message2 = await prisma.message.create({
    data: {
      providerMessageId: 'demo-msg-002',
      providerId: twilioProvider.id,
      customerId: sampleCustomer.id,
      conversationId: sampleConversation.id,
      channel: 'sms',
      direction: 'outbound',
      fromIdentifier: '+0987654321',
      toIdentifier: '+1234567890',
      threadKey: 'demo-thread-001',
      timestamp: new Date(Date.now() - 3000000), // 50 minutes ago
      body: 'Hi John! I\'d be happy to help you with your account. What specific issue are you experiencing?',
      status: 'processed',
      providerMeta: {
        twilioSid: 'demo-msg-002',
        numSegments: 1
      }
    }
  });
  console.log('📨 Created sample messages');

  // Assign conversation to staff user
  const assignment = await prisma.conversationAssignment.create({
    data: {
      conversationId: sampleConversation.id,
      userId: staffUser.id,
      assignedBy: adminUser.id,
      notes: 'Initial demo assignment'
    }
  });
  console.log('📋 Assigned conversation to staff user');

  // Create sample audit events
  await prisma.auditEvent.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'user.login',
        resourceType: 'user',
        resourceId: adminUser.id,
        metadata: {
          source: 'seed',
          loginMethod: 'password'
        }
      },
      {
        userId: staffUser.id,
        action: 'conversation.view',
        resourceType: 'conversation',
        resourceId: sampleConversation.id,
        metadata: {
          source: 'seed'
        }
      }
    ]
  });
  console.log('📊 Created sample audit events');

  console.log('✅ Database seed completed successfully!');
  console.log('\nDefault credentials:');
  console.log('Admin: admin@example.com / AdminPass123!');
  console.log('Staff: staff@example.com / StaffPass123!');
  console.log('Viewer: viewer@example.com / ViewerPass123!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });