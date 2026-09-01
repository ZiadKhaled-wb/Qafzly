import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as paymentController from '../controllers/payment.controller';
import {
    createPaymentRequestSchema,
    markPaymentSentSchema,
    listPaymentRequestsQuerySchema,
    activatePaymentRequestSchema,
    rejectPaymentRequestSchema,
} from '../utils/validators/payment.schema';

const router = Router();

// User routes (authenticated)
router.post('/requests', authenticate, validate(createPaymentRequestSchema), paymentController.createPaymentRequest);
router.get('/requests', authenticate, validate(listPaymentRequestsQuerySchema), paymentController.listUserPaymentRequests);
router.post('/requests/:id/mark-sent', authenticate, validate(markPaymentSentSchema), paymentController.markPaymentAsSent);

// Admin routes
router.get('/admin/requests', authenticate, authorize('ADMIN'), validate(listPaymentRequestsQuerySchema), paymentController.listAllPaymentRequests);
router.post('/admin/requests/:id/activate', authenticate, authorize('ADMIN'), validate(activatePaymentRequestSchema), paymentController.activatePaymentRequest);
router.post('/admin/requests/:id/reject', authenticate, authorize('ADMIN'), validate(rejectPaymentRequestSchema), paymentController.rejectPaymentRequest);

export default router;