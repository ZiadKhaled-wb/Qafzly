import multer from 'multer';
import path from 'path';
import { AppError } from './AppError';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Set storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/avatars/');
    },
    filename: (req, file, cb) => {
        const userId = (req as any).user?.userId || 'unknown';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${userId}-${uniqueSuffix}${ext}`);
    },
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        cb(new AppError(400, 'صيغة الملف غير مدعومة. استخدم JPG أو PNG أو WebP'));
        return;
    }
    cb(null, true);
};

export const uploadAvatar = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter,
}).single('avatar');