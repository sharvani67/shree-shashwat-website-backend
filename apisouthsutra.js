const express = require('express');
const axios = require('axios');
const app = express();
const port = 4001;

// Middleware to parse JSON request body
app.use(express.json());
const SHIPROCKET_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjY2OTYxNDAsInNvdXJjZSI6InNyLWF1dGgtaW50IiwiZXhwIjoxNzU2MzY1MTUwLCJqdGkiOiJWMXlaNzJmc1ZIS0hNY0t4IiwiaWF0IjoxNzU1NTAxMTUwLCJpc3MiOiJodHRwczovL3NyLWF1dGguc2hpcHJvY2tldC5pbi9hdXRob3JpemUvdXNlciIsIm5iZiI6MTc1NTUwMTE1MCwiY2lkIjo0NTY4NDczLCJ0YyI6MzYwLCJ2ZXJib3NlIjpmYWxzZSwidmVuZG9yX2lkIjowLCJ2ZW5kb3JfY29kZSI6Im1pbmlzIn0.JVS-fEGSdKtr9MNiWnWjillRs9afRzfnm9LFn4S9jtE';
// Route: POST /api/shiprocket-login
app.post('/api/shiprocket-login', async (req, res) => {
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

app.post('/api/create-order', async (req, res) => {
  try {
    const orderData = req.body;

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

app.post('/api/cancel-order', async (req, res) => {
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

app.post('/api/Shipment', async (req, res) => {
  try {
    const { shipment_id, courier_id } = req.body;

    const data = JSON.stringify({
      shipment_id,
      courier_id
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/courier/assign/awb',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('AWB Assignment Error:', error.message);
    res.status(500).json({
      error: 'Failed to assign AWB',
      details: error.response?.data || error.message
    });
  }
});

app.post('/api/tracking-order', async (req, res) => {
  try {
    const { awbs } = req.body;

    const data = JSON.stringify({
      awbs
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/courier/track/awbs',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      },
      data
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Tracking Error:', error.message);
    res.status(500).json({
      error: 'Failed to track AWBs',
      details: error.response?.data || error.message
    });
  }
});

app.get('/api/orders', async (req, res) => {
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

app.get('/api/products', async (req, res) => {
  try {
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: 'https://apiv2.shiprocket.in/v1/external/products',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHIPROCKET_TOKEN
      }
    };

    const response = await axios(config);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({
      error: 'Failed to fetch products',
      details: error.response?.data || error.message
    });
  }
});

app.get('/api/serviceability/:orderId', async (req, res) => {
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
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching courier serviceability:', error.message);
    res.status(500).json({
      error: 'Failed to fetch courier serviceability',
      details: error.response?.data || error.message
    });
  }
});

app.post('/api/generate-pickup', async (req, res) => {
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

app.post('/api/print-manifest', async (req, res) => {
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

app.post('/api/generate-manifest', async (req, res) => {
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

app.post('/api/generate-label', async (req, res) => {
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

app.post('/api/print-invoice', async (req, res) => {
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

app.get('/api/track-shipment/:shipment_id', async (req, res) => {
  const { shipment_id } = req.params;

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


// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
