window.onload = () => {
    // Ensure Firebase is loaded before starting the app
    if (typeof firebase === 'undefined') {
        console.error("FATAL: Firebase SDK not loaded. Check script tags in HTML.");
        alert("Error: The Firebase library failed to load. The app cannot start.");
        return;
    }
    startApp();
};

function startApp() {
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
    
    // Enable offline persistence for a seamless experience
    firebase.firestore().enablePersistence().catch(err => {
        if (err.code == 'failed-precondition') {
            console.warn("Firestore persistence could not be enabled. Multiple tabs open?");
        } else if (err.code == 'unimplemented') {
            console.warn("The current browser does not support all of the features required to enable persistence.");
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
    const closeDetailsModalBtn = taskDetailsModal.querySelector('.close-button');
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
    const closeDayDetailsModalBtn = dayDetailsModal.querySelector('.close-button');
    const dayDetailsTitleEl = document.getElementById('day-details-title');
    const dayDetailsListEl = document.getElementById('day-details-list');

    // --- 3. Global State ---
    let currentDate = new Date();
    let currentUser = null;
    let tasks = [];
    let subtasks = []; // Holds subtasks for the currently edited task
    let selectedColor = '#718096';
    const TASK_COLORS = ['#718096', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

    // --- 4. Routing ---
    function handleRouting() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const [year, month] = hash.split('-').map(Number);
            if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
                currentDate = new Date(year, month - 1, 1);
            }
        }
        renderCalendar();
    }
    function updateHash() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        window.location.hash = `${year}-${month}`;
    }
    window.addEventListener('hashchange', handleRouting);

    // --- 5. Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loginContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            userPhoto.src = user.photoURL || 'default-avatar.png';
            handleRouting(); // Initial load
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

    // --- 6. Calendar Rendering & Drag-and-Drop ---
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

        const MAX_TASKS_VISIBLE = 2;
        for (let i = 1; i <= lastDay; i++) {
            const dayDate = new Date(date.getFullYear(), date.getMonth(), i);
            const dayString = dayDate.toISOString().split('T')[0];
            let todayClass = dayDate.toDateString() === new Date().toDateString() ? 'today' : '';
            
            const dayTasks = tasks
                .filter(task => task.startAt.toDate().toDateString() === dayDate.toDateString())
                .sort((a, b) => a.startAt.toMillis() - b.toMillis());

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
    };

    function initializeDragAndDrop() {
        const taskContainers = document.querySelectorAll('.tasks-container');
        taskContainers.forEach(container => {
            new Sortable(container, {
                group: 'tasks',
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: async (evt) => {
                    const taskId = evt.item.dataset.taskId;
                    const newDayElement = evt.to.closest('.calendar-day');
                    const newDateStr = newDayElement.dataset.date;
                    
                    const originalTask = tasks.find(t => t.id === taskId);
                    if (originalTask) {
                        const originalDate = originalTask.startAt.toDate();
                        const newDate = new Date(`${newDateStr}T${originalDate.toTimeString().split(' ')[0]}`);
                        
                        await db.collection('tasks').doc(taskId).update({
                            startAt: firebase.firestore.Timestamp.fromDate(newDate)
                        });
                    }
                }
            });
        });
    }

    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateHash(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateHash(); });

    // --- 7. Firestore Listener ---
    function listenForTasks() {
        db.collection('tasks').onSnapshot(snapshot => {
            tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCalendar();
        }, error => console.error("Error listening for tasks:", error));
    }

    // --- 8. Event Listeners & Modals ---
    // Sidebar & Global Create
    hamburgerMenu.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    sidebarOverlay.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    createTaskBtn.addEventListener('click', () => openTaskDetailsModal());

    // Calendar Interactions
    calendarEl.addEventListener('click', (e) => {
        if (e.target.closest('.task')) {
            const taskId = e.target.closest('.task').dataset.taskId;
            const taskToEdit = tasks.find(t => t.id === taskId);
            if (taskToEdit) openTaskDetailsModal(taskToEdit);
        } else if (e.target.closest('.more-tasks-indicator')) {
            const date = e.target.closest('.more-tasks-indicator').dataset.date;
            openDayDetailsModal(date);
        } else if (e.target.closest('.calendar-day:not(.other-month)')) {
            const dayElement = e.target.closest('.calendar-day');
            openQuickAddPopover(dayElement);
        }
    });

    // Quick Add Popover
    function openQuickAddPopover(dayElement) {
        const rect = dayElement.getBoundingClientRect();
        quickAddPopover.style.left = `${rect.left}px`;
        quickAddPopover.style.top = `${rect.bottom + 5}px`;
        quickAddPopover.classList.add('visible');
        quickAddTitleEl.value = '';
        quickAddTitleEl.focus();
        quickAddPopover.dataset.date = dayElement.dataset.date;
    }
    quickAddSaveBtn.addEventListener('click', async () => {
        const text = quickAddTitleEl.value.trim();
        const date = quickAddPopover.dataset.date;
        if (!text || !date) return;
        
        const parsed = parseQuickAddText(text, date);
        setButtonLoading(quickAddSaveBtn, true);
        await saveTask({
            title: parsed.title,
            startAt: firebase.firestore.Timestamp.fromDate(parsed.date),
            hasTime: parsed.hasTime,
            color: selectedColor,
            subtasks: []
        });
        setButtonLoading(quickAddSaveBtn, false);
        quickAddPopover.classList.remove('visible');
    });
    quickAddDetailsBtn.addEventListener('click', () => {
        const text = quickAddTitleEl.value.trim();
        const date = quickAddPopover.dataset.date;
        const parsed = parseQuickAddText(text, date);
        quickAddPopover.classList.remove('visible');
        openTaskDetailsModal({
            title: parsed.title,
            startAt: firebase.firestore.Timestamp.fromDate(parsed.date),
            hasTime: parsed.hasTime
        });
    });

    // Day Details Modal (+X more)
    function openDayDetailsModal(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        dayDetailsTitleEl.textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        const dayTasks = tasks
            .filter(task => task.startAt.toDate().toDateString() === date.toDateString())
            .sort((a, b) => a.startAt.toMillis() - b.toMillis());

        dayDetailsListEl.innerHTML = dayTasks.map(task => `
            <div class="task" data-task-id="${task.id}" style="background-color: ${task.color || '#718096'}">
                ${task.hasTime ? `<span class="task-time">${formatTime(task.startAt.toDate())}</span>` : ''}
                ${task.title}
            </div>`).join('');
        dayDetailsModal.classList.add('visible');
    }
    dayDetailsModal.addEventListener('click', (e) => {
        if(e.target.closest('.task')) {
            const taskId = e.target.closest('.task').dataset.taskId;
            const taskToEdit = tasks.find(t => t.id === taskId);
            if (taskToEdit) {
                dayDetailsModal.classList.remove('visible');
                openTaskDetailsModal(taskToEdit);
            }
        }
    });

    // Full Task Details Modal
    function openTaskDetailsModal(task = {}) {
        taskDetailsModal.classList.add('visible');
        renderColorSelector();
        
        const taskDate = task.startAt ? task.startAt.toDate() : new Date();
        
        taskIdEl.value = task.id || '';
        taskTitleEl.value = task.title || '';
        taskDateEl.value = taskDate.toISOString().split('T')[0];
        taskTimeEl.value = task.hasTime ? taskDate.toTimeString().substring(0, 5) : '';
        taskDescriptionEl.value = task.description || '';
        
        subtasks = task.subtasks || [];
        renderSubtasks();
        
        selectedColor = task.color || TASK_COLORS[0];
        taskColorsContainer.querySelectorAll('.color-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.color === selectedColor);
        });

        deleteTaskBtn.style.display = task.id ? 'block' : 'none';
    }
    
    // Subtask Logic
    addSubtaskInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            subtasks.push({ text: e.target.value.trim(), completed: false });
            renderSubtasks();
            e.target.value = '';
        }
    });
    subtasksListEl.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') {
            const index = parseInt(e.target.dataset.index);
            subtasks[index].completed = e.target.checked;
            renderSubtasks();
        }
    });
    function renderSubtasks() {
        subtasksListEl.innerHTML = subtasks.map((sub, index) => `
            <div class="subtask-item ${sub.completed ? 'completed' : ''}">
                <input type="checkbox" data-index="${index}" ${sub.completed ? 'checked' : ''}>
                <label>${sub.text}</label>
            </div>`).join('');
    }

    // Modal Action Buttons
    saveTaskBtn.addEventListener('click', async () => {
        const date = taskDateEl.value;
        const time = taskTimeEl.value;
        const dateTime = new Date(`${date}T${time || '00:00:00'}`);

        const taskData = {
            id: taskIdEl.value,
            title: taskTitleEl.value.trim(),
            startAt: firebase.firestore.Timestamp.fromDate(dateTime),
            hasTime: !!time,
            description: taskDescriptionEl.value.trim(),
            color: selectedColor,
            subtasks: subtasks,
        };
        if (!taskData.title || !date) return alert('Title and Date are required.');
        
        setButtonLoading(saveTaskBtn, true, "Save Task");
        await saveTask(taskData);
        setButtonLoading(saveTaskBtn, false, "Save Task");
        taskDetailsModal.classList.remove('visible');
    });
    deleteTaskBtn.addEventListener('click', async () => {
        const id = taskIdEl.value;
        if (id && confirm('Are you sure you want to delete this task?')) {
            await db.collection('tasks').doc(id).delete();
            taskDetailsModal.classList.remove('visible');
        }
    });
    
    // Universal Modal Closing
    [quickAddPopover, taskDetailsModal, dayDetailsModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-button')) {
                modal.classList.remove('visible');
                quickAddPopover.classList.remove('visible'); // Also hide popover
            }
        });
    });

    // --- 9. Core Save & Helper Functions ---
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
    
    function parseQuickAddText(text, referenceDateStr) {
        let date = new Date(`${referenceDateStr}T00:00:00`);
        let title = text;
        let hasTime = false;
        
        const timeRegex = /(\d{1,2}(:\d{2})?)\s*(am|pm)?/i;
        const timeMatch = text.match(timeRegex);

        if (timeMatch) {
            let [ , time, , ampm ] = timeMatch;
            let [hours, minutes] = time.split(':');
            hours = parseInt(hours);
            minutes = parseInt(minutes || '0');
            
            if (ampm && hours < 12 && ampm.toLowerCase() === 'pm') {
                hours += 12;
            } else if (ampm && hours === 12 && ampm.toLowerCase() === 'am') {
                hours = 0;
            }
            
            date.setHours(hours, minutes);
            hasTime = true;
            title = title.replace(timeMatch[0], '').trim();
        }

        if (/\btomorrow\b/i.test(text)) {
            date.setDate(date.getDate() + 1);
            title = title.replace(/\btomorrow\b/i, '').trim();
        }

        return { title: title || 'New Task', date, hasTime };
    }

    function renderColorSelector() {
        taskColorsContainer.innerHTML = TASK_COLORS.map(color => `<div class="color-option" data-color="${color}" style="background-color: ${color};"></div>`).join('');
        taskColorsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option')) {
                selectedColor = e.target.dataset.color;
                taskColorsContainer.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
                e.target.classList.add('selected');
            }
        });
    }

    function setButtonLoading(button, isLoading, defaultText) {
        button.disabled = isLoading;
        button.textContent = isLoading ? 'Saving...' : defaultText;
    }

    function formatTime(date) {
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
}
