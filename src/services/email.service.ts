// src/services/email.service.ts
import { config } from '../config/env';
import { logger } from '../config/logger';
import { sendSesEmail } from '../config/sesClient';

/**
 * Sends an email via Amazon SES.
 *
 * IMPORTANT: This function NEVER throws. Failures are logged and swallowed.
 * This ensures that email outages never break critical API flows such as
 * creating a payment request or activating an enrollment.
 *
 * Callers should treat email as a best-effort side effect.
 */
export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
    if (process.env.NODE_ENV === 'test') {
        logger.debug('Test mode: email sending skipped.');
        return;
    }

    // Short-circuit for local dev when no SES credentials are configured.
    // In production, AWS credentials are always present (IAM role or env vars).
    const hasAwsCreds =
        config.awsAccessKeyId ||
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_PROFILE; // From ~/.aws/credentials

    if (!hasAwsCreds && config.env !== 'production') {
        logger.info(`[DEV] Would send email to ${to}: ${subject}`);
        return;
    }

    try {
        await sendSesEmail({
            to,
            from: config.sesFromEmail, // We'll rename this env var later
            subject,
            html,
        });
    } catch (error) {
        // Swallow the error — email is a best-effort notification.
        // Log it so operations can investigate, but never propagate.
        logger.error(
            { error, to, subject },
            'Email send failed — continuing without blocking the request'
        );
    }
};

// ============================================================================
// All template functions below are UNCHANGED except for their import path.
// Their signatures, HTML bodies, and Arabic subjects remain exactly as-is.
// ============================================================================

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
): Promise<void> => {
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
): Promise<void> => {
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
): Promise<void> => {
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

export const sendCertificateIssuedEmail = async (
    to: string,
    data: { userName: string; pathTitle: string; certificateCode: string; downloadUrl: string }
): Promise<void> => {
    const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; background-color: #f4f7f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2C3E50 0%, #C9A961 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background-color: #ffffff; padding: 25px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .cert-box { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #C9A961; text-align: center; }
            .code { font-size: 20px; font-weight: bold; color: #2C3E50; direction: ltr; display: inline-block; letter-spacing: 2px; }
            .btn { display: inline-block; background-color: #2C3E50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
            <h1>🎉 مبروك ${data.userName}!</h1>
            </div>
            <div class="content">
            <p>يسعدنا إبلاغك بأنك أتممت بنجاح مسار <strong>${data.pathTitle}</strong> وحصلت على شهادة إتمام.</p>
            <div class="cert-box">
                <p style="margin: 0 0 10px 0; color: #666;">رمز التحقق من الشهادة</p>
                <span class="code">${data.certificateCode}</span>
            </div>
            <p>يمكنك تحميل نسخة PDF من شهادتك ومشاركتها مع أصدقائك وعائلتك.</p>
            <div style="text-align: center;">
                <a href="${data.downloadUrl}" class="btn">عرض الشهادة</a>
            </div>
            <p style="margin-top: 25px; color: #666; font-size: 14px;">
                يمكن التحقق من صحة الشهادة في أي وقت عبر إدخال رمز التحقق على موقع قفزلي.
            </p>
            </div>
            <div class="footer">
            Qafzly - منصة التعليم المتكاملة
            </div>
        </div>
        </body>
        </html>
    `;
    await sendEmail(to, `🎓 شهادة إتمام - ${data.pathTitle}`, html);
};

// ============================================================================
// Sprint 13 / Item 2 — Weekly Summary Digest
// ============================================================================

export interface WeeklySummaryEmailData {
    fullName: string;
    xpEarned: number;
    lessonsCompleted: number;
    currentStreak: number;
    longestStreak: number;
    rank: number;
    rankChange: number | null;
    badgesEarned: Array<{ name: string; nameEn: string | null; iconUrl: string | null }>;
    certificatesEarned: number;
    bossBattlesWon: number;
}

/**
 * Weekly digest email — Arabic, RTL, branded.
 * Non-throwing: delegates to sendEmail, which swallows and logs failures.
 *
 * The "quiet week" body fires when the user had zero activity in the period
 * (per PM decision: send anyway to re-engage).
 */
export const sendWeeklySummaryEmail = async (
    to: string,
    data: WeeklySummaryEmailData
): Promise<void> => {
    const isQuietWeek =
        data.xpEarned === 0 &&
        data.lessonsCompleted === 0 &&
        data.badgesEarned.length === 0 &&
        data.certificatesEarned === 0 &&
        data.bossBattlesWon === 0;

    const subject = isQuietWeek
        ? 'افتقدناك هذا الأسبوع! 👋 - Qafztk'
        : `ملخصك الأسبوعي: ${data.xpEarned} XP 🎉 - Qafztk`;

    const statRow = (label: string, value: string) => `
        <tr>
            <td style="padding: 10px 0; color: #555; font-size: 15px; border-bottom: 1px solid #f0f0f0;">${label}</td>
            <td style="padding: 10px 0; color: #2C3E50; font-size: 16px; font-weight: 700; text-align: left; border-bottom: 1px solid #f0f0f0;">${value}</td>
        </tr>`;

    const rankLine =
        data.rankChange === null
            ? `<p style="margin: 12px 0 0; color: #666; font-size: 14px;">ترتيبك الحالي: <strong style="color: #2C3E50;">#${data.rank}</strong></p>`
            : data.rankChange > 0
              ? `<p style="margin: 12px 0 0; color: #16a34a; font-size: 14px;">🚀 تقدمت <strong>${data.rankChange}</strong> مركز — ترتيبك الحالي <strong>#${data.rank}</strong></p>`
              : data.rankChange < 0
                ? `<p style="margin: 12px 0 0; color: #dc2626; font-size: 14px;">ترتيبك الحالي <strong>#${data.rank}</strong> — أكمل درساً للصعود تاني!</p>`
                : `<p style="margin: 12px 0 0; color: #666; font-size: 14px;">ترتيبك مستقر عند <strong style="color: #2C3E50;">#${data.rank}</strong></p>`;

    const badgesBlock =
        data.badgesEarned.length > 0
            ? `
            <div style="margin-top: 20px; padding: 16px; background-color: #fff7ed; border-radius: 8px; border-right: 4px solid #C9A961;">
                <p style="margin: 0 0 8px; font-weight: 700; color: #2C3E50; font-size: 15px;">🏅 شارات جديدة</p>
                <ul style="margin: 0; padding-right: 20px; color: #2C3E50; line-height: 1.8;">
                    ${data.badgesEarned
                        .map((b) => `<li>${b.name}</li>`)
                        .join('')}
                </ul>
            </div>`
            : '';

    const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; background-color: #f4f7f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2C3E50 0%, #C9A961 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 8px 0 0; font-size: 15px; opacity: 0.9; }
            .content { background-color: #ffffff; padding: 25px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .stats-box { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #C9A961; }
            .stats-table { width: 100%; border-collapse: collapse; }
            .btn { display: inline-block; background-color: #2C3E50; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; line-height: 1.6; }
            .footer a { color: #666; text-decoration: underline; }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
            <h1>${isQuietWeek ? 'افتقدناك هذا الأسبوع 👋' : 'ملخصك الأسبوعي 📊'}</h1>
            <p>أهلاً ${data.fullName}</p>
            </div>
            <div class="content">
            <p style="color: #555; font-size: 15px; line-height: 1.7;">
                ${isQuietWeek
                    ? 'ملاحظناش نشاط منك الأسبوع ده — لكن الباب مفتوح دايماً! ابدأ درساً جديداً وارجع للمنافسة.'
                    : 'إليك ملخص إنجازاتك خلال الأسبوع الماضي:'}
            </p>

            <div class="stats-box">
                <table class="stats-table">
                    ${statRow('XP تم جمعه', String(data.xpEarned))}
                    ${statRow('دروس مكتملة', String(data.lessonsCompleted))}
                    ${statRow('🔥 ستريك حالي', `${data.currentStreak} ${data.currentStreak === 1 ? 'يوم' : 'أيام'}`)}
                    ${statRow('أطول ستريك', `${data.longestStreak} ${data.longestStreak === 1 ? 'يوم' : 'أيام'}`)}
                    ${data.certificatesEarned > 0 ? statRow('🎓 شهادات جديدة', String(data.certificatesEarned)) : ''}
                    ${data.bossBattlesWon > 0 ? statRow('👾 معارك زعماء مكسوبة', String(data.bossBattlesWon)) : ''}
                </table>
                ${rankLine}
            </div>

            ${badgesBlock}

            <div style="margin-top: 28px; text-align: center;">
                <a href="${config.frontendUrl}/dashboard" class="btn">كمّل رحلتك في مدينة الكمبيوتر</a>
            </div>
            </div>
            <div class="footer">
                وصلتك هذه الرسالة لأنك مسجل في Qafztk.<br>
                لتغيير تفضيلات البريد، افتح إعدادات الخصوصية في حسابك.<br>
                Qafztk - منصة التعليم المتكاملة
            </div>
        </div>
        </body>
        </html>
    `;
    await sendEmail(to, subject, html);
};