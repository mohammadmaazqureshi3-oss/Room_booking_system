require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios');
const nodemailer = require('nodemailer'); // NEW: Email support

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'smartbuilding',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ==================== EMAIL CONFIGURATION ====================

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS
  }
});

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server ready to send messages');
  }
});

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Calculate OTP expiry time
function getOTPExpiry() {
  const minutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
}

// Send OTP email
async function sendOTPEmail(userEmail, userName, otpCode, bookingId, resourceName) {
  const mailOptions = {
    from: `"SmartBuilding System" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: '🔐 Your SmartBuilding Access Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 3px dashed #667eea; padding: 20px; 
                     text-align: center; margin: 20px 0; border-radius: 10px; }
          .otp-code { font-size: 36px; font-weight: bold; color: #667eea; 
                      letter-spacing: 10px; font-family: monospace; }
          .info-box { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; 
                      margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
          .warning { color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏢 SmartBuilding System</h1>
            <p>Secure Booking Verification</p>
          </div>
          <div class="content">
            <h2>Hello, ${userName}!</h2>
            <p>Your room booking has been created successfully. To access your secure PIN, please verify your identity using the One-Time Password below.</p>
            
            <div class="otp-box">
              <p style="margin: 0; font-size: 14px; color: #666;">Your Verification Code</p>
              <div class="otp-code">${otpCode}</div>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes</p>
            </div>
            
            <div class="info-box">
              <strong>📋 Booking Details:</strong><br>
              • Booking ID: <strong>#${bookingId}</strong><br>
              • Room: <strong>${resourceName}</strong><br>
              • Date: <strong>${new Date().toLocaleString()}</strong>
            </div>
            
            <p><strong>🔒 Security Information:</strong></p>
            <ul>
              <li>This code expires in <strong>${process.env.OTP_EXPIRY_MINUTES || 10} minutes</strong></li>
              <li>Each code can only be used <strong>once</strong></li>
              <li>Your access PIN is stored across <strong>3 federated edge nodes</strong> for maximum security</li>
            </ul>
            
            <p class="warning">⚠️ If you didn't request this booking, please contact our support team immediately.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from SmartBuilding System<br>
            Please do not reply to this email</p>
            <p>© 2024 SmartBuilding - Secured by Federated Architecture</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    return false;
  }
}

// Edge Node Configuration
const EDGE_NODES = {
  nodeA: { 
    url: process.env.NODE_A_URL || 'http://localhost:3001', 
    key: process.env.NODE_A_KEY || 'node-a-secret-key-abc123' 
  },
  nodeB: { 
    url: process.env.NODE_B_URL || 'http://localhost:3002', 
    key: process.env.NODE_B_KEY || 'node-b-secret-key-def456' 
  },
  nodeC: { 
    url: process.env.NODE_C_URL || 'http://localhost:3003', 
    key: process.env.NODE_C_KEY || 'node-c-secret-key-ghi789' 
  }
};

// ==================== MIDDLEWARE ====================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==================== AUTHENTICATION ENDPOINTS ====================

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'user']
    );

    const token = jwt.sign(
      { id: result.insertId, email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.insertId, name, email, role: 'user' }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== RESOURCE CRUD ENDPOINTS ====================

app.get('/api/resources', authenticateToken, async (req, res) => {
  try {
    const [resources] = await pool.query('SELECT * FROM resources WHERE status = "available"');
    res.json(resources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

app.post('/api/resources', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, capacity } = req.body;

    if (!name || !description || !capacity) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const [result] = await pool.query(
      'INSERT INTO resources (name, description, capacity) VALUES (?, ?, ?)',
      [name, description, capacity]
    );

    res.status(201).json({
      message: 'Resource created',
      resource: { id: result.insertId, name, description, capacity }
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({ error: 'Failed to create resource' });
  }
});

app.put('/api/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, capacity } = req.body;

    const [result] = await pool.query(
      'UPDATE resources SET name = ?, description = ?, capacity = ? WHERE id = ?',
      [name, description, capacity, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json({ message: 'Resource updated successfully' });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

app.delete('/api/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM resources WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

// ==================== FEDERATED SECURITY FUNCTIONS ====================

function splitPIN(pin) {
  return {
    shard1: pin.substring(0, 2),
    shard2: pin.substring(2, 4),
    shard3: pin.substring(4, 6)
  };
}

async function storeShard(nodeUrl, nodeKey, shardId, shardValue) {
  try {
    const response = await axios.post(`${nodeUrl}/store`, {
      shardId,
      shardValue,
      nodeKey
    }, { timeout: 5000 });
    return response.data.success;
  } catch (error) {
    console.error(`Error storing shard in ${nodeUrl}:`, error.message);
    return false;
  }
}

async function retrieveShard(nodeUrl, nodeKey, shardId) {
  try {
    const response = await axios.post(`${nodeUrl}/retrieve`, {
      shardId,
      nodeKey
    }, { timeout: 5000 });
    return response.data.shard;
  } catch (error) {
    console.error(`Error retrieving shard from ${nodeUrl}:`, error.message);
    return null;
  }
}

// ==================== BOOKING ENDPOINTS WITH OTP ====================

app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { resourceId } = req.body;
    const userId = req.user.id;

    // Get user info for email
    const [users] = await pool.query('SELECT name, email FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    // Check resource exists
    const [resources] = await pool.query('SELECT * FROM resources WHERE id = ?', [resourceId]);
    if (resources.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    const resource = resources[0];

    // Generate 6-digit PIN for access
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Generated PIN: ${pin} for user ${userId}`);

    // Generate 6-digit OTP for email verification
    const otpCode = generateOTP();
    const otpExpiry = getOTPExpiry();
    console.log(`Generated OTP: ${otpCode} (expires at ${otpExpiry})`);

    // Split PIN into shards
    const shards = splitPIN(pin);
    const bookingTimestamp = Date.now();
    const shardIdPrefix = `booking_${bookingTimestamp}`;

    // Store shards in edge nodes
    const [storeA, storeB, storeC] = await Promise.all([
      storeShard(EDGE_NODES.nodeA.url, EDGE_NODES.nodeA.key, `${shardIdPrefix}_a`, shards.shard1),
      storeShard(EDGE_NODES.nodeB.url, EDGE_NODES.nodeB.key, `${shardIdPrefix}_b`, shards.shard2),
      storeShard(EDGE_NODES.nodeC.url, EDGE_NODES.nodeC.key, `${shardIdPrefix}_c`, shards.shard3)
    ]);

    if (!storeA || !storeB || !storeC) {
      return res.status(500).json({ error: 'Failed to store security shards' });
    }

    // Create booking with shard references AND OTP
    const [result] = await pool.query(
      `INSERT INTO bookings 
       (user_id, resource_id, booking_date, shard_ref_a, shard_ref_b, shard_ref_c, otp_code, otp_expiry, otp_used) 
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, FALSE)`,
      [userId, resourceId, `${shardIdPrefix}_a`, `${shardIdPrefix}_b`, `${shardIdPrefix}_c`, otpCode, otpExpiry]
    );

    const bookingId = result.insertId;

    // Send OTP email
    const emailSent = await sendOTPEmail(user.email, user.name, otpCode, bookingId, resource.name);

    if (!emailSent) {
      console.error('Failed to send OTP email, but booking was created');
    }

    res.status(201).json({
      message: 'Booking created successfully',
      bookingId: bookingId,
      resourceName: resource.name,
      otpSent: emailSent,
      userEmail: user.email
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Booking failed' });
  }
});

app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const [bookings] = await pool.query(
      `SELECT b.*, r.name as resource_name 
       FROM bookings b 
       JOIN resources r ON b.resource_id = r.id 
       WHERE b.user_id = ? AND b.status = 'active'
       ORDER BY b.booking_date DESC`,
      [req.user.id]
    );
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ==================== OTP VERIFICATION & PIN REVEAL ====================

app.post('/api/bookings/:id/reveal-pin', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { mfaCode } = req.body;

    if (!mfaCode || mfaCode.length !== 6) {
      return res.status(400).json({ error: 'Invalid OTP format' });
    }

    // Fetch booking with OTP info
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookings[0];

    // Verify OTP exists
    if (!booking.otp_code) {
      return res.status(400).json({ error: 'No OTP found for this booking' });
    }

    // Check if OTP has already been used
    if (booking.otp_used) {
      return res.status(400).json({ error: 'OTP has already been used. Each code can only be used once.' });
    }

    // Check if OTP has expired
    const now = new Date();
    const expiry = new Date(booking.otp_expiry);
    if (now > expiry) {
      return res.status(400).json({ 
        error: 'OTP has expired. Please create a new booking.',
        expired: true
      });
    }

    // Verify OTP matches
    if (mfaCode !== booking.otp_code) {
      return res.status(401).json({ error: 'Invalid OTP code' });
    }

    // OTP is valid! Mark it as used
    await pool.query(
      'UPDATE bookings SET otp_used = TRUE WHERE id = ?',
      [id]
    );

    // Retrieve shards from all 3 nodes
    const [shard1, shard2, shard3] = await Promise.all([
      retrieveShard(EDGE_NODES.nodeA.url, EDGE_NODES.nodeA.key, booking.shard_ref_a),
      retrieveShard(EDGE_NODES.nodeB.url, EDGE_NODES.nodeB.key, booking.shard_ref_b),
      retrieveShard(EDGE_NODES.nodeC.url, EDGE_NODES.nodeC.key, booking.shard_ref_c)
    ]);

    // Check if all shards retrieved
    if (!shard1 || !shard2 || !shard3) {
      return res.status(500).json({
        error: 'Cannot retrieve PIN - one or more edge nodes unavailable',
        federatedSecurityActive: true
      });
    }

    // Reconstruct PIN
    const pin = shard1 + shard2 + shard3;

    res.json({
      message: 'PIN retrieved successfully',
      pin,
      bookingId: id
    });
  } catch (error) {
    console.error('Error revealing PIN:', error);
    res.status(500).json({ error: 'Failed to reveal PIN' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SmartBuilding API running',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASS)
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SmartBuilding Backend running on http://localhost:${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
  console.log(`📧 Email OTP: ${process.env.EMAIL_USER ? 'Configured ✅' : 'Not configured ❌'}`);
});