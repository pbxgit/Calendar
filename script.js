window.onload = () => {
    // Check if Firebase is loaded before starting the app
    if (typeof firebase === 'undefined') {
        console.error("FATAL: Firebase SDK not loaded.");
        alert("Error: The Firebase library failed to load. The app cannot start.");
        return;
    }
    startApp();
};

function startApp() {
    const firebaseConfig = {
        apiKey: "AIzaSyBghGrPLr7_iC46u1Phs83vd1i-47zstUs",
        authDomain: "calendar-pbx21.firebaseapp.com",
        projectId: "calendar-pbx21",
        storageBucket: "calendar-pbx21.firebasestorage.app",
        messagingSenderId: "304190482123",
        appId: "1:304190482123:web:2a8415125467565a1e9d4e",
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    const githubProvider = new firebase.auth.GithubAuthProvider();

    // DOM Elements
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginGoogle = document.getElementById('login-google');
    const loginGithub = document.getElementById('login-github');
    const logoutButton = document.getElementById('logout-button');
    const userPhoto = document.getElementById('user-photo');
    const userName = document.getElementById('user-name');

    const calendarEl = document.getElementById('calendar');
    const currentMonthEl = document.getElementById('current-month');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    const taskModal = document.getElementById('task-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const saveTaskBtn = document.getElementById('save-task');
    const deleteTaskBtn = document.getElementById('delete-task');
    const taskTitleEl = document.getElementById('task-title');
    const taskDescriptionEl = document.getElementById('task-description');
    const taskDateEl = document.getElementById('task-date');
    const taskIdEl = document.getElementById('task-id');
    
    const taskListUl = document.getElementById('task-list');
    const logListUl = document.getElementById('log-list');
    const chatBox = document.getElementById('chat-box');
    const chatMessageInput = document.getElementById('chat-message');
    const sendMessageBtn = document.getElementById('send-message');
    
    // New elements for sidebar toggle
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    let currentDate = new Date();
    let currentUser = null;
    let tasks = [];

    // --- 1. Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loginContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            userPhoto.src = user.photoURL || 'default-avatar.png';
            userName.textContent = user.displayName || user.email;
            listenForTasks();
            listenForLogs();
            listenForChat();
        } else {
            currentUser = null;
            loginContainer.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    const handleAuthError = (error) => {
        console.error("Authentication Error:", error);
        alert(`Login failed: ${error.message}`);
    };

    loginGoogle.addEventListener('click', () => auth.signInWithPopup(googleProvider).catch(handleAuthError));
    loginGithub.addEventListener('click', () => auth.signInWithPopup(githubProvider).catch(handleAuthError));
    logoutButton.addEventListener('click', () => auth.signOut());

    // --- 2. Sidebar Toggle for Mobile ---
    hamburgerMenu.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-open');
    });

    sidebarOverlay.addEventListener('click', () => {
        document.body.classList.remove('sidebar-open');
    });

    // --- 3. Calendar Rendering ---
    const renderCalendar = () => {
        const date = new Date(currentDate);
        date.setDate(1);
        const firstDayIndex = date.getDay();
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const prevLastDay = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
        const lastDayIndex = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDay();
        const nextDays = 7 - lastDayIndex - 1;

        currentMonthEl.textContent = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        let daysHtml = "";

        for (let x = firstDayIndex; x > 0; x--) {
            daysHtml += `<div class="calendar-day other-month">${prevLastDay - x + 1}</div>`;
        }

        for (let i = 1; i <= lastDay; i++) {
            const dayDate = new Date(date.getFullYear(), date.getMonth(), i);
            const dayString = dayDate.toISOString().split('T')[0];
            let todayClass = dayDate.toDateString() === new Date().toDateString() ? 'today' : '';
            
            // BUG FIX: Compare dates safely across timezones
            const dayTasks = tasks.filter(task => 
                new Date(task.date + 'T00:00:00').toDateString() === dayDate.toDateString()
            );

            let tasksHtml = dayTasks.map(task => `<div class="task" data-task-id="${task.id}">${task.title}</div>`).join('');

            daysHtml += `
                <div class="calendar-day ${todayClass}" data-date="${dayString}">
                    <div class="day-number">${i}</div>
                    <div class="tasks-container">${tasksHtml}</div>
                </div>`;
        }

        for (let j = 1; j <= nextDays; j++) {
            daysHtml += `<div class="calendar-day other-month">${j}</div>`;
        }

        calendarEl.innerHTML = daysHtml;
    };
    
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

    // --- 4. Firestore Listeners ---
    function listenForTasks() {
        db.collection('tasks').orderBy('date').onSnapshot(snapshot => {
            tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCalendar();
            renderTaskList();
        }, error => console.error("Error listening for tasks:", error));
    }

    function listenForLogs() { /* Unchanged */ }
    function listenForChat() { /* Unchanged */ }
    
    function renderTaskList() {
        taskListUl.innerHTML = tasks.slice(0, 5).map(task => `<li>${task.title} on ${task.date}</li>`).join('');
    }

    // --- 5. Modal and Task Management ---
    calendarEl.addEventListener('click', (e) => {
        // FEATURE: Click on a task to edit it
        if (e.target.classList.contains('task')) {
            const taskId = e.target.dataset.taskId;
            const taskToEdit = tasks.find(t => t.id === taskId);
            if (taskToEdit) {
                openTaskModal(taskToEdit);
            }
            return;
        }

        // Click on a day to add a new task
        const dayElement = e.target.closest('.calendar-day:not(.other-month)');
        if (dayElement) {
            openTaskModal({ date: dayElement.dataset.date });
        }
    });

    function openTaskModal(task = {}) {
        taskIdEl.value = task.id || '';
        taskTitleEl.value = task.title || '';
        taskDescriptionEl.value = task.description || '';
        taskDateEl.value = task.date || new Date().toISOString().split('T')[0];
        deleteTaskBtn.style.display = task.id ? 'flex' : 'none';
        taskModal.classList.add('visible');
    }

    closeModalBtn.addEventListener('click', () => taskModal.classList.remove('visible'));

    saveTaskBtn.addEventListener('click', async () => {
        if (!taskTitleEl.value || !taskDateEl.value) { return alert('Please provide a title and date.'); }

        const taskData = {
            title: taskTitleEl.value,
            description: taskDescriptionEl.value,
            date: taskDateEl.value,
            lastEditedBy: currentUser.uid,
            lastEditedName: currentUser.displayName,
        };

        const id = taskIdEl.value;
        const action = id ? 'updated' : 'created';

        try {
            if (id) {
                await db.collection('tasks').doc(id).update(taskData);
            } else {
                taskData.createdBy = currentUser.uid;
                taskData.createdByName = currentUser.displayName;
                await db.collection('tasks').add(taskData);
            }
            
            await db.collection('logs').add({ action: action, taskTitle: taskData.title, editorId: currentUser.uid, editorName: currentUser.displayName, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            taskModal.classList.remove('visible');
        } catch (error) { console.error("Error saving task: ", error); }
    });

    deleteTaskBtn.addEventListener('click', async () => {
        const id = taskIdEl.value;
        if (id && confirm('Are you sure you want to delete this task?')) {
            try {
                await db.collection('tasks').doc(id).delete();
                await db.collection('logs').add({ action: 'deleted', taskTitle: taskTitleEl.value, editorId: currentUser.uid, editorName: currentUser.displayName, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                taskModal.classList.remove('visible');
            } catch (error) { console.error("Error deleting task: ", error); }
        }
    });

    // --- 6. Chat Functionality ---
    const sendMessage = async () => {
        const text = chatMessageInput.value.trim();
        if (text && currentUser) {
            try {
                await db.collection('chat').add({ text: text, senderId: currentUser.uid, senderName: currentUser.displayName, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                chatMessageInput.value = '';
            } catch (error) { console.error("Error sending message: ", error); }
        }
    };

    sendMessageBtn.addEventListener('click', sendMessage);
    chatMessageInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') sendMessage(); });

    // Initial render on app start
    renderCalendar();
}
