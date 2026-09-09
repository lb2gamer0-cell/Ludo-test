// backend/config.js
require('dotenv').config();

const usingDefaultSecret = !process.env.JWT_SECRET;
const usingDefaultAdminPass = !process.env.ADMIN_PASSWORD;

if (process.env.NODE_ENV === 'production' && (usingDefaultSecret || usingDefaultAdminPass)) {
    console.warn('\n[SECURITY WARNING] JWT_SECRET / ADMIN_PASSWORD .env me set nahi hai.');
    console.warn('backend/.env.example ko copy karke backend/.env banayein aur values badlein.\n');
}

module.exports = {
    PORT: process.env.PORT || 3000,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || "loki",
    ADMIN_PHONE: process.env.ADMIN_PHONE || "9024244434",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "loki00",
    JWT_SECRET: process.env.JWT_SECRET || "super_secret_ludo_jwt_key_2026_x89f72b9a!",
    FAST2SMS_KEY: process.env.FAST2SMS_KEY || "YOUR_FAST2SMS_API_KEY",
    
    SIGNUP_BONUS_COINS: Number(process.env.SIGNUP_BONUS_COINS || 2500),
    SIGNUP_BONUS_DIAMONDS: Number(process.env.SIGNUP_BONUS_DIAMONDS || 50),
    SOLO_PRIZE_MULTIPLIER: Number(process.env.SOLO_PRIZE_MULTIPLIER || 1)
};