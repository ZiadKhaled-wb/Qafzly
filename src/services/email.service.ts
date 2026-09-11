import sgMail from '@sendgrid/mail';
import { config } from '../config/env';
import { logger } from '../config/logger';

if (config.sendgridApiKey) {
    sgMail.setApiKey(config.sendgridApiKey);
}

export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {

    if (process.env.NODE_ENV === 'test') {
        console.log('Test mode: email sending skipped.');
        return;
    }

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

export const sendPaymentInstructions = async (
    to: string,
    data: {
        pathName: string;
        amount: string;
        currency: string;
        referenceCode: string;
        vodafoneNumber: string;
        instapayNumber: string;
    }
    ) => {
    const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; background-color: #f4f7f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2C3E50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .payment-details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #2C3E50; }
            .reference-code { font-size: 22px; font-weight: bold; color: #2C3E50; direction: ltr; display: inline-block; }
            .instructions { margin: 15px 0; padding: 0 20px; }
            .instructions ol { padding-right: 20px; }
            .instructions li { margin-bottom: 8px; line-height: 1.5; }
            .note { background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #ffc107; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
            <h1>شكراً لاختيارك Qafzly</h1>
            </div>
            <div class="content">
            <h2>تفاصيل الدفع</h2>
            <div class="payment-details">
                <p><strong>الدورة:</strong> ${data.pathName}</p>
                <p><strong>المبلغ:</strong> ${data.amount} ${data.currency}</p>
                <p><strong>رمز المرجع:</strong> <span class="reference-code">${data.referenceCode}</span></p>
            </div>
            
            <h3>طريقة الدفع: فودافون كاش</h3>
            <div class="instructions">
                <ol>
                <li>افتح تطبيق فودافون كاش</li>
                <li>اختر "تحويل أموال"</li>
                <li>أدخل الرقم: <strong>${data.vodafoneNumber}</strong></li>
                <li>أدخل المبلغ: <strong>${data.amount} ${data.currency}</strong></li>
                <li>اكتب رمز المرجع في رسالة التحويل: <strong>${data.referenceCode}</strong></li>
                <li>اضغط على "إرسال"</li>
                <li>عد إلى المنصة واضغط على "أكدت الدفع"</li>
                </ol>
            </div>

            <h3>طريقة الدفع: إنستا باي</h3>
            <div class="instructions">
                <ol>
                <li>افتح تطبيق إنستا باي</li>
                <li>اختر "تحويل"</li>
                <li>أدخل رقم الهاتف: <strong>${data.instapayNumber}</strong></li>
                <li>أدخل المبلغ: <strong>${data.amount} ${data.currency}</strong></li>
                <li>أضف رمز المرجع في البيان: <strong>${data.referenceCode}</strong></li>
                <li>اضغط على "تأكيد"</li>
                <li>عد إلى المنصة واضغط على "أكدت الدفع"</li>
                </ol>
            </div>
            
            <div class="note">
                <strong>ملاحظة مهمة:</strong> سيتم تفعيل اشتراكك خلال 24 ساعة عمل بعد تأكيد الدفع.
            </div>
            
            <p>إذا واجهت أي مشكلة، يرجى التواصل معنا على support@qafzly.com</p>
            </div>
            <div class="footer">
            Qafzly - منصة التعليم المتكاملة
            </div>
        </div>
        </body>
        </html>
    `;
    await sendEmail(to, 'تعليمات الدفع - Qafzly', html);
};

export const sendPaymentActivationConfirmation = async (
    to: string,
    data: { pathName: string; durationMonths: number; endDate: string }
    ) => {
    const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; background-color: #f4f7f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
            <h1>تم تفعيل اشتراكك بنجاح</h1>
            </div>
            <div class="content">
            <p>عزيزي المستخدم،</p>
            <p>نود إعلامك بأنه تم تفعيل اشتراكك في الدورة التالية:</p>
            <div class="details">
                <p><strong>الدورة:</strong> ${data.pathName}</p>
                <p><strong>مدة الاشتراك:</strong> ${data.durationMonths} ${data.durationMonths > 1 ? 'أشهر' : 'شهر'}</p>
                <p><strong>ينتهي في:</strong> ${data.endDate}</p>
            </div>
            <p>يمكنك الآن الوصول إلى محتوى الدورة والبدء في التعلم.</p>
            <p>إذا كان لديك أي استفسار، لا تتردد في التواصل معنا.</p>
            </div>
            <div class="footer">
            Qafzly - منصة التعليم المتكاملة
            </div>
        </div>
        </body>
        </html>
    `;
    await sendEmail(to, 'تم تفعيل اشتراكك - Qafzly', html);
};

export const sendPaymentRejection = async (
    to: string,
    data: { pathName: string; reason: string }
    ) => {
    const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; background-color: #f4f7f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
            <h1>تم رفض طلب الدفع</h1>
            </div>
            <div class="content">
            <p>عزيزي المستخدم،</p>
            <p>نأسف لإبلاغك بأنه تم رفض طلب الدفع الخاص بك للدورة: <strong>${data.pathName}</strong></p>
            <p><strong>سبب الرفض:</strong> ${data.reason}</p>
            <p>إذا كنت تعتقد أن هذا القرار غير صحيح، يرجى التواصل معنا على support@qafzly.com.</p>
            </div>
            <div class="footer">
            Qafzly - منصة التعليم المتكاملة
            </div>
        </div>
        </body>
        </html>
    `;
    await sendEmail(to, 'تم رفض طلب الدفع - Qafzly', html);
};

export const sendNotificationEmail = async (
        to: string,
        data: { title: string; body: string; link?: string }
    ): Promise<void> => {
    const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; background-color: #f4f7f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2C3E50; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 20px; }
            .content { background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .notification-body { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #2C3E50; }
            .link { color: #2C3E50; text-decoration: underline; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
            <h1>${data.title}</h1>
            </div>
            <div class="content">
            <div class="notification-body">
                <p>${data.body}</p>
            </div>
            ${data.link ? `<p><a class="link" href="${data.link}">عرض التفاصيل</a></p>` : ''}
            </div>
            <div class="footer">
            Qafzly - منصة التعليم المتكاملة
            </div>
        </div>
        </body>
        </html>
    `;
    await sendEmail(to, `إشعار: ${data.title}`, html);
};