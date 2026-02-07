import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
    signInWithEmailAndPassword,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig, 'donor-auth');
const auth = getAuth(app);

const authMessage = document.getElementById('authMessage');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabs = document.querySelectorAll('.auth-tab');
const tabSwitchers = document.querySelectorAll('[data-tab-switch]');
const anonLoginBtn = document.getElementById('anonLoginBtn');

const authErrorMap = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Your password should be at least 6 characters.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/user-not-found': 'No account found for that email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.'
};

const showMessage = (message, variant = 'error') => {
    if (!authMessage) {
        return;
    }

    if (!message) {
        authMessage.style.display = 'none';
        authMessage.textContent = '';
        return;
    }

    authMessage.textContent = message;
    authMessage.style.display = 'block';

    if (variant === 'success') {
        authMessage.style.background = 'rgba(34, 197, 94, 0.15)';
        authMessage.style.color = '#15803d';
    } else if (variant === 'info') {
        authMessage.style.background = 'rgba(59, 130, 246, 0.12)';
        authMessage.style.color = '#1d4ed8';
    } else {
        authMessage.style.background = 'rgba(248, 113, 113, 0.12)';
        authMessage.style.color = '#b91c1c';
    }
};

const setButtonState = (button, isLoading, loadingText) => {
    if (!button) {
        return;
    }

    if (isLoading) {
        button.dataset.defaultText = button.textContent;
        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent = button.dataset.defaultText || button.textContent;
        button.disabled = false;
    }
};

const setActiveTab = (tabName) => {
    tabs.forEach((tab) => {
        const isActive = tab.dataset.tab === tabName;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive.toString());
    });

    if (loginForm) {
        loginForm.style.display = tabName === 'login' ? 'grid' : 'none';
    }

    if (registerForm) {
        registerForm.style.display = tabName === 'register' ? 'grid' : 'none';
    }

    showMessage('');
};

const redirectToDashboard = () => {
    window.location.href = 'donor-mapview.html';
};

const storeDisplayName = (name) => {
    if (name) {
        localStorage.setItem('donorDisplayName', name);
    }
};

tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
});

tabSwitchers.forEach((switcher) => {
    switcher.addEventListener('click', () => setActiveTab(switcher.dataset.tabSwitch));
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        storeDisplayName(user.displayName || 'Donor');
        redirectToDashboard();
    }
});

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage('');

        const submitButton = loginForm.querySelector('button[type="submit"]');
        setButtonState(submitButton, true, 'Signing in...');

        try {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            await signInWithEmailAndPassword(auth, email, password);
            storeDisplayName(auth.currentUser?.displayName || 'Donor');
            redirectToDashboard();
        } catch (error) {
            showMessage(authErrorMap[error.code] || 'Unable to login. Please try again.');
        } finally {
            setButtonState(submitButton, false, 'Login');
        }
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage('');

        const submitButton = registerForm.querySelector('button[type="submit"]');
        setButtonState(submitButton, true, 'Creating account...');

        try {
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;

            if (password !== confirmPassword) {
                showMessage('Passwords do not match.');
                setButtonState(submitButton, false, 'Create Account');
                return;
            }

            await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(auth.currentUser, { displayName: name });
            storeDisplayName(name);
            redirectToDashboard();
        } catch (error) {
            showMessage(authErrorMap[error.code] || 'Unable to create account. Please try again.');
        } finally {
            setButtonState(submitButton, false, 'Create Account');
        }
    });
}

if (anonLoginBtn) {
    anonLoginBtn.addEventListener('click', async () => {
        showMessage('');
        setButtonState(anonLoginBtn, true, 'Signing in...');

        try {
            await signInAnonymously(auth);
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: 'Anonymous Donor' });
                storeDisplayName('Anonymous Donor');
            }
            redirectToDashboard();
        } catch (error) {
            showMessage('Anonymous login failed. Please try again.');
        } finally {
            setButtonState(anonLoginBtn, false, 'Continue as Anonymous Donor');
        }
    });
}
