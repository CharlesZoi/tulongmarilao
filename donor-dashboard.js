import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
    signOut,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    onSnapshot,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { firebaseChatConfig } from './firebase-chat-config.js';

const app = initializeApp(firebaseConfig, 'donor-auth');
const auth = getAuth(app);
const db = getFirestore(app);

window.firebaseApp = app;
window.firestoreDb = db;
window.firebaseAuth = auth;
window.isDonorMap = true;

try {
    const chatApp = initializeApp(firebaseChatConfig, 'donor-chat');
    const chatDb = getFirestore(chatApp);
    const chatAuth = getAuth(chatApp);

    window.firebaseChatApp = chatApp;
    window.firestoreChatDb = chatDb;
    window.firebaseChatAuth = chatAuth;
} catch (error) {
    console.warn('Chat Firebase initialization failed:', error);
}

const authActions = document.getElementById('donorAuthActions');
const sessionActions = document.getElementById('donorSessionActions');
const donorNameBadge = document.getElementById('donorNameBadge');
const loginBtn = document.getElementById('donorLoginBtn');
const anonymousBtn = document.getElementById('donorAnonymousBtn');
const logoutBtn = document.getElementById('donorLogoutBtn');
const mapStatusLabel = document.getElementById('mapStatusLabel');
const mapCountLabel = document.getElementById('mapCountLabel');
const unreachedList = document.getElementById('unreachedList');
const claimsList = document.getElementById('claimsList');
const unreachedSearch = document.getElementById('unreachedSearch');
const unreachedFilter = document.getElementById('unreachedFilter');
const claimsSearch = document.getElementById('claimsSearch');
const claimsFilter = document.getElementById('claimsFilter');

const panelTabs = document.querySelectorAll('.panel-tab');
const panelSections = document.querySelectorAll('.panel-section');

const donationModal = document.getElementById('donationModal');
const openDonationModalBtn = document.getElementById('openDonationModal');
const closeDonationModalBtn = document.getElementById('closeDonationModal');
const donationForm = document.getElementById('donationForm');
const donationItems = document.getElementById('donationItems');
const addDonationItemBtn = document.getElementById('addDonationItem');
const donationPhotos = document.getElementById('donationPhotos');
const photoPreview = document.getElementById('photoPreview');

const DISPLAY_NAME_KEY = 'donorDisplayName';
const ANONYMOUS_NAME = 'Anonymous';
const SUPPORTER_NAME_KEY = 'donorTeamName';
const RELIEF_COLLECTION = 'relief-locations';
let currentDonorId = null;
let currentDonorName = null;

if (mapStatusLabel) {
    mapStatusLabel.textContent = 'Map ready for unreached locations.';
}

if (mapCountLabel) {
    mapCountLabel.textContent = '0 locations loaded';
}

const setActivePanel = (panelName) => {
    panelTabs.forEach((tab) => {
        const isActive = tab.dataset.panel === panelName;
        tab.classList.toggle('is-active', isActive);
    });

    panelSections.forEach((section) => {
        const isActive = section.dataset.panelContent === panelName;
        section.classList.toggle('is-active', isActive);
    });
};

panelTabs.forEach((tab) => {
    tab.addEventListener('click', () => setActivePanel(tab.dataset.panel));
});

const toggleModal = (show) => {
    if (!donationModal) {
        return;
    }
    donationModal.classList.toggle('is-visible', show);
    donationModal.setAttribute('aria-hidden', (!show).toString());
};

if (openDonationModalBtn) {
    openDonationModalBtn.addEventListener('click', () => toggleModal(true));
}

if (closeDonationModalBtn) {
    closeDonationModalBtn.addEventListener('click', () => toggleModal(false));
}

if (donationModal) {
    donationModal.addEventListener('click', (event) => {
        if (event.target === donationModal) {
            toggleModal(false);
        }
    });
}

if (addDonationItemBtn && donationItems) {
    addDonationItemBtn.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'donation-item-row';
        row.innerHTML = `
            <input type="text" placeholder="Item name" required>
            <input type="number" placeholder="Quantity" min="0" required>
            <input type="text" placeholder="Unit (packs, boxes)" required>
        `;
        donationItems.appendChild(row);
    });
}

if (donationPhotos && photoPreview) {
    donationPhotos.addEventListener('change', () => {
        photoPreview.innerHTML = '';
        Array.from(donationPhotos.files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = document.createElement('img');
                img.src = reader.result;
                img.alt = file.name;
                photoPreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

if (donationForm) {
    donationForm.addEventListener('submit', (event) => {
        event.preventDefault();
        window.alert('Donation log submission will be enabled after data integration.');
    });
}

const setAuthView = (isAuthenticated) => {
    if (authActions) {
        authActions.hidden = isAuthenticated;
    }
    if (sessionActions) {
        sessionActions.hidden = !isAuthenticated;
    }
};

const setDonorBadge = (name) => {
    if (donorNameBadge) {
        donorNameBadge.textContent = `Signed in as ${name}`;
    }
};

const storeDisplayName = (name) => {
    if (name) {
        localStorage.setItem(DISPLAY_NAME_KEY, name);
    }
};

const resolveDisplayName = (user) => {
    if (!user) {
        return 'Donor';
    }

    if (user.displayName) {
        return user.displayName;
    }

    if (user.isAnonymous) {
        return ANONYMOUS_NAME;
    }

    return localStorage.getItem(DISPLAY_NAME_KEY) || 'Donor';
};

const ensureAnonymousProfile = async () => {
    if (auth.currentUser && auth.currentUser.isAnonymous && !auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: ANONYMOUS_NAME });
    }
    storeDisplayName(ANONYMOUS_NAME);
};

onAuthStateChanged(auth, (user) => {
    if (!user) {
        setAuthView(false);
        return;
    }

    const displayName = resolveDisplayName(user);
    setDonorBadge(displayName);
    setAuthView(true);
    storeDisplayName(displayName);
});

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        window.location.href = 'donor-panel.html';
    });
}

if (anonymousBtn) {
    anonymousBtn.addEventListener('click', async () => {
        anonymousBtn.disabled = true;
        anonymousBtn.textContent = 'Signing in...';
        try {
            await signInAnonymously(auth);
            await ensureAnonymousProfile();
        } catch (error) {
            window.alert('Anonymous sign-in failed. Please try again.');
        } finally {
            anonymousBtn.disabled = false;
            anonymousBtn.innerHTML = '<i class="fas fa-user-secret"></i> Donate as anonymous';
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        localStorage.removeItem(DISPLAY_NAME_KEY);
        setAuthView(false);
    });
}
