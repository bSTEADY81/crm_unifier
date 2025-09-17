import { PrismaClient } from '@prisma/client';
import { SecureUserModel } from '../src/models/user-secure.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default admin user
  const adminUser = await SecureUserModel.create({
    email: 'admin@example.com',
    name: 'System Administrator',
    role: 'admin',
    password: 'AdminPass123!',
    metadata: {
      isDefaultAdmin: true,
      createdBy: 'seed'
    }
  });
  console.log('👤 Created admin user:', adminUser.email);

  // Create sample staff user
  const staffUser = await SecureUserModel.create({
    email: 'staff@example.com',
    name: 'John Staff',
    role: 'staff',
    password: 'StaffPass123!',
    metadata: {
      department: 'customer_service',
      createdBy: 'seed'
    }
  });
  console.log('👤 Created staff user:', staffUser.email);

  // Create sample viewer user
  const viewerUser = await SecureUserModel.create({
    email: 'viewer@example.com',
    name: 'Jane Viewer',
    role: 'viewer',
    password: 'ViewerPass123!',
    metadata: {
      department: 'management',
      createdBy: 'seed'
    }
  });
  console.log('👤 Created viewer user:', viewerUser.email);

  // Create sample providers (inactive by default)
  const whatsappProvider = await prisma.provider.upsert({
    where: { name: 'WhatsApp Business' },
    update: {},
    create: {
      name: 'WhatsApp Business',
      type: 'whatsapp',
      status: 'inactive',
      config: {
        accessToken: 'your_whatsapp_access_token',
        phoneNumberId: 'your_phone_number_id',
        webhookVerifyToken: 'your_webhook_verify_token',
        encrypted: false
      }
    }
  });
  console.log('📱 Created WhatsApp provider:', whatsappProvider.name);

  const twilioProvider = await prisma.provider.upsert({
    where: { name: 'Twilio SMS' },
    update: {},
    create: {
      name: 'Twilio SMS',
      type: 'sms',
      status: 'inactive',
      config: {
        accountSid: 'your_twilio_account_sid',
        authToken: 'your_twilio_auth_token',
        phoneNumber: '+1234567890',
        encrypted: false
      }
    }
  });
  console.log('📱 Created Twilio provider:', twilioProvider.name);

  const gmailProvider = await prisma.provider.upsert({
    where: { name: 'Gmail' },
    update: {},
    create: {
      name: 'Gmail',
      type: 'email',
      status: 'inactive',
      config: {
        clientId: 'your_gmail_client_id',
        clientSecret: 'your_gmail_client_secret',
        refreshToken: 'your_gmail_refresh_token',
        encrypted: false
      }
    }
  });
  console.log('📧 Created Gmail provider:', gmailProvider.name);

  const facebookProvider = await prisma.provider.upsert({
    where: { name: 'Facebook Messenger' },
    update: {},
    create: {
      name: 'Facebook Messenger',
      type: 'facebook',
      status: 'inactive',
      config: {
        pageAccessToken: 'your_facebook_page_access_token',
        webhookVerifyToken: 'your_facebook_webhook_verify_token',
        appSecret: 'your_facebook_app_secret',
        encrypted: false
      }
    }
  });
  console.log('📘 Created Facebook provider:', facebookProvider.name);

  const instagramProvider = await prisma.provider.upsert({
    where: { name: 'Instagram DM' },
    update: {},
    create: {
      name: 'Instagram DM',
      type: 'instagram',
      status: 'inactive',
      config: {
        accessToken: 'your_instagram_access_token',
        webhookVerifyToken: 'your_instagram_webhook_verify_token',
        appSecret: 'your_instagram_app_secret',
        encrypted: false
      }
    }
  });
  console.log('📷 Created Instagram provider:', instagramProvider.name);

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