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

    const calendar = document.getElementById('calendar');
    const currentMonthEl = document.getElementById('current-month');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    const taskModal = document.getElementById('task-modal');
    const closeModal = document.querySelector('.close-button');
    const saveTaskBtn = document.getElementById('save-task');
    const deleteTaskBtn = document.getElementById('delete-task');
    const taskTitle = document.getElementById('task-title');
    const taskDescription = document.getElementById('task-description');
    const taskDate = document.getElementById('task-date');
    const taskId = document.getElementById('task-id');
    
    const taskList = document.getElementById('task-list');
    const logList = document.getElementById('log-list');
    const chatBox = document.getElementById('chat-box');
    const chatMessage = document.getElementById('chat-message');
    const sendMessageBtn = document.getElementById('send-message');

    let currentDate = new Date();
    let currentUser = null;

    // --- Authentication ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loginContainer.classList.remove('active');
            appContainer.classList.add('active');
            userPhoto.src = user.photoURL;
            userName.textContent = user.displayName;
            renderCalendar();
            listenForTasks();
            listenForLogs();
            listenForChat();
        } else {
            currentUser = null;
            loginContainer.classList.add('active');
            appContainer.classList.remove('active');
        }
    });

    loginGoogle.addEventListener('click', () => auth.signInWithPopup(googleProvider));
