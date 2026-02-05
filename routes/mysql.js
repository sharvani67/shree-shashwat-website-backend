const express = require('express');
const router = express.Router();
const { dbMySQL } = require('../config/db');

router.post('/api/bulk-order', (req, res) => {
  const {
    full_name,
    company_name,
    email,
    phone,
    selectedProducts = {
      lemon: false,
      pulihora: false,
      sorakaya: false,
      tomato: false
    },
    shipping_city,
    shipping_pincode,
    additional_message,
    source,
  } = req.body;

  const query = `
    INSERT INTO bulk_orders 
    (full_name, company_name, email, phone, 
     lemon_chutney, pulihora_chutney, sorakaya_chutney, tomato_chutney,
     shipping_city, shipping_pincode, additional_message, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  dbMySQL.query(
    query,
    [
      full_name,
      company_name,
      email,
      phone,
      selectedProducts.lemon || false,
      selectedProducts.pulihora || false,
      selectedProducts.sorakaya || false,
      selectedProducts.tomato || false,
      shipping_city || null,
      shipping_pincode || null,
      additional_message || null,
      source
    ],
    (err, result) => {
      if (err) {
        console.error('Error saving order:', err);
        return res.status(500).json({ error: 'Failed to save order' });
      }
      res.json({ message: 'Order submitted successfully!', id: result.insertId });
    }
  );
});

router.post('/api/contact', (req, res) => {
  const { full_name, email, phone, additional_message, source } = req.body;
  
  const query = 'INSERT INTO bulk_orders (full_name, email, phone, additional_message, source) VALUES (?, ?, ?, ?, ?)';
  
  dbMySQL.query(query, [full_name, email, phone, additional_message, source], (err, result) => {
    if (err) {
      console.error('Error saving contact form:', err);
      return res.status(500).json({ error: 'Failed to submit form' });
    }
    res.status(200).json({ message: 'Form submitted successfully!' });
  });
});

router.get('/get-active-theme', (req, res) => {
  dbMySQL.query("SELECT * FROM themes WHERE is_active = 1 LIMIT 1", (err, results) => {
    if (err) {
      console.error('Error fetching theme:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No active theme found' });
    }

    res.status(200).json(results[0]);
  });
});

router.get('/contact-submissions', (req, res) => {
  const sql = 'SELECT * FROM contact_submissions ORDER BY submission_date DESC';
  dbMySQL.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

router.get('/bulk-order-leads', (req, res) => {
  const sql = 'SELECT * FROM bulk_orders ORDER BY created_at DESC';
  dbMySQL.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database query failed' });
    }
    res.json(results);
  });
});

module.exports = router;