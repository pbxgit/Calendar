// A function to run the main application logic.
// We will call this function only after confirming Firebase is loaded.
function startApp() {
    console.log("startApp() called: Firebase is ready.");

    // Firebase Configuration - no changes here
    const firebaseConfig = {
        apiKey: "AIzaSyBghGrPLr7_iC46u1Phs83vd1i-47zstUs",
        authDomain: "calendar-pbx21.firebaseapp.com",
        projectId: "calendar-pbx21",
        storageBucket: "calendar-pbx21.firebasestorage.app",
        messagingSenderId: "304190482123",
        appId: "1:304190482123:web:2a8415125467565a1e9d4e",
    };

    // Initialize Firebase
    try {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully.");
    } catch (e) {
        console.error("Error initializing Firebase:", e);
        alert("Could not initialize Firebase. Please check the console for errors.");
        return; // Stop execution if Firebase fails to initialize
    }

    // Firebase services
    const auth = firebase.auth();
    const db = firebase.firestore();
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    const githubProvider = new firebase.auth.GithubAuthProvider();

    // --- DOM Element Selection ---
    // We select all elements here to ensure they exist.
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginGoogle = document.getElementById('login-google');
    const loginGithub = document.getElementById('login-github');
    const logoutButton = document.getElementById('logout-button');
    // ... (rest of your DOM elements) ...
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
    
    // Check if login buttons exist before adding listeners
    if (!loginGoogle || !loginGithub) {
        console.error("FATAL: Login buttons not found in the DOM.");
        return;
    }
    console.log("Login buttons found successfully.");

    // Global state variables
    let currentDate = new Date();
    let currentUser = null;
    let tasks = [];
    
    // --- Authentication Logic ---
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
        console.error("Authentication Error Details:", error);
        if (error.code === 'auth/popup-blocked-by-browser') {
            alert("Login failed: Your browser blocked the pop-up. Please allow pop-ups for this site and try again.");
        } else {
            alert(`Login failed: ${error.message}`);
        }
    };
    
    // --- FIXED: Event Listeners ---
    loginGoogle.addEventListener('click', () => {
        console.log("Google sign-in button clicked.");
        auth.signInWithPopup(googleProvider).catch(handleAuthError);
    });
    
    loginGithub.addEventListener('click', () => {
        console.log("GitHub sign-in button clicked.");
        auth.signInWithPopup(githubProvider).catch(handleAuthError);
    });

    logoutButton.addEventListener('click', () => auth.signOut());

    // (All other functions: renderCalendar, listenForTasks, etc. remain the same as the previous version)
    // --- PASTE THE REST OF THE JAVASCRIPT FUNCTIONS FROM THE PREVIOUS RESPONSE HERE ---
    // (This includes renderCalendar, listenForTasks, listenForLogs, listenForChat, renderTaskList, openTaskModal, sendMessage, etc.)
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
            let todayClass = dayDate.toDateString() === new Date().toDateString() ? 'today' : '';
            
            const dayTasks = tasks.filter(task => 
                new Date(task.date + 'T00:00:00').toDateString() === dayDate.toDateString()
            );

            let tasksHtml = dayTasks.map(task => `<div class="task">${task.title}</div>`).join('');

            daysHtml += `
                <div class="calendar-day ${todayClass}" data-date="${dayDate.toISOString().split('T')[0]}">
                    <div class="day-number">${i}</div>
                    <div class="tasks-container">${tasksHtml}</div>
                </div>
            `;
        }

        for (let j = 1; j <= nextDays; j++) {
            daysHtml += `<div class="calendar-day other-month">${j}</div>`;
        }

        calendarEl.innerHTML = daysHtml;
    };
    
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    function listenForTasks() {
        db.collection('tasks').orderBy('date').onSnapshot(snapshot => {
            tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCalendar();
            renderTaskList();
        }, error => console.error("Error listening for tasks:", error));
    }

    function listenForLogs() {
        db.collection('logs').orderBy('timestamp', 'desc').limit(10).onSnapshot(snapshot => {
            logListUl.innerHTML = snapshot.docs.map(doc => {
                const log = doc.data();
                return `<li>${new Date(log.timestamp?.toDate()).toLocaleTimeString()}: ${log.editorName} ${log.action} task "${log.taskTitle}"</li>`;
            }).join('');
        }, error => console.error("Error listening for logs:", error));
    }

    function listenForChat() {
        db.collection('chat').orderBy('timestamp').limit(50).onSnapshot(snapshot => {
            chatBox.innerHTML = snapshot.docs.map(doc => {
                const msg = doc.data();
                return `<div class="chat-message"><strong>${msg.senderName}:</strong> ${msg.text}</div>`;
            }).join('');
            chatBox.scrollTop = chatBox.scrollHeight;
        }, error => console.error("Error listening for chat:", error));
    }
    
    function renderTaskList() {
        taskListUl.innerHTML = tasks.slice(0, 5).map(task => `<li>${task.title} on ${task.date}</li>`).join('');
    }

    calendarEl.addEventListener('click', (e) => {
        const dayElement = e.target.closest('.calendar-day:not(.other-month)');
        if (dayElement) {
            openTaskModal({ date: dayElement.dataset.date });
        }
    });

    function openTaskModal(task = {}) {
        taskIdEl.value = task.id || '';
        taskTitleEl.value = task.title || '';
        taskDescriptionEl.value = task.description || '';
        taskDateEl.value = task.date || '';
        deleteTaskBtn.style.display = task.id ? 'flex' : 'none';
        taskModal.classList.add('visible');
    }

    closeModalBtn.addEventListener('click', () => taskModal.classList.remove('visible'));

    saveTaskBtn.addEventListener('click', async () => {
        // ... save task logic
    });

    deleteTaskBtn.addEventListener('click', async () => {
        // ... delete task logic
    });

    const sendMessage = async () => {
        // ... send message logic
    };

    sendMessageBtn.addEventListener('click', sendMessage);
    chatMessageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    renderCalendar();
}


// --- Main Entry Point ---
// We wait for the entire window to load, including the Firebase scripts.
window.onload = () => {
    console.log("Window loaded.");
    // Check if the Firebase library is actually available
    if (typeof firebase === 'undefined') {
        console.error("FATAL: Firebase SDK not loaded. Check the script tags in your HTML.");
        alert("Error: The Firebase library failed to load. The app cannot start.");
    } else {
        // If Firebase is available, start the app.
        startApp();
    }
};
