import sgMail from '@sendgrid/mail';
import { config } from '../config/env';
import { logger } from '../config/logger';

if (config.sendgridApiKey) {
    sgMail.setApiKey(config.sendgridApiKey);
}

export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
    if (!config.sendgridApiKey) {
        logger.info(`[DEV] Would send email to ${to}: ${subject}`);
        return;
    }

    const msg = {
        to,
        from: config.sendgridFromEmail,
        subject,
        html,
    };

    try {
        await sgMail.send(msg);
        logger.info(`Email sent to ${to}`);
    } catch (error) {
        logger.error({ error, to, subject }, 'Failed to send email');
        throw new Error('فشل إرسال البريد الإلكتروني');
    }
};

export const sendPasswordResetEmail = async (to: string, resetToken: string): Promise<void> => {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    const html = `
        <div dir="rtl">
        <h2>إعادة تعيين كلمة المرور</h2>
        <p>لقد طلبت إعادة تعيين كلمة المرور. اضغط على الرابط التالي:</p>
        <a href="${resetUrl}">إعادة تعيين كلمة المرور</a>
        <p>هذا الرابط صالح لمدة 15 دقيقة فقط.</p>
        </div>
    `;
    await sendEmail(to, 'إعادة تعيين كلمة المرور - Qafzly', html);
};