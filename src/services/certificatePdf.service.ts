import PDFDocument from 'pdfkit';
import path from 'path';
import { ArabicShaper } from 'arabic-persian-reshaper';
import { logger } from '../config/logger';

const FONT_REGULAR = path.join(process.cwd(), 'src', 'assets', 'fonts', 'NotoNaskhArabic-Regular.ttf');
const FONT_BOLD    = path.join(process.cwd(), 'src', 'assets', 'fonts', 'NotoNaskhArabic-Bold.ttf');

const COLORS = {
    primary: '#2C3E50',
    gold:    '#C9A961',
    text:    '#1A1A1A',
    muted:   '#666666',
};

/**
 * Shape Arabic and reverse for RTL rendering.
 *
 * PDFKit does not perform bidirectional text layout — it renders glyphs
 * left-to-right in the order given. `arabic-persian-reshaper` substitutes
 * contextual glyph forms; we then reverse the string so RTL reads correctly.
 */
const shapeAr = (text: string): string => {
    const shaped = ArabicShaper.convertArabic(text);
    return shaped.split('').reverse().join('');
};

/**
 * Draw centered text, shrinking the font size until it fits the available width.
 * `rtl` selects between shaped Arabic (reversed) and plain LTR text.
 */
const drawCentered = (
    doc: PDFKit.PDFDocument,
    text: string,
    y: number,
    maxWidth: number,
    preferredSize: number,
    opts: { bold?: boolean; color?: string; rtl?: boolean; minSize?: number } = {}
): number => {
    const rendered = opts.rtl ? shapeAr(text) : text;
    const font = opts.bold ? 'Arabic-Bold' : 'Arabic';
    const minSize = opts.minSize ?? 10;

    let size = preferredSize;
    doc.font(font);
    while (size > minSize) {
        doc.fontSize(size);
        if (doc.widthOfString(rendered) <= maxWidth) break;
        size -= 2;
    }
    doc.fillColor(opts.color ?? COLORS.text);
    doc.text(rendered, 0, y, { width: doc.page.width, align: 'center' });
    return y + doc.heightOfString(rendered) + 4;
};

export interface CertificateRenderInput {
    userName: string;
    pathTitle: string;
    certificateCode: string;
    issuedAt: Date;
    verifyUrl: string;
}

export const generateCertificatePdf = async (input: CertificateRenderInput): Promise<Buffer> => {
    // A4 landscape
    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
            Title: `Qafzly Certificate - ${input.certificateCode}`,
            Author: 'Qafzly',
            Subject: input.pathTitle,
        },
    });

    doc.registerFont('Arabic', FONT_REGULAR);
    doc.registerFont('Arabic-Bold', FONT_BOLD);

    const W = doc.page.width;
    const H = doc.page.height;
    const MARGIN = 40;
    const INNER = MARGIN + 10;
    const CONTENT_WIDTH = W - INNER * 2 - 60; // extra side padding for text

    // ----- Borders -----
    doc.rect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2)
        .lineWidth(3)
        .strokeColor(COLORS.primary)
        .stroke();

    doc.rect(INNER, INNER, W - INNER * 2, H - INNER * 2)
        .lineWidth(1)
        .strokeColor(COLORS.gold)
        .stroke();

    // ----- Brand header -----
    let y = MARGIN + 40;
    y = drawCentered(doc, 'QAFZLY', y, CONTENT_WIDTH, 28, { bold: true, color: COLORS.primary });
    y = drawCentered(doc, 'منصة التعليم التفاعلي', y, CONTENT_WIDTH, 12, { color: COLORS.muted, rtl: true });

    // Divider
    y += 10;
    doc.moveTo(W / 2 - 100, y).lineTo(W / 2 + 100, y)
        .lineWidth(1).strokeColor(COLORS.gold).stroke();

    // ----- Title -----
    y += 25;
    y = drawCentered(doc, 'شهادة إتمام', y, CONTENT_WIDTH, 44, { bold: true, color: COLORS.primary, rtl: true });

    // ----- Intro line -----
    y += 10;
    y = drawCentered(doc, 'تشهد منصة قفزلي بأن', y, CONTENT_WIDTH, 16, { color: COLORS.text, rtl: true });

    // ----- Recipient name (large) -----
    y += 20;
    y = drawCentered(doc, input.userName, y, CONTENT_WIDTH, 38, { bold: true, color: COLORS.primary, rtl: true });

    // ----- Path line -----
    y += 20;
    y = drawCentered(doc, 'قد أتم بنجاح مسار', y, CONTENT_WIDTH, 16, { color: COLORS.text, rtl: true });

    y += 14;
    y = drawCentered(doc, input.pathTitle, y, CONTENT_WIDTH, 24, { bold: true, color: COLORS.gold, rtl: true });

    // ----- Bottom section: date left, code right -----
    const bottomY = H - MARGIN - 70;

    // Divider above bottom section
    doc.moveTo(W / 2 - 100, bottomY - 12).lineTo(W / 2 + 100, bottomY - 12)
        .lineWidth(1).strokeColor(COLORS.gold).stroke();

    // Left: issue date
    const dateStr = input.issuedAt.toISOString().split('T')[0];
    doc.font('Arabic').fontSize(11).fillColor(COLORS.muted);
    doc.text(`تاريخ الإصدار: ${dateStr}`, INNER + 30, bottomY, { width: 220, align: 'left' });

    // Right: verification code
    doc.font('Arabic').fontSize(11).fillColor(COLORS.muted);
    doc.text(`رمز التحقق: ${input.certificateCode}`, W - INNER - 250, bottomY, {
        width: 220,
        align: 'right',
    });

    // Footer verify URL
    doc.font('Arabic').fontSize(9).fillColor(COLORS.muted);
    doc.text(input.verifyUrl, 0, H - MARGIN - 30, { width: W, align: 'center' });

    // ----- Buffer & close -----
    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => {
            logger.error({ err }, 'Certificate PDF stream error');
            reject(err);
        });
    });
};