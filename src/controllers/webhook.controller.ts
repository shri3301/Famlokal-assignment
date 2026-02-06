import { Request, Response, NextFunction } from 'express';
import { cacheGet, cacheSet } from '../infrastructure/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { BadRequestError } from '../types/errors';
import crypto from 'crypto';

export class WebhookController {
  /**
   * POST /api/v1/webhooks/events
   * Webhook receiver with idempotency and safe retry handling
   */
  public handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { body, headers } = req;

      // 1. Verify webhook signature
      const signature = headers['x-webhook-signature'] as string;
      if (!this.verifySignature(JSON.stringify(body), signature)) {
        throw new BadRequestError('Invalid webhook signature');
      }

      // 2. Check idempotency (prevent duplicate processing)
      const idempotencyKey = headers['x-idempotency-key'] as string || body.id;
      if (!idempotencyKey) {
        throw new BadRequestError('Missing idempotency key');
      }

      const isProcessed = await this.checkIdempotency(idempotencyKey);
      if (isProcessed) {
        logger.info('Webhook already processed (idempotent)', { idempotencyKey });
        // Return 200 to acknowledge (prevents retries)
        res.status(200).json({
          success: true,
          message: 'Event already processed',
        });
        return;
      }

      // 3. Process webhook payload
      logger.info('Processing webhook event', {
        idempotencyKey,
        eventType: body.type,
      });

      // TODO: Implement actual webhook processing logic
      await this.processWebhookEvent(body);

      // 4. Mark as processed (store idempotency key)
      await this.markAsProcessed(idempotencyKey);

      // 5. Return success response
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      // Log error but still return 200 to prevent unnecessary retries
      // Only return error status for client errors (4xx)
      if (error instanceof BadRequestError) {
        next(error);
      } else {
        logger.error('Error processing webhook', error);
        res.status(200).json({
          success: false,
          message: 'Webhook received but processing failed',
        });
      }
    }
  };

  /**
   * Verify webhook signature using HMAC
   */
  private verifySignature(payload: string, signature: string): boolean {
    if (!signature || !config.webhook.secret) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.webhook.secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Check if webhook has already been processed
   */
  private async checkIdempotency(key: string): Promise<boolean> {
    const cacheKey = `webhook:idempotency:${key}`;
    const cached = await cacheGet(cacheKey);
    return cached !== null;
  }

  /**
   * Mark webhook as processed
   */
  private async markAsProcessed(key: string): Promise<void> {
    const cacheKey = `webhook:idempotency:${key}`;
    await cacheSet(cacheKey, '1', config.webhook.idempotencyTTL);
  }

  /**
   * Process webhook event
   * TODO: Implement actual business logic
   */
  private async processWebhookEvent(payload: any): Promise<void> {
    // TODO: Implement webhook processing logic based on event type
    // Examples:
    // - Update database records
    // - Trigger background jobs
    // - Send notifications
    // - Update cache
    
    logger.info('Webhook event processed', {
      eventType: payload.type,
      eventId: payload.id,
    });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
