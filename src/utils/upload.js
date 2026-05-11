const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = 'uploads/';
        if (req.baseUrl.includes('ai')) uploadPath += 'ai_results/';
        else if (req.baseUrl.includes('barbers')) uploadPath += 'barbers/';
        else if (req.baseUrl.includes('gallery') || req.baseUrl.includes('services')) uploadPath += 'gallery/';
        else if (req.baseUrl.includes('social-media')) uploadPath += 'social-media/';
        else uploadPath += 'profiles/';


        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
})

module.exports = multer({storage: storage});