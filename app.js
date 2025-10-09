import {
    auth,
    db,
    googleProvider,
    githubProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    setDoc,
    getDoc
} from './firebase.js';

// Global state
let currentUser = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let unsubscribers = [];

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const googleLoginBtn = document.getElementById('googleLogin');
const githubLoginBtn = document.getElementById('githubLogin');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const darkModeToggle = document.getElementById('darkModeToggle');

// ==================== AUTHENTICATION ====================

// Google Sign In
googleLoginBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await saveUserToFirestore(result.user);
    } catch (error) {
        console.error('Google sign in error:', error);
        alert('Failed to sign in with Google. Please try again.');
    }
});

// GitHub Sign In
githubLoginBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, githubProvider);
        await saveUserToFirestore(result.user);
    } catch (error) {
        console.error('GitHub sign in error:', error);
        alert('Failed to sign in with GitHub. Please try again.');
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        // Unsubscribe all listeners
        unsubscribers.forEach(unsub => unsub());
        unsubscribers = [];
        
        await signOut(auth);
        loginScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Save user info to Firestore
async function saveUserToFirestore(user) {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastLogin: serverTimestamp()
    }, { merge: true });
}

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
        userName.textContent = user.displayName || 'User';
        
        loginScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        
        // Initialize app
        initializeApp();
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
});

// ==================== DARK MODE ====================

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

darkModeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// ==================== NAVIGATION ====================

const navButtons = document.querySelectorAll('.nav-btn');
const contentSections = document.querySelectorAll('.content-section');

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetSection = btn.dataset.section;
        
        // Update active states
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show target section
        contentSections.forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${targetSection}Section`).classList.add('active');
    });
});

// ==================== CALENDAR ====================

const calendarGrid = document.getElementById('calendar');
const currentMonthEl = document.getElementById('currentMonth');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const addEventBtn = document.getElementById('addEventBtn');
const eventModal = document.getElementById('eventModal');
const saveEventBtn = document.getElementById('saveEventBtn');

let eventsData = [];

prevMonthBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
});

addEventBtn.addEventListener('click', () => {
    openEventModal();
});

saveEventBtn.addEventListener('click', async () => {
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDescription').value.trim();
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    
    if (!title || !date) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        await addDoc(collection(db, 'events'), {
            title,
            description,
            date,
            time,
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName,
            createdAt: serverTimestamp()
        });
        
        // Log activity
        await logActivity(`${currentUser.displayName} added event "${title}" on ${formatDate(date)}`);
        
        closeEventModal();
    } catch (error) {
        console.error('Error adding event:', error);
        alert('Failed to add event');
    }
});

function renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    currentMonthEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayNames = ['
