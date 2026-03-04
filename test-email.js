const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'mohammadmaazqureshi3@gmail.com',
    pass: 'expdropuuezbaqhe' // NO SPACES!
  }
});

transporter.sendMail({
  from: 'mohammadmaazqureshi3@gmail.com',
  to: 'mohammadmaazqureshi3@gmail.com',
  subject: 'Test Email',
  text: 'If you receive this, your Gmail is configured correctly!'
}, (error, info) => {
  if (error) {
    console.error('❌ EMAIL ERROR:', error);
  } else {
    console.log('✅ EMAIL SENT:', info.response);
  }
});