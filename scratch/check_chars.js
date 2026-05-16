const fs = require('fs');
const s = fs.readFileSync('scratch/test_image_gen_out.txt', 'utf16le');
const m = s.match(/data:image\/(jpeg|png|webp|gif);base64,([^\"]+)/i);
if (m) {
  const b64 = m[2];
  console.log('Base64 length matched:', b64.length);
  const invalidChars = b64.match(/[^A-Za-z0-9+/=]/g);
  if (invalidChars) {
    console.log('Invalid chars:', Array.from(new Set(invalidChars)));
  } else {
    console.log('Only standard Base64 chars found.');
  }
} else {
  console.log('NO MATCH');
}
