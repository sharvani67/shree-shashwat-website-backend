const express = require('express');
const router = express.Router();
const { dbMySQL } = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use only uploads/ folder, no wishlist subfolder
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// POST - Add item to wishlist
router.post('/wishlist', async (req, res) => {
  try {
    const { customer_id, product_id, name, original_price, price, quantity, weight, image, description } = req.body;
    
    // Validate required fields
    if (!customer_id || !product_id || !name || !price || !quantity || !image) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer ID, product ID, name, price, quantity, and image are required' 
      });
    }

    // Check if item already exists
    const [existing] = await dbMySQL.query(
      'SELECT id FROM wishlist WHERE customer_id = ? AND product_id = ?',
      [customer_id, product_id]
    );

    if (existing.length > 0) {
      return res.status(200).json({ 
        success: false, 
        message: 'Item already in wishlist',
        data: { id: existing[0].id } 
      });
    }

    // Insert new wishlist item
    const [result] = await dbMySQL.query(
      `INSERT INTO wishlist 
       (customer_id, product_id, name, image, original_price, price, quantity, weight, added_at, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        customer_id, 
        product_id, 
        name, 
        image, 
        original_price || null, 
        price, 
        quantity, 
        weight || null,
        description
      ]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Item added to wishlist', 
      data: {
        id: result.insertId,
        customer_id,
        product_id,
        name,
        image,
        original_price: original_price || null,
        price,
        quantity,
        weight: weight || null,
        added_at: new Date().toISOString(),
        description
      }
    });
  } catch (error) {
    console.error('Wishlist Add Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
});


// GET - Get all wishlist items
router.get('/wishlist', async (req, res) => {
  try {
    const [items] = await dbMySQL.query('SELECT * FROM wishlist');
    res.status(200).json(items);
  } catch (error) {
    console.error('Wishlist Get All Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// GET - Get wishlist items by customer_id
router.get('/wishlist/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    
    if (!customer_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer ID is required' 
      });
    }

    const [items] = await dbMySQL.query(
      'SELECT * FROM wishlist WHERE customer_id = ? ORDER BY added_at DESC',
      [customer_id]
    );

    res.status(200).json({ 
      success: true, 
      data: items 
    });
  } catch (error) {
    console.error('Wishlist Get by Customer Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// DELETE - Remove item from wishlist
router.delete('/wishlist/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: 'Item ID is required' });
    }

    // First get the item to check if it exists and get the image path
    const [item] = await dbMySQL.query(
      'SELECT * FROM wishlist WHERE id = ?',
      [id]
    );

    if (item.length === 0) {
      return res.status(404).json({ message: 'Item not found in wishlist' });
    }

    // Delete the item from database
    await dbMySQL.query(
      'DELETE FROM wishlist WHERE id = ?',
      [id]
    );

    // Optionally delete the associated image file
    if (item[0].image) {
      const imagePath = path.join(__dirname, '..', item[0].image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.status(200).json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Wishlist Delete Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// Add this to your backend routes
router.get('/wishlist/check/:customer_id/:product_id', async (req, res) => {
  try {
    const { customer_id, product_id } = req.params;
    
    const [existing] = await dbMySQL.query(
      'SELECT id FROM wishlist WHERE customer_id = ? AND product_id = ?',
      [customer_id, product_id]
    );

    res.status(200).json({ 
      success: true, 
      exists: existing.length > 0,
      wishlistItemId: existing.length > 0 ? existing[0].id : null
    });
  } catch (error) {
    console.error('Wishlist Check Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

module.exports = router;