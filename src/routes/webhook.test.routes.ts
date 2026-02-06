import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/webhooks/generate-signature
 * Generate valid HMAC signature for testing webhook endpoint
 */
router.post('/generate-signature', (req: Request, res: Response) => {
  const payload = req.body;
  
  if (!config.webhook.secret) {
    return res.status(400).json({
      success: false,
      message: 'WEBHOOK_SECRET not configured in .env',
      hint: 'Set WEBHOOK_SECRET=your_secret_key in .env file',
    });
  }
  
  // Generate HMAC signature
  const signature = crypto
    .createHmac('sha256', config.webhook.secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  logger.info('Generated webhook signature for testing', {
    payloadKeys: Object.keys(payload),
  });
  
  return res.json({
    success: true,
    message: 'Signature generated successfully',
    payload: payload,
    signature: signature,
    curlCommand: `curl -X POST http://localhost:3000/api/v1/webhooks/events \\
  -H "Content-Type: application/json" \\
  -H "X-Idempotency-Key: ${payload.id || 'test-123'}" \\
  -H "X-Webhook-Signature: ${signature}" \\
  -d '${JSON.stringify(payload)}'`,
  });
});

/**
 * POST /api/v1/webhooks/test
 * Test webhook endpoint without signature verification (for testing only)
 */
router.post('/test', async (req: Request, res: Response) => {
  const { body } = req;
  const idempotencyKey = req.headers['x-idempotency-key'] as string || body.id || `test-${Date.now()}`;
  
  logger.info('Test webhook received (no signature verification)', {
    idempotencyKey,
    eventType: body.type,
  });
  
  return res.json({
    success: true,
    message: 'Test webhook processed (signature verification bypassed)',
    receivedPayload: body,
    idempotencyKey,
    note: 'This endpoint is for testing only. Use /api/v1/webhooks/events for production with signature verification.',
  });
});

export default router;
