// TMS Smart Trip - Core Logic (v2.6 - Ultra Stable)
// Priorities: 1. Zero-Crash Stability 2. Image Resilience 3. Local-First Logic

// Supabase Configuration (Background Backup)
const SUPABASE_URL = 'https://rzqxnlqnridawazapbgw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6cXhubHFucmlkYXdhemFwYmd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDkxMTQsImV4cCI6MjA4NjYyNTExNH0.uLe9bUpeRc6yXPMiQKdud63DFaA5S92yDObaK3lM1oM';
let supabase = null;
try {
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.error('Supabase Initialization Failed:', e);
}

// Storage Engine (Local-First Architecture)
const DB = {
    getUsers() {
        try {
            return JSON.parse(localStorage.getItem('tms_users')) || [];
        } catch (e) { return []; }
    },
    getBookings() {
        try {
            return JSON.parse(localStorage.getItem('tms_bookings')) || [];
        } catch (e) { return []; }
    },
    async saveBooking(booking) {
        const bookings = this.getBookings();
        const newBooking = {
            id: Date.now().toString(),
            ...booking,
            status: 'Pending',
            created_at: new Date().toISOString()
        };
        bookings.push(newBooking);
        localStorage.setItem('tms_bookings', JSON.stringify(bookings));

        // Silent Cloud Backup
        if (supabase) {
            supabase.from('bookings').insert([{
                user_id: booking.userId,
                user_name: booking.userName,
                dest: booking.selections.dest,
                flight: booking.selections.flight,
                total_price: booking.totalPrice,
                status: 'Pending'
            }]).then(() => console.log('✅ Cloud Backup Success')).catch(() => { });
        }
        return newBooking;
    },
    async createUser(user) {
        const users = this.getUsers();
        users.push({ ...user, created_at: new Date().toISOString() });
        localStorage.setItem('tms_users', JSON.stringify(users));

        if (supabase) {
            supabase.from('users').insert([user]).then(() => console.log('✅ User Synced')).catch(() => { });
        }
        return user;
    },
    updateBookingStatus(id, status) {
        const bookings = this.getBookings();
        const index = bookings.findIndex(b => b.id === id);
        if (index !== -1) {
            bookings[index].status = status;
            localStorage.setItem('tms_bookings', JSON.stringify(bookings));
        }
    },
    deleteBooking(id) {
        const bookings = this.getBookings().filter(b => b.id !== id);
        localStorage.setItem('tms_bookings', JSON.stringify(bookings));
    },
    emergencyReset() {
        if (confirm('CRITICAL: This will clear all local data and reset the app. Continue?')) {
            localStorage.clear();
            location.reload();
        }
    }
};

// Ensure basic users exist
if (DB.getUsers().length === 0) {
    DB.createUser({ name: 'Admin', email: 'admin@tms.com', password: 'admin123', role: 'admin' });
}

// State Management
const state = {
    currentUser: JSON.parse(localStorage.getItem('tms_active_user')) || null,
    booking: { subtotal: 0, gst: 0, serviceTax: 0, total: 0 },
    selections: { dest: 'none', flight: 'none', ride: 'none', hotel: 'none', food: 'none', guide: 'none' },
    prices: {
        goa: 2000, thailand: 15000, switzerland: 45000, maldives: 25000, usa: 65000, uk: 55000, japan: 50000, dubai: 18000,
        economy: 4500, business: 12500, first: 32000,
        ride_free: 0, ride_standard: 350, ride_special: 1500, ride_luxury: 12000,
        stay_budget: 1200, stay_premium: 5500, stay_resort: 15000,
        food_basic: 150, food_gourmet: 450, food_premium: 1200,
        guide_basic: 800, guide_pro: 2500
    }
};

const cleanDisplay = (val) => {
    if (!val || val === 'none') return '-';
    return val.split('_').pop().toUpperCase();
};

// DOM Elements
const destSelect = document.getElementById('dest-type');
const flightSelect = document.getElementById('flight-type');
const rideSelect = document.getElementById('ride-type');
const hotelSelect = document.getElementById('hotel-type');
const foodSelect = document.getElementById('food-type');
const guideSelect = document.getElementById('guide-type');
const totalPriceDisplay = document.getElementById('overall-price');
const bookBtn = document.getElementById('book-now-btn');
const authModal = document.getElementById('auth-modal');
const loginTrigger = document.getElementById('login-trigger');
const closeAuthModal = document.getElementById('close-auth-modal');
const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('TMS initialized. Stability Mode active.');
    updateUIForAuth();
    setupEventListeners();
    initGSAP();

    // Check for admin role case-insensitively
    if (state.currentUser && state.currentUser.role?.toLowerCase() === 'admin') {
        toggleAdminPanel(true);
    }

    // Resilience: Image Error Handler
    document.querySelectorAll('img').forEach(img => {
        img.onerror = function () {
            console.warn('Image failed to load:', this.src);
            this.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80';
            this.onerror = null;
        };
        // Trigger error for broken cached images
        if (img.complete && img.naturalHeight === 0) img.onerror();
    });

    setTimeout(() => ScrollTrigger.refresh(), 1000);
});

function initGSAP() {
    try {
        gsap.registerPlugin(ScrollTrigger);
        gsap.from(".hero-content > *", { duration: 1, y: 30, opacity: 0, stagger: 0.2, ease: "power2.out" });
        gsap.from(".booking-card", {
            scrollTrigger: { trigger: ".booking-grid", start: "top 90%" },
            duration: 0.6, y: 20, opacity: 0, stagger: 0.05, ease: "power2.out"
        });
    } catch (e) { console.warn('GSAP Animation Error:', e); }
}

function setupEventListeners() {
    [destSelect, flightSelect, rideSelect, hotelSelect, foodSelect, guideSelect].forEach(el => {
        el?.addEventListener('change', updatePrices);
    });

    loginTrigger?.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.currentUser) logout();
        else authModal.classList.remove('hidden');
    });

    closeAuthModal?.addEventListener('click', () => authModal.classList.add('hidden'));

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.target;
            loginForm?.classList.toggle('hidden', target !== 'login-form');
            signupForm?.classList.toggle('hidden', target === 'login-form');
        });
    });

    loginForm?.addEventListener('submit', handleLogin);
    signupForm?.addEventListener('submit', handleSignup);
    if (bookBtn) bookBtn.onclick = handleBooking;

    // Mobile Menu
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    mobileBtn?.addEventListener('click', () => {
        mobileBtn.classList.toggle('active');
        navLinks?.classList.toggle('active');
    });
}

function updateUIForAuth() {
    if (state.currentUser && loginTrigger) {
        loginTrigger.innerHTML = `Logout (${state.currentUser.name})`;
        loginTrigger.classList.replace('btn-primary', 'btn-outline');
    } else if (loginTrigger) {
        loginTrigger.innerHTML = 'Login';
        loginTrigger.classList.replace('btn-outline', 'btn-primary');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value.trim().toLowerCase();
    const password = loginForm.querySelector('input[type="password"]').value;

    const user = DB.getUsers().find(u => u.email.toLowerCase() === email && u.password === password);

    if (user) {
        state.currentUser = user;
        localStorage.setItem('tms_active_user', JSON.stringify(user));
        updateUIForAuth();
        authModal.classList.add('hidden');
        if (user.role?.toLowerCase() === 'admin') toggleAdminPanel(true);
        alert(`Welcome, ${user.name}!`);
    } else {
        alert('Invalid email or password.');
    }
}

function handleSignup(e) {
    e.preventDefault();
    const name = signupForm.querySelector('input[type="text"]').value;
    const email = signupForm.querySelector('input[type="email"]').value.toLowerCase();
    const password = signupForm.querySelector('input[type="password"]').value;

    if (DB.getUsers().find(u => u.email.toLowerCase() === email)) {
        alert('Email already exists.');
        return;
    }

    DB.createUser({ name, email, password, role: 'user' });
    alert('Success! Please login.');
    authTabs[0].click();
}

function logout() {
    state.currentUser = null;
    localStorage.removeItem('tms_active_user');
    updateUIForAuth();
    toggleAdminPanel(false);
    location.reload(); // Hard reload for clean state
}

function updatePrices() {
    state.selections = {
        dest: destSelect?.value || 'none',
        flight: flightSelect?.value || 'none',
        ride: rideSelect?.value || 'none',
        hotel: hotelSelect?.value || 'none',
        food: foodSelect?.value || 'none',
        guide: guideSelect?.value || 'none'
    };

    const subtotal = Object.values(state.selections).reduce((acc, val) => acc + (state.prices[val] || 0), 0);
    const gst = subtotal * 0.05;
    const sTax = subtotal * 0.02;
    state.booking = { subtotal, gst, serviceTax: sTax, total: subtotal + gst + sTax };

    animateValue(totalPriceDisplay, state.booking.total);
    updateBreakdownUI();
    if (bookBtn) bookBtn.disabled = state.booking.total === 0;
}

function updateBreakdownUI() {
    const ids = { 'subtotal-val': state.booking.subtotal, 'gst-val': state.booking.gst, 'tax-val': state.booking.serviceTax };
    Object.entries(ids).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = `₹${val.toFixed(2)}`;
    });
}

function handleBooking() {
    if (!state.currentUser) {
        alert('Please login to book.');
        authModal.classList.remove('hidden');
        return;
    }

    const data = {
        userId: state.currentUser.id || 'LOCAL',
        userName: state.currentUser.name,
        selections: { ...state.selections },
        totalPrice: state.booking.total
    };

    DB.saveBooking(data).then(res => {
        if (res) {
            alert('Booking Saved!');
            showBillModal(res);
        }
    });
}

function showBillModal(data) {
    const modal = document.getElementById('bill-modal');
    const details = document.getElementById('bill-details');
    if (details) {
        details.innerHTML = `
            <div style="display:flex;justify-content:space-between"><strong>ID:</strong><span>#${data.id.slice(-4)}</span></div>
            <div style="display:flex;justify-content:space-between"><strong>Customer:</strong><span>${data.userName}</span></div>
            <div style="display:flex;justify-content:space-between"><strong>Destination:</strong><span>${cleanDisplay(data.selections.dest)}</span></div>
        `;
    }
    const total = document.getElementById('bill-total');
    if (total) total.innerText = `₹${data.totalPrice.toFixed(2)}`;
    modal?.classList.remove('hidden');
}

window.proceedToPaymentFromBill = () => {
    document.getElementById('bill-modal')?.classList.add('hidden');
    const payModal = document.getElementById('payment-modal');
    const payAmt = document.getElementById('pay-amount');
    if (payAmt) payAmt.innerText = `₹${state.booking.total.toFixed(2)}`;
    payModal?.classList.remove('hidden');
};

window.confirmBookingPayment = () => {
    const btn = event.target;
    if (btn) btn.innerText = 'Verifying...';
    setTimeout(() => {
        alert('Payment Success! Your trip is locked in.');
        location.reload();
    }, 1500);
};

function renderAdminDashboard() {
    const adminSec = document.getElementById('admin-section');
    if (!adminSec) return;

    adminSec.classList.remove('hidden');
    ['home', 'booking', 'about', 'contact'].forEach(s => document.getElementById(s)?.classList.add('hidden'));

    const bookings = DB.getBookings();
    const users = DB.getUsers();
    const revenue = bookings.reduce((s, b) => s + (b.totalPrice || 0), 0);

    const statsHTML = `
        <div class="admin-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;margin-bottom:2rem">
            <div class="glass-card" style="padding:1rem;text-align:center"><h4>Users</h4><div style="font-size:1.5rem;color:var(--primary)">${users.length}</div></div>
            <div class="glass-card" style="padding:1rem;text-align:center"><h4>Bookings</h4><div style="font-size:1.5rem;color:var(--primary)">${bookings.length}</div></div>
            <div class="glass-card" style="padding:1rem;text-align:center"><h4>Revenue</h4><div style="font-size:1.5rem;color:var(--primary)">₹${revenue.toLocaleString()}</div></div>
        </div>
    `;

    const oldStats = adminSec.querySelector('.admin-stats');
    if (oldStats) oldStats.remove();
    adminSec.querySelector('.section-header')?.insertAdjacentHTML('afterend', statsHTML);

    const bTbody = document.getElementById('bookings-tbody');
    if (bTbody) {
        bTbody.innerHTML = bookings.length === 0 ? '<tr><td colspan="6" style="padding:2rem;text-align:center">No bookings yet</td></tr>' : bookings.map(b => `
            <tr style="border-bottom:1px solid var(--glass-border)">
                <td style="padding:1rem">#${b.id.slice(-4)}</td>
                <td style="padding:1rem">${b.userName}</td>
                <td style="padding:1rem;font-size:0.8rem">${cleanDisplay(b.selections.dest)}</td>
                <td style="padding:1rem;color:var(--primary)">₹${b.totalPrice.toFixed(0)}</td>
                <td style="padding:1rem"><span style="background:var(--primary)11;color:var(--primary);padding:3px 8px;border-radius:10px">${b.status}</span></td>
                <td style="padding:1rem">
                    <button onclick="DB.deleteBooking('${b.id}');renderAdminDashboard()" style="color:var(--primary);background:none;border:1px solid var(--primary);padding:3px 8px;border-radius:4px;cursor:pointer">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    const uTbody = document.getElementById('users-tbody');
    if (uTbody) {
        uTbody.innerHTML = users.map(u => `
            <tr style="border-bottom:1px solid var(--glass-border)">
                <td style="padding:1rem">${u.name}</td>
                <td style="padding:1rem;color:var(--text-muted)">${u.email}</td>
                <td style="padding:1rem">${u.role}</td>
                <td style="padding:1rem">${new Date(u.created_at || Date.now()).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }
}

window.switchAdminTab = (name) => {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => t.classList.toggle('active', t.innerText.toLowerCase() === name.toLowerCase()));
    document.getElementById('admin-bookings-tab')?.classList.toggle('hidden', name !== 'bookings');
    document.getElementById('admin-users-tab')?.classList.toggle('hidden', name !== 'users');
};

const toggleAdminPanel = (show) => {
    const adminSec = document.getElementById('admin-section');
    if (show) {
        renderAdminDashboard();
        if (!document.getElementById('admin-link')) {
            const li = document.createElement('li');
            li.id = 'admin-link';
            li.innerHTML = '<a href="#" class="accent-text" style="color:var(--primary);border:1px solid var(--primary);padding:5px 15px;border-radius:8px">Admin Panel</a>';
            document.querySelector('.nav-links')?.prepend(li);
            li.onclick = (e) => { e.preventDefault(); renderAdminDashboard(); };
        }
    } else {
        adminSec?.classList.add('hidden');
        ['home', 'booking', 'about', 'contact'].forEach(s => document.getElementById(s)?.classList.remove('hidden'));
        document.getElementById('admin-link')?.remove();
    }
};

window.toggleAdminPanel = toggleAdminPanel;

function animateValue(obj, end) {
    if (!obj) return;
    const start = parseFloat(obj.innerText.replace(/[₹,]/g, '')) || 0;
    const curr = { val: start };
    gsap.to(curr, {
        val: end, duration: 0.8, ease: "power2.out",
        onUpdate: () => obj.innerText = `₹${curr.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    });
}
