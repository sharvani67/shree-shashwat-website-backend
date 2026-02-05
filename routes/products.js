const express = require("express");
const router = express.Router();
const multer = require("multer");
const { dbMySQL } = require("../config/db");
const fs = require("fs");
const path = require("path");

// Configure upload directory
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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
  try {
    // Check if table exists
    const [tables] = await dbMySQL.query(`
      SHOW TABLES LIKE 'products'
    `);

    if (tables.length === 0) {
      // Create table if it doesn't exist
      await dbMySQL.query(`
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
    const [columns] = await dbMySQL.query(`
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
          await dbMySQL.query(`ALTER TABLE products ${alterQuery}`);
          console.log(`Added column ${col} to products table`);
        }
      }
    }
  } catch (err) {
    console.error('Error verifying table structure:', err);
    throw err;
  }
}

// Add product with multiple images
router.post('/add/products', upload.array("images", 6), async (req, res) => {
  // console.log('Request files:', req.files);
  // console.log('Request body:', req.body);

  const {
    name,
    description,
    tag,
    icon,
    rating = "0.0",
    spicyLevel = 0,
    price,
    originalPrice = null,
    weight,
    weightOptions
  } = req.body;

  try {
    await verifyTableStructure();

    if (!name || !description || !price || !weight) {
      return res.status(400).json({ error: "Missing required fields (name, description, price, or weight)" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images were uploaded" });
    }

    // Create clean image URLs
    const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
    const mainImage = imageUrls[0];

    // Verify files were saved
    for (const file of req.files) {
      const filePath = path.join(uploadDir, file.filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File ${file.filename} was not saved correctly`);
      }
    }

    // Handle weightOptions
    let parsedWeightOptions = [];
    try {
      if (typeof weightOptions === 'string') {
        parsedWeightOptions = weightOptions ? JSON.parse(weightOptions) : [];
      } else if (weightOptions && Array.isArray(weightOptions)) {
        parsedWeightOptions = weightOptions;
      } else {
        parsedWeightOptions = [{
          weight: weight,
          price: price,
          originalPrice: originalPrice || null,
          quantity: 20
        }];
      }
    } catch (e) {
      console.error("Error parsing weightOptions:", e);
      return res.status(400).json({
        error: "Invalid weight options format",
        details: "Please provide valid JSON array for weightOptions"
      });
    }

    // Insert product into database
    const insertProductQuery = `
      INSERT INTO products 
        (name, description, tag, icon, rating, spicyLevel, price, originalPrice, weight, images, image, weight_options) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Properly stringify the image array
    const imagesJson = JSON.stringify(imageUrls);
    const weightOptionsJson = JSON.stringify(parsedWeightOptions);

    const [productResult] = await dbMySQL.query(insertProductQuery, [
      name,
      description,
      tag || null,
      icon || null,
      parseFloat(rating),
      parseInt(spicyLevel),
      parseFloat(price),
      originalPrice ? parseFloat(originalPrice) : null,
      weight,
      imagesJson,
      mainImage,
      weightOptionsJson
    ]);

    res.status(201).json({
      message: 'Product added successfully',
      product: {
        id: productResult.insertId,
        name,
        description,
        tag,
        icon,
        rating: parseFloat(rating).toFixed(1),
        spicyLevel: parseInt(spicyLevel),
        price: parseFloat(price).toFixed(2),
        originalPrice: originalPrice ? parseFloat(originalPrice).toFixed(2) : null,
        weight,
        images: imageUrls,
        image: mainImage,
        weightOptions: parsedWeightOptions,
        createdAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Insert error:', err);

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(path.join(uploadDir, file.filename));
        } catch (unlinkErr) {
          console.error("Error cleaning up file:", unlinkErr);
        }
      });
    }

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Product with this name already exists' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size too large (max 100MB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files (max 6)' });
    }
    if (err.message.includes('Only image files')) {
      return res.status(400).json({ message: 'Only image files are allowed' });
    }

    res.status(500).json({
      message: 'Internal server error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET: All products with proper image URLs
router.get("/get/products", async (req, res) => {
  try {
    await verifyTableStructure();

    const [columns] = await dbMySQL.query(`SHOW COLUMNS FROM products`);
    const columnNames = columns.map(col => col.Field);

    const selectFields = [
      'id', 'name', 'description', 'tag', 'icon',
      'rating', 'spicyLevel', 'price', 'weight',
      'images', 'weight_options', 'createdAt'
    ].filter(field => columnNames.includes(field));

    if (columnNames.includes('originalPrice')) {
      selectFields.splice(selectFields.indexOf('price') + 1, 0, 'originalPrice');
    }

    const [results] = await dbMySQL.query(`
      SELECT ${selectFields.join(',')}
      FROM products 
      ORDER BY createdAt ASC
    `);

    // Construct full image URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const products = results.map(product => {
      // Parse the images JSON properly
      let images = [];
      try {
        if (product.images) {
          images = JSON.parse(product.images);
          if (!Array.isArray(images)) {
            images = [];
          }
        }
      } catch (e) {
        console.error("Error parsing images JSON:", e);
        images = [];
      }

      return {
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
        images: images,
        image: images.length > 0 ? images[0] : `/uploads/default-product.jpg`,

        weightOptions: product.weight_options ? JSON.parse(product.weight_options) : [],
        createdAt: product.createdAt.toISOString()
      };
    });

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
  }
});

// GET product by ID
router.get("/getbyId/products/:id", async (req, res) => {
  try {
    await verifyTableStructure();

    const [columns] = await dbMySQL.query(`SHOW COLUMNS FROM products`);
    const columnNames = columns.map(col => col.Field);

    const selectFields = [
      'id', 'name', 'description', 'tag', 'icon',
      'rating', 'spicyLevel', 'price', 'weight',
      'images', 'weight_options', 'createdAt'
    ].filter(field => columnNames.includes(field));

    if (columnNames.includes('originalPrice')) {
      selectFields.splice(selectFields.indexOf('price') + 1, 0, 'originalPrice');
    }

    const [results] = await dbMySQL.query(`
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

    // Parse the images JSON properly
    let images = [];
    try {
      if (product.images) {
        images = JSON.parse(product.images);
        if (!Array.isArray(images)) {
          images = [];
        }
      }
    } catch (e) {
      console.error("Error parsing images JSON:", e);
      images = [];
    }

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
      images: images,
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
  }
});

// DELETE: Product by ID
router.delete("/products/:id", async (req, res) => {
  try {
    // First get the product to delete its images
    const [products] = await dbMySQL.query("SELECT images FROM products WHERE id = ?", [req.params.id]);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    // Parse the images JSON properly
    let images = [];
    try {
      if (products[0].images) {
        images = JSON.parse(products[0].images);
        if (!Array.isArray(images)) {
          images = [];
        }
      }
    } catch (e) {
      console.error("Error parsing images JSON:", e);
      images = [];
    }

    // Delete the product
    await dbMySQL.query("DELETE FROM products WHERE id = ?", [req.params.id]);

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
  }
});

module.exports = router;