// The 'defer' attribute in the HTML <script> tag ensures this code runs after the DOM is fully loaded.

// --- 1. Firebase & App Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyBghGrPLr7_iC46u1Phs83vd1i-47zstUs",
    authDomain: "calendar-pbx21.firebaseapp.com",
    projectId: "calendar-pbx21",
    storageBucket: "calendar-pbx21.firebasestorage.app",
    messagingSenderId: "304190482123",
    appId: "1:304190482123:web:2a8415125467565a1e9d4e",
};

firebase.initializeApp(firebaseConfig);

firebase.firestore().enablePersistence().catch(err => {
    if (err.code == 'failed-precondition') {
        console.warn("Firestore persistence could not be enabled. Multiple tabs open?");
    } else if (err.code == 'unimplemented') {
        console.warn("Browser does not support all features for persistence.");
    }
});

const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
const githubProvider = new firebase.auth.GithubAuthProvider();

// --- 2. DOM Element Selection ---
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginGoogle = document.getElementById('login-google');
const loginGithub = document.getElementById('login-github');
const logoutButton = document.getElementById('logout-button');
const userPhoto = document.getElementById('user-photo');
const calendarEl = document.getElementById('calendar');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const createTaskBtn = document.getElementById('create-task-btn');
const hamburgerMenu = document.getElementById('hamburger-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const quickAddPopover = document.getElementById('quick-add-popover');
const quickAddTitleEl = document.getElementById('quick-add-title');
const quickAddDetailsBtn = document.getElementById('quick-add-details-btn');
const quickAddSaveBtn = document.getElementById('quick-add-save-btn');
const taskDetailsModal = document.getElementById('task-details-modal');
const taskIdEl = document.getElementById('task-id');
const taskTitleEl = document.getElementById('task-title');
const taskDateEl = document.getElementById('task-date');
const taskTimeEl = document.getElementById('task-time');
const taskDescriptionEl = document.getElementById('task-description');
const taskColorsContainer = document.getElementById('task-colors');
const subtasksListEl = document.getElementById('subtasks-list');
const addSubtaskInput = document.getElementById('add-subtask-input');
const saveTaskBtn = document.getElementById('save-task-btn');
const deleteTaskBtn = document.getElementById('delete-task-btn');
const dayDetailsModal = document.getElementById('day-details-modal');
const dayDetailsTitleEl = document.getElementById('day-details-title');
const dayDetailsListEl = document.getElementById('day-details-list');
const upcomingTasksList = document.getElementById('upcoming-tasks-list');
const activityLogList = document.getElementById('activity-log-list');
const notificationsBell = document.getElementById('notifications-bell');
const notificationDot = document.getElementById('notification-dot');
const notificationsPopover = document.getElementById('notifications-popover');
const notificationsList = document.getElementById('notifications-list');
const taskAssignmentContainer = document.getElementById('task-assignment');
const taskCommentsList = document.getElementById('task-comments-list');
const addCommentInput = document.getElementById('add-comment-input');

// --- 3. Global State ---
let currentDate = new Date();
let currentUser = null;
let tasks = [];
let users = [];
let activityLogs = [];
let notifications = [];
let subtasks = [];
let selectedColor = '#718096';
let currentCommentsUnsubscribe = null;
const TASK_COLORS = ['#718096', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

// --- 4. Main App Flow (Routing, Auth, Listeners) ---
function handleRouting() {
    const hash = window.location.hash.substring(1);
    const [year, month] = hash.split('-').map(Number);
    if (hash && !isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
        currentDate = new Date(year, month - 1, 1);
    }
    renderCalendar();
}
function updateHash() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    window.location.hash = `${year}-${month}`;
}
window.addEventListener('hashchange', handleRouting);

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        userPhoto.src = user.photoURL || 'default-avatar.png';
        
        // Save/update user profile in Firestore
        db.collection('users').doc(user.uid).set({
            displayName: user.displayName,
            photoURL: user.photoURL,
            email: user.email
        }, { merge: true });

        handleRouting();
        listenForAllUsers();
        listenForTasks();
        listenForActivity();
    } else {
        currentUser = null;
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

function listenForTasks() {
    db.collection('tasks').orderBy('startAt').onSnapshot(snapshot => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
        renderUpcomingTasks();
    });
}

function listenForActivity() {
    db.collection('logs').orderBy('timestamp', 'desc').limit(10).onSnapshot(snapshot => {
        activityLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderActivityLog();
    });
}

function listenForAllUsers() {
    db.collection('users').onSnapshot(snapshot => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
}

// --- 5. Rendering Functions ---
function renderCalendar() {
    const date = new Date(currentDate);
    date.setDate(1);
    const firstDayIndex = date.getDay();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const prevLastDay = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    const nextDays = 7 - new Date(date.getFullYear(), date.getMonth() + 1, 0).getDay() - 1;

    currentMonthEl.textContent = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    let daysHtml = "";
    for (let x = firstDayIndex; x > 0; x--) { daysHtml += `<div class="calendar-day other-month"><div class="day-number">${prevLastDay - x + 1}</div></div>`; }

    const MAX_TASKS_VISIBLE = 2;
    for (let i = 1; i <= lastDay; i++) {
        const dayDate = new Date(date.getFullYear(), date.getMonth(), i);
        const dayString = dayDate.toISOString().split('T')[0];
        const todayClass = dayDate.toDateString() === new Date().toDateString() ? 'today' : '';
        
        const dayTasks = tasks
            .filter(task => task.startAt && task.startAt.toDate().toDateString() === dayDate.toDateString())
            .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());

        let tasksHtml = dayTasks.slice(0, MAX_TASKS_VISIBLE).map(task => `
            <div class="task" data-task-id="${task.id}" style="background-color: ${task.color || '#718096'}">
                ${task.hasTime ? `<span class="task-time">${formatTime(task.startAt.toDate())}</span>` : ''}
                ${task.title}
            </div>`).join('');

        if (dayTasks.length > MAX_TASKS_VISIBLE) {
            tasksHtml += `<div class="more-tasks-indicator" data-date="${dayString}">+${dayTasks.length - MAX_TASKS_VISIBLE} more</div>`;
        }
        
        daysHtml += `<div class="calendar-day ${todayClass}" data-date="${dayString}"><div class="day-number">${i}</div><div class="tasks-container">${tasksHtml}</div></div>`;
    }

    for (let j = 1; j <= nextDays; j++) { daysHtml += `<div class="calendar-day other-month"><div class="day-number">${j}</div></div>`; }
    calendarEl.innerHTML = daysHtml;
    initializeDragAndDrop();
}

function renderUpcomingTasks() {
    const now = new Date();
    const upcoming = tasks
        .filter(task => task.startAt && task.startAt.toDate() >= now)
        .slice(0, 7);
    
    if (upcoming.length === 0) {
        upcomingTasksList.innerHTML = `<li class="empty-state">No upcoming tasks.</li>`;
        return;
    }
    
    upcomingTasksList.innerHTML = upcoming.map(task => `
        <li class="sidebar-task-item">
            <div class="task-color-dot" style="background-color: ${task.color || '#718096'}"></div>
            <div class="sidebar-task-details">
                <span>${task.title}</span>
                <span class="task-date">${task.startAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
            </div>
        </li>
    `).join('');
}

function renderActivityLog() {
    if (activityLogs.length === 0) {
        activityLogList.innerHTML = `<li class="empty-state">No recent activity.</li>`;
        return;
    }

    activityLogList.innerHTML = activityLogs.map(log => {
        const user = users.find(u => u.id === log.editorId);
        return `
            <li class="sidebar-activity-item">
                <img src="${user?.photoURL || 'default-avatar.png'}" alt="${user?.displayName}">
                <div>
                    <strong>${user?.displayName || 'Someone'}</strong> ${log.action} "${log.taskTitle}"
                </div>
            </li>
        `;
    }).join('');
}

function renderTaskAssignments(assignedIds = []) {
    taskAssignmentContainer.innerHTML = assignedIds.map(userId => {
        const user = users.find(u => u.id === userId);
        return user ? `<img class="user-avatar" src="${user.photoURL}" title="${user.displayName}">` : '';
    }).join('') + `<button class="add-assignment-btn">+</button>`;
    // Note: The "+" button is a UI placeholder for a future user selection feature.
}

function listenForComments(taskId) {
    if (currentCommentsUnsubscribe) currentCommentsUnsubscribe();
    currentCommentsUnsubscribe = db.collection('tasks').doc(taskId).collection('comments')
        .orderBy('timestamp')
        .onSnapshot(snapshot => {
            const comments = snapshot.docs.map(doc => doc.data());
            renderComments(comments);
        });
}

function renderComments(comments) {
    taskCommentsList.innerHTML = comments.map(comment => {
        const user = users.find(u => u.id === comment.authorId);
        return `
            <div class="comment-item">
                <img src="${user?.photoURL || 'default-avatar.png'}" alt="${user?.displayName}">
                <div class="comment-bubble">
                    <strong>${user?.displayName || 'Someone'}</strong>
                    <p>${comment.text}</p>
                </div>
            </div>
        `;
    }).join('') || '<p class="empty-state">No comments yet.</p>';
}

function renderSubtasks() {
    subtasksListEl.innerHTML = subtasks.map((sub, index) => `
        <div class="subtask-item ${sub.completed ? 'completed' : ''}">
            <input type="checkbox" data-index="${index}" ${sub.completed ? 'checked' : ''}>
            <label>${sub.text}</label>
        </div>`).join('');
}

// --- 6. Event Listeners Setup ---
function setupEventListeners() {
    const handleAuthError = (error) => { console.error("Auth Error:", error); alert(`Login failed: ${error.message}`); };
    loginGoogle.addEventListener('click', () => auth.signInWithPopup(googleProvider).catch(handleAuthError));
    loginGithub.addEventListener('click', () => auth.signInWithPopup(githubProvider).catch(handleAuthError));
    logoutButton.addEventListener('click', () => auth.signOut());
    
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateHash(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateHash(); });

    hamburgerMenu.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    sidebarOverlay.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    createTaskBtn.addEventListener('click', () => openTaskDetailsModal());
    calendarEl.addEventListener('click', (e) => {
        if (e.target.closest('.task')) {
            const taskToEdit = tasks.find(t => t.id === e.target.closest('.task').dataset.taskId);
            if (taskToEdit) openTaskDetailsModal(taskToEdit);
        } else if (e.target.closest('.more-tasks-indicator')) {
            openDayDetailsModal(e.target.closest('.more-tasks-indicator').dataset.date);
        } else if (e.target.closest('.calendar-day:not(.other-month)')) {
            openQuickAddPopover(e.target.closest('.calendar-day'));
        }
    });

    document.addEventListener('click', (e) => {
        if (!quickAddPopover.contains(e.target) && !e.target.closest('.calendar-day')) {
            quickAddPopover.classList.remove('visible');
        }
    });

    quickAddSaveBtn.addEventListener('click', handleQuickAddSave);
    quickAddTitleEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleQuickAddSave(e); });
    quickAddDetailsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parsed = parseQuickAddText(quickAddTitleEl.value.trim(), quickAddPopover.dataset.date);
        quickAddPopover.classList.remove('visible');
        openTaskDetailsModal({
            title: parsed.title,
            startAt: firebase.firestore.Timestamp.fromDate(parsed.date),
            hasTime: parsed.hasTime
        });
    });
    
    dayDetailsModal.addEventListener('click', (e) => {
        if (e.target.closest('.task')) {
            const taskToEdit = tasks.find(t => t.id === e.target.closest('.task').dataset.taskId);
            if (taskToEdit) {
                dayDetailsModal.classList.remove('visible');
                openTaskDetailsModal(taskToEdit);
            }
        }
    });

    addSubtaskInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            subtasks.push({ text: e.target.value.trim(), completed: false });
            renderSubtasks();
            e.target.value = '';
        }
    });

    subtasksListEl.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') {
            const index = parseInt(e.target.dataset.index, 10);
            if (subtasks[index]) subtasks[index].completed = e.target.checked;
            renderSubtasks();
        }
    });

    saveTaskBtn.addEventListener('click', handleSaveTask);
    deleteTaskBtn.addEventListener('click', handleDeleteTask);
    
    [taskDetailsModal, dayDetailsModal, notificationsPopover].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-button')) {
                modal.classList.remove('visible');
            }
        });
    });

    taskColorsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-option')) {
            selectedColor = e.target.dataset.color;
            taskColorsContainer.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            e.target.classList.add('selected');
        }
    });
    
    addCommentInput.addEventListener('keyup', async (e) => {
        const taskId = taskIdEl.value;
        const text = addCommentInput.value.trim();
        if (e.key === 'Enter' && text && taskId) {
            addCommentInput.disabled = true;
            await db.collection('tasks').doc(taskId).collection('comments').add({
                text,
                authorId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            addCommentInput.value = '';
            addCommentInput.disabled = false;
        }
    });
}

// --- 7. UI Interaction Functions ---
function openTaskDetailsModal(task = {}) {
    if (currentCommentsUnsubscribe) currentCommentsUnsubscribe();
    
    taskDetailsModal.classList.add('visible');
    const taskDate = task.startAt ? task.startAt.toDate() : new Date();
    
    taskIdEl.value = task.id || '';
    taskTitleEl.value = task.title || '';
    taskDateEl.value = taskDate.toISOString().split('T')[0];
    taskTimeEl.value = task.hasTime ? taskDate.toTimeString().substring(0, 5) : '';
    taskDescriptionEl.value = task.description || '';
    
    subtasks = task.subtasks ? [...task.subtasks] : [];
    renderSubtasks();
    
    renderTaskAssignments(task.assignedTo || []);
    if (task.id) {
        listenForComments(task.id);
    } else {
        taskCommentsList.innerHTML = '<p class="empty-state">Save the task to add comments.</p>';
    }

    selectedColor = task.color || TASK_COLORS[0];
    taskColorsContainer.querySelectorAll('.color-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === selectedColor);
    });
    deleteTaskBtn.style.display = task.id ? 'block' : 'none';
}

function openDayDetailsModal(dateStr) { /* ... same as before ... */ }
function openQuickAddPopover(dayElement) { /* ... same as before ... */ }

// --- 8. Core Logic & Handlers ---
async function handleQuickAddSave(e) {
    e.stopPropagation();
    setButtonLoading(quickAddSaveBtn, true, "Save");
    const text = quickAddTitleEl.value.trim();
    const date = quickAddPopover.dataset.date;
    if (!text || !date) {
        setButtonLoading(quickAddSaveBtn, false, "Save");
        return;
    }
    
    const parsed = parseQuickAddText(text, date);
    await saveTask({
        title: parsed.title,
        startAt: firebase.firestore.Timestamp.fromDate(parsed.date),
        hasTime: parsed.hasTime,
        color: selectedColor,
        subtasks: [],
        assignedTo: [currentUser.uid] // Assign to self by default
    });
    setButtonLoading(quickAddSaveBtn, false, "Save");
    quickAddPopover.classList.remove('visible');
}

async function handleSaveTask() {
    setButtonLoading(saveTaskBtn, true, "Save Task");
    const date = taskDateEl.value;
    const time = taskTimeEl.value;
    if (!taskTitleEl.value.trim() || !date) {
        setButtonLoading(saveTaskBtn, false, "Save Task");
        return alert('Title and Date are required.');
    }
    
    const dateTime = new Date(`${date}T${time || '00:00:00'}`);
    const originalTask = tasks.find(t => t.id === taskIdEl.value);

    await saveTask({
        id: taskIdEl.value,
        title: taskTitleEl.value.trim(),
        startAt: firebase.firestore.Timestamp.fromDate(dateTime),
        hasTime: !!time,
        description: taskDescriptionEl.value.trim(),
        color: selectedColor,
        subtasks: subtasks,
        assignedTo: originalTask?.assignedTo || [currentUser.uid]
    });
    setButtonLoading(saveTaskBtn, false, "Save Task");
    taskDetailsModal.classList.remove('visible');
}

async function handleDeleteTask() {
    const id = taskIdEl.value;
    if (id && confirm('Are you sure you want to delete this task?')) {
        await db.collection('tasks').doc(id).delete();
        // NOTE: In a real app, use Cloud Functions to delete subcollections like comments.
        taskDetailsModal.classList.remove('visible');
    }
}

async function saveTask(taskData) {
    const { id, ...dataToSave } = taskData;
    dataToSave.lastEditedBy = currentUser.uid;
    try {
        if (id) {
            await db.collection('tasks').doc(id).update(dataToSave);
        } else {
            dataToSave.createdBy = currentUser.uid;
            await db.collection('tasks').add(dataToSave);
        }
    } catch (error) { console.error("Error saving task:", error); }
}

// --- 9. Helper Functions ---
function parseQuickAddText(text, referenceDateStr) { /* ... same as before ... */ }
function renderColorSelector() {
    taskColorsContainer.innerHTML = TASK_COLORS.map(color => `<div class="color-option" data-color="${color}" style="background-color: ${color};"></div>`).join('');
}
function setButtonLoading(button, isLoading, defaultText) { /* ... same as before ... */ }
function formatTime(date) { /* ... same as before ... */ }
function initializeDragAndDrop() { /* ... same as before ... */ }

// --- Initialize App ---
renderColorSelector();
setupEventListeners();
