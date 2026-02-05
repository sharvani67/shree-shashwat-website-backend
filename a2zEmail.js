const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/send-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) return res.status(400).send('Email and code required');

  // Set up the transporter (using Gmail as example)
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'iiiqbets01@gmail.com',
      pass: 'rava xoel gzai rkgx' // your password or app password
    },
  });

  const mailOptions = {
    from: 'iiiqbets01@gmail.com',
    to: email,
    subject: 'Email Verification - A2Z SHIPS Registration',
    html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Welcome to A2Z SHIPS</h2>
      <p>Dear User,</p>
      <p>Thank you for registering with <strong>A2Z SHIPS</strong>.</p>
      <p>To complete your registration, please use the verification code below:</p>
      <h3 style="color: #2d6cdf;">Your Verification Code: ${code}</h3>
      <p>Please enter this code in the registration page to verify your email address.</p>
      <p>If you did not initiate this registration, you may safely ignore this email.</p>
      <p>If you have any questions or require assistance, feel free to contact our support team at <a href="mailto:support@a2zships.com">support@a2zships.com</a>.</p>
      <br/>
      <p>Best regards,<br/>
      The A2Z SHIPS Team</p>
    </div>
  `,
  };


  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send('Verification code sent');
  } catch (error) {
    console.error('Email sending failed:', error);
    res.status(500).send('Failed to send email');
  }
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
});
