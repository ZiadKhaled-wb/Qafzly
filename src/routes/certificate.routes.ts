import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as certificateController from '../controllers/certificate.controller';
import {
    listCertificatesQuerySchema,
    certificateIdParamSchema,
    certificateCodeParamSchema,
    adminIssueCertificateSchema,
    revokeCertificateSchema,
} from '../utils/validators/certificate.schema';

const router = Router();

// ----- Public verification (must come before /:id) -----
router.get(
    '/verify/:code',
    validate(certificateCodeParamSchema),
    certificateController.verifyCertificate
);

// ----- Authenticated user routes -----
router.get(
    '/me',
    authenticate,
    validate(listCertificatesQuerySchema),
    certificateController.listMyCertificates
);

router.get(
    '/:id/download',
    authenticate,
    validate(certificateIdParamSchema),
    certificateController.getCertificateDownloadUrl
);

router.get(
    '/:id',
    authenticate,
    validate(certificateIdParamSchema),
    certificateController.getCertificate
);

// ----- Admin routes -----
router.post(
    '/admin/issue',
    authenticate,
    authorize('ADMIN'),
    validate(adminIssueCertificateSchema),
    certificateController.adminIssueCertificate
);

router.post(
    '/admin/:id/revoke',
    authenticate,
    authorize('ADMIN'),
    validate(revokeCertificateSchema),
    certificateController.revokeCertificate
);

export default router;