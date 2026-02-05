const admin = require("firebase-admin");
const mysql = require("mysql2/promise");
const Razorpay = require("razorpay");
const serviceAccount = require("../southsutraecommerce.json");

// Firebase configuration
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tickettracker-dedc6-default-rtdb.firebaseio.com"
});

const dbFirestore = admin.firestore();
const auth = admin.auth();

// MySQL configuration using connection pool (promise-based)
const dbMySQL = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'south_suthra_testdb',
  // port:  4306, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000 // 10 seconds
});


// const dbMySQL = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: 'mysql@pwd#',
//   database: 'bulk_orders_db',
//   port: 3306, // Change if needed
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
//   connectTimeout: 10000 // 10 seconds
// });

// Razorpay configuration
const razorpay = new Razorpay({
  key_id: "rzp_test_PhWbtmUxU6a9Vf",
  key_secret: "jw2cBoogPEj2jzIvwlAiTJuk"
});

// Export all configured services
module.exports = {
  dbFirestore,
  auth,
  dbMySQL,
  razorpay
};
