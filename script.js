window.onload = () => {
    if (typeof firebase === 'undefined') { return alert("FATAL: Firebase SDK not loaded."); }
    startApp();
};

function startApp() {
    // --- Firebase & App Initialization ---
    const firebaseConfig = { /* ... your config ... */ };
    firebase.initializeApp(firebaseConfig);
    firebase.firestore().enablePersistence().catch(err => console.error("Firestore persistence error: ", err));
    
    const auth = firebase.auth();
    const db = firebase.firestore();
    // ... all other const declarations for providers and DOM elements ...
    const quickAddPopover = document.getElementById('quick-add-popover');
    const dayDetailsModal = document.getElementById('day-details-modal');
    
    // --- Global State ---
    let currentDate = new Date();
    let currentUser = null;
    let tasks = [];
    let subtasks = [];
    let selectedColor = '#718096';
    const TASK_COLORS = ['#718096', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

    // --- 1. Routing ---
    function handleRouting() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const [year, month] = hash.split('-').map(Number);
            if (!isNaN(year) && !isNaN(month)) {
                currentDate = new Date(year, month - 1, 1);
            }
        }
    }
    function updateHash() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        window.location.hash = `${year}-${month}`;
    }
    window.addEventListener('hashchange', handleRouting);
    handleRouting(); // Initial check on load

    // --- 2. Authentication ---
    auth.onAuthStateChanged(user => {
        // ... same as before ...
    });
    // ... all auth event listeners ...

    // --- 3. Calendar Rendering (Now with "+X more") ---
    const renderCalendar = () => {
        // ... date calculation logic is the same ...
        const MAX_TASKS_VISIBLE = 2;

        for (let i = 1; i <= lastDay; i++) {
            // ... dayDate and dayString logic is the same ...
            const dayTasks = tasks
                .filter(task => task.startAt.toDate().toDateString() === dayDate.toDateString())
                .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());

            let tasksHtml = dayTasks.slice(0, MAX_TASKS_VISIBLE).map(task => `
                <div class="task" data-task-id="${task.id}" style="background-color: ${task.color || '#718096'}">
                    <span class="task-time">${formatTime(task.startAt.toDate())}</span>
                    ${task.title}
                </div>`).join('');

            if (dayTasks.length > MAX_TASKS_VISIBLE) {
                tasksHtml += `<div class="more-tasks-indicator" data-date="${dayString}">+${dayTasks.length - MAX_TASKS_VISIBLE} more</div>`;
            }
            
            // ... the rest of the daysHtml assembly is the same ...
        }
        // ... final calendarEl.innerHTML and next/prev month logic ...
        initializeDragAndDrop(); // IMPORTANT: Re-initialize D&D after every render
    };
    
    // --- 4. Drag and Drop ---
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

    // --- 5. Task Management (Now with Contextual Popover & Subtasks) ---
    calendarEl.addEventListener('click', (e) => {
        if (e.target.closest('.task')) {
            // ... edit task logic (unchanged) ...
        } else if (e.target.closest('.more-tasks-indicator')) {
            const date = e.target.closest('.more-tasks-indicator').dataset.date;
            openDayDetailsModal(date);
        } else if (e.target.closest('.calendar-day:not(.other-month)')) {
            const dayElement = e.target.closest('.calendar-day');
            openQuickAddPopover(dayElement);
        }
    });

    // Popover Logic
    function openQuickAddPopover(dayElement) {
        const rect = dayElement.getBoundingClientRect();
        quickAddPopover.style.left = `${rect.left}px`;
        quickAddPopover.style.top = `${rect.bottom + 5}px`;
        quickAddPopover.classList.add('visible');
        quickAddTitleEl.value = '';
        quickAddTitleEl.focus();
        quickAddPopover.dataset.date = dayElement.dataset.date;
    }

    // NLP for Quick Add
    quickAddSaveBtn.addEventListener('click', async () => {
        const text = quickAddTitleEl.value.trim();
        const date = quickAddPopover.dataset.date;
        if (!text || !date) return;
        
        const parsed = parseQuickAddText(text, date);
        await saveTask({
            title: parsed.title,
            startAt: firebase.firestore.Timestamp.fromDate(parsed.date),
            color: selectedColor,
            subtasks: []
        });
        quickAddPopover.classList.remove('visible');
    });

    // Subtask Logic in Full Modal
    const addSubtaskInput = document.getElementById('add-subtask-input');
    addSubtaskInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            subtasks.push({ text: e.target.value.trim(), completed: false });
            renderSubtasks();
            e.target.value = '';
        }
    });

    function renderSubtasks() {
        // ... function to render the subtasks array into the #subtasks-list div ...
    }

    // Full save function now handles subtasks and startAt timestamp
    async function saveTask(taskData) {
        const { id, ...dataToSave } = taskData;
        dataToSave.lastEditedBy = currentUser.uid;
        // Make sure subtasks are included
        dataToSave.subtasks = subtasks; 
        
        if (id) {
            await db.collection('tasks').doc(id).update(dataToSave);
        } else {
            // ... add logic ...
        }
    }
    
    // --- 6. Helper Functions ---
    function parseQuickAddText(text, referenceDate) {
        // Basic NLP for time and relative dates
        let date = new Date(`${referenceDate}T00:00:00`);
        let title = text;

        // Example: match "at 5pm", "at 10:30", "at 7"
        const timeMatch = text.match(/at (\d{1,2}(:\d{2})?)\s*(am|pm)?/i);
        if (timeMatch) {
            // ... logic to parse the time and set it on the date object ...
            title = title.replace(timeMatch[0], '').trim();
        }

        // Example: match "tomorrow"
        if (text.toLowerCase().includes('tomorrow')) {
            date.setDate(date.getDate() + 1);
            title = title.replace(/tomorrow/i, '').trim();
        }

        return { title, date };
    }

    // ... All other helpers like formatTime, setButtonLoading, etc. ...

    // Initial Render
    renderCalendar();
}
