const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'iiiqbets01@gmail.com',
    pass: 'rava xoel gzai rkgx'
  },
  tls: {
    rejectUnauthorized: false
  }
});

const adminEmail = 'iiiqbets01@gmail.com';

module.exports = {
  transporter,
  adminEmail
};