// TMS Smart Trip - Core Logic (v3.0 Shadow Sync Edition)
// Priorities: 1. OG Stability (LocalStorage) 2. Silent Cloud Backup 3. Admin Tools

// Supabase Configuration
const SUPABASE_URL = 'https://rzqxnlqnridawazapbgw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6cXhubHFucmlkYXdhemFwYmd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDkxMTQsImV4cCI6MjA4NjYyNTExNH0.uLe9bUpeRc6yXPMiQKdud63DFaA5S92yDObaK3lM1oM';
let supabase = null;

try {
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) { console.warn('Supabase not available yet.'); }

// Storage Engine (The "OG" Local Engine)
const DB = {
    init() {
        if (!localStorage.getItem('tms_users')) {
            localStorage.setItem('tms_users', JSON.stringify([
                { id: '1', name: 'Admin', email: 'admin@tms.com', password: 'admin', role: 'admin' },
                { id: '2', name: 'Guest', email: 'user@tms.com', password: 'user', role: 'user' }
            ]));
        }
        if (!localStorage.getItem('tms_bookings')) {
            localStorage.setItem('tms_bookings', JSON.stringify([]));
        }
    },
    getUsers() { return JSON.parse(localStorage.getItem('tms_users')) || []; },
    getBookings() { return JSON.parse(localStorage.getItem('tms_bookings')) || []; },

    saveBooking(booking) {
        const bookings = this.getBookings();
        const newBooking = {
            id: Date.now().toString(),
            date: new Date().toLocaleDateString(),
            ...booking,
            status: 'Pending',
            synced: false
        };
        bookings.push(newBooking);
        localStorage.setItem('tms_bookings', JSON.stringify(bookings));

        // Silent Background Sync
        this.silentSyncBooking(newBooking);
        return newBooking;
    },

    createUser(user) {
        const users = this.getUsers();
        const newUser = { id: Date.now().toString(), ...user, synced: false };
        users.push(newUser);
        localStorage.setItem('tms_users', JSON.stringify(users));
        this.silentSyncUser(newUser);
        return newUser;
    },

    async silentSyncBooking(booking) {
        if (!supabase) return;
        try {
            const { error } = await supabase.from('bookings').insert([{
                user_id: booking.userId || 'LOCAL',
                user_name: booking.userName,
                dest: booking.selections?.dest || 'none',
                flight: booking.selections?.flight || 'none',
                total_price: booking.totalPrice || booking.total || 0,
                status: booking.status
            }]);
            if (!error) {
                this.markAsSynced(booking.id, 'tms_bookings');
                console.log('✅ Booking Synced Silently');
            }
        } catch (e) { /* Silent fail */ }
    },

    async silentSyncUser(user) {
        if (!supabase) return;
        try {
            const { error } = await supabase.from('users').insert([{
                name: user.name,
                email: user.email,
                password: user.password,
                role: user.role
            }]);
            if (!error) this.markAsSynced(user.id, 'tms_users');
        } catch (e) { /* Silent fail */ }
    },

    markAsSynced(id, key) {
        const items = JSON.parse(localStorage.getItem(key)) || [];
        const index = items.findIndex(i => i.id === id);
        if (index !== -1) {
            items[index].synced = true;
            localStorage.setItem(key, JSON.stringify(items));
        }
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
        stay_budget: 1200, stay_premium: 5500, stay_resort: 15000,
        food_basic: 150, food_gourmet: 450, food_premium: 1200,
        guide_basic: 800, guide_pro: 2500,
        ride_free: 0, ride_standard: 350, ride_special: 1500, ride_luxury: 12000
    }
};

// UI Helpers
const cleanDisplay = (val) => {
    if (!val || val === 'none') return '-';
    return val.includes('_') ? val.split('_').slice(1).join(' ').toUpperCase() : val.toUpperCase();
};

document.addEventListener('DOMContentLoaded', () => {
    DB.init();
    updateUIForAuth();
    setupEventListeners();
    initAnimations();

    if (state.currentUser?.role === 'admin') toggleAdminPanel(true);

    // Resilience: Image Error Fallback
    document.querySelectorAll('img').forEach(img => {
        img.onerror = function () {
            this.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80';
            this.onerror = null;
        };
    });

    // Slow scroll refresh
    window.addEventListener('load', () => setTimeout(() => ScrollTrigger?.refresh(), 1000));
});

function initAnimations() {
    try {
        gsap.from(".hero-content > *", { duration: 1, y: 30, opacity: 0, stagger: 0.2 });
    } catch (e) { }
}

function setupEventListeners() {
    const selects = ['dest-type', 'flight-type', 'ride-type', 'hotel-type', 'food-type', 'guide-type'];
    selects.forEach(id => document.getElementById(id)?.addEventListener('change', updatePrices));

    document.getElementById('login-trigger')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.currentUser) logout();
        else document.getElementById('auth-modal').classList.remove('hidden');
    });

    document.getElementById('close-auth-modal')?.addEventListener('click', () => {
        document.getElementById('auth-modal').classList.add('hidden');
    });

    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('signup-form')?.addEventListener('submit', handleSignup);
    document.getElementById('book-now-btn')?.addEventListener('click', handleBooking);

    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.target;
            document.getElementById('login-form').classList.toggle('hidden', target !== 'login-form');
            document.getElementById('signup-form').classList.toggle('hidden', target === 'login-form');
        });
    });

    const mobileBtn = document.getElementById('mobile-menu-btn');
    mobileBtn?.addEventListener('click', () => {
        mobileBtn.classList.toggle('active');
        document.getElementById('nav-links')?.classList.toggle('active');
    });
}

function updateUIForAuth() {
    const trigger = document.getElementById('login-trigger');
    if (state.currentUser) {
        trigger.innerHTML = `Logout (${state.currentUser.name})`;
        trigger.classList.replace('btn-primary', 'btn-outline');
    } else {
        trigger.innerHTML = 'Login';
        trigger.classList.replace('btn-outline', 'btn-primary');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value.toLowerCase();
    const password = e.target.querySelector('input[type="password"]').value;
    const user = DB.getUsers().find(u => u.email === email && u.password === password);

    if (user) {
        state.currentUser = user;
        localStorage.setItem('tms_active_user', JSON.stringify(user));
        updateUIForAuth();
        document.getElementById('auth-modal').classList.add('hidden');
        if (user.role === 'admin') toggleAdminPanel(true);
        alert('Welcome back, ' + user.name + '!');
    } else {
        alert('Invalid email or password.');
    }
}

function handleSignup(e) {
    e.preventDefault();
    const name = e.target.querySelector('input[type="text"]').value;
    const email = e.target.querySelector('input[type="email"]').value.toLowerCase();
    const password = e.target.querySelector('input[type="password"]').value;
    if (DB.getUsers().find(u => u.email === email)) return alert('Email already exists.');
    DB.createUser({ name, email, password, role: 'user' });
    alert('Success! Please sign in.');
    document.querySelectorAll('.auth-tab')[0].click();
}

function logout() {
    state.currentUser = null;
    localStorage.removeItem('tms_active_user');
    updateUIForAuth();
    toggleAdminPanel(false);
    location.reload();
}

function updatePrices() {
    state.selections = {
        dest: document.getElementById('dest-type').value,
        flight: document.getElementById('flight-type').value,
        ride: document.getElementById('ride-type').value,
        hotel: document.getElementById('hotel-type').value,
        food: document.getElementById('food-type').value,
        guide: document.getElementById('guide-type').value
    };
    const subtotal = Object.values(state.selections).reduce((acc, val) => acc + (state.prices[val] || 0), 0);
    const gst = subtotal * 0.05;
    const sTax = subtotal * 0.02;
    state.booking = { subtotal, gst, sTax, total: subtotal + gst + sTax };

    animateValue(document.getElementById('overall-price'), state.booking.total);
    document.getElementById('subtotal-val').innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById('gst-val').innerText = `₹${gst.toFixed(2)}`;
    document.getElementById('tax-val').innerText = `₹${sTax.toFixed(2)}`;
    document.getElementById('book-now-btn').disabled = subtotal === 0;
}

function handleBooking() {
    if (!state.currentUser) return alert('Please login first!');
    const booking = DB.saveBooking({
        userName: state.currentUser.name,
        userId: state.currentUser.id,
        selections: { ...state.selections },
        totalPrice: state.booking.total
    });
    alert('Booking Confirmed locally!');
    showBillModal(booking);
}

function showBillModal(data) {
    const modal = document.getElementById('bill-modal');
    const details = document.getElementById('bill-details');
    if (details) {
        details.innerHTML = `
            <div style="margin-bottom: 1.5rem; background: var(--glass-border); padding: 1rem; border-radius: 12px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem"><strong style="color:var(--primary)">ID:</strong><span>#${data.id.slice(-4)}</span></div>
                <div style="display:flex;justify-content:space-between"><strong style="color:var(--text-muted)">Customer:</strong><span>${data.userName}</span></div>
            </div>
            <div style="display: grid; gap: 0.8rem; font-size: 0.9rem;">
                <div style="display:flex;justify-content:space-between"><span>Destination:</span><span style="font-weight:600">${cleanDisplay(data.selections.dest)}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Flight Class:</span><span style="font-weight:600">${cleanDisplay(data.selections.flight)}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Stay Type:</span><span style="font-weight:600">${cleanDisplay(data.selections.hotel)}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Food Package:</span><span style="font-weight:600">${cleanDisplay(data.selections.food)}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Guide:</span><span style="font-weight:600">${cleanDisplay(data.selections.guide)}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Transport:</span><span style="font-weight:600">${cleanDisplay(data.selections.ride)}</span></div>
            </div>
        `;
    }
    const total = document.getElementById('bill-total');
    if (total) {
        const curr = { val: 0 };
        gsap.to(curr, {
            val: data.totalPrice || data.total || 0,
            duration: 1.2,
            ease: "power2.out",
            onUpdate: () => total.innerText = `₹${curr.val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        });
    }
    modal?.classList.remove('hidden');
}

window.showBookingDetails = (id) => {
    const booking = DB.getBookings().find(b => b.id === id);
    if (booking) showBillModal(booking);
};

window.proceedToPaymentFromBill = () => {
    document.getElementById('bill-modal').classList.add('hidden');
    document.getElementById('pay-amount').innerText = `₹${state.booking.total.toLocaleString('en-IN')}`;
    document.getElementById('payment-modal').classList.remove('hidden');
};

window.confirmBookingPayment = () => {
    const btn = event.target;
    btn.innerText = 'Verifying...';
    setTimeout(() => {
        alert('Payment Done! Enjoy your trip.');
        location.reload();
    }, 1500);
};

function toggleAdminPanel(show) {
    let adminLink = document.getElementById('admin-link');
    if (show) {
        if (!adminLink) {
            const li = document.createElement('li');
            li.id = 'admin-link';
            li.innerHTML = '<a href="#" style="color:var(--primary);border:1px solid var(--primary);padding:5px 15px;border-radius:8px">Admin Panel</a>';
            document.querySelector('.nav-links').prepend(li);
            li.addEventListener('click', (e) => { e.preventDefault(); renderAdminDashboard(); });
        }
    } else {
        adminLink?.remove();
        document.getElementById('admin-section')?.classList.add('hidden');
        ['home', 'booking', 'about', 'contact'].forEach(s => document.getElementById(s)?.classList.remove('hidden'));
    }
}

function renderAdminDashboard() {
    const adminSec = document.getElementById('admin-section');
    adminSec.classList.remove('hidden');
    ['home', 'booking', 'about', 'contact'].forEach(s => document.getElementById(s).classList.add('hidden'));

    const bookings = DB.getBookings();
    const users = DB.getUsers();
    const totalRev = bookings.reduce((s, b) => s + (b.totalPrice || 0), 0);

    const statsHTML = `
        <div class="admin-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem">
            <div class="glass-card" style="padding:1rem;text-align:center"><h4>Total Users</h4><div style="font-size:1.5rem;color:var(--primary)">${users.length}</div></div>
            <div class="glass-card" style="padding:1rem;text-align:center"><h4>Total Bookings</h4><div style="font-size:1.5rem;color:var(--primary)">${bookings.length}</div></div>
            <div class="glass-card" style="padding:1rem;text-align:center"><h4>Total Revenue</h4><div style="font-size:1.5rem;color:var(--primary)">₹${totalRev.toLocaleString()}</div></div>
        </div>
    `;

    const existingStats = adminSec.querySelector('.admin-stats');
    if (existingStats) existingStats.remove();
    adminSec.querySelector('.section-header').insertAdjacentHTML('afterend', statsHTML);

    document.getElementById('bookings-tbody').innerHTML = bookings.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:2rem">Local storage is empty</td></tr>' : bookings.map(b => `
        <tr style="border-bottom:1px solid var(--glass-border)">
            <td style="padding:1rem">#${b.id.slice(-4)}</td>
            <td style="padding:1rem; font-weight:600">${b.userName}</td>
            <td style="padding:1rem">${cleanDisplay(b.selections.dest)}</td>
            <td style="padding:1rem; color:var(--primary); font-weight:700">₹${(b.totalPrice || b.total).toLocaleString()}</td>
            <td style="padding:1rem"><span style="background:var(--primary)22; color:var(--primary); padding:3px 10px; border-radius:10px; font-size:0.75rem">${b.status}</span></td>
            <td style="padding:1rem; font-size:0.7rem">${b.synced ? '✅' : '⏳'}</td>
            <td style="padding:1rem">
                <button onclick="showBookingDetails('${b.id}')" class="btn-outline" style="padding:4px 8px; font-size:0.7rem; border-color:var(--primary); color:var(--primary)">View Details</button>
            </td>
        </tr>
    `).join('');

    const uTbody = document.getElementById('users-tbody');
    if (uTbody) {
        uTbody.innerHTML = users.length === 0 ? '<tr><td colspan="3" style="text-align:center;padding:2rem">No users found</td></tr>' : users.map(u => `
            <tr style="border-bottom:1px solid var(--glass-border)">
                <td style="padding:1rem; font-weight:600">${u.name}</td>
                <td style="padding:1rem; color:var(--text-muted)">${u.email}</td>
                <td style="padding:1rem"><span style="background:var(--glass-border); padding:3px 8px; border-radius:4px; font-size:0.7rem">${u.role}</span></td>
            </tr>
        `).join('');
    }
}

window.switchAdminTab = (name) => {
    document.getElementById('admin-bookings-tab').classList.toggle('hidden', name !== 'bookings');
    document.getElementById('admin-users-tab').classList.toggle('hidden', name !== 'users');
};

function animateValue(obj, end) {
    if (!obj) return;
    const start = parseFloat(obj.innerText.replace(/[₹,]/g, '')) || 0;
    const curr = { val: start };
    gsap.to(curr, {
        val: end,
        duration: 1.5,
        ease: "expo.out",
        onUpdate: () => {
            obj.innerText = `₹${curr.val.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        }
    });
}
