// TMS Smart Trip - Stable Local Edition (v1.0 Restore)
// All data is saved on your device (LocalStorage) - No internet/cloud required for core features.

const DB = {
    getUsers() {
        return JSON.parse(localStorage.getItem('tms_users')) || [
            { name: 'User', email: 'user@tms.com', password: 'user123', role: 'user' }
        ];
    },
    getBookings() {
        return JSON.parse(localStorage.getItem('tms_bookings')) || [];
    },
    saveBooking(booking) {
        const bookings = this.getBookings();
        const newBooking = { id: Date.now(), ...booking, status: 'Confirmed' };
        bookings.push(newBooking);
        localStorage.setItem('tms_bookings', JSON.stringify(bookings));
        return newBooking;
    },
    createUser(user) {
        const users = this.getUsers();
        users.push(user);
        localStorage.setItem('tms_users', JSON.stringify(users));
        return user;
    }
};

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
    return val.includes('_') ? val.split('_').slice(1).join(' ').toUpperCase() : val.toUpperCase();
};

document.addEventListener('DOMContentLoaded', () => {
    updateUIForAuth();
    setupEventListeners();
    initAnimations();

    // Image fallback
    document.querySelectorAll('img').forEach(img => {
        img.onerror = function () {
            this.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80';
        };
    });
});

function initAnimations() {
    gsap.from(".hero-content > *", { duration: 1, y: 30, opacity: 0, stagger: 0.2 });
    gsap.from(".booking-card", { duration: 0.8, y: 20, opacity: 0, stagger: 0.1, delay: 0.5 });
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

    // Mobile Menu
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    mobileBtn?.addEventListener('click', () => {
        mobileBtn.classList.toggle('active');
        navLinks.classList.toggle('active');
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
        alert('Welcome back, ' + user.name + '!');
    } else {
        alert('Invalid credentials.');
    }
}

function handleSignup(e) {
    e.preventDefault();
    const name = e.target.querySelector('input[type="text"]').value;
    const email = e.target.querySelector('input[type="email"]').value.toLowerCase();
    const password = e.target.querySelector('input[type="password"]').value;
    if (DB.getUsers().find(u => u.email === email)) return alert('Email exists.');
    DB.createUser({ name, email, password, role: 'user' });
    alert('Account created! Please Login.');
}

function logout() {
    state.currentUser = null;
    localStorage.removeItem('tms_active_user');
    updateUIForAuth();
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

    document.getElementById('overall-price').innerText = `₹${state.booking.total.toLocaleString('en-IN')}`;
    document.getElementById('subtotal-val').innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById('gst-val').innerText = `₹${gst.toFixed(2)}`;
    document.getElementById('tax-val').innerText = `₹${sTax.toFixed(2)}`;
    document.getElementById('book-now-btn').disabled = subtotal === 0;
}

function handleBooking() {
    if (!state.currentUser) return alert('Please login first!');
    const res = DB.saveBooking({
        userName: state.currentUser.name,
        selections: state.selections,
        total: state.booking.total
    });
    alert('Booking Success!');
    showBill(res);
}

function showBill(data) {
    const modal = document.getElementById('bill-modal');
    document.getElementById('bill-details').innerHTML = `
        <p><strong>Booking ID:</strong> #${data.id.toString().slice(-4)}</p>
        <p><strong>Customer:</strong> ${data.userName}</p>
        <p><strong>Destination:</strong> ${cleanDisplay(data.selections.dest)}</p>
        <p><strong>Total Paid:</strong> ₹${data.total.toLocaleString('en-IN')}</p>
    `;
    document.getElementById('bill-total').innerText = `₹${data.total.toLocaleString('en-IN')}`;
    modal.classList.remove('hidden');
}

window.proceedToPaymentFromBill = () => {
    document.getElementById('bill-modal').classList.add('hidden');
    document.getElementById('pay-amount').innerText = `₹${state.booking.total.toLocaleString('en-IN')}`;
    document.getElementById('payment-modal').classList.remove('hidden');
};

window.confirmBookingPayment = () => {
    const btn = event.target;
    btn.innerText = 'Verifying...';
    setTimeout(() => {
        alert('Payment Done! Trip Booked.');
        location.reload();
    }, 1500);
};
