document.addEventListener('DOMContentLoaded', () => {
    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyBghGrPLr7_iC46u1Phs83vd1i-47zstUs",
        authDomain: "calendar-pbx21.firebaseapp.com",
        projectId: "calendar-pbx21",
        storageBucket: "calendar-pbx21.firebasestorage.app",
        messagingSenderId: "304190482123",
        appId: "1:304190482123:web:2a8415125467565a1e9d4e",
    };

    // Initialize Firebase
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

    let currentDate = new Date();
    let currentUser = null;
    let tasks = [];

    // --- 1. Authentication Logic ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loginContainer.classList.add('hidden');
            appContainer.classList.add('visible');
            userPhoto.src = user.photoURL || 'default-avatar.png'; // Fallback for no photo
            userName.textContent = user.displayName || user.email;
            
            // Initial data load
            renderCalendar();
            listenForTasks();
            listenForLogs();
            listenForChat();

        } else {
            currentUser = null;
            loginContainer.classList.remove('hidden');
            appContainer.classList.remove('visible');
        }
    });

    loginGoogle.addEventListener('click', () => auth.signInWithPopup(googleProvider).catch(err => console.error(err)));
    loginGithub.addEventListener('click', () => auth.signInWithPopup(githubProvider).catch(err => console.error(err)));
    logoutButton.addEventListener('click', () => auth.signOut());

    // --- 2. Calendar Rendering ---
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
                new Date(task.date).toDateString() === dayDate.toDateString()
            );

            let tasksHtml = dayTasks.map(task => `<div class="task">${task.title}</div>`).join('');

            daysHtml += `
                <div class="calendar-day ${todayClass}" data-date="${dayDate.toISOString().split('T')[0]}">
                    <div class="day-number">${i}</div>
                    ${tasksHtml}
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

    // --- 3. Firestore Listeners (Real-time updates) ---
    function listenForTasks() {
        db.collection('tasks').orderBy('date').onSnapshot(snapshot => {
            tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCalendar();
            renderTaskList();
        });
    }

    function listenForLogs() {
        db.collection('logs').orderBy('timestamp', 'desc').limit(10).onSnapshot(snapshot => {
            logListUl.innerHTML = snapshot.docs.map(doc => {
                const log = doc.data();
                return `<li>${new Date(log.timestamp?.toDate()).toLocaleTimeString()}: ${log.editorName} ${log.action} task "${log.taskTitle}"</li>`;
            }).join('');
        });
    }

    function listenForChat() {
        db.collection('chat').orderBy('timestamp').limit(50).onSnapshot(snapshot => {
            chatBox.innerHTML = snapshot.docs.map(doc => {
                const msg = doc.data();
                return `<div class="chat-message"><strong>${msg.senderName}:</strong> ${msg.text}</div>`;
            }).join('');
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    }
    
    function renderTaskList() {
        taskListUl.innerHTML = tasks.slice(0, 5).map(task => `<li>${task.title} on ${task.date}</li>`).join('');
    }

    // --- 4. Modal and Task Management ---
    calendarEl.addEventListener('click', (e) => {
        const dayElement = e.target.closest('.calendar-day:not(.other-month)');
        if (dayElement) {
            const date = dayElement.dataset.date;
            openTaskModal({ date });
        }
    });

    function openTaskModal(task = {}) {
        taskIdEl.value = task.id || '';
        taskTitleEl.value = task.title || '';
        taskDescriptionEl.value = task.description || '';
        taskDateEl.value = task.date || '';
        deleteTaskBtn.style.display = task.id ? 'block' : 'none';
        taskModal.classList.add('visible');
    }

    closeModalBtn.addEventListener('click', () => taskModal.classList.remove('visible'));

    saveTaskBtn.addEventListener('click', async () => {
        if (!taskTitleEl.value || !taskDateEl.value) {
            alert('Please provide a title and date.');
            return;
        }

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
                taskData.c
