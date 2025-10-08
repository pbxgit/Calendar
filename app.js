// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- DANGER: FINAL WARNING - SECURE YOUR KEYS IN PRODUCTION ---
const firebaseConfig = {
    apiKey: "AIzaSyBghGrPLr7_iC46u1Phs83vd1i-47zstUs",
    authDomain: "calendar-pbx21.firebaseapp.com",
    projectId: "calendar-pbx21",
    storageBucket: "calendar-pbx21.appspot.com",
    messagingSenderId: "304190482123",
    appId: "1:304190482123:web:2a8415125467565a1e9d4e",
    measurementId: "G-YCNG7QXRR2"
};

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Global State ---
let currentUser = null;
let eventsUnsubscribe = null;
const state = {
    viewDate: new Date(),
    events: [],
};

// --- DOM Element Caching ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const logoutBtn = document.getElementById('logout-btn');
const calendarGrid = document.getElementById('calendar-grid');
const monthNameEl = document.getElementById('month-name');
const yearEl = document.getElementById('year');
// ... (rest of the elements)

// --- AUTHENTICATION ---
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = { uid: user.uid, name: user.displayName || 'Anonymous' };
        loginScreen.classList.remove('visible');
        appScreen.classList.add('visible');
        renderCalendar();
    } else {
        currentUser = null;
        if (eventsUnsubscribe) eventsUnsubscribe();
        loginScreen.classList.add('visible');
        appScreen.classList.remove('visible');
    }
});

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
document.getElementById('github-login-btn').onclick = () => signInWithPopup(auth, new GithubAuthProvider());
logoutBtn.onclick = () => signOut(auth);

// --- CALENDAR LOGIC ---
function renderCalendar() {
    if (!currentUser) return;

    state.viewDate.setDate(1); // Start from the first day of the month
    const month = state.viewDate.getMonth();
    const year = state.viewDate.getFullYear();

    monthNameEl.textContent = state.viewDate.toLocaleString('default', { month: 'long' });
    yearEl.textContent = year;

    const firstDayIndex = state.viewDate.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    calendarGrid.innerHTML = '';

    // Previous month's days
    for (let i = firstDayIndex; i > 0; i--) {
        const dayEl = createDayElement(prevLastDay - i + 1, true);
        calendarGrid.appendChild(dayEl);
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const dayEl = createDayElement(i, false, date);
        if (i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()) {
            dayEl.classList.add('today');
        }
        calendarGrid.appendChild(dayEl);
    }

    // Next month's days (to fill the grid)
    const remainingCells = 42 - calendarGrid.children.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingCells; i++) {
        const dayEl = createDayElement(i, true);
        calendarGrid.appendChild(dayEl);
    }
    
    fetchAndRenderEvents();
}

function createDayElement(dayNum, isOtherMonth, date = null) {
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    if (isOtherMonth) dayEl.classList.add('other-month');
    
    const dayNumberEl = document.createElement('span');
    dayNumberEl.className = 'day-number';
    dayNumberEl.textContent = dayNum;
    dayEl.appendChild(dayNumberEl);
    
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'events-container';
    dayEl.appendChild(eventsContainer);

    if (date) {
        dayEl.onclick = (e) => {
            // Only open modal if clicking on the day itself, not an event pill
            if (e.target.classList.contains('day') || e.target.classList.contains('day-number')) {
                openModal(null, date);
            }
        };
    }
    return dayEl;
}

// --- NAVIGATION ---
document.getElementById('next-month-btn').onclick = () => {
    state.viewDate.setMonth(state.viewDate.getMonth() + 1);
    renderCalendar();
};
document.getElementById('prev-month-btn').onclick = () => {
    state.viewDate.setMonth(state.viewDate.getMonth() - 1);
    renderCalendar();
};
document.getElementById('today-btn').onclick = () => {
    state.viewDate = new Date();
    renderCalendar();
};

// --- FIRESTORE & EVENT RENDERING ---
function fetchAndRenderEvents() {
    if (eventsUnsubscribe) eventsUnsubscribe();

    const month = state.viewDate.getMonth();
    const year = state.viewDate.getFullYear();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const eventsRef = collection(db, 'events');
    const q = query(eventsRef,
        where("dateTime", ">=", startDate),
        where("dateTime", "<=", endDate),
        orderBy("dateTime")
    );

    eventsUnsubscribe = onSnapshot(q, (snapshot) => {
        state.events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        distributeEventsToDays();
    });
}

function distributeEventsToDays() {
    // Clear existing event pills
    document.querySelectorAll('.event-pill').forEach(pill => pill.remove());

    state.events.forEach(event => {
        const eventDate = event.dateTime.toDate();
        const day = eventDate.getDate();
        const month = eventDate.getMonth();
        const year = eventDate.getFullYear();
        
        // Find the correct day cell in the grid
        if (month === state.viewDate.getMonth() && year === state.viewDate.getFullYear()) {
            const dayIndex = day + new Date(year, month, 1).getDay() - 1;
            const dayEl = calendarGrid.children[dayIndex];
            if (dayEl) {
                const eventsContainer = dayEl.querySelector('.events-container');
                const pill = document.createElement('div');
                pill.className = `event-pill cat-${event.category || 'blue'}`;
                pill.textContent = event.title;
                pill.onclick = () => openModal(event);
                eventsContainer.appendChild(pill);
            }
        }
    });
}

// --- MODAL & EVENT MANAGEMENT ---
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
const deleteEventBtn = document.getElementById('delete-event-btn');

function openModal(event = null, date = null) {
    eventForm.reset();
    document.querySelectorAll('.category-option').forEach(el => el.classList.remove('selected'));

    if (event) { // Editing
        document.getElementById('modal-title').textContent = 'Edit Event';
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-title-input').value = event.title;
        const eventDate = event.dateTime.toDate();
        document.getElementById('event-date-input').valueAsDate = eventDate;
        document.getElementById('event-time-input').value = eventDate.toTimeString().slice(0, 5);
        deleteEventBtn.classList.remove('hidden');
    } else { // Creating
        document.getElementById('modal-title').textContent = 'New Event';
        document.getElementById('event-id').value = '';
        if (date) {
            document.getElementById('event-date-input').valueAsDate = date;
        }
        deleteEventBtn.classList.add('hidden');
    }
    
    // Handle category for both new and edit
    const category = event?.category || 'blue';
    document.querySelector(`.category-option[data-color="${category}"]`).classList.add('selected');
    document.getElementById('event-category-input').value = category;
    
    eventModal.classList.add('visible');
}

function closeModal() {
    eventModal.classList.remove('visible');
}

document.getElementById('add-event-btn').onclick = () => openModal(null, new Date());
document.getElementById('cancel-event-btn').onclick = closeModal;
window.onclick = (e) => { if (e.target === eventModal) closeModal(); };

// Category Selector Logic
document.getElementById('category-selector').addEventListener('click', (e) => {
    if (e.target.classList.contains('category-option')) {
        document.querySelectorAll('.category-option').forEach(el => el.classList.remove('selected'));
        e.target.classList.add('selected');
        document.getElementById('event-category-input').value = e.target.dataset.color;
    }
});

// Form Submission (Create/Update)
eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const date = document.getElementById('event-date-input').value;
    const time = document.getElementById('event-time-input').value;
    const dateTime = new Date(`${date}T${time}`);
    
    const eventData = {
        title: document.getElementById('event-title-input').value,
        dateTime: dateTime,
        category: document.getElementById('event-category-input').value,
        creatorUid: currentUser.uid,
        creatorName: currentUser.name,
        lastUpdated: serverTimestamp()
    };
    
    const eventId = id || doc(collection(db, 'events')).id;
    await setDoc(doc(db, 'events', eventId), eventData, { merge: true });
    closeModal();
});

// Delete Logic
