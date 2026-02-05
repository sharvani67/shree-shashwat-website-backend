const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { dbMySQL } = require('../config/db');
const dotenv = require('dotenv');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
dotenv.config();

const downloadAndSavePdf = async (url, filename) => {
  const filePath = path.join(__dirname, '../assets', filename);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(filePath, response.data);
  return `/assets/${filename}`; // public path for frontend
};

router.post('/api/orders', async (req, res) => {
  const {
    orderId,
    orderItem,
    orderItems,
    shippingAddress,
    paymentId,
    paymentAmount,
    paymentStatus,
    paymentMethod,
    userId,
    userEmail,
    userFullName,
    userPhone,
    // createdAt,
    saveToAccount,
    total_price,
    discount_amt,
    shipping_price,
    cod_charges,
    shiprocket_order_id,
    shipment_id,
    tracking_id,
    track_url,
    labelUrl,
    manifestUrl,
    invoiceUrl
  } = req.body;

  const connection = await dbMySQL.getConnection();
  try {
    await connection.beginTransaction();

    const address_id = `ADR_${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    let labelPath = null;
    let manifestPath = null;
    let invoicePath = null;

    if (labelUrl) {
      const labelFilename = `label_${orderId}.pdf`;
      labelPath = await downloadAndSavePdf(labelUrl, labelFilename);
    }

    if (manifestUrl) {
      const manifestFilename = `manifest_${orderId}.pdf`;
      manifestPath = await downloadAndSavePdf(manifestUrl, manifestFilename);
    }

    if (invoiceUrl) {
      const invoiceFilename = `invoice${orderId}.pdf`;
      invoicePath = await downloadAndSavePdf(invoiceUrl, invoiceFilename);
    }


    // ⬇️ Insert into orders (now including address_id)
    await connection.query(
      `INSERT INTO orders (
        order_id, user_id, user_name, user_email, user_phone, address_id, payment_id, total_price, discount_amt, shipping_price, cod_charges,
        payment_amount, payment_status, payment_method, shiprocket_order_id, shipment_id, tracking_id, track_url, label_order_id,
        manifest_order_id, invoice_order_id, status, \`created_at\`
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, userId, userFullName, userEmail, userPhone, address_id, paymentId, total_price, discount_amt, shipping_price, cod_charges,
        paymentAmount, paymentStatus, paymentMethod, shiprocket_order_id, shipment_id, tracking_id, track_url, labelPath, manifestPath,
        invoicePath, 'Pending', new Date()
      ]
    );

    let totalQuantity = 0;

    if (orderItems && Array.isArray(orderItems)) {
      for (const item of orderItems) {
        await connection.query(
          `INSERT INTO order_items (
            order_item_id, order_id, product_id,
            name, price, weight, original_price,
            quantity, image
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), orderId, item.product_id,
            item.name, item.price, item.weight,
            item.originalPrice, item.quantity, item.image
          ]
        );

        totalQuantity += item.quantity || 1;
      }
    } else if (orderItem) {
      await connection.query(
        `INSERT INTO order_items (
          order_item_id, order_id, product_id,
          name, price, weight, original_price,
          quantity, image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), orderId, orderItem.product_id,
          orderItem.name, orderItem.price, orderItem.weight,
          orderItem.originalPrice, orderItem.quantity, orderItem.image
        ]
      );

      totalQuantity = orderItem.quantity || 1;
    }

    await connection.query(
      `INSERT INTO transactions (
        order_id, user_id, payment_id,
        payment_amount, payment_method,
        payment_status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, userId, paymentId, paymentAmount, paymentMethod, paymentStatus]
    );

    await connection.query(
      `INSERT INTO order_status (order_id, status, \`timestamp\`)
   VALUES (?, 'Pending', ?)`,
      [orderId, new Date()]
    );

    if (saveToAccount) {
      // ⬇️ Reset current default and insert new address using same address_id
      await connection.query(
        `UPDATE addresses SET isDefault = 0
         WHERE customer_id = ? AND isDefault = 1`,
        [userId]
      );

      await connection.query(
        `INSERT INTO addresses (
          customer_id, address_id, addressLabel,
          addressLine1, addressLine2, city, state,
          country, postalCode, fullName, email, phone,
          isDefault, label
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, address_id, shippingAddress.addressLabel,
          shippingAddress.addressLine1, shippingAddress.addressLine2,
          shippingAddress.city, shippingAddress.state,
          shippingAddress.country, shippingAddress.postalCode,
          shippingAddress.fullName, shippingAddress.email,
          shippingAddress.phone, 1,
          shippingAddress.addressLabel
        ]
      );
    }

    await connection.query(
      `INSERT INTO order_addresses (
    address_id, order_id, customer_id, fullName, email, phone,
    addressLine1, addressLine2, city, state, country,
    postalCode, label
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        address_id, orderId, userId, shippingAddress.fullName,
        shippingAddress.email, shippingAddress.phone,
        shippingAddress.addressLine1, shippingAddress.addressLine2,
        shippingAddress.city, shippingAddress.state,
        shippingAddress.country, shippingAddress.postalCode,
        shippingAddress.addressLabel
      ]
    );


    await connection.query(
      `INSERT INTO dashboard (
        name, count, totalAmount, totalQuantity
      )
      VALUES ('orders', 1, ?, ?)
      ON DUPLICATE KEY UPDATE
        count = count + 1,
        totalAmount = totalAmount + ?,
        totalQuantity = totalQuantity + ?`,
      [paymentAmount, totalQuantity, paymentAmount, totalQuantity]
    );

    await connection.query(
      `DELETE FROM cart_items WHERE customer_id = ?`,
      [userId]
    );

    await connection.commit();

    // if (paymentStatus === 'Paid' || paymentStatus === 'Pending') {
    //   let productSummary = '';

    //   if (orderItems && Array.isArray(orderItems) && orderItems.length > 0) {
    //     productSummary = orderItems
    //       .map(item => `${item.name} (${item.weight})`)
    //       .join('\n'); // or use ' ' for space-separated
    //   } else if (orderItem) {
    //     productSummary = `${orderItem.name} (${orderItem.weight})`;
    //   }

    //   const smsText = `Dear Customer, Your Order NO. ${orderId} for ${productSummary} has been successfully placed. Thank you for shopping with us! INFAB AGRO FOODS`;

    //   const smsParams = {
    //     username: process.env.SMS_USERNAME,
    //     password: process.env.SMS_PASSWORD,
    //     from: process.env.SMS_SENDERID,
    //     to: `91${userPhone},919743112460`, // Send to customer + additional number
    //     text: smsText,
    //     indiaDltContentTemplateId: process.env.SMS_ORDERTEMPLATEID,
    //     indiaDltPrincipalEntityId: process.env.SMS_ENTITYID,
    //     indiaDltTelemarketerId: process.env.SMS_MARKETERID
    //   };

    //   const smsUrl = 'https://api.kapsystem.in/sms/1/text/query';
    //   const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    //   try {
    //     const smsResponse = await axios.get(smsUrl, { params: smsParams, httpsAgent });
    //     console.log('SMS API Response:', smsResponse.data);
    //   } catch (smsErr) {
    //     console.error('SMS sending failed:', smsErr.message);
    //   }
    // }


    res.status(200).json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error('Error saving order:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    connection.release();
  }
});

router.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await dbMySQL.query(`SELECT * FROM orders ORDER BY created_at DESC`);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get('/api/orders/customer/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await dbMySQL.query(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get('/api/order-items/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    const [rows] = await dbMySQL.query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching order items:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get('/api/order-status/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    const [rows] = await dbMySQL.query(
      `SELECT * FROM order_status WHERE order_id = ? ORDER BY timestamp DESC`,
      [orderId]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching order status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get('/api/order-address/:orderId', async (req, res) => {
  const { orderId } = req.params;

  try {
    const [rows] = await dbMySQL.query(
      `SELECT * FROM order_addresses WHERE order_id = ?`,
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order address not found' });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Error fetching order address:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/api/feedback', async (req, res) => {
  const { orderId, userId, userName, rating, comment, complaintText, items } = req.body;

  if (!orderId || !userId || !items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required data' });
  }

  const connection = await dbMySQL.getConnection(); // ✅ this now works
  try {
    await connection.beginTransaction();

    // Insert feedback for each product
    for (const item of items) {
      const productId = item.product_id;
      if (!productId) continue;

      await connection.query(
        `INSERT INTO feedback (product_id, user_id, user_name, rating, comment, order_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, userId, userName, rating, comment, orderId]
      );
    }

    // Update order's feedback flag
    await connection.query(
      `UPDATE orders SET feedback = TRUE WHERE order_id = ?`,
      [orderId]
    );

    // Optional: insert complaint
    if (complaintText) {
      await connection.query(
        `INSERT INTO complaints (order_id, complaint_text) VALUES (?, ?)`,
        [orderId, complaintText]
      );
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Error storing feedback:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    connection.release();
  }
});

router.get('/feedback/product/:productId', async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    return res.status(400).json({ success: false, message: 'Product ID is required' });
  }

  try {
    const [rows] = await dbMySQL.query(
      'SELECT * FROM feedback WHERE product_id = ? ORDER BY feedback_date DESC',
      [productId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching feedback by product ID:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});






module.exports = router;
