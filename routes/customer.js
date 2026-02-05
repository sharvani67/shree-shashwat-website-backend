const express = require('express');
const router = express.Router();
const { dbMySQL } = require('../config/db');

router.post('/customers', async (req, res) => {
  const { fullName, email, password, phone } = req.body;

  try {
    // Insert into customers table
    const insertCustomerQuery = `
      INSERT INTO customers (fullName, email, password, phone)
      VALUES (?, ?, ?, ?)
    `;
    const [customerResult] = await dbMySQL.query(insertCustomerQuery, [
      fullName,
      email,
      password,
      phone
    ]);

    // Update dashboard table
    const checkDashboardQuery = `SELECT * FROM dashboard WHERE name = 'customers'`;
    const [dashboardRows] = await dbMySQL.query(checkDashboardQuery);

    if (dashboardRows.length > 0) {
      // If exists, increment the count
      const updateQuery = `
        UPDATE dashboard
        SET count = count + 1
        WHERE name = 'customers'
      `;
      await dbMySQL.query(updateQuery);
    } else {
      // If not exists, insert initial count
      const insertDashboardQuery = `
        INSERT INTO dashboard (name, count)
        VALUES ('customers', 1)
      `;
      await dbMySQL.query(insertDashboardQuery);
    }

    res.status(201).json({ message: 'Customer added successfully', customer_id: customerResult.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    console.error('Insert error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const [rows] = await dbMySQL.query('SELECT * FROM customers');
    res.json(rows);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/customers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await dbMySQL.query('SELECT * FROM customers WHERE customer_id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch by ID error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone } = req.body;

  try {
    const [result] = await dbMySQL.query(
      `UPDATE customers SET fullName = ?, email = ?, phone = ? WHERE customer_id = ?`,
      [fullName, email, phone, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    console.error('Update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/customers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await dbMySQL.query('DELETE FROM customers WHERE customer_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ✅ Get customer by email
router.get('/customers/email/:email', async (req, res) => {
  const { email } = req.params;

  try {
    const [rows] = await dbMySQL.query('SELECT * FROM customers WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(rows[0]); // return single customer
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router;
