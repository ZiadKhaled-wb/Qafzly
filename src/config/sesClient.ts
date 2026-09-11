// src/config/sesClient.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from './env';
import { logger } from './logger';

// Create the SES client.
// Credentials are automatically resolved from environment variables
// (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) or IAM roles.
export const sesClient = new SESClient({
    region: config.awsRegion,
    // The SDK automatically looks for credentials in the environment,
    // so we don't need to pass accessKeyId or secretAccessKey explicitly.
    maxAttempts: 3, // Retry failed sends up to 3 times with backoff
});

export interface SendEmailParams {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Sends an email via Amazon SES.
 * Throws an error if the send fails — callers are responsible for
 * catching it and deciding whether to log or propagate.
 */
export const sendSesEmail = async (params: SendEmailParams): Promise<string> => {
    const command = new SendEmailCommand({
        Source: params.from,
        Destination: {
            ToAddresses: [params.to],
        },
        Message: {
            Subject: {
                Data: params.subject,
                Charset: 'UTF-8',
            },
            Body: {
                Html: {
                    Data: params.html,
                    Charset: 'UTF-8',
                },
                // Plain text fallback for clients that don't support HTML
                Text: {
                    Data: params.text || params.html.replace(/<[^>]*>/g, ''), // Crude HTML strip
                    Charset: 'UTF-8',
                },
            },
        },
    });

    try {
        const response = await sesClient.send(command);
        logger.info({ to: params.to, messageId: response.MessageId }, 'Email sent via SES');
        return response.MessageId!;
    } catch (error: any) {
        logger.error(
            { error, to: params.to, subject: params.subject },
            'Failed to send email via SES'
        );
        throw new Error('فشل إرسال البريد الإلكتروني عبر Amazon SES');
    }
};