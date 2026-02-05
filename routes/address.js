const express = require('express');
const router = express.Router();
const { dbMySQL } = require('../config/db');

router.post('/addresses', async (req, res) => {
  const {
    customer_id,
    addressLabel,
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    postalCode,
    fullName,
    email,
    phone,
    isDefault,
    label
  } = req.body;

  try {
    const createdAt = new Date();

    // Insert into addresses table
    const insertAddressQuery = `
      INSERT INTO addresses (
        customer_id, addressLabel, addressLine1, addressLine2, city, 
        state, country, postalCode, fullName, email, 
        phone, isDefault, label, createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await dbMySQL.query(insertAddressQuery, [
      customer_id, addressLabel, addressLine1, addressLine2, city,
      state, country, postalCode, fullName, email,
      phone, isDefault || false, label, createdAt
    ]);

    const insertedId = result.insertId;

    // If this address is set as default, update all other addresses
    if (isDefault) {
      await dbMySQL.query(
        'UPDATE addresses SET isDefault = FALSE WHERE id != ?',
        [insertedId]
      );
    }

    // Update dashboard table
    const checkDashboardQuery = `SELECT * FROM dashboard WHERE name = 'addresses'`;
    const [dashboardRows] = await dbMySQL.query(checkDashboardQuery);

    if (dashboardRows.length > 0) {
      // If exists, increment the count
      const updateQuery = `
        UPDATE dashboard
        SET count = count + 1
        WHERE name = 'addresses'
      `;
      await dbMySQL.query(updateQuery);
    } else {
      // If not exists, insert initial count
      const insertDashboardQuery = `
        INSERT INTO dashboard (name, count)
        VALUES ('addresses', 1)
      `;
      await dbMySQL.query(insertDashboardQuery);
    }

    res.status(201).json({
      message: 'Address added successfully',
      id: insertedId
    });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/addresses', async (req, res) => {
  try {
    const [rows] = await dbMySQL.query('SELECT * FROM addresses');
    res.json(rows);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/addresses/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await dbMySQL.query(
      'SELECT * FROM addresses WHERE customer_id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No addresses found for this customer' });
    }

    res.json(rows); // ✅ return all matching addresses
  } catch (err) {
    console.error('Fetch by ID error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.put('/addresses/:id', async (req, res) => {
  const { id } = req.params;
  const {
    customer_id,
    addressLabel,
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    postalCode,
    fullName,
    email,
    phone,
    isDefault,
    label
  } = req.body;

  try {
    const [result] = await dbMySQL.query(
      `UPDATE addresses SET 
        customer_id = ?,
        addressLabel = ?, 
        addressLine1 = ?, 
        addressLine2 = ?, 
        city = ?, 
        state = ?, 
        country = ?, 
        postalCode = ?, 
        fullName = ?, 
        email = ?, 
        phone = ?, 
        isDefault = ?, 
        label = ? 
      WHERE id = ?`,
      [
        customer_id, addressLabel, addressLine1, addressLine2, city, state,
        country, postalCode, fullName, email, phone,
        isDefault || false, label, id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // If this address is set as default, update all other addresses
    if (isDefault) {
      await dbMySQL.query(
        'UPDATE addresses SET isDefault = FALSE WHERE id != ?',
        [id]
      );
    }

    res.json({ message: 'Address updated successfully' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/addresses/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await dbMySQL.query('DELETE FROM addresses WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Update dashboard count
    await dbMySQL.query(`
      UPDATE dashboard 
      SET count = count - 1 
      WHERE name = 'addresses' AND count > 0
    `);

    res.json({ message: 'Address deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Set default address
router.patch('/addresses/:id/set-default', async (req, res) => {
  const { id } = req.params;

  try {
    // First check if address exists
    const [addressRows] = await dbMySQL.query(
      'SELECT * FROM addresses WHERE id = ?',
      [id]
    );

    if (addressRows.length === 0) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Set all addresses to non-default
    await dbMySQL.query('UPDATE addresses SET isDefault = FALSE');

    // Set the specified address as default
    await dbMySQL.query(
      'UPDATE addresses SET isDefault = TRUE WHERE id = ?',
      [id]
    );

    res.json({ message: 'Default address set successfully' });
  } catch (err) {
    console.error('Set default error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;