const express = require('express');
const router = express.Router();
const { dbMySQL } = require('../config/db');

router.put('/api/customers/:customer_id/password', async (req, res) => {
  const { customer_id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ success: false, message: 'New password is required.' });
  }

  try {
    const [results] = await dbMySQL.execute(
      'UPDATE customers SET password = ? WHERE customer_id = ?',
      [newPassword, customer_id]
    );

    if (results.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    return res.status(200).json({ success: true, message: 'Password updated successfully in MySQL.' });
  } catch (err) {
    console.error('MySQL error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update password.', error: err.message });
  }
});

router.get('/get-customer-uid', async (req, res) => {
  const { email } = req.query;

  try {
    const [results] = await dbMySQL.execute(
      'SELECT customer_id FROM customers WHERE email = ?',
      [email]
    );

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    return res.status(200).json({ success: true, customer_id: results[0].customer_id });
  } catch (err) {
    console.error('MySQL error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve customer ID.', error: err.message });
  }
});

router.post('/store-otp', async (req, res) => {
  const { email, otp } = req.body;
  const createdAt = new Date();

  try {
    await dbMySQL.execute(
      'REPLACE INTO otp_verification (email, otp, created_at) VALUES (?, ?, ?)',
      [email, otp, createdAt]
    );

    return res.status(200).json({ success: true, message: 'OTP stored' });
  } catch (err) {
    console.error('Error storing OTP:', err);
    return res.status(500).json({ success: false, message: 'Error storing OTP' });
  }
});


module.exports = router;
