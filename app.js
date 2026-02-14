// TMS Smart Trip - Core Logic (v2.5 - Professional Edition)
// Priorities: 1. Stability 2. UI Aesthetics 3. Cloud Sync

// Supabase Configuration (Silent Sync)
const SUPABASE_URL = 'https://rzqxnlqnridawazapbgw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6cXhubHFucmlkYXdhemFwYmd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDkxMTQsImV4cCI6MjA4NjYyNTExNH0.uLe9bUpeRc6yXPMiQKdud63DFaA5S92yDObaK3lM1oM';
let supabase = null;
if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Storage Engine (Local-First with Silent Cloud Backup)
const DB = {
    getUsers() {
        return JSON.parse(localStorage.getItem('tms_users')) || [];
    },
    getBookings() {
        return JSON.parse(localStorage.getItem('tms_bookings')) || [];
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

        // Silent Cloud Sync
        if (supabase) {
            supabase.from('bookings').insert([{
                user_id: booking.userId,
                user_name: booking.userName,
                dest: booking.selections.dest,
                flight: booking.selections.flight,
                total_price: booking.totalPrice,
                status: 'Pending'
            }]).then(() => console.log('Cloud Sync Success')).catch(e => console.warn('Cloud Sync Failed', e));
        }
        return newBooking;
    },
    async createUser(user) {
        const users = this.getUsers();
        users.push(user);
        localStorage.setItem('tms_users', JSON.stringify(users));

        // Silent Cloud Sync
        if (supabase) {
            supabase.from('users').insert([user]).then(() => console.log('User Sync Success')).catch(e => console.warn('User Sync Failed', e));
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
    }
};

// Initial Data: Create Admin if not exists
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
    const parts = val.split('_');
    return (parts.length > 1 ? parts.slice(1).join(' ') : parts[0]).toUpperCase();
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
    updateUIForAuth();
    setupEventListeners();
    initGSAP();

    // Force Admin Panel Visibility if needed
    if (state.currentUser && state.currentUser.role === 'admin') {
        toggleAdminPanel(true);
    }

    // Refresh layout after animations
    setTimeout(() => ScrollTrigger.refresh(), 500);
});

function initGSAP() {
    gsap.registerPlugin(ScrollTrigger);

    // Hero Animations
    gsap.from(".hero-content > *", { duration: 1.2, y: 50, opacity: 0, stagger: 0.3, ease: "power4.out" });

    // About Section
    gsap.from(".about-content", {
        scrollTrigger: { trigger: "#about", start: "top 80%" },
        duration: 1, x: -50, opacity: 0, ease: "power3.out"
    });
    gsap.from(".about-image", {
        scrollTrigger: { trigger: "#about", start: "top 80%" },
        duration: 1, x: 50, opacity: 0, ease: "power3.out"
    });

    // Booking Section
    gsap.from(".booking-card", {
        scrollTrigger: { trigger: ".booking-grid", start: "top 85%" },
        duration: 0.8, y: 30, opacity: 0, stagger: 0.1, ease: "back.out(1.2)"
    });

    // Contact Cards
    gsap.from(".contact-card", {
        scrollTrigger: { trigger: "#contact", start: "top 90%" },
        duration: 0.8, scale: 0.9, opacity: 0, stagger: 0.2, ease: "power2.out"
    });
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
            loginForm.classList.toggle('hidden', target !== 'login-form');
            signupForm.classList.toggle('hidden', target === 'login-form');
        });
    });

    loginForm?.addEventListener('submit', handleLogin);
    signupForm?.addEventListener('submit', handleSignup);
    bookBtn?.addEventListener('click', handleBooking);

    // Mobile Menu
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    mobileBtn?.addEventListener('click', () => {
        mobileBtn.classList.toggle('active');
        navLinks.classList.toggle('active');
    });
}

function updateUIForAuth() {
    if (state.currentUser && loginTrigger) {
        loginTrigger.innerHTML = `Logout (${state.currentUser.name})`;
        loginTrigger.classList.remove('btn-primary');
        loginTrigger.classList.add('btn-outline');
    } else if (loginTrigger) {
        loginTrigger.innerHTML = 'Login';
        loginTrigger.classList.add('btn-primary');
        loginTrigger.classList.remove('btn-outline');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value.trim();
    const password = loginForm.querySelector('input[type="password"]').value;

    const users = DB.getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        state.currentUser = user;
        localStorage.setItem('tms_active_user', JSON.stringify(user));
        updateUIForAuth();
        authModal.classList.add('hidden');
        if (user.role === 'admin') toggleAdminPanel(true);
        alert(`Welcome, ${user.name}!`);
    } else {
        alert('Invalid email or password.');
    }
}

function handleSignup(e) {
    e.preventDefault();
    const name = signupForm.querySelector('input[type="text"]').value;
    const email = signupForm.querySelector('input[type="email"]').value;
    const password = signupForm.querySelector('input[type="password"]').value;

    if (DB.getUsers().find(u => u.email === email)) {
        alert('Email already registered.');
        return;
    }

    DB.createUser({ name, email, password, role: 'user' });
    alert('Account created! Please login.');
    authTabs[0].click();
}

function logout() {
    state.currentUser = null;
    localStorage.removeItem('tms_active_user');
    updateUIForAuth();
    toggleAdminPanel(false);
    alert('Logged out.');
}

function updatePrices() {
    state.selections.dest = destSelect.value;
    state.selections.flight = flightSelect.value;
    state.selections.ride = rideSelect.value;
    state.selections.hotel = hotelSelect.value;
    state.selections.food = foodSelect.value;
    state.selections.guide = guideSelect.value;

    const subtotal = (state.prices[state.selections.dest] || 0) +
        (state.prices[state.selections.flight] || 0) +
        (state.prices[state.selections.ride] || 0) +
        (state.prices[state.selections.hotel] || 0) +
        (state.prices[state.selections.food] || 0) +
        (state.prices[state.selections.guide] || 0);

    const gst = subtotal * 0.05;
    const sTax = subtotal * 0.02;
    state.booking = { subtotal, gst, serviceTax: sTax, total: subtotal + gst + sTax };

    animateValue(totalPriceDisplay, state.booking.total);
    updateBreakdownUI();
    bookBtn.disabled = state.booking.total === 0;
}

function updateBreakdownUI() {
    document.getElementById('subtotal-val').innerText = `₹${state.booking.subtotal.toFixed(2)}`;
    document.getElementById('gst-val').innerText = `₹${state.booking.gst.toFixed(2)}`;
    document.getElementById('tax-val').innerText = `₹${state.booking.serviceTax.toFixed(2)}`;
}

async function handleBooking() {
    if (!state.currentUser) {
        alert('Please login first.');
        authModal.classList.remove('hidden');
        return;
    }

    const bookingData = {
        userId: state.currentUser.id || 'LOCAL',
        userName: state.currentUser.name,
        selections: { ...state.selections },
        totalPrice: state.booking.total
    };

    const res = await DB.saveBooking(bookingData);
    if (res) {
        alert('Booking Success!');
        showBillModal(res);
    }
}

function showBillModal(data) {
    const modal = document.getElementById('bill-modal');
    document.getElementById('bill-details').innerHTML = `
        <div style="display:flex;justify-content:space-between"><strong>ID:</strong><span>#${data.id.slice(-4)}</span></div>
        <div style="display:flex;justify-content:space-between"><strong>Destination:</strong><span>${cleanDisplay(data.selections.dest)}</span></div>
    `;
    document.getElementById('bill-total').innerText = `₹${data.totalPrice.toFixed(2)}`;
    modal.classList.remove('hidden');
}

window.proceedToPaymentFromBill = function () {
    document.getElementById('bill-modal').classList.add('hidden');
    const payModal = document.getElementById('payment-modal');
    document.getElementById('pay-amount').innerText = `₹${state.booking.total.toFixed(2)}`;
    payModal.classList.remove('hidden');
};

window.confirmBookingPayment = function () {
    const btn = event.target;
    btn.innerText = 'Verifying...';
    setTimeout(() => {
        alert('Payment Confirmed!');
        location.reload();
    }, 1500);
};

function renderAdminDashboard() {
    const adminSection = document.getElementById('admin-section');
    adminSection.classList.remove('hidden');
    document.getElementById('home').classList.add('hidden');
    document.getElementById('booking').classList.add('hidden');
    document.getElementById('about').classList.add('hidden');
    document.getElementById('contact').classList.add('hidden');

    const bookings = DB.getBookings();
    const users = DB.getUsers();

    // Stats
    const totalRev = bookings.reduce((s, b) => s + (b.totalPrice || 0), 0);
    const statsHTML = `
        <div class="admin-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
            <div class="glass-card" style="padding: 1.5rem; text-align: center;">
                <h4 style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Total Users</h4>
                <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${users.length}</div>
            </div>
            <div class="glass-card" style="padding: 1.5rem; text-align: center;">
                <h4 style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Total Bookings</h4>
                <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${bookings.length}</div>
            </div>
            <div class="glass-card" style="padding: 1.5rem; text-align: center;">
                <h4 style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Revenue</h4>
                <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">₹${totalRev.toLocaleString('en-IN')}</div>
            </div>
        </div>
    `;

    const existingStats = adminSection.querySelector('.admin-stats');
    if (existingStats) existingStats.remove();
    adminSection.querySelector('.section-header').insertAdjacentHTML('afterend', statsHTML);

    // Bookings Table
    document.getElementById('bookings-tbody').innerHTML = bookings.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:2rem">No bookings yet.</td></tr>' : bookings.map(b => `
        <tr style="border-bottom: 1px solid var(--glass-border)">
            <td style="padding: 1rem">#${b.id.slice(-4)}</td>
            <td style="padding: 1rem; font-weight: 600">${b.userName}</td>
            <td style="padding: 1rem; font-size: 0.85rem">${cleanDisplay(b.selections.dest)} | ${cleanDisplay(b.selections.flight)}</td>
            <td style="padding: 1rem; color: var(--primary); font-weight: 700">₹${b.totalPrice.toFixed(2)}</td>
            <td style="padding: 1rem"><span style="background:var(--primary)22; color:var(--primary); padding:3px 10px; border-radius:10px; font-size:0.75rem">${b.status}</span></td>
            <td style="padding: 1rem">
                <button onclick="DB.updateBookingStatus('${b.id}', 'Confirmed');renderAdminDashboard()" class="btn-primary" style="padding:5px 10px; font-size:0.7rem">Verify</button>
                <button onclick="DB.deleteBooking('${b.id}');renderAdminDashboard()" class="btn-outline" style="padding:5px 10px; font-size:0.7rem; border-color:var(--primary); color:var(--primary)">Delete</button>
            </td>
        </tr>
    `).join('');

    // Users Table
    document.getElementById('users-tbody').innerHTML = users.map(u => `
        <tr style="border-bottom: 1px solid var(--glass-border)">
            <td style="padding: 1rem; font-weight: 600">${u.name}</td>
            <td style="padding: 1rem; color: var(--text-muted)">${u.email}</td>
            <td style="padding: 1rem"><span style="background: ${u.role === 'admin' ? '#ef444422' : '#var(--glass-border)'}; color: ${u.role === 'admin' ? '#ef4444' : 'var(--text-muted)'}; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem;">${u.role || 'User'}</span></td>
            <td style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted)">${new Date(u.created_at || Date.now()).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

window.switchAdminTab = function (tabName) {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => {
        const isActive = t.innerText.toLowerCase() === tabName.toLowerCase();
        t.classList.toggle('active', isActive);
        t.classList.toggle('btn-primary', isActive);
        t.classList.toggle('btn-outline', !isActive);
    });
    document.getElementById('admin-bookings-tab').classList.toggle('hidden', tabName !== 'bookings');
    document.getElementById('admin-users-tab').classList.toggle('hidden', tabName !== 'users');
};

const toggleAdminPanel = (show) => {
    const adminSec = document.getElementById('admin-section');
    const sections = ['home', 'booking', 'about', 'contact'];

    if (show) {
        renderAdminDashboard();
        if (!document.getElementById('admin-link')) {
            const li = document.createElement('li');
            li.id = 'admin-link';
            li.innerHTML = '<a href="#" class="accent-text" style="color:var(--primary); border:1px solid var(--primary); padding:5px 15px; border-radius:8px">Admin Panel</a>';
            document.querySelector('.nav-links').prepend(li);
            li.addEventListener('click', (e) => { e.preventDefault(); renderAdminDashboard(); });
        }
    } else {
        adminSec.classList.add('hidden');
        sections.forEach(s => document.getElementById(s)?.classList.remove('hidden'));
        document.getElementById('admin-link')?.remove();
    }
};

window.toggleAdminPanel = toggleAdminPanel;

function animateValue(obj, end) {
    const start = parseFloat(obj.innerText.replace(/[₹,]/g, '')) || 0;
    const current = { val: start };
    gsap.to(current, {
        val: end, duration: 1, ease: "power2.out",
        onUpdate: () => obj.innerText = `₹${current.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    });
}
