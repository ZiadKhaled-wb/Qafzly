import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      throw new AppError(401, 'Authentication required');
    }
    if (!roles.includes(user.role)) {
      throw new AppError(403, 'غير مصرح لك بالوصول');
    }
    next();
  };
};