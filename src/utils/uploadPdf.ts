import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadPdf = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('يجب أن يكون الملف من نوع PDF'));
        }
    },
}).single('pdf');