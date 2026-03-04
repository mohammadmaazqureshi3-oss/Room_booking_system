SmartBuilding Secure Booking System
A secure, full-stack web application designed for facility management and room booking. This project demonstrates advanced security concepts, specifically a "Federated Security" architecture that decentralizes sensitive access credentials to eliminate single points of failure.

🔐 Core Security Innovation: Federated Sharding
Instead of storing a complete access PIN in a central database, the system splits the PIN into three shards and distributes them across isolated Edge Nodes.

Sharding: A 6-digit PIN (e.g., 123456) is split into three 2-digit shards (12, 34, 56).

Distribution: Each shard is transmitted to a specific Edge Node via a POST request signed with an internal NODE_KEY.

Reconstruction: PINs are only reconstructed after a user verifies their identity via a strictly single-use One-Time Password (OTP) sent to their email.

🏗️ System Architecture
The application is containerized using Docker and consists of 5 distinct services running on a private bridge network:

Backend API (smartbuilding_backend): Central orchestration server built with Node.js and Express. Handles authentication, MFA, and serves static frontend files.

Database (smartbuilding_db): MySQL 8.0 instance. Stores user profiles and shard references (e.g., booking_1705500000_a), but never the shards themselves.

Edge Nodes (edge_node_a, edge_node_b, edge_node_c): Three lightweight, isolated Node.js services acting as secure vaults. They store credential shards in-memory and require strict Node Key Authentication.

🛠️ Technology Stack
Backend: Node.js (v18 Alpine), Express.js

Database: MySQL 8.0 (using mysql2 promise wrapper)

Frontend: HTML5, CSS3, Bootstrap 5 (Single Page Application)

Security: BCrypt, JWT, Nodemailer (Gmail SMTP), Internal Node Keys

Infrastructure: Docker & Docker Compose

🚀 Features
Role-Based Access Control (RBAC): Users can view/book rooms; Admins can create/delete resources.

Multi-Factor Authentication (MFA): Email-based OTP verification using Nodemailer.

Anti-Replay Protection: OTPs use an otp_used flag to ensure they cannot be intercepted and reused.

Blast Radius Minimization: A database breach only reveals shard references, not usable PINs.

💻 Installation & Setup
Prerequisites
Docker and Docker Compose installed on your machine.

A Gmail account with an App Password generated (for MFA emails).

1. Environment Configuration
Create a .env file in the root directory and configure your secure variables:

Code snippet
# Database Configuration
DB_HOST=database
DB_USER=root
DB_PASSWORD=rootpassword
DB_NAME=smartbuilding

# Authentication
JWT_SECRET=your_super_secret_jwt_key

# Email Configuration (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_APP_PASS=your_16_char_app_password

# Edge Node Keys (Must match docker-compose.yml)
NODE_A_KEY=node-a-secret-key-abc123
NODE_B_KEY=node-b-secret-key-def456
NODE_C_KEY=node-c-secret-key-ghi789
2. Start the Application
Since the app is fully containerized, starting it is a single command. The included init.sql will automatically build the database schema and insert default data.

Run the following command in the root folder:

Bash
docker-compose up -d --build
(Alternatively, use npm run docker:up if you have Node installed locally)

3. Access the System
Frontend/API: http://localhost:3000

Default Admin Account:

Email: admin@smartbuilding.com

Password: admin123 (Note: The hash in init.sql matches password or admin123 depending on your setup, be sure to test both and update immediately)

Stopping the System
To stop the containers and secure the network:

Bash
docker-compose down
