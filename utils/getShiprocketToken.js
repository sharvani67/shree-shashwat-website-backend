// utils/getShiprocketToken.js
const { dbMySQL } = require('../config/db');

const getShiprocketToken = async () => {
  const query = "SELECT token FROM shiprocket_auth ORDER BY id DESC LIMIT 1";
  try {
    const [rows] = await dbMySQL.query(query);
    if (rows.length === 0) {
      throw new Error("No token found");
    }
    return `Bearer ${rows[0].token}`;
  } catch (err) {
    throw new Error(`Failed to fetch Shiprocket token: ${err.message}`);
  }
};

module.exports = getShiprocketToken;
