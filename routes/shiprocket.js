const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbMySQL } = require('../config/db');
const getShiprocketToken = require('../utils/getShiprocketToken');

// const SHIPROCKET_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjY2OTYxNDAsInNvdXJjZSI6InNyLWF1dGgtaW50IiwiZXhwIjoxNzUyNTc1ODQxLCJqdGkiOiJuQm9ZUTlBSks1d2tHdEZLIiwiaWF0IjoxNzUxNzExODQxLCJpc3MiOiJodHRwczovL3NyLWF1dGguc2hpcHJvY2tldC5pbi9hdXRob3JpemUvdXNlciIsIm5iZiI6MTc1MTcxMTg0MSwiY2lkIjo0NTY4NDczLCJ0YyI6MzYwLCJ2ZXJib3NlIjpmYWxzZSwidmVuZG9yX2lkIjowLCJ2ZW5kb3JfY29kZSI6Im1pbmlzIn0.9ycvGL6I6t2uWriHr8vxbZ0rUQnoDbWWnPLxgb1nvWI';

router.post('/api/shiprocket-login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/auth/login',
      {
        email: email,
        password: password
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        maxBodyLength: Infinity
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Login failed:', error.message);
    res.status(500).json({
      error: 'Shiprocket login failed',
      details: error.response?.data || error.message
    });
  }
});

router.post('/shiprocket-login', async (req, res) => {
  try {
    // Step 1: Check if entry with id = 1 exists
    const [rows] = await dbMySQL.execute(
      `SELECT token, expiration_date FROM shiprocket_auth WHERE id = 1`
    );

    const now = new Date();

    // Step 2: If exists and not expired, return existing token
    if (rows.length > 0) {
      const { token, expiration_date } = rows[0];
      const expiry = new Date(expiration_date);

      if (now < expiry) {
        return res.json({ status: 'success', token, reused: true });
      }
    }

    // Step 3: Get a new token from Shiprocket API
    const loginPayload = {
      email: 'pavanimyana@iiiqai.com',
      password: 'B%PD75HDi0YNq#ba',
    };

    const shiprocketRes = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/auth/login',
      loginPayload
    );

    const { token } = shiprocketRes.data;
    console.log("token=", token)

    const createdAt = new Date(); // Use current date/time
    const expirationDate = new Date(createdAt);
    expirationDate.setDate(createdAt.getDate() + 10); // Valid for 10 days

    const formattedCreatedAt = createdAt.toISOString().slice(0, 19).replace('T', ' ');
    const formattedExpirationDate = expirationDate.toISOString().slice(0, 19).replace('T', ' ');

    if (rows.length === 0) {
      // Step 4A: Insert if no row exists
      const insertQuery = `
        INSERT INTO shiprocket_auth (id, token, created_at, expiration_date, validity)
        VALUES (1, ?, ?, ?, ?)
      `;
      await dbMySQL.execute(insertQuery, [
        token,
        formattedCreatedAt,
        formattedExpirationDate,
        10,
      ]);
    } else {
      // Step 4B: Update if row exists
      const updateQuery = `
        UPDATE shiprocket_auth 
        SET token = ?, created_at = ?, expiration_date = ?, validity = ?
        WHERE id = 1
      `;
      await dbMySQL.execute(updateQuery, [
        token,
        formattedCreatedAt,
        formattedExpirationDate,
        10,
      ]);
    }

    res.json({ status: 'success', token, reused: false });
  } catch (error) {
    console.error('Shiprocket login error:', error.response?.data || error.message);
    res.status(500).json({ status: 'error', message: 'Failed to login or insert/update token.' });
  }
});

router.get("/shiprocket-token", async (req, res) => {
  const query = "SELECT token FROM shiprocket_auth ORDER BY id DESC LIMIT 1";

  try {
    const [rows] = await dbMySQL.query(query);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No token found" });
    }

    const token = rows[0].token;
    return res.json({ token: `Bearer ${token}` });

  } catch (err) {
    return res.status(500).json({ error: "Database error", details: err.message });
  }
});

router.post('/api/create-order', async (req, res) => {
  const SHIPROCKET_TOKEN = await getShiprocketToken();
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    const orderData = req.body;

    // 1. Create Order
    const createOrderResponse = await axios({
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify(orderData)
    });

    const orderResult = createOrderResponse.data;

    // ✅ CORRECTED: Extract shipment_id and order_id from the proper location
    const shipmentId = orderResult?.shipment_id || orderResult?.data?.shipment_id;
    const orderId = orderResult?.order_id || orderResult?.data?.order_id;

    console.log('✅ Order Created:', JSON.stringify(orderResult, null, 2));

    if (!shipmentId || !orderId) {
      throw new Error(`Missing shipment_id or order_id in order creation response. Response: ${JSON.stringify(orderResult)}`);
    }

    // 2. Assign AWB
    let awbResult;
    try {
      const assignAWBResponse = await axios({
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://apiv2.shiprocket.in/v1/external/courier/assign/awb',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SHIPROCKET_TOKEN
        },
        data: JSON.stringify({ shipment_id: shipmentId })
      });

      awbResult = assignAWBResponse.data;
      console.log('✅ AWB Assigned:', JSON.stringify(awbResult, null, 2));
    } catch (err) {
      console.error('❌ AWB Assignment Failed:', err.response?.data || err.message);
      throw new Error('AWB assignment failed');
    }

    // ✅ CORRECTED: Extract AWB code from proper location
    const awbCode = awbResult?.awb_code || awbResult?.response?.data?.awb_code || awbResult?.data?.awb_code;
    if (!awbCode) {
      console.error('❌ No awb_code found in AWB response:', JSON.stringify(awbResult, null, 2));
      throw new Error('No awb_code found in AWB response');
    }

    // 3. Track Shipment
    let trackingResult;
    try {
      const trackingResponse = await axios({
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://apiv2.shiprocket.in/v1/external/courier/track/awbs',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SHIPROCKET_TOKEN
        },
        data: JSON.stringify({ awbs: [awbCode] })
      });

      trackingResult = trackingResponse.data;
      console.log('📦 Tracking Info:', JSON.stringify(trackingResult, null, 2));
    } catch (err) {
      console.error('❌ Tracking Failed:', err.response?.data || err.message);
    }

    // Add small delay to allow status to settle
    await delay(3000);

    // 4. Generate Pickup
    let pickupResult;
    try {
      const pickupResponse = await axios({
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://apiv2.shiprocket.in/v1/external/courier/generate/pickup',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SHIPROCKET_TOKEN
        },
        data: JSON.stringify({ shipment_id: [shipmentId] })
      });

      pickupResult = pickupResponse.data;
      console.log('🚚 Pickup Generated:', JSON.stringify(pickupResult, null, 2));
    } catch (err) {
      const message = err.response?.data?.message;

      if (message === 'Already in Pickup Queue.') {
        console.warn('⚠️ Shipment is already in pickup queue. Proceeding...');
        pickupResult = { message: 'Already in Pickup Queue.' };
      } else {
        console.error('❌ Pickup Generation Failed:', err.response?.data || err.message);
      }
    }

    // 5. Generate Label
    let labelResult;
    try {
      const labelResponse = await axios({
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://apiv2.shiprocket.in/v1/external/courier/generate/label',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SHIPROCKET_TOKEN
        },
        data: JSON.stringify({ shipment_id: [shipmentId] })
      });

      labelResult = labelResponse.data;
      console.log('🏷️ Label Generated:', JSON.stringify(labelResult, null, 2));
    } catch (err) {
      console.error('❌ Label Generation Failed:', err.response?.data || err.message);
    }

    // 6. Generate Manifest
    let manifestResult;
    try {
      const manifestResponse = await axios({
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://apiv2.shiprocket.in/v1/external/manifests/generate',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SHIPROCKET_TOKEN
        },
        data: JSON.stringify({ shipment_id: [shipmentId] })
      });

      manifestResult = manifestResponse.data;
      console.log('📄 Manifest Generated:', JSON.stringify(manifestResult, null, 2));
    } catch (err) {
      console.error('❌ Manifest Generation Failed:', err.response?.data || err.message);
    }

    // 7. Print Manifest
    let printManifestResult;
    try {
      const printManifestResponse = await axios({
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://apiv2.shiprocket.in/v1/external/manifests/print',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SHIPROCKET_TOKEN
        },
        data: JSON.stringify({ order_ids: [orderId] })
      });

      printManifestResult = printManifestResponse.data;
      console.log('🖨️ Manifest Print:', JSON.stringify(printManifestResult, null, 2));
    } catch (err) {
      console.error('❌ Manifest Print Failed:', err.response?.data || err.message);
    }

    // 8. Print Invoice
    let printInvoiceResult;
    try {
      const ids = [orderId.toString()];
      console.log('📤 Sending Invoice Print Request with Payload:', { ids });

      const printInvoiceResponse = await axios({
        method: 'post',
        url: 'https://apiv2.shiprocket.in/v1/external/orders/print/invoice',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SHIPROCKET_TOKEN
        },
        data: JSON.stringify({ ids })
      });

      printInvoiceResult = printInvoiceResponse.data;
      console.log('🧾 Invoice Print:', JSON.stringify(printInvoiceResult, null, 2));
    } catch (err) {
      console.error('❌ Invoice Print Failed:', err.response?.data || err.message);
    }

    // Final response
    res.status(200).json({
      order: orderResult,
      awb: awbResult,
      tracking: trackingResult,
      pickup: pickupResult,
      label: labelResult,
      manifest: manifestResult,
      printManifest: printManifestResult,
      printInvoice: printInvoiceResult
    });

  } catch (error) {
    console.error('❌ Error in full order workflow:', error.message);
    console.error('📦 Error Response:', JSON.stringify(error.response?.data || error.message, null, 2));

    res.status(500).json({
      error: 'Shiprocket order workflow failed',
      details: error.message,
      response: error.response?.data
    });
  }
});

router.post('/api/cancel-order', async (req, res) => {
  try {
    const { ids } = req.body;
    const SHIPROCKET_TOKEN = await getShiprocketToken();
    const data = JSON.stringify({ ids });

    // Cancel the order in Shiprocket
    const shiprocketResponse = await axios({
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/orders/cancel',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data
    });

    // Update MySQL `orders` table for each cancelled order
    for (const id of ids) {
      await dbMySQL.query(
        `UPDATE orders SET status = ? WHERE shiprocket_order_id = ?`,
        ['Cancelled', id]
      );
    }

    res.status(200).json({
      success: true,
      shiprocket: shiprocketResponse.data
    });
  } catch (error) {
    console.error('Cancel order error:', error.message);
    res.status(500).json({
      error: 'Failed to cancel order(s)',
      details: error.response?.data || error.message
    });
  }
});


router.get('/api/shiprocket/orders', async (req, res) => {
  const SHIPROCKET_TOKEN = await getShiprocketToken();
  try {
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/orders',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      }
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({
      error: 'Failed to fetch orders',
      details: error.response?.data || error.message
    });
  }
});

router.post('/api/shiprocket/serviceability', async (req, res) => {
  const {
    pickup_postcode,
    delivery_postcode,
    weight,
    declared_value
  } = req.body;
  const SHIPROCKET_TOKEN = await getShiprocketToken();
  // console.log("🚀 Shiprocket Token:", SHIPROCKET_TOKEN);

  if (!pickup_postcode || !delivery_postcode || !weight || !declared_value) {
    return res.status(400).json({ error: 'Missing required body parameters.' });
  }

  const params = new URLSearchParams({
    pickup_postcode,
    delivery_postcode,
    weight,
    cod: 1,
    declared_value,
    rate_calculator: 1,
    blocked: 1,
    is_return: 0,
    is_web: 1,
    is_dg: 0,
    only_qc_couriers: 0
  });

  try {
    const response = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/serviceability?${params.toString()}`,
      {
        headers: {
          Authorization: SHIPROCKET_TOKEN
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: error.response?.data || error.message
    });
  }
});

router.get('/api/track-shipment/:shipment_id', async (req, res) => {
  const { shipment_id } = req.params;
  const SHIPROCKET_TOKEN = await getShiprocketToken();

  if (!shipment_id) {
    return res.status(400).json({ success: false, message: 'Shipment ID is required' });
  }

  try {
    const response = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/track/shipment/${shipment_id}`,
      {
        headers: {
          Authorization: SHIPROCKET_TOKEN
        }
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Tracking API Error:', error?.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tracking info',
      error: error?.response?.data || error.message
    });
  }
});

router.get('/api/track-shipment/awb/:awb_code', async (req, res) => {
  const { awb_code } = req.params;
  const SHIPROCKET_TOKEN = await getShiprocketToken();

  if (!awb_code) {
    return res.status(400).json({ success: false, message: 'Shipment ID is required' });
  }

  try {
    const response = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb_code}`,
      {
        headers: {
          Authorization: SHIPROCKET_TOKEN
        }
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Tracking API Error:', error?.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tracking info',
      error: error?.response?.data || error.message
    });
  }
});

module.exports = router;
