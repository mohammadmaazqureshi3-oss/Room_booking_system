// ==================== GLOBAL VARIABLES ====================
const API_BASE = 'http://localhost:3000/api';
let currentUser = null;
let authToken = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkExistingAuth();
});

// ==================== SETUP EVENT LISTENERS ====================
function setupEventListeners() {
    // Auth forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    // Password toggles
    document.getElementById('toggleLoginPassword').addEventListener('click', () => {
        togglePassword('loginPassword', 'toggleLoginPassword');
    });
    document.getElementById('toggleRegisterPassword').addEventListener('click', () => {
        togglePassword('registerPassword', 'toggleRegisterPassword');
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Admin forms
    document.getElementById('addResourceForm').addEventListener('submit', handleAddResource);
    document.getElementById('updateResourceBtn').addEventListener('click', handleUpdateResource);
    
    // MFA
    document.getElementById('verifyMfaBtn').addEventListener('click', handleVerifyMFA);
    
    // Tab changes
    document.getElementById('bookings-tab').addEventListener('click', loadBookings);
    const adminTab = document.getElementById('admin-tab');
    if (adminTab) {
        adminTab.addEventListener('click', loadAdminResources);
    }
}

// ==================== AUTHENTICATION ====================

// Check if user is already logged in
function checkExistingAuth() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    
    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        showDashboard();
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showNotification('Login successful!', 'success');
            showDashboard();
        } else {
            showNotification(data.error || 'Login failed', 'danger');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Network error. Please check if the server is running.', 'danger');
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showNotification('Registration successful!', 'success');
            showDashboard();
        } else {
            showNotification(data.error || 'Registration failed', 'danger');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Network error. Please try again.', 'danger');
    }
}

// Handle logout
function handleLogout(e) {
    e.preventDefault();
    
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('authView').style.display = 'flex';
    
    // Reset forms
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    
    showNotification('Logged out successfully', 'info');
}

// Show dashboard after login
function showDashboard() {
    document.getElementById('authView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'block';
    
    // Update navbar with user info
    document.getElementById('navUserName').textContent = currentUser.name;
    document.getElementById('navUserEmail').textContent = currentUser.email;
    
    // Show admin tab if user is admin
    if (currentUser.role === 'admin') {
        document.getElementById('adminTabNav').style.display = 'block';
    }
    
    // Load initial data
    loadResources();
}

// ==================== RESOURCES ====================

// Load all resources
async function loadResources() {
    try {
        const response = await fetch(`${API_BASE}/resources`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const resources = await response.json();
        displayResources(resources);
    } catch (error) {
        console.error('Error loading resources:', error);
        document.getElementById('resourcesList').innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Failed to load resources. Please refresh the page.
                </div>
            </div>
        `;
    }
}

// Display resources
function displayResources(resources) {
    const container = document.getElementById('resourcesList');
    
    if (resources.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    No resources available at the moment.
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = resources.map(resource => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100 border-0 shadow-sm resource-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <h5 class="card-title fw-bold">${resource.name}</h5>
                        <i class="bi bi-building-fill text-primary fs-3"></i>
                    </div>
                    <p class="card-text text-muted">${resource.description}</p>
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                        <span class="badge bg-light text-dark">
                            <i class="bi bi-people-fill me-1"></i>${resource.capacity} people
                        </span>
                        <button class="btn btn-primary btn-sm" onclick="bookResource(${resource.id}, '${resource.name}')">
                            <i class="bi bi-calendar-plus me-1"></i>Book Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}


// Book a resource (UPDATED WITH EMAIL NOTIFICATION)
async function bookResource(resourceId, resourceName) {
    if (!confirm(`Book ${resourceName}?`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ resourceId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success message with email notification
            const message = data.otpSent 
                ? `✅ Booking successful!\n\n📧 A 6-digit verification code has been sent to ${data.userEmail}\n\n🔒 Your access PIN has been securely distributed across 3 federated edge nodes.\n\nBooking ID: ${data.bookingId}`
                : `✅ Booking successful!\n\n⚠️ Warning: Email could not be sent. Please contact support.\n\nBooking ID: ${data.bookingId}`;
            
            showNotification(message, data.otpSent ? 'success' : 'warning');
            
            // Switch to bookings tab
            document.getElementById('bookings-tab').click();
        } else {
            showNotification(data.error || 'Booking failed', 'danger');
        }
    } catch (error) {
        console.error('Booking error:', error);
        showNotification('Network error during booking', 'danger');
    }
}

// ==================== BOOKINGS ====================

// Load user bookings
async function loadBookings() {
    try {
        const response = await fetch(`${API_BASE}/bookings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const bookings = await response.json();
        displayBookings(bookings);
        
        // Update badge count
        document.getElementById('bookingsCount').textContent = bookings.length;
    } catch (error) {
        console.error('Error loading bookings:', error);
        document.getElementById('bookingsList').innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Failed to load bookings.
            </div>
        `;
    }
}

// Display bookings
function displayBookings(bookings) {
    const container = document.getElementById('bookingsList');
    
    if (bookings.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info border-0">
                <i class="bi bi-info-circle me-2"></i>
                You don't have any bookings yet. Book a room to get started!
            </div>
        `;
        return;
    }
    
    container.innerHTML = bookings.map(booking => `
        <div class="card mb-3 border-0 shadow-sm">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h5 class="fw-bold mb-2">
                            <i class="bi bi-door-open text-primary me-2"></i>
                            ${booking.resource_name}
                        </h5>
                        <p class="text-muted mb-2">
                            <i class="bi bi-calendar3 me-2"></i>
                            ${new Date(booking.booking_date).toLocaleString()}
                        </p>
                        <p class="text-muted mb-3">
                            <small><i class="bi bi-hash me-1"></i>Booking ID: ${booking.id}</small>
                        </p>
                        
                        <div class="bg-light rounded p-2">
                            <small class="text-muted fw-semibold">
                                <i class="bi bi-shield-check me-1"></i>Federated Security Status:
                            </small>
                            <div class="d-flex gap-2 mt-2 flex-wrap">
                                <span class="badge bg-success">
                                    <i class="bi bi-hdd-network-fill me-1"></i>Node-A: Active
                                </span>
                                <span class="badge bg-primary">
                                    <i class="bi bi-hdd-network-fill me-1"></i>Node-B: Active
                                </span>
                                <span class="badge bg-info text-dark">
                                    <i class="bi bi-hdd-network-fill me-1"></i>Node-C: Active
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4 text-end mt-3 mt-md-0">
                        <button class="btn btn-success btn-lg w-100" onclick="showMfaModal(${booking.id})">
                            <i class="bi bi-key-fill me-2"></i>Show Access PIN
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Show MFA modal
function showMfaModal(bookingId) {
    document.getElementById('mfaBookingId').value = bookingId;
    document.getElementById('mfaCode').value = '';
    const modal = new bootstrap.Modal(document.getElementById('mfaModal'));
    modal.show();
}

// Handle MFA verification and PIN reveal
async function handleVerifyMFA() {
    console.log('🔵 Verify button clicked!'); // ADD THIS DEBUG LINE
    
    const mfaCode = document.getElementById('mfaCode').value;
    const bookingId = document.getElementById('mfaBookingId').value;
    
    console.log('📝 MFA Code:', mfaCode); // ADD THIS DEBUG LINE
    console.log('📝 Booking ID:', bookingId); // ADD THIS DEBUG LINE
    
    if (!mfaCode || mfaCode.length !== 6) {
        showNotification('Please enter a valid 6-digit code', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/bookings/${bookingId}/reveal-pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ mfaCode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('mfaModal')).hide();
            showPinAlert(data.pin, bookingId);
        } else {
            showNotification(data.error || 'Failed to retrieve PIN', 'danger');
        }
    } catch (error) {
        console.error('PIN retrieval error:', error);
        showNotification('Network error during PIN retrieval', 'danger');
    }
}

// Show PIN alert
function showPinAlert(pin, bookingId) {
    const alertHTML = `
        <div class="alert alert-success alert-dismissible fade show border-0 shadow-lg" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 400px;">
            <h4 class="alert-heading">
                <i class="bi bi-check-circle-fill me-2"></i>PIN Retrieved Successfully!
            </h4>
            <hr>
            <div class="bg-white rounded p-3 mb-3">
                <p class="mb-2"><strong>Your Access PIN:</strong></p>
                <h1 class="text-center text-primary mb-0" style="font-family: monospace; letter-spacing: 10px; font-size: 3rem;">
                    ${pin}
                </h1>
            </div>
            <p class="mb-0 small">
                <i class="bi bi-info-circle me-1"></i>
                This PIN was securely reconstructed from 3 federated edge nodes (Docker containers).
                <br>Booking ID: ${bookingId}
            </p>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = alertHTML;
    document.body.appendChild(container);
    
    setTimeout(() => {
        container.remove();
    }, 10000);
}

// ==================== ADMIN FUNCTIONS ====================

async function loadAdminResources() {
    try {
        const response = await fetch(`${API_BASE}/resources`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const resources = await response.json();
        displayAdminResources(resources);
    } catch (error) {
        console.error('Error loading admin resources:', error);
    }
}

function displayAdminResources(resources) {
    const container = document.getElementById('adminResourcesList');
    
    if (resources.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No resources available.</div>';
        return;
    }
    
    container.innerHTML = resources.map(resource => `
        <div class="card mb-3 border-0 shadow-sm">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h5 class="fw-bold mb-2">${resource.name}</h5>
                        <p class="text-muted mb-1">${resource.description}</p>
                        <small class="text-muted">
                            <i class="bi bi-people-fill me-1"></i>Capacity: ${resource.capacity} people
                        </small>
                    </div>
                    <div class="col-md-4 text-end">
                        <button class="btn btn-warning btn-sm me-2" onclick="showEditModal(${resource.id}, '${resource.name.replace(/'/g, "\\'")}', '${resource.description.replace(/'/g, "\\'")}', ${resource.capacity})">
                            <i class="bi bi-pencil-square me-1"></i>Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteResource(${resource.id})">
                            <i class="bi bi-trash me-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleAddResource(e) {
    e.preventDefault();
    
    const name = document.getElementById('resourceName').value;
    const description = document.getElementById('resourceDescription').value;
    const capacity = document.getElementById('resourceCapacity').value;
    
    try {
        const response = await fetch(`${API_BASE}/resources`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, description, capacity })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Resource created successfully!', 'success');
            document.getElementById('addResourceForm').reset();
            loadAdminResources();
            loadResources();
        } else {
            showNotification(data.error || 'Failed to create resource', 'danger');
        }
    } catch (error) {
        console.error('Error creating resource:', error);
        showNotification('Network error', 'danger');
    }
}

function showEditModal(id, name, description, capacity) {
    document.getElementById('editResourceId').value = id;
    document.getElementById('editResourceName').value = name;
    document.getElementById('editResourceDescription').value = description;
    document.getElementById('editResourceCapacity').value = capacity;
    
    const modal = new bootstrap.Modal(document.getElementById('editResourceModal'));
    modal.show();
}

async function handleUpdateResource() {
    const id = document.getElementById('editResourceId').value;
    const name = document.getElementById('editResourceName').value;
    const description = document.getElementById('editResourceDescription').value;
    const capacity = document.getElementById('editResourceCapacity').value;
    
    try {
        const response = await fetch(`${API_BASE}/resources/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, description, capacity })
        });
        
        if (response.ok) {
            showNotification('Resource updated successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editResourceModal')).hide();
            loadAdminResources();
            loadResources();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Failed to update resource', 'danger');
        }
    } catch (error) {
        console.error('Error updating resource:', error);
        showNotification('Network error', 'danger');
    }
}

async function deleteResource(id) {
    if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/resources/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            showNotification('Resource deleted successfully!', 'success');
            loadAdminResources();
            loadResources();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Failed to delete resource', 'danger');
        }
    } catch (error) {
        console.error('Error deleting resource:', error);
        showNotification('Network error', 'danger');
    }
}

// ==================== UTILITY FUNCTIONS ====================

function togglePassword(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}

function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}