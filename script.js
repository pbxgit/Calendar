document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Firebase & App Initialization ---
    const firebaseConfig = {
        apiKey: "AIzaSyBghGrPLr7_iC46u1Phs83vd1i-47zstUs",
        authDomain: "calendar-pbx21.firebaseapp.com",
        projectId: "calendar-pbx21",
        storageBucket: "calendar-pbx21.firebasestorage.app",
        messagingSenderId: "304190482123",
        appId: "1:304190482123:web:2a8415125467565a1e9d4e",
    };
    
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    firebase.firestore().enablePersistence().catch(err => {
        if (err.code == 'failed-precondition') console.warn("Firestore persistence failed, likely due to multiple tabs open.");
        else if (err.code == 'unimplemented') console.warn("Browser does not support all features for persistence.");
    });

    const auth = firebase.auth();
    const db = firebase.firestore();
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    const githubProvider = new firebase.auth.GithubAuthProvider();

    // --- 2. DOM Element Selection ---
    const elements = {
        loginContainer: document.getElementById('login-container'),
        appContainer: document.getElementById('app-container'),
        loginGoogle: document.getElementById('login-google'),
        loginGithub: document.getElementById('login-github'),
        logoutButton: document.getElementById('logout-button'),
        userPhoto: document.getElementById('user-photo'),
        calendarEl: document.getElementById('calendar'),
        currentMonthEl: document.getElementById('current-month'),
        prevMonthBtn: document.getElementById('prev-month'),
        nextMonthBtn: document.getElementById('next-month'),
        createTaskBtn: document.getElementById('create-task-btn'),
        hamburgerMenu: document.getElementById('hamburger-menu'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        quickAddPopover: document.getElementById('quick-add-popover'),
        quickAddTitleEl: document.getElementById('quick-add-title'),
        quickAddDetailsBtn: document.getElementById('quick-add-details-btn'),
        quickAddSaveBtn: document.getElementById('quick-add-save-btn'),
        taskDetailsModal: document.getElementById('task-details-modal'),
        taskIdEl: document.getElementById('task-id'),
        taskTitleEl: document.getElementById('task-title'),
        taskDateEl: document.getElementById('task-date'),
        taskTimeEl: document.getElementById('task-time'),
        taskDescriptionEl: document.getElementById('task-description'),
        taskColorsContainer: document.getElementById('task-colors'),
        subtasksListEl: document.getElementById('subtasks-list'),
        addSubtaskInput: document.getElementById('add-subtask-input'),
        saveTaskBtn: document.getElementById('save-task-btn'),
        deleteTaskBtn: document.getElementById('delete-task-btn'),
        dayDetailsModal: document.getElementById('day-details-modal'),
        dayDetailsTitleEl: document.getElementById('day-details-title'),
        dayDetailsListEl: document.getElementById('day-details-list'),
        upcomingTasksList: document.getElementById('upcoming-tasks-list'),
        activityLogList: document.getElementById('activity-log-list'),
        notificationsBell: document.getElementById('notifications-bell'),
        notificationDot: document.getElementById('notification-dot'),
        notificationsPopover: document.getElementById('notifications-popover'),
        notificationsList: document.getElementById('notifications-list'),
        taskAssignmentContainer: document.getElementById('task-assignment'),
        taskCommentsList: document.getElementById('task-comments-list'),
        addCommentInput: document.getElementById('add-comment-input'),
    };

    for (const key in elements) {
        if (!elements[key]) {
            console.error(`FATAL ERROR: DOM element with ID '${key}' not found. The application cannot start.`);
            return;
        }
    }

    // --- 3. Global State ---
    let currentDate = new Date();
    let currentUser = null;
    let tasks = [];
    let users = [];
    let activityLogs = [];
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
            elements.loginContainer.style.display = 'none';
            elements.appContainer.style.display = 'flex';
            elements.userPhoto.src = user.photoURL || 'default-avatar.png';
            
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
            elements.loginContainer.style.display = 'flex';
            elements.appContainer.style.display = 'none';
        }
    });

    // --- 5. Firestore Listeners ---
    function listenForTasks() {
        db.collection('tasks').orderBy('startAt').onSnapshot(snapshot => {
            tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCalendar();
            renderUpcomingTasks();
        }, console.error);
    }

    function listenForActivity() {
        db.collection('logs').orderBy('timestamp', 'desc').limit(10).onSnapshot(snapshot => {
            activityLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderActivityLog();
        }, console.error);
    }

    function listenForAllUsers() {
        db.collection('users').onSnapshot(snapshot => {
            users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderActivityLog(); // Re-render logs in case user data arrived after logs
        }, console.error);
    }

    // --- 6. Rendering Functions ---
    function renderCalendar() {
        const date = new Date(currentDate);
        date.setDate(1);
        const firstDayIndex = date.getDay();
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const prevLastDay = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
        const nextDays = 7 - new Date(date.getFullYear(), date.getMonth() + 1, 0).getDay() - 1;

        elements.currentMonthEl.textContent = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        
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
        elements.calendarEl.innerHTML = daysHtml;
        initializeDragAndDrop();
    }

    function renderUpcomingTasks() {
        const now = new Date();
        const upcoming = tasks
            .filter(task => task.startAt && task.startAt.toDate() >= now)
            .slice(0, 7);
        
        if (upcoming.length === 0) {
            elements.upcomingTasksList.innerHTML = `<li class="empty-state">No upcoming tasks.</li>`;
            return;
        }
        
        elements.upcomingTasksList.innerHTML = upcoming.map(task => `
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
            elements.activityLogList.innerHTML = `<li class="empty-state">No recent activity.</li>`;
            return;
        }

        elements.activityLogList.innerHTML = activityLogs.map(log => {
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
        elements.taskAssignmentContainer.innerHTML = assignedIds.map(userId => {
            const user = users.find(u => u.id === userId);
            return user ? `<img class="user-avatar" src="${user.photoURL}" title="${user.displayName}">` : '';
        }).join('') + `<button class="add-assignment-btn">+</button>`;
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
        elements.taskCommentsList.innerHTML = comments.map(comment => {
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
        elements.subtasksListEl.innerHTML = subtasks.map((sub, index) => `
            <div class="subtask-item ${sub.completed ? 'completed' : ''}">
                <input type="checkbox" data-index="${index}" ${sub.completed ? 'checked' : ''}>
                <label>${sub.text}</label>
            </div>`).join('');
    }

    function renderColorSelector() {
        elements.taskColorsContainer.innerHTML = TASK_COLORS.map(color => `<div class="color-option" data-color="${color}" style="background-color: ${color};"></div>`).join('');
    }

    // --- 7. Event Listeners Setup ---
    function setupEventListeners() {
        const handleAuthError = (error) => { console.error("Auth Error:", error); alert(`Login failed: ${error.message}`); };
        elements.loginGoogle.addEventListener('click', () => auth.signInWithPopup(googleProvider).catch(handleAuthError));
        elements.loginGithub.addEventListener('click', () => auth.signInWithPopup(githubProvider).catch(handleAuthError));
        elements.logoutButton.addEventListener('click', () => auth.signOut());
        
        elements.prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateHash(); });
        elements.nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateHash(); });

        elements.hamburgerMenu.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
        elements.sidebarOverlay.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
        elements.createTaskBtn.addEventListener('click', () => openTaskDetailsModal());
        elements.calendarEl.addEventListener('click', (e) => {
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
            if (!elements.quickAddPopover.contains(e.target) && !e.target.closest('.calendar-day')) {
                elements.quickAddPopover.classList.remove('visible');
            }
        });

        elements.quickAddSaveBtn.addEventListener('click', handleQuickAddSave);
        elements.quickAddTitleEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleQuickAddSave(e); });
        elements.quickAddDetailsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parsed = parseQuickAddText(elements.quickAddTitleEl.value.trim(), elements.quickAddPopover.dataset.date);
            elements.quickAddPopover.classList.remove('visible');
            openTaskDetailsModal({
                title: parsed.title,
                startAt: firebase.firestore.Timestamp.fromDate(parsed.date),
                hasTime: parsed.hasTime
            });
        });
        
        elements.dayDetailsModal.addEventListener('click', (e) => {
            if (e.target.closest('.task')) {
                const taskToEdit = tasks.find(t => t.id === e.target.closest('.task').dataset.taskId);
                if (taskToEdit) {
                    elements.dayDetailsModal.classList.remove('visible');
                    openTaskDetailsModal(taskToEdit);
                }
            }
        });

        elements.addSubtaskInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                subtasks.push({ text: e.target.value.trim(), completed: false });
                renderSubtasks();
                e.target.value = '';
            }
        });

        elements.subtasksListEl.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') {
                const index = parseInt(e.target.dataset.index, 10);
                if (subtasks[index]) subtasks[index].completed = e.target.checked;
                renderSubtasks();
            }
        });

        elements.saveTaskBtn.addEventListener('click', handleSaveTask);
        elements.deleteTaskBtn.addEventListener('click', handleDeleteTask);
        
        [elements.taskDetailsModal, elements.dayDetailsModal, elements.notificationsPopover].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('close-button')) {
                    modal.classList.remove('visible');
                }
            });
        });

        elements.taskColorsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option')) {
                selectedColor = e.target.dataset.color;
                elements.taskColorsContainer.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
                e.target.classList.add('selected');
            }
        });
        
        elements.addCommentInput.addEventListener('keyup', async (e) => {
            const taskId = elements.taskIdEl.value;
            const text = elements.addCommentInput.value.trim();
            if (e.key === 'Enter' && text && taskId) {
                elements.addCommentInput.disabled = true;
                await db.collection('tasks').doc(taskId).collection('comments').add({
                    text,
                    authorId: currentUser.uid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                elements.addCommentInput.value = '';
                elements.addCommentInput.disabled = false;
            }
        });
    }

    // --- 8. UI Interaction Functions ---
    function openTaskDetailsModal(task = {}) {
        if (currentCommentsUnsubscribe) currentCommentsUnsubscribe();
        
        elements.taskDetailsModal.classList.add('visible');
        const taskDate = task.startAt ? task.startAt.toDate() : new Date();
        
        elements.taskIdEl.value = task.id || '';
        elements.taskTitleEl.value = task.title || '';
        elements.taskDateEl.value = taskDate.toISOString().split('T')[0];
        elements.taskTimeEl.value = task.hasTime ? taskDate.toTimeString().substring(0, 5) : '';
        elements.taskDescriptionEl.value = task.description || '';
        
        subtasks = task.subtasks ? [...task.subtasks] : [];
        renderSubtasks();
        
        renderTaskAssignments(task.assignedTo || []);
        if (task.id) {
            listenForComments(task.id);
        } else {
            elements.taskCommentsList.innerHTML = '<p class="empty-state">Save the task to add comments.</p>';
        }

        selectedColor = task.color || TASK_COLORS[0];
        elements.taskColorsContainer.querySelectorAll('.color-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.color === selectedColor);
        });
        elements.deleteTaskBtn.style.display = task.id ? 'block' : 'none';
    }

    function openDayDetailsModal(dateStr) {
        const date = new Date(`${dateStr}T00:00:00`);
        elements.dayDetailsTitleEl.textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        const dayTasks = tasks
            .filter(task => task.startAt && task.startAt.toDate().toDateString() === date.toDateString())
            .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());

        elements.dayDetailsListEl.innerHTML = dayTasks.map(task => `
            <div class="task" data-task-id="${task.id}" style="background-color: ${task.color || '#718096'}">
                ${task.hasTime ? `<span class="task-time">${formatTime(task.startAt.toDate())}</span>` : ''}
                ${task.title}
            </div>`).join('');
        elements.dayDetailsModal.classList.add('visible');
    }

    function openQuickAddPopover(dayElement) {
        const rect = dayElement.getBoundingClientRect();
        elements.quickAddPopover.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
        elements.quickAddPopover.style.top = `${rect.bottom + 5}px`;
        elements.quickAddPopover.classList.add('visible');
        elements.quickAddTitleEl.value = '';
        elements.quickAddTitleEl.focus();
        elements.quickAddPopover.dataset.date = dayElement.dataset.date;
    }

    // --- 9. Core Logic & Handlers ---
    async function handleQuickAddSave(e) {
        e.stopPropagation();
        setButtonLoading(elements.quickAddSaveBtn, true, "Save");
        const text = elements.quickAddTitleEl.value.trim();
        const date = elements.quickAddPopover.dataset.date;
        if (!text || !date) {
            setButtonLoading(elements.quickAddSaveBtn, false, "Save");
            return;
        }
        
        const parsed = parseQuickAddText(text, date);
        await saveTask({
            title: parsed.title,
            startAt: firebase.firestore.Timestamp.fromDate(parsed.date),
            hasTime: parsed.hasTime,
            color: selectedColor,
            subtasks: [],
            assignedTo: [currentUser.uid]
        });
        setButtonLoading(elements.quickAddSaveBtn, false, "Save");
        elements.quickAddPopover.classList.remove('visible');
    }

    async function handleSaveTask() {
        setButtonLoading(elements.saveTaskBtn, true, "Save Task");
        const date = elements.taskDateEl.value;
        const time = elements.taskTimeEl.value;
        if (!elements.taskTitleEl.value.trim() || !date) {
            setButtonLoading(elements.saveTaskBtn, false, "Save Task");
            return alert('Title and Date are required.');
        }
        
        const dateTime = new Date(`${date}T${time || '00:00:00'}`);
        const originalTask = tasks.find(t => t.id === elements.taskIdEl.value);

        await saveTask({
            id: elements.taskIdEl.value,
            title: elements.taskTitleEl.value.trim(),
            startAt: firebase.firestore.Timestamp.fromDate(dateTime),
            hasTime: !!time,
            description: elements.taskDescriptionEl.value.trim(),
            color: selectedColor,
            subtasks: subtasks,
            assignedTo: originalTask?.assignedTo || [currentUser.uid]
        });
        setButtonLoading(elements.saveTaskBtn, false, "Save Task");
        elements.taskDetailsModal.classList.remove('visible');
    }

    async function handleDeleteTask() {
        const id = elements.taskIdEl.value;
        if (id && confirm('Are you sure you want to delete this task?')) {
            await db.collection('tasks').doc(id).delete();
            elements.taskDetailsModal.classList.remove('visible');
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

    // --- 10. Helper Functions ---
    function initializeDragAndDrop() {
        document.querySelectorAll('.tasks-container').forEach(container => {
            new Sortable(container, {
                group: 'tasks',
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: async (evt) => {
                    const { item, to } = evt;
                    const taskId = item.dataset.taskId;
                    const newDayElement = to.closest('.calendar-day');
                    if (!taskId || !newDayElement) return;
                    
                    const newDateStr = newDayElement.dataset.date;
                    const originalTask = tasks.find(t => t.id === taskId);
                    
                    if (originalTask) {
                        const originalDate = originalTask.startAt.toDate();
                        const newDate = new Date(`${newDateStr}T${originalDate.toTimeString().split(' ')[0]}`);
                        await db.collection('tasks').doc(taskId).update({ startAt: firebase.firestore.Timestamp.fromDate(newDate) });
                    }
                }
            });
        });
    }
    
    function parseQuickAddText(text, referenceDateStr) {
        let date = new Date(`${referenceDateStr}T09:00:00`);
        let title = text;
        let hasTime = false;
        
        const timeRegex = /\b(\d{1,2}(:\d{2})?)\s*(am|pm)?\b/i;
        const timeMatch = text.match(timeRegex);

        if (timeMatch) {
            let [ , time, , ampm ] = timeMatch;
            let [hours, minutes] = time.split(':');
            hours = parseInt(hours, 10);
            minutes = parseInt(minutes || '0', 10);
            
            if (ampm && hours < 12 && ampm.toLowerCase() === 'pm') hours += 12;
            if (ampm && hours === 12 && ampm.toLowerCase() === 'am') hours = 0;
            
            date.setHours(hours, minutes, 0, 0);
            hasTime = true;
            title = title.replace(timeMatch[0], '').trim();
        }

        if (/\btomorrow\b/i.test(title)) {
            const refDate = new Date(`${referenceDateStr}T00:00:00`);
            date.setDate(refDate.getDate() + 1);
            title = title.replace(/\btomorrow\b/i, '').trim();
        }
        return { title: title || 'New Task', date, hasTime };
    }

    function setButtonLoading(button, isLoading, defaultText) {
        button.disabled = isLoading;
        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.textContent = 'Saving...';
        } else {
            button.textContent = button.dataset.originalText || defaultText;
        }
    }

    function formatTime(date) {
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    
    function renderColorSelector() {
        elements.taskColorsContainer.innerHTML = TASK_COLORS.map(color => `<div class="color-option" data-color="${color}" style="background-color: ${color};"></div>`).join('');
    }

    // --- Initialize App ---
    renderColorSelector();
    setupEventListeners();
});
