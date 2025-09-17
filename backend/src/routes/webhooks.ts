import { Router, Request, Response } from 'express';
import { ProviderService, ProviderFactory } from '../services/providers/ProviderFactory';
import { WebhookPayload } from '../services/providers/types';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Middleware to parse raw body for signature validation
const getRawBody = (req: Request, res: Response, next: Function) => {
  if (req.headers['content-type']?.includes('application/json')) {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.body = JSON.parse(data);
      (req as any).rawBody = data;
      next();
    });
  } else {
    next();
  }
};

// WhatsApp webhook
router.get('/whatsapp', async (req: Request, res: Response): Promise<void> => {
  try {
    // Webhook verification for WhatsApp
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe') {
      // TODO: Get verify token from provider config
      const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'your_verify_token';
      
      if (token === expectedToken) {
        console.log('WhatsApp webhook verified');
        res.status(200).send(challenge);
        return;
      } else {
        console.log('WhatsApp webhook verification failed');
        res.status(403).send('Verification failed');
        return;
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('WhatsApp webhook verification error:', error);
    res.status(500).send('Error');
  }
});

router.post('/whatsapp', getRawBody, async (req: Request, res: Response): Promise<void> => {
  try {
    // Find WhatsApp provider(s)
    const providers = await prisma.provider.findMany({
      where: { type: 'whatsapp', status: 'active' }
    });

    if (providers.length === 0) {
      console.log('No active WhatsApp providers found');
      res.status(200).send('OK');
      return;
    }

    // Process webhook for each provider (in case multiple WhatsApp accounts)
    for (const provider of providers) {
      try {
        const webhookPayload: WebhookPayload = {
          providerId: provider.id,
          signature: req.headers['x-hub-signature-256'] as string,
          timestamp: new Date(),
          data: req.body,
          headers: req.headers as Record<string, string>
        };

        // Initialize adapter if not exists
        if (!ProviderFactory.getAdapter(provider.id)) {
          ProviderFactory.createAdapter(provider.id, {
            type: 'whatsapp',
            credentials: provider.config as Record<string, string>,
            settings: {}
          });
        }

        // Validate signature
        if (!ProviderService.validateWebhookSignature(provider.id, webhookPayload)) {
          console.log('WhatsApp webhook signature validation failed for provider:', provider.id);
          continue;
        }

        // Process messages
        const messages = await ProviderService.processWebhook(provider.id, webhookPayload);
        
        // Store messages in database
        for (const message of messages) {
          await prisma.message.create({
            data: {
              providerMessageId: message.providerMessageId,
              providerId: provider.id,
              channel: message.channel as any,
              direction: message.direction as any,
              fromIdentifier: message.fromIdentifier,
              toIdentifier: message.toIdentifier,
              body: message.content,
              timestamp: message.timestamp,
              providerMeta: message.metadata,
              status: 'processed'
            }
          });
        }

        console.log(`Processed ${messages.length} WhatsApp messages for provider ${provider.id}`);
      } catch (error) {
        console.error('Error processing WhatsApp webhook for provider:', provider.id, error);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('WhatsApp webhook processing error:', error);
    res.status(500).send('Error');
  }
});

// Twilio webhook
router.post('/twilio', async (req: Request, res: Response): Promise<void> => {
  try {
    // Find Twilio provider(s)
    const providers = await prisma.provider.findMany({
      where: { type: 'sms', status: 'active' }
    });

    if (providers.length === 0) {
      console.log('No active Twilio providers found');
      res.status(200).send('OK');
      return;
    }

    // Process webhook for each provider
    for (const provider of providers) {
      try {
        const webhookPayload: WebhookPayload = {
          providerId: provider.id,
          signature: req.headers['x-twilio-signature'] as string,
          timestamp: new Date(),
          data: req.body,
          headers: req.headers as Record<string, string>
        };

        // Initialize adapter if not exists
        if (!ProviderFactory.getAdapter(provider.id)) {
          ProviderFactory.createAdapter(provider.id, {
            type: 'twilio',
            credentials: provider.config as Record<string, string>,
            settings: {}
          });
        }

        // Validate signature
        if (!ProviderService.validateWebhookSignature(provider.id, webhookPayload)) {
          console.log('Twilio webhook signature validation failed for provider:', provider.id);
          continue;
        }

        // Process messages
        const messages = await ProviderService.processWebhook(provider.id, webhookPayload);
        
        // Store messages in database
        for (const message of messages) {
          await prisma.message.create({
            data: {
              providerMessageId: message.providerMessageId,
              providerId: provider.id,
              channel: message.channel as any,
              direction: message.direction as any,
              fromIdentifier: message.fromIdentifier,
              toIdentifier: message.toIdentifier,
              body: message.content,
              timestamp: message.timestamp,
              providerMeta: message.metadata,
              status: 'processed'
            }
          });
        }

        console.log(`Processed ${messages.length} Twilio messages for provider ${provider.id}`);
      } catch (error) {
        console.error('Error processing Twilio webhook for provider:', provider.id, error);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Twilio webhook processing error:', error);
    res.status(500).send('Error');
  }
});

// Facebook webhook (placeholder)
router.get('/facebook', async (req: Request, res: Response): Promise<void> => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe') {
      const expectedToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'your_verify_token';
      
      if (token === expectedToken) {
        console.log('Facebook webhook verified');
        res.status(200).send(challenge);
        return;
      }
    }

    res.status(403).send('Verification failed');
  } catch (error) {
    console.error('Facebook webhook verification error:', error);
    res.status(500).send('Error');
  }
});

router.post('/facebook', getRawBody, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Facebook webhook received:', JSON.stringify(req.body, null, 2));
    // TODO: Implement Facebook Messenger webhook processing
    res.status(200).send('OK');
  } catch (error) {
    console.error('Facebook webhook processing error:', error);
    res.status(500).send('Error');
  }
});

// Instagram webhook (placeholder)
router.get('/instagram', async (req: Request, res: Response): Promise<void> => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe') {
      const expectedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'your_verify_token';
      
      if (token === expectedToken) {
        console.log('Instagram webhook verified');
        res.status(200).send(challenge);
        return;
      }
    }

    res.status(403).send('Verification failed');
  } catch (error) {
    console.error('Instagram webhook verification error:', error);
    res.status(500).send('Error');
  }
});

router.post('/instagram', getRawBody, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Instagram webhook received:', JSON.stringify(req.body, null, 2));
    // TODO: Implement Instagram webhook processing
    res.status(200).send('OK');
  } catch (error) {
    console.error('Instagram webhook processing error:', error);
    res.status(500).send('Error');
  }
});

// Gmail webhook (placeholder)
router.post('/gmail', getRawBody, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Gmail webhook received:', JSON.stringify(req.body, null, 2));
    // TODO: Implement Gmail webhook processing
    res.status(200).send('OK');
  } catch (error) {
    console.error('Gmail webhook processing error:', error);
    res.status(500).send('Error');
  }
});

export default router;