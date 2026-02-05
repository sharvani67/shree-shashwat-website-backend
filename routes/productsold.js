const express = require("express");
const router = express.Router();
const multer = require("multer");
const mysql = require("mysql2/promise");

const fs = require("fs");


// Database connection pool with improved configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'south_suthra',
  //  port: process.env.DB_PORT || 4306, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  timezone: 'Z'
});

// Error handling for database connection
pool.getConnection()
  .then(conn => {
    console.log('Successfully connected to the database');
    conn.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 6 // Max 6 files
  }
});

// Middleware to ensure table structure
async function verifyTableStructure() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Check if table exists
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'products'
    `);
    
    if (tables.length === 0) {
      // Create table if it doesn't exist
      await connection.query(`
        CREATE TABLE products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          tag VARCHAR(50) NOT NULL,
          icon VARCHAR(50) NOT NULL,
          rating DECIMAL(3,1) DEFAULT 0,
          spicyLevel INT DEFAULT 0,
          price DECIMAL(10,2) NOT NULL,
          originalPrice DECIMAL(10,2),
          weight VARCHAR(50) NOT NULL,
          images TEXT,
          weight_options JSON,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Created products table');
    }

    // Check for missing columns
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM products
    `);
    
    const columnNames = columns.map(col => col.Field);
    const requiredColumns = [
      'name', 'description', 'tag', 'icon', 'rating', 
      'spicyLevel', 'price', 'originalPrice', 'weight', 'images', 'weight_options'
    ];

    for (const col of requiredColumns) {
      if (!columnNames.includes(col)) {
        let alterQuery = '';
        if (col === 'weight') {
          alterQuery = 'ADD COLUMN weight VARCHAR(50) NOT NULL AFTER price';
        } else if (col === 'weight_options') {
          alterQuery = 'ADD COLUMN weight_options JSON AFTER images';
        } else if (col === 'images') {
          alterQuery = 'ADD COLUMN images TEXT AFTER weight';
        } else if (col === 'originalPrice') {
          alterQuery = 'ADD COLUMN originalPrice DECIMAL(10,2) AFTER price';
        }
        
        if (alterQuery) {
          await connection.query(`ALTER TABLE products ${alterQuery}`);
          console.log(`Added column ${col} to products table`);
        }
      }
    }
  } catch (err) {
    console.error('Error verifying table structure:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

// Add product with multiple images
router.post("/add/products", upload.array("images", 6), async (req, res) => {
  let connection;
  try {
    await verifyTableStructure();
    connection = await pool.getConnection();

    const { 
      name, 
      description, 
      tag, 
      icon, 
      rating = 0, 
      spicyLevel = 0, 
      price,
      originalPrice,
      weight,
      weightOptions
    } = req.body;

    // Validate required fields
    if (!name || !description || !tag || !price || !weight) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Process uploaded files
    const imageUrls = req.files.map(file => `/uploads/${file.filename}`);

    // Parse weight options
    let parsedWeightOptions = [];
    try {
      parsedWeightOptions = weightOptions ? JSON.parse(weightOptions) : [];
    } catch (e) {
      console.error("Error parsing weightOptions:", e);
      return res.status(400).json({ error: "Invalid weight options format" });
    }

    // Insert product into database
    const [result] = await connection.query(
      `INSERT INTO products 
       (name, description, tag, icon, rating, spicyLevel, price, originalPrice, weight, images, weight_options) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        description, 
        tag, 
        icon, 
        parseFloat(rating), 
        parseInt(spicyLevel), 
        parseFloat(price),
        originalPrice ? parseFloat(originalPrice) : null,
        weight,
        imageUrls.join(','),
        JSON.stringify(parsedWeightOptions)
      ]
    );

    res.status(201).json({ 
      success: true,
      message: "Product added successfully",
      productId: result.insertId,
      images: imageUrls
    });

  } catch (err) {
    console.error("Error adding product:", err);
    
    // Clean up uploaded files if error occurred
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(path.join(uploadDir, file.filename));
        } catch (unlinkErr) {
          console.error("Error cleaning up file:", unlinkErr);
        }
      });
    }
    
    let errorMessage = "Internal server error";
    if (err.code === 'LIMIT_FILE_SIZE') {
      errorMessage = "File size too large (max 100MB)";
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      errorMessage = "Too many files (max 6)";
    } else if (err.message.includes('Only image files')) {
      errorMessage = "Only image files are allowed";
    } else if (err.code === 'ECONNREFUSED') {
      errorMessage = "Database connection refused";
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});

// In your backend routes/products.js

// GET: All products with proper image URLs
router.get("/get/products", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await verifyTableStructure();
    
    const [columns] = await connection.query(`SHOW COLUMNS FROM products`);
    const columnNames = columns.map(col => col.Field);
    
    const selectFields = [
      'id', 'name', 'description', 'tag', 'icon', 
      'rating', 'spicyLevel', 'price', 'weight', 
      'images', 'weight_options', 'createdAt'
    ].filter(field => columnNames.includes(field));
    
    if (columnNames.includes('originalPrice')) {
      selectFields.splice(selectFields.indexOf('price') + 1, 0, 'originalPrice');
    }
    
    const [results] = await connection.query(`
      SELECT ${selectFields.join(',')}
      FROM products 
      ORDER BY createdAt ASC
    `);
    
    // Construct full image URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const products = results.map(product => ({
      id: product.id.toString(),
      name: product.name,
      description: product.description,
      tag: product.tag,
      icon: product.icon,
      rating: product.rating,
      spicyLevel: product.spicyLevel,
      price: product.price,
      originalPrice: columnNames.includes('originalPrice') ? product.originalPrice : null,
      weight: product.weight,
      images: product.images ? 
        product.images.split(',').map(img => `${baseUrl}${img}`) : [],
      image: product.images ? 
        `${baseUrl}${product.images.split(',')[0]}` : `${baseUrl}/uploads/default-product.jpg`,
      weightOptions: product.weight_options ? JSON.parse(product.weight_options) : [],
      createdAt: product.createdAt.toISOString()
    }));
    
    res.json({
      success: true,
      data: products
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ 
      success: false,
      error: "Database operation failed"
    });
  } finally {
    if (connection) connection.release();
  }
});

// Similarly update the GET by ID endpoint
router.get("/getbyId/products/:id", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // First verify the table structure
    await verifyTableStructure();
    
    // Get all column names to check what exists
    const [columns] = await connection.query(`SHOW COLUMNS FROM products`);
    const columnNames = columns.map(col => col.Field);
    
    // Build the SELECT query dynamically based on available columns
    const selectFields = [
      'id', 'name', 'description', 'tag', 'icon', 
      'rating', 'spicyLevel', 'price', 'weight', 
      'images', 'weight_options', 'createdAt'
    ].filter(field => columnNames.includes(field));
    
    // Add originalPrice only if it exists
    if (columnNames.includes('originalPrice')) {
      selectFields.splice(selectFields.indexOf('price') + 1, 0, 'originalPrice');
    }
    
    const [results] = await connection.query(`
      SELECT ${selectFields.join(',')}
      FROM products 
      WHERE id = ?
    `, [req.params.id]);
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: "Product not found" 
      });
    }
    
    const product = results[0];
    // In your backend route (/getbyId/products/:id)
const responseData = {
  id: product.id.toString(),
  name: product.name,
  description: product.description,
  tag: product.tag,
  icon: product.icon,
  rating: parseFloat(product.rating) || 0,
  spicyLevel: parseInt(product.spicyLevel) || 0,
  price: parseFloat(product.price) || 0,
  originalPrice: columnNames.includes('originalPrice') ? 
    (product.originalPrice ? parseFloat(product.originalPrice) : null) : 
    null,
  weight: product.weight,
  images: product.images ? 
    product.images.split(',').map(img => `${req.protocol}://${req.get('host')}${img}`) : 
    [],
  weightOptions: product.weight_options ? 
    JSON.parse(product.weight_options).map(option => ({
      ...option,
      price: parseFloat(option.price) || 0,
      originalPrice: option.originalPrice ? parseFloat(option.originalPrice) : null
    })) : 
    [],
  createdAt: product.createdAt.toISOString()
};
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ 
      success: false,
      error: "Database operation failed",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});


// DELETE: Product by ID
router.delete("/products/:id", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // First get the product to delete its images
    const [products] = await connection.query("SELECT images FROM products WHERE id = ?", [req.params.id]);
    
    if (products.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: "Product not found" 
      });
    }
    
    const images = products[0].images ? products[0].images.split(',') : [];
    
    // Delete the product
    await connection.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    
    // Delete associated images
    images.forEach(imagePath => {
      if (imagePath) {
        const filename = path.basename(imagePath);
        try {
          fs.unlinkSync(path.join(uploadDir, filename));
        } catch (err) {
          console.error("Error deleting image file:", err);
        }
      }
    });
    
    res.json({ 
      success: true,
      message: "Product deleted successfully" 
    });
  } catch (err) {
    console.error("Database error:", err);
    
    let statusCode = 500;
    let errorMessage = "Database operation failed";
    
    if (err.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = "Database service unavailable";
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;