window.onload = () => {
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

    // --- DOM Elements ---
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

    // Quick Add Modal
    const quickAddModal = document.getElementById('quick-add-modal');
    const quickAddTitleEl = document.getElementById('quick-add-title');
    const quickAddDetailsBtn = document.getElementById('quick-add-details-btn');
    const quickAddSaveBtn = document.getElementById('quick-add-save-btn');

    // Task Details Modal
    const taskDetailsModal = document.getElementById('task-details-modal');
    const closeDetailsModalBtn = taskDetailsModal.querySelector('.close-button');
    const taskIdEl = document.getElementById('task-id');
    const taskTitleEl = document.getElementById('task-title');
    const taskDateEl = document.getElementById('task-date');
    const taskTimeEl = document.getElementById('task-time');
    const taskDescriptionEl = document.getElementById('task-description');
    const taskColorsContainer = document.getElementById('task-colors');
    const saveTaskBtn = document.getElementById('save-task-btn');
    const deleteTaskBtn = document.getElementById('delete-task-btn');

    // --- Global State ---
    let currentDate = new Date();
    let currentUser = null;
    let tasks = [];
    let currentPopoverDate = null;
    let selectedColor = '#718096'; // Default color
    const TASK_COLORS = ['#718096', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

    // --- 1. Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loginContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            userPhoto.src = user.photoURL || 'default-avatar.png';
            listenForTasks();
        } else {
            currentUser = null;
            loginContainer.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    const handleAuthError = (error) => { console.error("Auth Error:", error); alert(`Login failed: ${error.message}`); };
    loginGoogle.addEventListener('click', () => auth.signInWithPopup(googleProvider).catch(handleAuthError));
    loginGithub.addEventListener('click', () => auth.signInWithPopup(githubProvider).catch(handleAuthError));
    logoutButton.addEventListener('click', () => auth.signOut());

    // --- 2. Sidebar & Navigation ---
    hamburgerMenu.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    sidebarOverlay.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    createTaskBtn.addEventListener('click', () => openTaskDetailsModal());

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
        for (let x = firstDayIndex; x > 0; x--) { daysHtml += `<div class="calendar-day other-month"><div class="day-number">${prevLastDay - x + 1}</div></div>`; }

        for (let i = 1; i <= lastDay; i++) {
            const dayDate = new Date(date.getFullYear(), date.getMonth(), i);
            const dayString = dayDate.toISOString().split('T')[0];
            let todayClass = dayDate.toDateString() === new Date().toDateString() ? 'today' : '';
            
            const dayTasks = tasks
                .filter(task => task.date === dayString)
                .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            let tasksHtml = dayTasks.map(task => `
                <div class="task" data-task-id="${task.id}" style="background-color: ${task.color || '#718096'}">
                    ${task.time ? `<span class="task-time">${formatTime(task.time)}</span>` : ''}
                    ${task.title}
                </div>`).join('');

            daysHtml += `<div class="calendar-day ${todayClass}" data-date="${dayString}"><div class="day-number">${i}</div><div class="tasks-container">${tasksHtml}</div></div>`;
        }

        for (let j = 1; j <= nextDays; j++) { daysHtml += `<div class="calendar-day other-month"><div class="day-number">${j}</div></div>`; }
        calendarEl.innerHTML = daysHtml;
    };
    
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

    // --- 4. Firestore Listener ---
    function listenForTasks() {
        db.collection('tasks').onSnapshot(snapshot => {
            tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCalendar();
        }, error => console.error("Error listening for tasks:", error));
    }

    // --- 5. Task Creation & Editing Workflow ---
    calendarEl.addEventListener('click', (e) => {
        if (e.target.closest('.task')) { // Clicked on an existing task
            const taskId = e.target.closest('.task').dataset.taskId;
            const taskToEdit = tasks.find(t => t.id === taskId);
            if (taskToEdit) openTaskDetailsModal(taskToEdit);
        } else if (e.target.closest('.calendar-day:not(.other-month)')) { // Clicked on a calendar day
            const dayElement = e.target.closest('.calendar-day');
            openQuickAddPopover(dayElement.dataset.date);
        }
    });

    // Quick Add Popover
    function openQuickAddPopover(date) {
        quickAddModal.classList.add('visible');
        quickAddTitleEl.value = '';
        quickAddTitleEl.focus();
        currentPopoverDate = date;
    }

    quickAddSaveBtn.addEventListener('click', async () => {
        const title = quickAddTitleEl.value.trim();
        if (!title) return;
        setButtonLoading(quickAddSaveBtn, true);
        await saveTask({ title, date: currentPopoverDate, color: selectedColor }); // Save with default color
        setButtonLoading(quickAddSaveBtn, false);
        quickAddModal.classList.remove('visible');
    });

    quickAddDetailsBtn.addEventListener('click', () => {
        const title = quickAddTitleEl.value.trim();
        quickAddModal.classList.remove('visible');
        openTaskDetailsModal({ title, date: currentPopoverDate });
    });

    // Full Details Modal
    function renderColorSelector() {
        taskColorsContainer.innerHTML = TASK_COLORS.map(color => 
            `<div class="color-option" data-color="${color}" style="background-color: ${color};"></div>`
        ).join('');
    }
    taskColorsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-option')) {
            selectedColor = e.target.dataset.color;
            taskColorsContainer.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            e.target.classList.add('selected');
        }
    });

    function openTaskDetailsModal(task = {}) {
        taskDetailsModal.classList.add('visible');
        renderColorSelector();
        
        taskIdEl.value = task.id || '';
        taskTitleEl.value = task.title || '';
        taskDateEl.value = task.date || new Date().toISOString().split('T')[0];
        taskTimeEl.value = task.time || '';
        taskDescriptionEl.value = task.description || '';
        
        selectedColor = task.color || TASK_COLORS[0];
        taskColorsContainer.querySelectorAll('.color-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.color === selectedColor);
        });

        deleteTaskBtn.style.display = task.id ? 'block' : 'none';
    }

    closeDetailsModalBtn.addEventListener('click', () => taskDetailsModal.classList.remove('visible'));

    saveTaskBtn.addEventListener('click', async () => {
        const taskData = {
            id: taskIdEl.value,
            title: taskTitleEl.value.trim(),
            date: taskDateEl.value,
            time: taskTimeEl.value,
            description: taskDescriptionEl.value.trim(),
            color: selectedColor
        };
        if (!taskData.title || !taskData.date) return alert('Title and Date are required.');
        
        setButtonLoading(saveTaskBtn, true);
        await saveTask(taskData);
        setButtonLoading(saveTaskBtn, false);
        taskDetailsModal.classList.remove('visible');
    });

    deleteTaskBtn.addEventListener('click', async () => {
        const id = taskIdEl.value;
        if (id && confirm('Are you sure you want to delete this task?')) {
            setButtonLoading(deleteTaskBtn, true);
            await db.collection('tasks').doc(id).delete();
            setButtonLoading(deleteTaskBtn, false);
            taskDetailsModal.classList.remove('visible');
        }
    });

    // --- 6. Core Save Function ---
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

    // --- 7. Helper Functions ---
    function setButtonLoading(button, isLoading) {
        button.disabled = isLoading;
        button.textContent = isLoading ? 'Saving...' : button.textContent.replace('Saving...', 'Save');
    }

    function formatTime(timeString) {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedHours = h % 12 || 12;
        return `${formattedHours}:${minutes} ${ampm}`;
    }

    // Initial Render
    renderCalendar();
}
