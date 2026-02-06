const express = require('express');
const router = express.Router();
const { transporter, adminEmail } = require('../config/nodemailer');

router.post('/send-welcome-email', async (req, res) => {
  const { email, fullName, password } = req.body;

  try {
    const mailOptions = {
      from: 'iiiqbets01@gmail.com',
      to: email,
      subject: 'Welcome to Shree ShashwatRaj!',
      html: `
        <h2>Hi ${fullName},</h2>
        <p>Thank you for registering on Shree ShashwatRaj. We're excited to have you!</p>
        <p><strong>Your login credentials:</strong></p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
        <p>We recommend changing your password after logging in for security purposes.</p>
        <br>
        <p>– Shree ShashwatRaj Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).send({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).send({ success: false, message: "Failed to send email" });
  }
});

router.post('/send-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const mailOptions = {
      from: 'iiiqbets01@gmail.com',
      to: email,
      subject: 'Shree ShashwatRaj OTP Verification',
      html: `<p>Your OTP is <strong>${otp}</strong>. It is valid for 5 minutes.</p>`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).send({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).send({ success: false, message: "Failed to send OTP" });
  }
});

router.post('/send-order-confirmation', async (req, res) => {
  const { email, orderId, amount, items } = req.body;

  if (!email || !orderId || !amount || !items) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const orderItemsHtml = items.map(item => 
    `<li>${item.name} (x${item.quantity}) - ₹${item.price}</li>`
  ).join('');

  const customerMailOptions = {
    from: 'iiiqbets01@gmail.com',
    to: email,
    subject: 'Order Confirmation',
    html: `
      <h1>Thank you for your order!</h1>
      <p>Your order #${orderId} has been received.</p>
      <p>Total amount: ₹${amount}</p>
      <h3>Order Items:</h3>
      <ul>${orderItemsHtml}</ul>
      <p>We'll notify you when your order ships.</p>
    `
  };

  const adminMailOptions = {
    from: 'iiiqbets01@gmail.com',
    to: adminEmail,
    subject: `New Order Received - #${orderId}`,
    html: `
      <h1>New Order Notification</h1>
      <p>Order ID: ${orderId}</p>
      <p>Customer Email: ${email}</p>
      <p>Total amount: ₹${amount}</p>
      <h3>Order Items:</h3>
      <ul>${orderItemsHtml}</ul>
    `
  };

  try {
    await Promise.all([
      transporter.sendMail(customerMailOptions),
      transporter.sendMail(adminMailOptions)
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

router.post('/bulk-order', async (req, res) => {
    const { 
        full_name, 
        company_name = '', 
        email, 
        phone, 
        shipping_city = '', 
        shipping_pincode = '', 
        additional_message = '', 
        selectedProducts 
    } = req.body;

    if (!full_name || !email || !phone) {
        return res.status(400).json({ 
            success: false,
            message: 'Missing required fields' 
        });
    }

    try {
        // 1. Prepare customer email
      const customerMailOptions = {
    from: '"Shree ShashwatRaj" <iiiqbets01@gmail.com>',
    to: email,
    subject: 'Thank you for your Bulk Order Inquiry',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4a4a4a;">Dear ${full_name},</h2>
            <p>Thank you for your bulk order inquiry with Shree ShashwatRaj. We've received your request and our team will contact you shortly.</p>
            
            <h3 style="color: #4a4a4a; margin-top: 20px;">Your Inquiry Details:</h3>
            <p><strong>Name:</strong> ${full_name}</p>
            ${company_name ? `<p><strong>Company:</strong> ${company_name}</p>` : ''}
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            
            ${shipping_city || shipping_pincode ? `
            <h3 style="color: #4a4a4a; margin-top: 20px;">Shipping Information:</h3>
            ${shipping_city ? `<p><strong>City/Region:</strong> ${shipping_city}</p>` : ''}
            ${shipping_pincode ? `<p><strong>Pincode:</strong> ${shipping_pincode}</p>` : ''}
            ` : ''}
            
            <h3 style="color: #4a4a4a; margin-top: 20px;">Products Interested In:</h3>
            <ul>
                ${selectedProducts.lemon ? '<li>Lemon Rice Gojju</li>' : ''}
                ${selectedProducts.pulihora ? '<li>Puliyogare Gojju</li>' : ''}
                ${selectedProducts.sorakaya ? '<li>Vangibath Gojju</li>' : ''}
                ${selectedProducts.tomato ? '<li>Tomato Rice Gojju</li>' : ''}
            </ul>
            
            ${additional_message ? `
            <h3 style="color: #4a4a4a; margin-top: 20px;">Your Message:</h3>
            <p>${additional_message}</p>
            ` : ''}
            
            <p style="margin-top: 30px;">We typically respond within 24 hours. For immediate assistance, please call us at +91 XXXXXXXXXX.</p>

            <div style="margin-top: 30px; text-align: center;">
                <p style="font-weight: bold;">Join our WhatsApp group for updates and support:</p>
                <a href="https://chat.whatsapp.com/IEn431tS9Rl21yL5KzwtnS" target="_blank" 
                   style="display: inline-block; background-color: #25D366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Join WhatsApp Group
                </a>
            </div>

            <p style="margin-top: 30px;">Best regards,<br>The Shree ShashwatRaj Team</p>
        </div>
    `
};


        // 2. Prepare admin email
        const adminMailOptions = {
            from: '"Shree ShashwatRaj Notifications" <iiiqbets01@gmail.com>',
            to: adminEmail,
            subject: `New Bulk Order Inquiry from ${full_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4a4a4a;">New Bulk Order Inquiry</h2>
                    <p><strong>Customer Name:</strong> ${full_name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
                    
                    <h3 style="color: #4a4a4a; margin-top: 20px;">Products Requested:</h3>
                    <ul>
                        ${selectedProducts.lemon ? '<li>Lemon Rice Gojju</li>' : ''}
                        ${selectedProducts.pulihora ? '<li>Puliyogare Gojju</li>' : ''}
                        ${selectedProducts.sorakaya ? '<li>Vangibath Gojju</li>' : ''}
                        ${selectedProducts.tomato ? '<li>Tomato Rice Gojju</li>' : ''}
                    </ul>
                    
                    <p><a href="mailto:${email}?subject=Re: Your Bulk Order Inquiry">Click here to respond</a></p>
                </div>
            `
        };

        // 3. Send both emails
        await transporter.sendMail(customerMailOptions);
        await transporter.sendMail(adminMailOptions);

        res.status(200).json({ 
            success: true, 
            message: 'Emails sent successfully' 
        });

    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send emails',
            error: error.message 
        });
    }
});


module.exports = router;