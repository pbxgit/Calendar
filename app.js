// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- Firebase Initialization (Keys should be in environment variables for production) ---
const firebaseConfig = {
    apiKey: "AIzaSyBghGrPLr7_iC46u1Phs83vd1i-47zstUs",
    authDomain: "calendar-pbx21.firebaseapp.com",
    projectId: "calendar-pbx21",
    storageBucket: "calendar-pbx21.appspot.com",
    messagingSenderId: "304190482123",
    appId: "1:304190482123:web:2a8415125467565a1e9d4e",
    measurementId: "G-YCNG7QXRR2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Global State & DOM Caching ---
let currentUser = null;
let eventsUnsubscribe = null;
const state = { viewDate: new Date(), events: [] };

const body = document.body;
const appLoader = document.getElementById('app-loader');
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const calendarBody = document.querySelector('.calendar-body');
const calendarGrid = document.getElementById('calendar-grid');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const monthNameEl = document.getElementById('month-name');
const yearEl = document.getElementById('year');
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
const deleteEventBtn = document.getElementById('delete-event-btn');

// --- UI Management ---
const showGridLoader = () => calendarBody.classList.add('loading');
const hideGridLoader = () => calendarBody.classList.remove('loading');

function setLoginButtonLoading(provider, isLoading) {
    const button = document.getElementById(`${provider}-login-btn`);
    if (button) {
        button.classList.toggle('loading', isLoading);
        button.disabled = isLoading;
    }
}

// CRITICAL FIX: Explicitly manages which main screen is visible
function manageScreenVisibility(visibleScreen) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('is-visible');
    });
    if (visibleScreen) {
        visibleScreen.classList.add('is-visible');
    }
}

// --- AUTHENTICATION ---
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = { uid: user.uid, name: user.displayName || 'Anonymous', avatar: user.photoURL };
        userAvatar.src = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`;
        userProfile.classList.remove('is-hidden');

        manageScreenVisibility(appScreen);
        renderCalendar();
    } else {
        currentUser = null;
        if (eventsUnsubscribe) eventsUnsubscribe();
        
        userProfile.classList.add('is-hidden');
        userAvatar.src = "";
        
        manageScreenVisibility(loginScreen);
    }
    appLoader.classList.remove('is-visible');
});

async function handleLogin(provider) {
    setLoginButtonLoading(provider, true);
    try {
        const authProvider = provider === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
        await signInWithPopup(auth, authProvider);
    } catch (error) {
        console.error("Login failed:", error);
    } finally {
        setLoginButtonLoading(provider, false);
    }
}

async function handleLogout() {
    logoutBtn.disabled = true;
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed:", error);
    } finally {
        logoutBtn.disabled = false;
    }
}

document.getElementById('google-login-btn').onclick = () => handleLogin('google');
document.getElementById('github-login-btn').onclick = () => handleLogin('github');
logoutBtn.onclick = handleLogout;

// --- SIDEBAR LOGIC ---
document.getElementById('sidebar-toggle-btn').onclick = () => body.classList.add('sidebar-open');
sidebarOverlay.onclick = () => body.classList.remove('sidebar-open');

// --- CALENDAR LOGIC (Restored & Stable) ---
function renderCalendar() {
    if (!currentUser) return;
    showGridLoader();

    state.viewDate.setDate(1);
    const month = state.viewDate.getMonth();
    const year = state.viewDate.getFullYear();

    monthNameEl.textContent = state.viewDate.toLocaleString('default', { month: 'long' });
    yearEl.textContent = year;

    const firstDayIndex = state.viewDate.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    calendarGrid.innerHTML = ''; // Always clear the grid to rebuild it

    for (let i = firstDayIndex; i > 0; i--) {
        calendarGrid.appendChild(createDayElement(prevLastDay - i + 1, true));
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const isToday = date.toDateString() === new Date().toDateString();
        calendarGrid.appendChild(createDayElement(i, false, date, isToday));
    }
    const totalCells = firstDayIndex + daysInMonth;
    const nextDays = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= nextDays; i++) {
        calendarGrid.appendChild(createDayElement(i, true));
    }
    
    fetchAndRenderEvents();
}

function createDayElement(dayNum, isOtherMonth, date = null, isToday = false) {
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    if (isOtherMonth) dayEl.classList.add('other-month');
    if (isToday) dayEl.classList.add('today');
    
    dayEl.innerHTML = `<span class="day-number">${dayNum}</span><div class="events-container"></div>`;
    if (date) {
        dayEl.onclick = (e) => {
            if (e.target.closest('.event-pill')) return;
            openModal(null, date);
        };
    }
    return dayEl;
}

// --- NAVIGATION ---
function navigateMonths(offset) {
    state.viewDate.setMonth(state.viewDate.getMonth() + offset);
    renderCalendar();
}
document.getElementById('next-month-btn').onclick = () => navigateMonths(1);
document.getElementById('prev-month-btn').onclick = () => navigateMonths(-1);
document.getElementById('today-btn').onclick = () => { state.viewDate = new Date(); renderCalendar(); };

// --- FIRESTORE & EVENT RENDERING (Restored & Stable) ---
function fetchAndRenderEvents() {
    if (eventsUnsubscribe) eventsUnsubscribe();
    const month = state.viewDate.getMonth();
    const year = state.viewDate.getFullYear();
    const startDate = Timestamp.fromDate(new Date(year, month, 1));
    const endDate = Timestamp.fromDate(new Date(year, month + 1, 1));

    const q = query(collection(db, 'events'),
        where("dateTime", ">=", startDate),
        where("dateTime", "<", endDate),
        orderBy("dateTime")
    );

    eventsUnsubscribe = onSnapshot(q, (snapshot) => {
        state.events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        distributeEventsToDays();
        hideGridLoader();
    }, (error) => {
        console.error("Error fetching events:", error);
        hideGridLoader();
    });
}

function distributeEventsToDays() {
    document.querySelectorAll('.events-container').forEach(c => c.innerHTML = '');

    if (state.events.length === 0) {
        if (!calendarGrid.querySelector('.calendar-empty-state')) {
            calendarGrid.innerHTML = `<div class="calendar-empty-state">No events this month</div>`;
        }
        return;
    }
    
    if (calendarGrid.querySelector('.calendar-empty-state')) {
        renderCalendar();
        return;
    }

    state.events.forEach(event => {
        const eventDate = event.dateTime.toDate();
        const dayOfMonth = eventDate.getDate();
        const dayEl = Array.from(calendarGrid.children).find(d => 
            !d.classList.contains('other-month') && 
            parseInt(d.querySelector('.day-number').textContent) === dayOfMonth
        );
        if (dayEl) {
            const eventsContainer = dayEl.querySelector('.events-container');
            const pill = document.createElement('div');
            pill.className = `event-pill cat-${event.category || 'blue'}`;
            pill.textContent = event.title;
            pill.onclick = () => openModal(event);
            eventsContainer.appendChild(pill);
        }
    });
}

// --- MODAL & EVENT MANAGEMENT (Unchanged) ---
function openModal(event = null, date = null) {
    eventForm.reset();
    document.querySelectorAll('.category-option').forEach(el => el.classList.remove('selected'));

    if (event) { // Editing
        document.getElementById('modal-title').textContent = 'Edit Event';
        const { id, title, dateTime, category } = event;
        document.getElementById('event-id').value = id;
        document.getElementById('event-title-input').value = title;
        const eventDate = dateTime.toDate();
        document.getElementById('event-date-input').value = eventDate.toISOString().split('T')[0];
        document.getElementById('event-time-input').value = eventDate.toTimeString().slice(0, 5);
        document.getElementById('event-category-input').value = category || 'blue';
        deleteEventBtn.classList.remove('is-hidden');
    } else { // Creating
        document.getElementById('modal-title').textContent = 'New Event';
        document.getElementById('event-id').value = '';
        const initialDate = date || new Date();
        document.getElementById('event-date-input').value = initialDate.toISOString().split('T')[0];
        document.getElementById('event-time-input').value = initialDate.toTimeString().slice(0, 5);
        document.getElementById('event-category-input').value = 'blue';
        deleteEventBtn.classList.add('is-hidden');
    }
    
    const currentCategory = document.getElementById('event-category-input').value;
    document.querySelector(`.category-option[data-color="${currentCategory}"]`).classList.add('selected');
    
    eventModal.classList.add('visible');
}

function closeModal() {
    eventModal.classList.remove('visible');
}

document.getElementById('add-event-btn').onclick = () => openModal(null, new Date());
document.getElementById('cancel-event-btn').onclick = closeModal;
window.onclick = (e) => { if (e.target === eventModal) closeModal(); };

document.getElementById('category-selector').addEventListener('click', (e) => {
    if (e.target.classList.contains('category-option')) {
        document.querySelectorAll('.category-option').forEach(el => el.classList.remove('selected'));
        e.target.classList.add('selected');
        document.getElementById('event-category-input').value = e.target.dataset.color;
    }
});

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('event-date-input').value;
    const time = document.getElementById('event-time-input').value;
    const dateTime = Timestamp.fromDate(new Date(`${date}T${time}`));
    
    const eventData = {
        title: document.getElementById('event-title-input').value,
        dateTime,
        category: document.getElementById('event-category-input').value,
        creatorUid: currentUser.uid,
        creatorName: currentUser.name,
        lastUpdated: serverTimestamp()
    };
    
    const id = document.getElementById('event-id').value;
    const eventId = id || doc(collection(db, 'events')).id;
    await setDoc(doc(db, 'events', eventId), eventData, { merge: true });
    closeModal();
});

deleteEventBtn.onclick = async () => {
    const id = document.getElementById('event-id').value;
    if (id && confirm('Are you sure you want to delete this event?')) {
        await deleteDoc(doc(db, 'events', id));
        closeModal();
    }
};
