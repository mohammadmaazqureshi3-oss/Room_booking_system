-- SmartBuilding Database Schema
CREATE DATABASE IF NOT EXISTS smartbuilding;
USE smartbuilding;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Resources Table (Rooms)
CREATE TABLE IF NOT EXISTS resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity INT NOT NULL,
    status ENUM('available', 'maintenance', 'unavailable') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bookings Table with Federated Security References
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    resource_id INT NOT NULL,
    booking_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    -- Federated Security References
    shard_ref_a VARCHAR(255) NOT NULL COMMENT 'Reference to shard in Node A',
    shard_ref_b VARCHAR(255) NOT NULL COMMENT 'Reference to shard in Node B',
    shard_ref_c VARCHAR(255) NOT NULL COMMENT 'Reference to shard in Node C',
    -- OTP Fields for Email Verification
    otp_code VARCHAR(6) DEFAULT NULL COMMENT 'One-Time Password sent via email',
    otp_expiry DATETIME DEFAULT NULL COMMENT 'OTP expiration timestamp',
    otp_used BOOLEAN DEFAULT FALSE COMMENT 'Whether OTP has been used',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_resource_id (resource_id),
    INDEX idx_status (status),
    INDEX idx_booking_date (booking_date),
    INDEX idx_otp_code (otp_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin user
-- Password: admin123 (you'll hash this properly in production)
INSERT INTO users (name, email, password, role) VALUES 
('Admin User', 'admin@smartbuilding.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'admin');

-- Insert sample regular user
-- Password: user123
INSERT INTO users (name, email, password, role) VALUES 
('Test User', 'user@smartbuilding.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'user');

-- Insert sample resources
INSERT INTO resources (name, description, capacity, status) VALUES
('Conference Room A', 'Main conference room with projector and video conferencing equipment', 12, 'available'),
('Meeting Room B', 'Small meeting space with whiteboard', 6, 'available'),
('SBA', 'Premium meeting room with executive amenities', 8, 'available'),
('Training Room', 'Large space for workshops and training sessions', 20, 'available'),
('Collaboration Hub', 'Open space for team collaboration', 15, 'available');

-- Create audit log table (optional but recommended)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Success message
SELECT 'Database initialized successfully!' AS status;