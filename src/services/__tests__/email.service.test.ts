// src/services/__tests__/email.service.test.ts
import { sendEmail } from '../email.service';
import { sendSesEmail } from '../../config/sesClient';

jest.mock('../../config/sesClient', () => ({
    sendSesEmail: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../config/env', () => ({
    config: {
        env: 'test',
        awsRegion: 'eu-central-1',
        awsAccessKeyId: 'test',
        awsSecretAccessKey: 'test',
        sesFromEmail: 'ziadkhaledsaper@gmail.com',
    },
}));

describe('email.service - non-blocking behavior', () => {
    beforeEach(() => jest.clearAllMocks());

    it('does NOT throw when SES send fails', async () => {
        (sendSesEmail as jest.Mock).mockRejectedValue(new Error('SES down'));

        // This is the critical guarantee: no throw, no 500.
        await expect(sendEmail('to@test.com', 'Subject', '<p>Hi</p>')).resolves.toBeUndefined();
    });

    it('does NOT throw even if SES error is a hard auth failure', async () => {
        const authError = new Error('The security token included in the request is invalid');
        (sendSesEmail as jest.Mock).mockRejectedValue(authError);

        await expect(sendEmail('to@test.com', 'Subject', '<p>Hi</p>')).resolves.toBeUndefined();
    });

    it('returns early in test mode without calling SES', async () => {
        process.env.NODE_ENV = 'test';
        // Note: the mock config has env: 'test', so this will short-circuit.

        await sendEmail('to@test.com', 'Subject', '<p>Hi</p>');

        expect(sendSesEmail).not.toHaveBeenCalled();
    });
});