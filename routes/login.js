const express = require('express');
const router = express.Router();
const { dbMySQL } = require('../config/db'); // ✅ Correct import

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await dbMySQL.query(
      'SELECT * FROM customers WHERE email = ? AND password = ?',
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    res.status(200).json({
      uid: user.customer_id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/dashboard', async (req, res) => {
  try {
    const [rows] = await dbMySQL.query('SELECT * FROM dashboard');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;
