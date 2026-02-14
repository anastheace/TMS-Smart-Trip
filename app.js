console.log('TMS App Version: 2.3 - Global Sync');

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

        // Fetch users from Supabase
        const { data: users, error } = await supabase.from('users').select('*');

        if (error) {
            console.error('Database Connection Failed:', error);
            alert('Cloud Database Error: ' + error.message + '\n\nIMPORTANT: Please check your Supabase SQL Editor and ensure you disabled RLS (Row Level Security).');
            return;
        }

        console.log('Users found in cloud:', users ? users.length : 0);
        const user = users?.find(u => u.email.trim().toLowerCase() === email && u.password === password);

        if (user) {
            console.log('Access Granted:', user.name, 'Admin:', user.role?.toLowerCase() === 'admin');
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
            console.warn('Login failed: No matching user for', email);
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
    gsap.from(billModal.querySelector('.modal-content'), { duration: 0.5, scale: 0.9, opacity: 0, ease: "back.out" });
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
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Verifying Payment...';

    setTimeout(() => {
        btn.innerText = 'Redirecting...';
        setTimeout(async () => {
            document.getElementById('payment-modal').classList.add('hidden');
            alert('Success! Your payment has been confirmed and trip is booked.');

            // Refresh UI
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

    // Stats
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

    // Render Bookings
    const tbody = document.getElementById('bookings-tbody');
    tbody.innerHTML = bookings.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 3rem; color: var(--text-muted);">No bookings found.</td></tr>' : bookings.map(b => `
        <tr style="border-bottom: 1px solid var(--glass-border);">
            <td style="padding: 1.5rem;">#${b.id.toString().slice(-4)}</td>
            <td style="padding: 1.5rem; font-weight: 600;">${b.user_name}</td>
            <td style="padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">
                ${cleanDisplay(b.dest)} | ${cleanDisplay(b.flight)} | ${cleanDisplay(b.ride)}
            </td>
            <td style="padding: 1.5rem; color: var(--primary); font-weight: 800;">₹${parseFloat(b.total_price).toFixed(2)}</td>
            <td style="padding: 1.5rem;">
                <span style="background: ${b.status === 'Confirmed' ? '#10b98122' : '#f59e0b22'}; color: ${b.status === 'Confirmed' ? '#10b981' : '#f59e0b'}; padding: 0.25rem 0.75rem; border-radius: 50px; font-size: 0.75rem; font-weight: 700;">
                    ${b.status || 'Pending'}
                </span>
            </td>
            <td style="padding: 1.5rem; display: flex; gap: 0.5rem;">
                <button onclick="updateBookingStatus('${b.id}', '${b.status}')" class="btn-primary" style="padding: 0.5rem 0.8rem; font-size: 0.75rem;">${b.status === 'Confirmed' ? 'Unverify' : 'Verify'}</button>
                <button onclick="deleteBooking('${b.id}')" class="btn-outline" style="padding: 0.5rem 0.8rem; font-size: 0.75rem; border-color: var(--primary); color: var(--primary);">Cancel</button>
            </td>
        </tr>
    `).join('');

    // Render Users
    const utbody = document.getElementById('users-tbody');
    utbody.innerHTML = users.map(u => `
        <tr style="border-bottom: 1px solid var(--glass-border);">
            <td style="padding: 1.5rem; font-weight: 600;">${u.name}</td>
            <td style="padding: 1.5rem; color: var(--text-muted);">${u.email}</td>
            <td style="padding: 1.5rem;">
                <span style="background: ${u.role?.toLowerCase() === 'admin' ? '#ef444422' : '#var(--glass-border)'}; color: ${u.role?.toLowerCase() === 'admin' ? '#ef4444' : 'var(--text-muted)'}; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">
                    ${u.role || 'User'}
                </span>
            </td>
            <td style="padding: 1.5rem; font-size: 0.8rem; color: var(--text-muted);">${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

window.switchAdminTab = function (tabName) {
    const tabs = document.querySelectorAll('.admin-tab');
    const contents = document.querySelectorAll('.admin-tab-content');

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
    // Strip commas and ₹ before parsing
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
