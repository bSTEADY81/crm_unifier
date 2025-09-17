import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedProviders() {
  console.log('Seeding providers...');

  // Create sample providers
  const providers = [
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      name: 'WhatsApp Business',
      type: 'whatsapp',
      status: 'inactive', // Inactive until real credentials are provided
      config: {
        accessToken: 'your_whatsapp_access_token',
        phoneNumberId: 'your_phone_number_id',
        webhookVerifyToken: 'your_webhook_verify_token'
      },
      lastHealthCheck: new Date()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440011',
      name: 'Twilio SMS',
      type: 'sms',
      status: 'inactive', // Inactive until real credentials are provided
      config: {
        accountSid: 'your_twilio_account_sid',
        authToken: 'your_twilio_auth_token',
        phoneNumber: '+1234567890'
      },
      lastHealthCheck: new Date()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440012',
      name: 'Gmail',
      type: 'email',
      status: 'inactive', // Inactive until real credentials are provided
      config: {
        email: 'your-email@gmail.com',
        clientId: 'your_gmail_client_id',
        clientSecret: 'your_gmail_client_secret',
        refreshToken: 'your_gmail_refresh_token'
      },
      lastHealthCheck: new Date()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440013',
      name: 'Facebook Messenger',
      type: 'facebook',
      status: 'inactive', // Inactive until real credentials are provided
      config: {
        pageAccessToken: 'your_facebook_page_access_token',
        webhookVerifyToken: 'your_facebook_webhook_verify_token',
        appSecret: 'your_facebook_app_secret'
      },
      lastHealthCheck: new Date()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440014',
      name: 'Instagram DM',
      type: 'instagram',
      status: 'inactive', // Inactive until real credentials are provided
      config: {
        accessToken: 'your_instagram_access_token',
        webhookVerifyToken: 'your_instagram_webhook_verify_token',
        appSecret: 'your_instagram_app_secret'
      },
      lastHealthCheck: new Date()
    }
  ];

  // Upsert providers (create if not exists, update if exists)
  for (const provider of providers) {
    await prisma.provider.upsert({
      where: { id: provider.id },
      update: {
        name: provider.name,
        type: provider.type as any,
        status: provider.status as any,
        config: provider.config,
        lastHealthCheck: provider.lastHealthCheck
      },
      create: provider as any
    });
  }

  console.log(`Successfully seeded ${providers.length} providers`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedProviders()
    .catch((error) => {
      console.error('Error seeding providers:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}