import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();
const webhookController = new WebhookController();

/**
 * POST /api/v1/webhooks/events
 * Webhook receiver endpoint with idempotency
 */
router.post('/events', webhookController.handleWebhook);

export default router;
