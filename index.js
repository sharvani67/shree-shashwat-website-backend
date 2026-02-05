const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');  // Add this line to import path module

const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/email');
const mysqlRoutes = require('./routes/mysql');
const paymentRoutes = require('./routes/payment');
const shiprocketRoutes = require('./routes/shiprocket');
const phonepayRoutes = require('./routes/phonepe');
const CustomerRoutes = require('./routes/customer');
const productRoutes = require('./routes/products');
const loginRoutes = require('./routes/login');
const addressRoutes = require('./routes/address');
const cartitemsRoutes = require('./routes/cart_items');
const wishlistRoutes = require('./routes/wishlist');
const forgotPasswordRoutes = require('./routes/forgotpassword');
const orderRoutes = require('./routes/orders');


const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 
app.use('/assets', express.static(path.join(__dirname, 'assets')));


// Routes
app.use('/', authRoutes);
app.use('/', emailRoutes);
app.use('/', mysqlRoutes);
app.use('/', paymentRoutes);
app.use('/', shiprocketRoutes);
app.use('/', phonepayRoutes);
app.use('/', CustomerRoutes);
app.use('/', productRoutes);
app.use('/', loginRoutes);
app.use('/', addressRoutes);
app.use('/', cartitemsRoutes);
app.use('/', wishlistRoutes);
app.use('/', forgotPasswordRoutes);
app.use('/', orderRoutes);

// Root route
app.get('/', (req, res) => {
  res.send("Hello World! This is the modular SutraCart server.");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;