const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = 'uploads/';
        if (req.baseUrl.includes('ai')) uploadPath = path.join(uploadPath, 'ai_results/');
        else if (req.baseUrl.includes('barbers')) uploadPath = path.join(uploadPath, 'barbers/');
        else if (req.baseUrl.includes('gallery') || req.baseUrl.includes('services')) uploadPath = path.join(uploadPath, 'gallery/');
        else if (req.baseUrl.includes('social-media')) uploadPath = path.join(uploadPath, 'social-media/');
        else uploadPath = path.join(uploadPath, 'profiles/');

        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Sanitize original filename and add unique suffix
        const cleanName = path.parse(file.originalname).name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${cleanName}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
})

// Centralized validation for File Upload
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
    }
};

module.exports = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});