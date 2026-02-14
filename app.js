// Supabase Configuration
const SUPABASE_URL = 'https://rzqxnlqnridawazapbgw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6cXhubHFucmlkYXdhemFwYmd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDkxMTQsImV4cCI6MjA4NjYyNTExNH0.uLe9bUpeRc6yXPMiQKdud63DFaA5S92yDObaK3lM1oM';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('TMS App Version: 2.3 - Global Sync');

// Storage Engine (Now using Supabase Cloud DB)
const DB = {
    async getUsers() {
        const { data, error } = await supabase.from('users').select('*');
        if (error) { console.error('Error fetching users:', error); return []; }
        return data;
    },
    async getBookings() {
        const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
        if (error) { console.error('Error fetching bookings:', error); return []; }
        return data;
    },
    async saveBooking(booking) {
        const { data, error } = await supabase.from('bookings').insert([{
            user_id: booking.userId,
            user_name: booking.userName,
            dest: booking.selections.dest,
            flight: booking.selections.flight,
            ride: booking.selections.ride,
            hotel: booking.selections.hotel,
            food: booking.selections.food,
            guide: booking.selections.guide,
            total_price: booking.totalPrice,
            status: 'Pending'
        }]).select();
        if (error) { console.error('Error saving booking:', error); return null; }
        return data[0];
    },
    async createUser(user) {
        const { data, error } = await supabase.from('users').insert([user]).select();
        if (error) { console.error('Error creating user:', error); return null; }
        return data[0];
    },
    async deleteBooking(id) {
        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) console.error('Error deleting booking:', error);
    },
    async updateBookingStatus(id, status) {
        const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
        if (error) console.error('Error updating booking status:', error);
    }
};

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
const closePaymentModal = document.getElementById('close-payment-modal');
const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    updateUIForAuth();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registered', reg))
                .catch(err => console.log('Service Worker registration failed', err));
        });
    }

    if (state.currentUser && state.currentUser.role?.toLowerCase() === 'admin') {
        toggleAdminPanel(true);
    }
    setupEventListeners();
    initGSAP();

    // Global Image Error Fallback
    document.querySelectorAll('img').forEach(img => {
        img.onerror = function () {
            this.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80';
            this.onerror = null;
        };
    });
});

function initGSAP() {
    gsap.registerPlugin(ScrollTrigger);

    gsap.from(".hero-content > *", { duration: 1.2, y: 50, opacity: 0, stagger: 0.3, ease: "power4.out" });

    gsap.from(".booking-card", {
        duration: 0.8,
        scale: 0.8,
        opacity: 0,
        stagger: 0.1,
        scrollTrigger: {
            trigger: ".booking-grid",
            start: "top 80%",
            once: true
        },
        ease: "back.out(1.2)"
    });
}

function setupEventListeners() {
    if (destSelect) destSelect.addEventListener('change', updatePrices);
    if (flightSelect) flightSelect.addEventListener('change', updatePrices);
    if (rideSelect) rideSelect.addEventListener('change', updatePrices);
    if (hotelSelect) hotelSelect.addEventListener('change', updatePrices);
    if (foodSelect) foodSelect.addEventListener('change', updatePrices);
    if (guideSelect) guideSelect.addEventListener('change', updatePrices);

    loginTrigger?.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.currentUser) {
            logout();
        } else {
            authModal.classList.remove('hidden');
        }
    });

    closeAuthModal?.addEventListener('click', () => authModal.classList.add('hidden'));
    closePaymentModal?.addEventListener('click', () => document.getElementById('payment-modal').classList.add('hidden'));

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.target;
            if (loginForm) loginForm.classList.toggle('hidden', target !== 'login-form');
            if (signupForm) signupForm.classList.toggle('hidden', target === 'login-form');
        });
    });

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
    if (bookBtn) bookBtn.addEventListener('click', handleBooking);

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');

    mobileMenuBtn?.addEventListener('click', () => {
        mobileMenuBtn.classList.toggle('active');
        navLinks?.classList.toggle('active');
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

async function handleLogin(e) {
    e.preventDefault();
    const btn = loginForm.querySelector('button');
    const emailInput = loginForm.querySelector('input[type="email"]');
    const passwordInput = loginForm.querySelector('input[type="password"]');

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    const originalBtnText = btn.innerText;
    btn.innerText = 'Connecting...';
    btn.disabled = true;

    try {
        console.log('Attempting login for:', email);
        const { data: users, error } = await supabase.from('users').select('*');

        if (error) {
            console.error('Database Connection Failed:', error);
            alert('Cloud Database Error: ' + error.message + '\n\nIMPORTANT: Please check your Supabase SQL Editor and ensure you disabled RLS (Row Level Security).');
            return;
        }

        const user = users?.find(u => u.email.trim().toLowerCase() === email && u.password === password);

        if (user) {
            state.currentUser = user;
            localStorage.setItem('tms_active_user', JSON.stringify(user));
            updateUIForAuth();
            authModal.classList.add('hidden');

            if (user.role?.toLowerCase() === 'admin') {
                toggleAdminPanel(true);
                alert(`Welcome back, Admin ${user.name}!`);
            } else {
                alert(`Welcome back, ${user.name}!`);
            }
        } else {
            alert('Login Failed: Invalid email or password.\n\nMake sure you added your user to the Supabase "users" table!');
        }
    } catch (err) {
        console.error('Fatal App Error:', err);
        alert('System Error: ' + err.message);
    } finally {
        btn.innerText = originalBtnText;
        btn.disabled = false;
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = signupForm.querySelector('input[type="text"]').value;
    const email = signupForm.querySelector('input[type="email"]').value;
    const password = signupForm.querySelector('input[type="password"]').value;

    const users = await DB.getUsers();
    if (users.find(u => u.email === email)) {
        alert('Email already exists');
        return;
    }

    const newUser = { name, email, password, role: 'user' };
    const result = await DB.createUser(newUser);
    if (result) {
        alert('Account created! Please login.');
        authTabs[0].click();
    } else {
        alert('Failed to create account. Please try again.');
    }
}

function logout() {
    state.currentUser = null;
    localStorage.removeItem('tms_active_user');
    updateUIForAuth();
    toggleAdminPanel(false);
    window.location.hash = '#home';
    alert('Logged out successfully.');
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
    const serviceTax = subtotal * 0.02;
    const total = subtotal + gst + serviceTax;

    state.booking = { subtotal, gst, serviceTax, total };
    animateValue(totalPriceDisplay, total);
    updateBreakdownUI();
    bookBtn.disabled = total === 0;
}

function updateBreakdownUI() {
    const subtotalEl = document.getElementById('subtotal-val');
    const gstEl = document.getElementById('gst-val');
    const serviceTaxEl = document.getElementById('tax-val');

    if (subtotalEl) subtotalEl.innerText = `₹${state.booking.subtotal.toFixed(2)}`;
    if (gstEl) gstEl.innerText = `₹${state.booking.gst.toFixed(2)}`;
    if (serviceTaxEl) serviceTaxEl.innerText = `₹${state.booking.serviceTax.toFixed(2)}`;
}

async function handleBooking() {
    if (!state.currentUser) {
        alert('Please login to book tickets!');
        authModal.classList.remove('hidden');
        return;
    }

    const bookingData = {
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        selections: { ...state.selections },
        billing: { ...state.booking },
        totalPrice: state.booking.total
    };

    const result = await DB.saveBooking(bookingData);
    if (result) {
        alert('Booking Successful! Generating your bill...');
        showBillModal(result);
    } else {
        alert('Failed to save booking. Please try again.');
    }
}

function showBillModal(data) {
    const billModal = document.getElementById('bill-modal');
    document.getElementById('bill-details').innerHTML = `
        <div style="display: flex; justify-content: space-between;"><strong>Booking ID:</strong> <span>#${data.id.toString().slice(-4)}</span></div>
        <div style="display: flex; justify-content: space-between;"><strong>Customer:</strong> <span>${data.user_name}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Destination:</span> <span>${cleanDisplay(data.dest)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Flight:</span> <span>${cleanDisplay(data.flight)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Ride:</span> <span>${cleanDisplay(data.ride)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Hotel:</span> <span>${cleanDisplay(data.hotel)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Food:</span> <span>${cleanDisplay(data.food)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Guide:</span> <span>${cleanDisplay(data.guide)}</span></div>
    `;
    document.getElementById('bill-total').innerText = `₹${parseFloat(data.total_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    billModal.classList.remove('hidden');
}

function proceedToPaymentFromBill() {
    const billModal = document.getElementById('bill-modal');
    billModal.classList.add('hidden');
    showPaymentModal(state.booking.total);
}

function showPaymentModal(amount) {
    const paymentModal = document.getElementById('payment-modal');
    const payAmountEl = document.getElementById('pay-amount');
    if (payAmountEl) payAmountEl.innerText = `₹${amount.toFixed(2)}`;
    paymentModal.classList.remove('hidden');
}

window.confirmBookingPayment = function () {
    const btn = event.target;
    btn.disabled = true;
    btn.innerText = 'Verifying Payment...';

    setTimeout(() => {
        btn.innerText = 'Redirecting...';
        setTimeout(async () => {
            document.getElementById('payment-modal').classList.add('hidden');
            alert('Success! Your payment has been confirmed and trip is booked.');
            window.location.hash = '#home';
            window.location.reload();
        }, 1500);
    }, 2000);
};

function toggleAdminPanel(show) {
    const adminSection = document.getElementById('admin-section');
    const homeSection = document.getElementById('home');
    const bookingSection = document.getElementById('booking');
    const aboutSection = document.getElementById('about');
    const adminLink = document.getElementById('admin-link');

    if (show && state.currentUser && state.currentUser.role?.toLowerCase() === 'admin') {
        if (!adminLink) {
            const li = document.createElement('li');
            li.id = 'admin-link';
            li.innerHTML = '<a href="#admin" class="accent-text" style="color: var(--primary); border: 1px solid var(--primary); padding: 0.5rem 1rem; border-radius: 8px;">Admin Panel</a>';
            document.querySelector('.nav-links').insertBefore(li, document.getElementById('auth-link-container'));
            li.addEventListener('click', (e) => {
                e.preventDefault();
                renderAdminDashboard();
            });
        }
    } else {
        if (adminLink) adminLink.remove();
        adminSection?.classList.add('hidden');
        homeSection?.classList.remove('hidden');
        bookingSection?.classList.remove('hidden');
        aboutSection?.classList.remove('hidden');
    }
}

async function renderAdminDashboard() {
    document.getElementById('booking').classList.add('hidden');
    document.getElementById('about').classList.add('hidden');
    const adminSection = document.getElementById('admin-section');
    adminSection.classList.remove('hidden');

    const bookings = await DB.getBookings();
    const users = await DB.getUsers();

    const totalRevenue = bookings.reduce((sum, b) => sum + parseFloat(b.total_price), 0);
    const confirmedCount = bookings.filter(b => b.status === 'Confirmed').length;

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
                <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div class="glass-card" style="padding: 1.5rem; text-align: center;">
                <h4 style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Confirmed</h4>
                <div style="font-size: 2rem; font-weight: 800; color: #10b981;">${confirmedCount}</div>
            </div>
        </div>
    `;

    const existingStats = adminSection.querySelector('.admin-stats');
    if (existingStats) existingStats.remove();
    adminSection.querySelector('.section-header').insertAdjacentHTML('afterend', statsHTML);

    const tbody = document.getElementById('bookings-tbody');
    tbody.innerHTML = bookings.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 3rem; color: var(--text-muted);">No bookings found.</td></tr>' : bookings.map(b => `
        <tr style="border-bottom: 1px solid var(--glass-border);">
            <td style="padding: 1.5rem;">#${b.id.toString().slice(-4)}</td>
            <td style="padding: 1.5rem; font-weight: 600;">${b.user_name}</td>
            <td style="padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">${cleanDisplay(b.dest)} | ${cleanDisplay(b.flight)}</td>
            <td style="padding: 1.5rem; color: var(--primary); font-weight: 800;">₹${parseFloat(b.total_price).toFixed(2)}</td>
            <td style="padding: 1.5rem;"><span style="background: ${b.status === 'Confirmed' ? '#10b98122' : '#f59e0b22'}; color: ${b.status === 'Confirmed' ? '#10b981' : '#f59e0b'}; padding: 0.25rem 0.75rem; border-radius: 50px; font-size: 0.75rem; font-weight: 700;">${b.status || 'Pending'}</span></td>
            <td style="padding: 1.5rem; display: flex; gap: 0.5rem;">
                <button onclick="updateBookingStatus('${b.id}', '${b.status}')" class="btn-primary" style="padding: 0.5rem 0.8rem; font-size: 0.75rem;">${b.status === 'Confirmed' ? 'Unverify' : 'Verify'}</button>
                <button onclick="deleteBooking('${b.id}')" class="btn-outline" style="padding: 0.5rem 0.8rem; font-size: 0.75rem;">Cancel</button>
            </td>
        </tr>
    `).join('');

    const utbody = document.getElementById('users-tbody');
    utbody.innerHTML = users.map(u => `
        <tr style="border-bottom: 1px solid var(--glass-border);">
            <td style="padding: 1.5rem; font-weight: 600;">${u.name}</td>
            <td style="padding: 1.5rem; color: var(--text-muted);">${u.email}</td>
            <td style="padding: 1.5rem;"><span style="background: ${u.role?.toLowerCase() === 'admin' ? '#ef444422' : '#var(--glass-border)'}; color: ${u.role?.toLowerCase() === 'admin' ? '#ef4444' : 'var(--text-muted)'}; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">${u.role || 'User'}</span></td>
            <td style="padding: 1.5rem; font-size: 0.8rem; color: var(--text-muted);">${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

window.switchAdminTab = function (tabName) {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => {
        t.classList.toggle('active', t.innerText.toLowerCase() === tabName.toLowerCase());
        if (t.innerText.toLowerCase() === tabName.toLowerCase()) {
            t.classList.replace('btn-outline', 'btn-primary');
        } else {
            t.classList.replace('btn-primary', 'btn-outline');
        }
    });
    document.getElementById(`admin-bookings-tab`).classList.toggle('hidden', tabName !== 'bookings');
    document.getElementById(`admin-users-tab`).classList.toggle('hidden', tabName !== 'users');
};

window.updateBookingStatus = async function (id, currentStatus) {
    const newStatus = currentStatus === 'Confirmed' ? 'Pending' : 'Confirmed';
    await DB.updateBookingStatus(id, newStatus);
    renderAdminDashboard();
};

window.deleteBooking = async function (id) {
    if (confirm('Are you sure you want to cancel this booking?')) {
        await DB.deleteBooking(id);
        renderAdminDashboard();
    }
};

function animateValue(obj, end) {
    const currentPrice = { val: parseFloat(obj.innerText.replace(/[₹,]/g, '')) || 0 };
    gsap.to(currentPrice, {
        val: end,
        duration: 1,
        ease: "power2.out",
        onUpdate: () => {
            obj.innerHTML = `₹${currentPrice.val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    });
}
