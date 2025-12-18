const fs = require('fs');
const key = fs.readFileSync('./e-tution-bd-4005d-firebase-adminsdk-fbsvc-c2d585f529.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)