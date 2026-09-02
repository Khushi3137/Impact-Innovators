// generate-secrets.js
const crypto = require('crypto');

console.log('🔐 Generating Secure JWT Secrets\n');
console.log('='.repeat(50));

// Generate 256-bit (32-byte) secrets
const jwtSecret = crypto.randomBytes(32).toString('hex');
const refreshSecret = crypto.randomBytes(32).toString('hex');

console.log('✅ Copy these to your .env file:');
console.log('\n' + '='.repeat(50));
console.log('JWT_SECRET=' + jwtSecret);
console.log('JWT_REFRESH_SECRET=' + refreshSecret);
console.log('JWT_EXPIRE=7d');
console.log('JWT_REFRESH_EXPIRE=30d');
console.log('='.repeat(50));

console.log('\n📋 Security Notes:');
console.log('• Each secret is 64 hexadecimal characters');
console.log('• 256-bit encryption strength');
console.log('• Keep these secrets secure!');
console.log('• Never commit to version control');