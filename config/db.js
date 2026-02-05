
const mysql = require("mysql2/promise");
const Razorpay = require("razorpay");


// MySQL configuration using connection pool (promise-based)
const dbMySQL = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'ssr-db',
  // port:  4306, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000 // 10 seconds
});


// Razorpay configuration
const razorpay = new Razorpay({
  key_id: "rzp_test_PhWbtmUxU6a9Vf",
  key_secret: "jw2cBoogPEj2jzIvwlAiTJuk"
});

// Export all configured services
module.exports = {
  dbMySQL
};
