const express = require('express');
const router = express.Router();
const { dbMySQL } = require('../config/db');


// POST - Add item to cart
router.post('/cart-items', async (req, res) => {
  const { 
    customer_id, 
    product_id, 
    name, 
    image, 
    originalPrice, 
    price, 
    quantity,
    weight 
  } = req.body;

  try {
    // First check if the item already exists in the cart
    const checkExistingQuery = `
      SELECT * FROM cart_items 
      WHERE customer_id = ? AND product_id = ?
    `;
    const [existingItems] = await dbMySQL.query(checkExistingQuery, [customer_id, product_id]);

    if (existingItems.length > 0) {
      // Item exists, increment quantity by 1
      const existingItem = existingItems[0];
      const newQuantity = existingItem.quantity + quantity;
      
      const updateQuery = `
        UPDATE cart_items 
        SET quantity = ?, price = ?, original_price = ?
        WHERE id = ?
      `;
      
      await dbMySQL.query(updateQuery, [
        newQuantity,
        price, // Update price in case it changed
        originalPrice, // Update original price in case it changed
        existingItem.id
      ]);

      return res.status(200).json({ 
        message: 'Cart item quantity updated successfully', 
        id: existingItem.id 
      });
    } else {
      // Item doesn't exist, insert new row with quantity = 1
      const insertQuery = `
        INSERT INTO cart_items 
        (customer_id, product_id, name, image, original_price, price, quantity, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await dbMySQL.query(insertQuery, [
        customer_id,
        product_id,
        name,
        image,
        originalPrice,
        price,
        quantity,
        weight
      ]);

      // Update dashboard count only for new items
      const checkDashboardQuery = `SELECT * FROM dashboard WHERE name = 'cart_items'`;
      const [dashboardRows] = await dbMySQL.query(checkDashboardQuery);

      if (dashboardRows.length > 0) {
        await dbMySQL.query(`UPDATE dashboard SET count = count + 1 WHERE name = 'cart_items'`);
      } else {
        await dbMySQL.query(`INSERT INTO dashboard (name, count) VALUES ('cart_items', 1)`);
      }

      return res.status(201).json({ 
        message: 'Item added to cart successfully', 
        id: result.insertId 
      });
    }
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET - Get all cart items 
router.get('/cart-items', async (req, res) => {
  const { customer_id } = req.params;

  try {
    const [rows] = await dbMySQL.query(`
      SELECT * FROM cart_items 
      ORDER BY added_at DESC
    `, [customer_id]);
    
    res.json(rows);
  } catch (err) {
    console.error('Fetch cart items error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get a specific cart item by ID only
router.get('/cart-items/:id', async (req, res) => {
  const { id } = req.params; // Extract only the ID from URL params

  try {
    const [rows] = await dbMySQL.query(`
      SELECT * FROM cart_items 
      WHERE id = ?
    `, [id]); // Query only by ID
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    
    res.json(rows[0]); // Return the single cart item
  } catch (err) {
    console.error('Fetch cart item error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET - Get all cart items for a customer
router.get('/cart-items/customer/:customer_id', async (req, res) => {
  const { customer_id } = req.params;

  try {
    const [rows] = await dbMySQL.query(`
      SELECT * FROM cart_items 
      WHERE customer_id = ?
      ORDER BY added_at DESC
    `, [customer_id]);
    
    res.json(rows);
  } catch (err) {
    console.error('Fetch cart items error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET - Get specific cart item
router.get('/cart-items/:customer_id/:id', async (req, res) => {
  const { customer_id, id } = req.params;

  try {
    const [rows] = await dbMySQL.query(`
      SELECT * FROM cart_items 
      WHERE id = ? AND customer_id = ?
    `, [id, customer_id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch cart item error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// PUT - Update cart item quantity
router.put('/cart-items/:customer_id/:product_id', async (req, res) => {
  const { customer_id, product_id } = req.params;
  const { quantity } = req.body;

  try {
    const [result] = await dbMySQL.query(`
      UPDATE cart_items 
      SET quantity = ? 
      WHERE product_id = ? AND customer_id = ?
    `, [quantity, product_id, customer_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Cart item updated successfully' });
  } catch (err) {
    console.error('Update cart item error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE - Remove item from cart
router.delete('/cart-items/:customer_id/:product_id', async (req, res) => {
  const { customer_id, product_id } = req.params;

  try {
    const [result] = await dbMySQL.query(`
      DELETE FROM cart_items 
      WHERE product_id = ? AND customer_id = ?
    `, [product_id, customer_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    // Update dashboard count
    await dbMySQL.query(`
      UPDATE dashboard 
      SET count = count - 1 
      WHERE name = 'cart_items' AND count > 0
    `);

    res.json({ message: 'Item removed from cart successfully' });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// DELETE - Remove all cart items for a specific customer
// DELETE - Remove item from cart
router.delete('/cartitems/customer/:customer_id', async (req, res) => {
  const { customer_id } = req.params;

  try {
    const [result] = await dbMySQL.query(`
      DELETE FROM cart_items 
      WHERE customer_id = ?
    `, [customer_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    // Update dashboard count
    await dbMySQL.query(`
      UPDATE dashboard 
      SET count = count - 1 
      WHERE name = 'cart_items' AND count > 0
    `);

    res.json({ message: 'Item(s) removed from cart successfully' });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;