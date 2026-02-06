import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { BadRequestError } from '../types/errors';

/**
 * Middleware to validate request using express-validator
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    void res;
    // Run all validations
    for (const validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((err) => err.msg).join(', ');
      return next(new BadRequestError(errorMessages));
    }

    next();
  };
};
