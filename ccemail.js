// sendEmail.js
const nodemailer = require('nodemailer');

// Create transporter using your email service (example uses Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'iiiqbets01@gmail.com',
    pass: 'rava xoel gzai rkgx' // your password or app password
  },
});

// Email details
const mailOptions = {
  from: 'iiiqbets01@gmail.com',
  to: 'uppalahemanth4@gmail.com',               // main recipient
  cc: ['pavanimyana2000@gmail.com', 'manitejavadnala@gmail.com'],  // CC recipients
  subject: 'Welcome to iiiQbets',
  text: 'Hello, welcome to our iiiQbets! We are glad to have you onboard.',
};

// Send email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.log('Error:', error);
  }
  console.log('Email sent:', info.response);
});
