const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbMySQL } = require('../config/db');



const SHIPROCKET_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjY2OTYxNDAsInNvdXJjZSI6InNyLWF1dGgtaW50IiwiZXhwIjoxNzUxNTQzMzc4LCJqdGkiOiJOd3pDUEJDamJrSHlROWl6IiwiaWF0IjoxNzUwNjc5Mzc4LCJpc3MiOiJodHRwczovL3NyLWF1dGguc2hpcHJvY2tldC5pbi9hdXRob3JpemUvdXNlciIsIm5iZiI6MTc1MDY3OTM3OCwiY2lkIjo0NTY4NDczLCJ0YyI6MzYwLCJ2ZXJib3NlIjpmYWxzZSwidmVuZG9yX2lkIjowLCJ2ZW5kb3JfY29kZSI6Im1pbmlzIn0.vUvMddJNt0WRIuiAggPJPoc9JGZeBqHjjou2rClG7mE';

const getShiprocketToken = async () => {
  try {
    const query = "SELECT token FROM shiprocket_auth ORDER BY id DESC LIMIT 1";
    const [rows] = await dbMySQL.query(query);

    if (rows.length === 0) throw new Error("No Shiprocket token found");

    return `Bearer ${rows[0].token}`;
  } catch (error) {
    throw new Error("Database error: " + error.message);
  }
};


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

// router.post('/api/create-order', async (req, res) => {
//   try {
//     const orderData = req.body;

//     // Log the incoming order data for debugging
//     console.log('Incoming Shiprocket Order Data:', JSON.stringify(orderData, null, 2));

//     const config = {
//       method: 'post',
//       maxBodyLength: Infinity,
//       url: 'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': SHIPROCKET_TOKEN
//       },
//       data: JSON.stringify(orderData)
//     };

//     const response = await axios(config);

//     // Log the successful Shiprocket API response
//     console.log('Shiprocket API Response:', JSON.stringify(response.data, null, 2));

//     res.status(200).json(response.data);
//   } catch (error) {
//     console.error('Order creation failed:', error.message);

//     // Log the detailed error if available
//     if (error.response) {
//       console.error('Shiprocket API Error Response:', JSON.stringify({
//         status: error.response.status,
//         data: error.response.data,
//         headers: error.response.headers
//       }, null, 2));
//     } else {
//       console.error('Error details:', error);
//     }

//     res.status(500).json({
//       error: 'Shiprocket order creation failed',
//       details: error.response?.data || error.message
//     });
//   }
// });

// router.post('/api/Shipment', async (req, res) => {
//     try {
//         const { shipment_id, courier_id } = req.body;

//         const data = JSON.stringify({
//             shipment_id,
//             courier_id
//         });

//         const config = {
//             method: 'post',
//             maxBodyLength: Infinity,
//             url: 'https://apiv2.shiprocket.in/v1/external/courier/assign/awb',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': SHIPROCKET_TOKEN
//             },
//             data
//         };

//         const response = await axios(config);
//         res.status(200).json(response.data);
//     } catch (error) {
//         console.error('AWB Assignment Error:', error.message);
//         res.status(500).json({
//             error: 'Failed to assign AWB',
//             details: error.response?.data || error.message
//         });
//     }
// });

// router.post('/api/tracking-order', async (req, res) => {
//     try {
//         const { awbs } = req.body;

//         const data = JSON.stringify({
//             awbs
//         });

//         const config = {
//             method: 'post',
//             maxBodyLength: Infinity,
//             url: 'https://apiv2.shiprocket.in/v1/external/courier/track/awbs',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': SHIPROCKET_TOKEN
//             },
//             data
//         };

//         const response = await axios(config);
//         res.status(200).json(response.data);
//     } catch (error) {
//         console.error('Tracking Error:', error.message);
//         res.status(500).json({
//             error: 'Failed to track AWBs',
//             details: error.response?.data || error.message
//         });
//     }
// });


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

router.get("/shiprocket-token", (req, res) => {
  const query = "SELECT token FROM shiprocket_auth ORDER BY id DESC LIMIT 1";

  db.query(query, (err, result) => {
    if (err) return res.status(500).json({ error: "Database error", details: err });

    if (result.length === 0) return res.status(404).json({ error: "No token found" });

    const token = result[0].token;
    return res.json({ token: `Bearer ${token}` });
  });
});

router.post('/api/create-order', async (req, res) => {
  try {
    const orderData = req.body;

    // 1. Create Order
    const createOrderConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify(orderData)
    };

    const createOrderResponse = await axios(createOrderConfig);
    const orderResult = createOrderResponse.data;

    console.log('✅ Order Created:', JSON.stringify(orderResult, null, 2));

    const shipmentId = orderResult.shipment_id;

    if (!shipmentId) {
      throw new Error('No shipment_id found in create order response');
    }

    // 2. Assign AWB (even if order is "CANCELED", attempt assignment)
    const assignAWBConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/courier/assign/awb',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify({
        shipment_id: shipmentId
        // Not passing courier_id since it's often selected automatically by Shiprocket
      })
    };

    const assignAWBResponse = await axios(assignAWBConfig);
    const awbResult = assignAWBResponse.data;

    console.log('✅ AWB Assigned:', JSON.stringify(awbResult, null, 2));

    const awbCode = awbResult?.response?.data?.awb_code;

    if (!awbCode) {
      throw new Error('No awb_code found in AWB assignment response');
    }

    // 3. Track Shipment
    const trackingConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/courier/track/awbs',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify({
        awbs: [awbCode]
      })
    };

    const trackingResponse = await axios(trackingConfig);
    const trackingResult = trackingResponse.data;

    console.log('📦 Tracking Info:', JSON.stringify(trackingResult, null, 2));

    // Final Response
    res.status(200).json({
      order: orderResult,
      awb: awbResult,
      tracking: trackingResult
    });

  } catch (error) {
    console.error('❌ Error in order workflow:', error.message);

    res.status(500).json({
      error: 'Shiprocket order workflow failed',
      details: error.response?.data || error.message
    });
  }
});

router.post('/api/cancel-order', async (req, res) => {
  try {
    const { ids } = req.body;

    const data = JSON.stringify({ ids });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/orders/cancel',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Cancel order error:', error.message);
    res.status(500).json({
      error: 'Failed to cancel order(s)',
      details: error.response?.data || error.message
    });
  }
});


router.post('/api/shippingrate-order', async (req, res) => {
  try {
    const orderData = req.body;

    // const SHIPROCKET_TOKEN = await getShiprocketToken();

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify(orderData)
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Order creation failed:', error.message);
    res.status(500).json({
      error: 'Shiprocket order creation failed',
      details: error.response?.data || error.message
    });
  }
});

router.get('/api/serviceability/:orderId', async (req, res) => {
  const { orderId } = req.params;

  if (!orderId) {
    return res.status(400).json({ error: 'orderId is required' });
  }

  try {
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?order_id=${orderId}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      }
    };

    const response = await axios(config);
    // console.log("response=",response)
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching courier serviceability:', error.message);
    res.status(500).json({
      error: 'Failed to fetch courier serviceability',
      details: error.response?.data || error.message
    });
  }
});


router.post('/api/generate-pickup', async (req, res) => {
  const { shipment_id } = req.body;

  if (!Array.isArray(shipment_id) || shipment_id.length === 0) {
    return res.status(400).json({ error: 'shipment_id must be a non-empty array' });
  }

  try {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/courier/generate/pickup',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify({ shipment_id })
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error generating pickup:', error.message);
    res.status(500).json({
      error: 'Failed to generate pickup',
      details: error.response?.data || error.message
    });
  }
});

router.post('/api/print-manifest', async (req, res) => {
  const { order_ids } = req.body;

  if (!Array.isArray(order_ids) || order_ids.length === 0) {
    return res.status(400).json({ error: 'order_ids must be a non-empty array' });
  }

  try {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/manifests/print',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify({ order_ids })
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error printing manifest:', error.message);
    res.status(500).json({
      error: 'Failed to print manifest',
      details: error.response?.data || error.message
    });
  }
});

router.post('/api/generate-manifest', async (req, res) => {
  const { shipment_id } = req.body;

  if (!Array.isArray(shipment_id) || shipment_id.length === 0) {
    return res.status(400).json({ error: 'shipment_id must be a non-empty array' });
  }

  try {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/manifests/generate',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify({ shipment_id })
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error generating manifest:', error.message);
    res.status(500).json({
      error: 'Failed to generate manifest',
      details: error.response?.data || error.message
    });
  }
});

router.post('/api/generate-label', async (req, res) => {
  const { shipment_id } = req.body;

  if (!Array.isArray(shipment_id) || shipment_id.length === 0) {
    return res.status(400).json({ error: 'shipment_id must be a non-empty array' });
  }

  try {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/courier/generate/label',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify({ shipment_id })
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error generating label:', error.message);
    res.status(500).json({
      error: 'Failed to generate label',
      details: error.response?.data || error.message
    });
  }
});

router.post('/api/print-invoice', async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Order ID(s) required in an array' });
  }

  try {
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/orders/print/invoice',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data: JSON.stringify({ ids })
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching invoice print URL:', error.message);
    res.status(500).json({
      error: 'Failed to fetch invoice print URL',
      details: error.response?.data || error.message
    });
  }
});



module.exports = router;
