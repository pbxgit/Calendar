// --- Firebase SDK Imports ---
// This pattern is standard for modern web apps.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- DANGER: Your web app's Firebase configuration ---
// --- THIS IS NOT SECURE FOR A PRODUCTION WEBSITE. USE ENVIRONMENT VARIABLES. ---
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
// Store the current user's info to attach to events.
let currentUser = null;

// --- DOM Element Caching ---
// Getting all elements at once is more efficient.
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const googleLoginBtn = document.getElementById('google-login-btn');
const githubLoginBtn = document.getElementById('github-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const calendarContainer = document.getElementById('calendar-container');
const addEventBtn = document.getElementById('add-event-btn');
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
const cancelEventBtn = document.getElementById('cancel-event-btn');
const deleteEventBtn = document.getElementById('delete-event-btn');
const categorySelector = document.getElementById('category-selector');

// --- Authentication Logic ---
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

googleLoginBtn.onclick = () => signInWithPopup(auth, googleProvider);
githubLoginBtn.onclick = () => signInWithPopup(auth, githubProvider);
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
    if (user) {
        // User is signed in
        currentUser = { uid: user.uid, name: user.displayName || 'Anonymous' };
        loginScreen.classList.remove('visible');
        appScreen.classList.add('visible');
        listenForEvents(); // Start listening for events only after login
    } else {
        // User is signed out
        currentUser = null;
        loginScreen.classList.add('visible');
        appScreen.classList.remove('visible');
        if (eventsUnsubscribe) eventsUnsubscribe(); // Stop listening
        calendarContainer.innerHTML = '<div class="loader"></div>'; // Reset view
    }
});

// --- Firestore Real-Time Logic ---
let eventsUnsubscribe = null;

function listenForEvents() {
    if (eventsUnsubscribe) eventsUnsubscribe(); // Ensure no duplicate listeners

    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, orderBy("dateTime")); // Order events by date and time

    eventsUnsubscribe = onSnapshot(q, (snapshot) => {
        const events = [];
        snapshot.forEach(doc => {
            events.push({ id: doc.id, ...doc.data() });
        });
        renderEvents(events);
    });
}

function renderEvents(events) {
    calendarContainer.innerHTML = ''; // Clear previous events
    if (events.length === 0) {
        calendarContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No events scheduled. Add one to get started!</p>';
        return;
    }

    events.forEach(event => {
        const eventEl = document.createElement('div');
        eventEl.classList.add('event-item');
        eventEl.dataset.id = event.id;

        const eventDate = event.dateTime.toDate(); // Convert Firestore Timestamp to JS Date
        const formattedDate = eventDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        const formattedTime = eventDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

        eventEl.innerHTML = `
            <div class="event-category-indicator cat-${event.category || 'blue'}"></div>
            <div class="event-details">
                <p class="event-title">${event.title}</p>
                <p class="event-time">${formattedDate} at ${formattedTime}</p>
                <p class="event-creator">Added by ${event.creatorName}</p>
            </div>
        `;
        
        eventEl.onclick = () => openModal(event);
        calendarContainer.appendChild(eventEl);
    });
}

// --- Modal & Event Management ---
function openModal(event = null) {
    eventForm.reset();
    const modalTitle = eventModal.querySelector('h3');
    
    // Reset category selection
    document.querySelectorAll('.category-option').forEach(el => el.classList.remove('selected'));

    if (event) {
        // Editing existing event
        modalTitle.textContent = 'Edit Event';
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-title-input').value = event.title;
        
        // Split Firestore Timestamp back into date and time for input fields
        const eventDate = event.dateTime.toDate();
        document.getElementById('event-date-input').value = eventDate.toISOString().split('T')[0];
        document.getElementById('event-time-input').value = eventDate.toTimeString().slice(0, 5);
        
        // Set category
        const category = event.category || 'blue';
        document.querySelector(`.category-option[data-color="${category}"]`).classList.add('selected');
        document.getElementById('event-category-input').value = category;
        
        deleteEventBtn.classList.remove('hidden');
    } else {
        // Creating new event
        modalTitle.textContent = 'New Event';
        document.getElementById('event-id').value = '';
        // Select 'blue' by default
        document.querySelector('.category-option[data-color="blue"]').classList.add('selected');
        document.getElementById('event-category-input').value = 'blue';

        deleteEventBtn.classList.add('hidden');
    }
    eventModal.classList.add('visible');
}

function closeModal() {
    eventModal.classList.remove('visible');
}

addEventBtn.onclick = () => openModal();
cancelEventBtn.onclick = closeModal;
window.onclick = (e) => { if (e.target == eventModal) closeModal(); };

// Handle category selection
categorySelector.addEventListener('click', (e) => {
    if (e.target.classList.contains('category-option')) {
        document.querySelectorAll('.category-option').forEach(el => el.classList.remove('selected'));
        e.target.classList.add('selected');
        document.getElementById('event-category-input').value = e.target.dataset.color;
    }
});

// Handle form submission (Create/Update)
eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("You must be logged in to save an event.");

    const id = document.getElementById('event-id').value;
    const title = document.getElementById('event-title-input').value;
    const date = document.getElementById('event-date-input').value;
    const time = document.getElementById('event-time-input').value;
    const category = document.getElementById('event-category-input').value;

    if (!title || !date || !time) return;

    // Combine date and time into a single JavaScript Date object
    const dateTime = new Date(`${date}T${time}`);

    const eventId = id || doc(collection(db, 'events')).id;
    const eventRef = doc(db, 'events', eventId);

    try {
        await setDoc(eventRef, {
            title,
            dateTime, // Store as a single Timestamp for easy sorting
            category,
            creatorUid: currentUser.uid,
            creatorName: currentUser.name,
            lastUpdated: serverTimestamp()
        }, { merge: true });
        closeModal();
    } catch (error) {
        console.error("Error saving event: ", error);
        alert("Could not save event.");
    }
});

// Handle delete
deleteEventBtn.onclick = async () => {
    const id = document.getElementById('event-id').value;
    if (!id || !confirm('Are you sure you want to delete this event?')) return;
    
    try {
        await deleteDoc(doc(db, 'events', id));
        closeModal();
    } catch (error) {
        console.error("Error deleting event: ", error);
        alert("Could not delete event.");
    }
};
