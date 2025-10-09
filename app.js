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

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

// Initialize all event listeners
function initializeEventListeners() {
    // DOM Elements
    const googleLoginBtn = document.getElementById('googleLogin');
    const githubLoginBtn = document.getElementById('githubLogin');
    const logoutBtn = document.getElementById('logoutBtn');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const addEventBtn = document.getElementById('addEventBtn');
    const saveEventBtn = document.getElementById('saveEventBtn');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    const sendMessageBtn = document.getElementById('sendMessage');
    const chatInput = document.getElementById('chatInput');
    const fabBtn = document.getElementById('fabBtn');
    const eventModal = document.getElementById('eventModal');
    const taskModal = document.getElementById('taskModal');

    // ==================== AUTHENTICATION ====================

    // Google Sign In
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            console.log('Google login clicked');
            try {
                const result = await signInWithPopup(auth, googleProvider);
                console.log('Google login successful:', result.user);
                await saveUserToFirestore(result.user);
            } catch (error) {
                console.error('Google sign in error:', error);
                alert('Failed to sign in with Google: ' + error.message);
            }
        });
    }

    // GitHub Sign In
    if (githubLoginBtn) {
        githubLoginBtn.addEventListener('click', async () => {
            console.log('GitHub login clicked');
            try {
                const result = await signInWithPopup(auth, githubProvider);
                console.log('GitHub login successful:', result.user);
                await saveUserToFirestore(result.user);
            } catch (error) {
                console.error('GitHub sign in error:', error);
                alert('Failed to sign in with GitHub: ' + error.message);
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                // Unsubscribe all listeners
                unsubscribers.forEach(unsub => unsub());
                unsubscribers = [];
                
                await signOut(auth);
                document.getElementById('loginScreen').classList.remove('hidden');
                document.getElementById('mainApp').classList.add('hidden');
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // ==================== DARK MODE ====================

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

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

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
        });
    }

    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => {
            openEventModal();
        });
    }

    if (saveEventBtn) {
        saveEventBtn.addEventListener('click', async () => {
            const title = document.getElementById('eventTitle').value.trim();
            const description = document.getElementById('eventDescription').value.trim();
            const date = document.getElementById('eventDate').value;
            const time = document.getElementById('eventTime').value;
            
            if (!title || !date) {
                alert('Please fill in title and date');
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
                alert('Failed to add event: ' + error.message);
            }
        });
    }

    // ==================== TASKS ====================

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            openTaskModal();
        });
    }

    if (saveTaskBtn) {
        saveTaskBtn.addEventListener('click', async () => {
            const title = document.getElementById('taskTitle').value.trim();
            const date = document.getElementById('taskDate').value;
            
            if (!title) {
                alert('Please enter a task');
                return;
            }
            
            try {
                await addDoc(collection(db, 'tasks'), {
                    title,
                    date: date || null,
                    completed: false,
                    createdBy: currentUser.uid,
                    createdByName: currentUser.displayName,
                    createdAt: serverTimestamp()
                });
                
                // Log activity
                await logActivity(`${currentUser.displayName} added task "${title}"`);
                
                closeTaskModal();
            } catch (error) {
                console.error('Error adding task:', error);
                alert('Failed to add task: ' + error.message);
            }
        });
    }

    // ==================== CHAT ====================

    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendChatMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }

    // ==================== FAB ====================

    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            const activeSection = document.querySelector('.nav-btn.active')?.dataset.section;
            
            if (activeSection === 'calendar') {
                openEventModal();
            } else if (activeSection === 'tasks') {
                openTaskModal();
            } else if (activeSection === 'chat') {
                chatInput?.focus();
            }
        });
    }

    // Close modals when clicking outside
    if (eventModal) {
        eventModal.addEventListener('click', (e) => {
            if (e.target === eventModal) {
                closeEventModal();
            }
        });
    }

    if (taskModal) {
        taskModal.addEventListener('click', (e) => {
            if (e.target === taskModal) {
                closeTaskModal();
            }
        });
    }
}

// ==================== AUTH FUNCTIONS ====================

// Save user info to Firestore
async function saveUserToFirestore(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error saving user:', error);
    }
}

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed:', user);
    if (user) {
        currentUser = user;
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        
        if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
        if (userName) userName.textContent = user.displayName || 'User';
        
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        // Initialize app
        initializeApp();
    } else {
        currentUser = null;
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }
});

// ==================== CALENDAR FUNCTIONS ====================

let eventsData = [];

function renderCalendar() {
    const calendarGrid = document.getElementById('calendar');
    const currentMonthEl = document.getElementById('currentMonth');
    
    if (!calendarGrid || !currentMonthEl) return;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    currentMonthEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day header';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayEl = createCalendarDay(day, true, currentMonth === 0 ? 11 : currentMonth - 1);
        calendarGrid.appendChild(dayEl);
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = createCalendarDay(day, false, currentMonth);
        calendarGrid.appendChild(dayEl);
    }
    
    // Next month days
    const totalCells = calendarGrid.children.length - 7; // Subtract headers
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dayEl = createCalendarDay(day, true, currentMonth === 11 ? 0 : currentMonth + 1);
        calendarGrid.appendChild(dayEl);
    }
}

function createCalendarDay(day, isOtherMonth, month) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }
    
    const today = new Date();
    if (day === today.getDate() && currentMonth === today.getMonth() && 
        currentYear === today.getFullYear() && !isOtherMonth) {
        dayEl.classList.add('today');
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayEl.appendChild(dayNumber);
    
    // Check for events on this day
    const dateStr = `${currentYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasEvent = eventsData.some(event => event.date === dateStr);
    
    if (hasEvent && !isOtherMonth) {
        dayEl.classList.add('has-event');
        const indicator = document.createElement('div');
        indicator.className = 'event-indicator';
        dayEl.appendChild(indicator);
    }
    
    dayEl.addEventListener('click', () => {
        if (!isOtherMonth) {
            showDayEvents(dateStr);
        }
    });
    
    return dayEl;
}

function showDayEvents(dateStr) {
    const dayEvents = eventsData.filter(event => event.date === dateStr);
    
    if (dayEvents.length === 0) {
        openEventModal(dateStr);
    } else {
        const eventList = dayEvents.map(e => 
            `• ${e.title} ${e.time ? `at ${e.time}` : ''}`
        ).join('\n');
        
        if (confirm(`Events on ${formatDate(dateStr)}:\n\n${eventList}\n\nAdd another event?`)) {
            openEventModal(dateStr);
        }
    }
}

function openEventModal(date = '') {
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDescription').value = '';
    document.getElementById('eventDate').value = date || new Date().toISOString().split('T')[0];
    document.getElementById('eventTime').value = '';
    document.getElementById('eventModal').classList.remove('hidden');
}

window.closeEventModal = function() {
    document.getElementById('eventModal').classList.add('hidden');
};

// Listen to events
function listenToEvents() {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        eventsData = [];
        snapshot.forEach((doc) => {
            eventsData.push({ id: doc.id, ...doc.data() });
        });
        renderCalendar();
        renderDatedTasks();
    });
    unsubscribers.push(unsubscribe);
}

// ==================== TASKS FUNCTIONS ====================

let tasksData = [];

function openTaskModal() {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDate').value = '';
    document.getElementById('taskModal').classList.remove('hidden');
}

window.closeTaskModal = function() {
    document.getElementById('taskModal').classList.add('hidden');
};

// Listen to tasks
function listenToTasks() {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        tasksData = [];
        snapshot.forEach((doc) => {
            tasksData.push({ id: doc.id, ...doc.data() });
        });
        renderDatedTasks();
        renderUndatedTasks();
    });
    unsubscribers.push(unsubscribe);
}

function renderDatedTasks() {
    const datedTasksEl = document.getElementById('datedTasks');
    if (!datedTasksEl) return;
    
    const datedTasks = tasksData.filter(task => task.date);
    datedTasksEl.innerHTML = '';
    
    if (datedTasks.length === 0) {
        datedTasksEl.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">No dated tasks</p>';
        return;
    }
    
    datedTasks.sort((a, b) => a.date.localeCompare(b.date));
    
    datedTasks.forEach(task => {
        const taskEl = createTaskElement(task);
        datedTasksEl.appendChild(taskEl);
    });
}

function renderUndatedTasks() {
    const undatedTasksEl = document.getElementById('undatedTasks');
    if (!undatedTasksEl) return;
    
    const undatedTasks = tasksData.filter(task => !task.date);
    undatedTasksEl.innerHTML = '';
    
    if (undatedTasks.length === 0) {
        undatedTasksEl.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">No undated tasks</p>';
        return;
    }
    
    undatedTasks.forEach(task => {
        const taskEl = createTaskElement(task);
        undatedTasksEl.appendChild(taskEl);
    });
}

function createTaskElement(task) {
    const taskEl = document.createElement('div');
    taskEl.className = 'task-item';
    if (task.completed) {
        taskEl.classList.add('completed');
    }
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => toggleTask(task.id, checkbox.checked));
    
    const content = document.createElement('div');
    content.className = 'task-content';
    
    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.title;
    content.appendChild(title);
    
    if (task.date) {
        const date = document.createElement('div');
        date.className = 'task-date';
        date.textContent = formatDate(task.date);
        content.appendChild(date);
    }
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>`;
    deleteBtn.addEventListener('click', () => deleteTask(task.id, task.title));
    
    taskEl.appendChild(checkbox);
    taskEl.appendChild(content);
    taskEl.appendChild(deleteBtn);
    
    return taskEl;
}

async function toggleTask(taskId, completed) {
    try {
        await updateDoc(doc(db, 'tasks', taskId), {
            completed
        });
        
        const task = tasksData.find(t => t.id === taskId);
        if (task && completed) {
            await logActivity(`${currentUser.displayName} completed task "${task.title}"`);
        }
    } catch (error) {
        console.error('Error toggling task:', error);
    }
}

async function deleteTask(taskId, taskTitle) {
    if (!confirm(`Delete task "${taskTitle}"?`)) return;
    
    try {
        await deleteDoc(doc(db, 'tasks', taskId));
        await logActivity(`${currentUser.displayName} deleted task "${taskTitle}"`);
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

// ==================== ACTIVITY LOG ====================

let activitiesData = [];

function listenToActivity() {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        activitiesData = [];
        snapshot.forEach((doc) => {
            activitiesData.push({ id: doc.id, ...doc.data() });
        });
        renderActivity();
    });
    unsubscribers.push(unsubscribe);
}

function renderActivity() {
    const activityFeed = document.getElementById('activityFeed');
    if (!activityFeed) return;
    
    activityFeed.innerHTML = '';
    
    if (activitiesData.length === 0) {
        activityFeed.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 40px;">No recent activity</p>';
        return;
    }
    
    activitiesData.slice(0, 20).forEach(activity => {
        const activityEl = document.createElement('div');
        activityEl.className = 'activity-item';
        
        activityEl.innerHTML = `
            <div class="activity-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
            </div>
            <div class="activity-content">
                <div class="activity-text">${activity.message}</div>
                <div class="activity-time">${formatTimestamp(activity.timestamp)}</div>
            </div>
        `;
        
        activityFeed.appendChild(activityEl);
    });
}

async function logActivity(message) {
    try {
        await addDoc(collection(db, 'activity_logs'), {
            message,
            userId: currentUser.uid,
            userName: currentUser.displayName,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// ==================== CHAT ====================

let messagesData = [];

async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    try {
        await addDoc(collection(db, 'chat'), {
            message,
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            senderPhoto: currentUser.photoURL,
            timestamp: serverTimestamp()
        });
        
        // Log activity
        await logActivity(`${currentUser.displayName} sent a message`);
        
        chatInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

function listenToChat() {
    const q = query(collection(db, 'chat'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        messagesData = [];
        snapshot.forEach((doc) => {
            messagesData.push({ id: doc.id, ...doc.data() });
        });
        renderChat();
    });
    unsubscribers.push(unsubscribe);
}

function renderChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    chatMessages.innerHTML = '';
    
    if (messagesData.length === 0) {
        chatMessages.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 40px;">No messages yet. Start the conversation!</p>';
        return;
    }
    
    messagesData.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        
        messageEl.innerHTML = `
            <img src="${msg.senderPhoto || 'https://via.placeholder.com/40'}" alt="${msg.senderName}" class="message-avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${msg.senderName}</span>
                    <span class="message-time">${formatTimestamp(msg.timestamp)}</span>
                </div>
                <div class="message-text">${escapeHtml(msg.message)}</div>
            </div>
        `;
        
        chatMessages.appendChild(messageEl);
    });
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==================== UTILITY FUNCTIONS ====================

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'Just now';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== INITIALIZE APP ====================

function initializeApp() {
    renderCalendar();
    listenToEvents();
    listenToTasks();
    listenToActivity();
    listenToChat();
}
