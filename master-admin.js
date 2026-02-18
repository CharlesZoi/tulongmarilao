// Master Admin Panel JavaScript
// Handles authentication and pin management with full deletion privileges
let db = null;
let auth = null;
let currentUser = null;
let allLocations = [];
let filteredLocations = [];
let currentDeleteId = null;
let lastImportedIds = []; // Track IDs of last imported locations for undo
let selectedLocationForDeletion = null;
let selectedLocationForDetails = null;
let selectedLocationForEdit = null;
let unsubscribeListener = null; // Firestore listener unsubscribe function
let donationLogs = [];
let selectedDonationLog = null;
let donationLogsUnsubscribe = null;
let filteredSupportedLocations = [];
let activeRowActionsMenuId = null;

// Security instances
let rateLimiter = null;
let sessionManager = null;

// Initialize admin when DOM is loaded
document.addEventListener('DOMContentLoaded', initAdmin);

// Wait for Firebase to load
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;

        const checkFirebase = setInterval(() => {
            attempts++;
            if (window.firestoreDb && window.firebaseAuth) {
                clearInterval(checkFirebase);
                db = window.firestoreDb;
                auth = window.firebaseAuth;
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkFirebase);
                reject(new Error('Firebase failed to load'));
            }
        }, 100);
    });
}

async function initAdmin() {
    try {
        await waitForFirebase();
        console.log('Firebase loaded successfully');

        // Initialize security modules
        if (window.SecurityModule) {
            rateLimiter = new window.SecurityModule.LoginRateLimiter();
            sessionManager = new window.SecurityModule.SessionManager();
            console.log('Security modules initialized');
        }

        // Check authentication state
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Verify if user is a master admin
                const masterAdminEmails = ['louisejane1007@gmail.com'];
                if (!masterAdminEmails.includes(user.email.toLowerCase())) {
                    // Not a master admin - sign out and redirect
                    console.log('Access denied: User is not a master admin');
                    await auth.signOut();

                    // Show error message on login screen
                    showLoginScreen();
                    const errorDiv = document.getElementById('loginError');
                    if (errorDiv) {
                        errorDiv.textContent = '🔒 Access Denied. This panel is restricted to master administrators only. Your account has been signed out.';
                        errorDiv.style.display = 'block';
                        errorDiv.style.background = '#f8d7da';
                        errorDiv.style.borderLeft = '4px solid #dc3545';
                        errorDiv.style.padding = '1rem';
                    }
                    return;
                }

                currentUser = user;
                showDashboard();
                await loadAllLocations();
                await loadDonationLogs();

                // Start session monitoring
                if (sessionManager) {
                    sessionManager.startMonitoring(
                        () => handleSessionTimeout(),
                        (minutes) => showSessionWarning(minutes)
                    );
                }
            } else {
                showLoginScreen();
                if (sessionManager) {
                    sessionManager.stopMonitoring();
                }
            }
        });

        setupEventListeners();
    } catch (error) {
        console.error('Failed to initialize admin panel:', error);
        showError('Failed to initialize. Please refresh the page.');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Search
    document.getElementById('searchPins').addEventListener('input', handleSearch);

    // Filters
    document.getElementById('urgencyFilter').addEventListener('change', applyFilters);
    document.getElementById('reachedFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);

    const donationSearchInput = document.getElementById('donationSearch');
    if (donationSearchInput) {
        donationSearchInput.addEventListener('input', renderDonationLogs);
    }

    const donationDeliveryFilter = document.getElementById('donationDeliveryFilter');
    if (donationDeliveryFilter) {
        donationDeliveryFilter.addEventListener('change', renderDonationLogs);
    }

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        const btn = document.getElementById('refreshBtn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        btn.disabled = true;

        await loadAllLocations();

        btn.innerHTML = originalHTML;
        btn.disabled = false;
    });

    const showPinsBtn = document.getElementById('showPinsBtn');
    if (showPinsBtn) {
        showPinsBtn.addEventListener('click', () => setActiveSection('pins'));
    }

    const showSupportedLocationsBtn = document.getElementById('showSupportedLocationsBtn');
    if (showSupportedLocationsBtn) {
        showSupportedLocationsBtn.addEventListener('click', () => setActiveSection('supported'));
    }

    const showDonationLogsBtn = document.getElementById('showDonationLogsBtn');
    if (showDonationLogsBtn) {
        showDonationLogsBtn.addEventListener('click', () => setActiveSection('donationLogs'));
    }

    const supportedSearchInput = document.getElementById('supportedSearch');
    if (supportedSearchInput) {
        supportedSearchInput.addEventListener('input', renderSupportedLocationsTable);
    }

    const supportedStatusFilter = document.getElementById('supportedStatusFilter');
    if (supportedStatusFilter) {
        supportedStatusFilter.addEventListener('change', renderSupportedLocationsTable);
    }

    const supportedUrgencyFilter = document.getElementById('supportedUrgencyFilter');
    if (supportedUrgencyFilter) {
        supportedUrgencyFilter.addEventListener('change', renderSupportedLocationsTable);
    }

    const refreshSupportedLocationsBtn = document.getElementById('refreshSupportedLocations');
    if (refreshSupportedLocationsBtn) {
        refreshSupportedLocationsBtn.addEventListener('click', renderSupportedLocationsTable);
    }

    const refreshDonationBtn = document.getElementById('refreshDonationLogs');
    if (refreshDonationBtn) {
        refreshDonationBtn.addEventListener('click', async () => {
            const originalHTML = refreshDonationBtn.innerHTML;
            refreshDonationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshDonationBtn.disabled = true;

            const donationBody = document.getElementById('donationLogsBody');
            if (donationBody) {
                donationBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="loading-row">
                            <i class="fas fa-spinner fa-spin"></i> Loading donation logs...
                        </td>
                    </tr>
                `;
            }

            await loadDonationLogs();

            refreshDonationBtn.innerHTML = originalHTML;
            refreshDonationBtn.disabled = false;
        });
    }

    // Download Excel button
    document.getElementById('downloadExcelBtn').addEventListener('click', downloadExcel);

    // Import Excel button
    document.getElementById('importExcelBtn').addEventListener('click', () => {
        document.getElementById('excelFileInput').click();
    });

    // Excel file input
    document.getElementById('excelFileInput').addEventListener('change', handleExcelImport);

    // Undo import button
    document.getElementById('undoImportBtn').addEventListener('click', handleUndoImport);

    // Delete modal
    document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDelete').addEventListener('click', handleDeleteConfirm);

    // Details modal
    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);
    document.getElementById('closeDetailsBtn').addEventListener('click', closeDetailsModal);
    document.getElementById('viewOnMapBtn').addEventListener('click', viewOnMap);

    // Edit modal
    const closeEditLocationModalBtn = document.getElementById('closeEditLocationModal');
    if (closeEditLocationModalBtn) {
        closeEditLocationModalBtn.addEventListener('click', closeEditLocationModal);
    }
    const cancelEditLocationBtn = document.getElementById('cancelEditLocation');
    if (cancelEditLocationBtn) {
        cancelEditLocationBtn.addEventListener('click', closeEditLocationModal);
    }
    const saveEditLocationBtn = document.getElementById('saveEditLocation');
    if (saveEditLocationBtn) {
        saveEditLocationBtn.addEventListener('click', saveEditLocation);
    }

    const closeDonationModalBtn = document.getElementById('closeDonationLogModal');
    if (closeDonationModalBtn) {
        closeDonationModalBtn.addEventListener('click', closeDonationLogModal);
    }
    const approveDonationBtn = document.getElementById('approveDonationLog');
    if (approveDonationBtn) {
        approveDonationBtn.addEventListener('click', handleDonationLogApprove);
    }
    const rejectDonationBtn = document.getElementById('rejectDonationLog');
    if (rejectDonationBtn) {
        rejectDonationBtn.addEventListener('click', handleDonationLogReject);
    }
    const undoDonationBtn = document.getElementById('undoDonationLogDecision');
    if (undoDonationBtn) {
        undoDonationBtn.addEventListener('click', handleDonationLogUndo);
    }

    // Help modal
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
        helpBtn.addEventListener('click', openHelpModal);
    }
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', closeHelpModal);
    }

    // Close modals on outside click
    document.getElementById('deleteModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });
    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') closeDetailsModal();
    });
    const editLocationModal = document.getElementById('editLocationModal');
    if (editLocationModal) {
        editLocationModal.addEventListener('click', (e) => {
            if (e.target.id === 'editLocationModal') closeEditLocationModal();
        });
    }
    const donationLogModal = document.getElementById('donationLogModal');
    if (donationLogModal) {
        donationLogModal.addEventListener('click', (e) => {
            if (e.target.id === 'donationLogModal') closeDonationLogModal();
        });
    }
    document.getElementById('helpModal').addEventListener('click', (e) => {
        if (e.target.id === 'helpModal') closeHelpModal();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.row-actions-menu')) {
            closeAllRowActionMenus();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllRowActionMenus();
        }
    });
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    // Clear previous errors
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Security: Check if account is locked out
    if (rateLimiter) {
        const lockoutStatus = rateLimiter.isLockedOut(email);
        if (lockoutStatus.locked) {
            errorDiv.textContent = `🔒 Account temporarily locked due to too many failed attempts. Please try again in ${lockoutStatus.remainingMinutes} minute(s).`;
            errorDiv.style.display = 'block';
            return;
        }
    }

    // Security: Validate email format
    if (window.SecurityModule) {
        const emailValidation = window.SecurityModule.EmailValidator.validate(email);
        if (!emailValidation.isValid) {
            errorDiv.textContent = emailValidation.error;
            errorDiv.style.display = 'block';
            return;
        }
    }

    try {
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;

        await signInWithEmailAndPassword(auth, email, password);

        // Check if user is a master admin
        const masterAdminEmails = ['louisejane1007@gmail.com'];
        if (!masterAdminEmails.includes(email.toLowerCase())) {
            // Not a master admin - sign out and show error
            await auth.signOut();
            errorDiv.textContent = '🔒 Access Denied. This panel is only for master administrators. Please use the regular admin panel.';
            errorDiv.style.display = 'block';
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            submitBtn.disabled = false;
            return;
        }

        // Success - clear failed attempts
        if (rateLimiter) {
            rateLimiter.clearAttempts(email);
        }
        console.log('✅ Master admin login successful');

    } catch (error) {
        console.error('❌ Login error:', error);

        // Security: Record failed attempt
        if (rateLimiter) {
            const result = rateLimiter.recordFailedAttempt(email);
            if (result.shouldLockout) {
                errorDiv.textContent = `🔒 Too many failed attempts. Account locked for 15 minutes.`;
                errorDiv.style.display = 'block';
                const submitBtn = e.target.querySelector('button[type="submit"]');
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
                submitBtn.disabled = false;
                return;
            } else if (result.remainingAttempts <= 2) {
                console.warn(`⚠️ ${result.remainingAttempts} attempts remaining before lockout`);
            }
        }

        // Reset button
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        submitBtn.disabled = false;

        // Show error message
        let errorMessage = 'Login failed. Please check your credentials.';

        if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address format.';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No admin account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
            if (rateLimiter) {
                const remaining = rateLimiter.getRemainingAttempts(email);
                if (remaining <= 2) {
                    errorMessage += ` (${remaining} attempts remaining before lockout)`;
                }
            }
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid credentials. Please check your email and password.';
        }

        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
    }
}

// Handle logout
async function handleLogout() {
    try {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
        await signOut(auth);

        // Clean up
        if (unsubscribeListener) {
            unsubscribeListener();
            unsubscribeListener = null;
        }
        if (donationLogsUnsubscribe) {
            donationLogsUnsubscribe();
            donationLogsUnsubscribe = null;
        }

        currentUser = null;
        allLocations = [];
        filteredLocations = [];
        filteredSupportedLocations = [];
        donationLogs = [];
        selectedDonationLog = null;

        showLoginScreen();
        console.log('Logout successful');
    } catch (error) {
        console.error('Logout error:', error);
        showError('Failed to logout. Please try again.');
    }
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminDashboard').style.display = 'none';

    // Clear form
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';

    // Update user email display
    if (currentUser && currentUser.email) {
        document.getElementById('adminUserEmail').textContent = currentUser.email;

        // Master Admin Panel - Always has full privileges
        const isMasterAdmin = true;
        const viewMapBtn = document.getElementById('viewMapBtn');
        const mapBtnText = document.getElementById('mapBtnText');
        const mapAccessText = document.getElementById('mapAccessText');
        const adminPanelTitle = document.getElementById('adminPanelTitle');
        const adminPanelSubtitle = document.getElementById('adminPanelSubtitle');
        const adminPanelIcon = document.getElementById('adminPanelIcon');

        if (isMasterAdmin) {
            // Master admin sees public map with enhanced privileges
            if (viewMapBtn) {
                viewMapBtn.href = 'admin-map.html';
                viewMapBtn.title = 'View admin map with master admin privileges';
            }
            if (mapBtnText) mapBtnText.textContent = 'Admin Map';

            // Master admin panel title - already set in HTML
            if (adminPanelTitle) adminPanelTitle.textContent = 'Master Admin Panel';
            if (adminPanelSubtitle) adminPanelSubtitle.textContent = 'Full Relief Map Management';
            if (adminPanelIcon) adminPanelIcon.className = 'fas fa-crown';

            // Update info text - already set in HTML but update if element exists
            if (mapAccessText) {
                mapAccessText.innerHTML = `
                    <strong style="color: #ffd700;">Master Admin Access</strong>
                    <p style="margin: 0.25rem 0 0 0; color: #333; font-size: 0.9rem;">
                        Click <strong>"Admin Map"</strong> to access the admin map with master admin delete capabilities.
                        You can delete any pin and manage all locations.
                    </p>
                `;
            }
        } else {
            // Regular users see public map link
            viewMapBtn.href = 'index.html';
            viewMapBtn.title = 'View public map (read-only)';
            mapBtnText.textContent = 'View Map';

            // Regular user admin panel title
            if (adminPanelTitle) adminPanelTitle.textContent = 'User Admin Dashboard';
            if (adminPanelSubtitle) adminPanelSubtitle.textContent = 'Relief Map Coordination';
            if (adminPanelIcon) adminPanelIcon.className = 'fas fa-th-large';

            // Update info text
            if (mapAccessText) {
                mapAccessText.innerHTML = `
                    <strong style="color: #0066cc;">User Admin Access</strong>
                    <p style="margin: 0.25rem 0 0 0; color: #333; font-size: 0.9rem;">
                        Click <strong>"View Map"</strong> to access the public map. 
                        You can view and add pins, but cannot delete them. Use the Supported Locations tab to mark locations as reached.
                    </p>
                `;
            }
        }
    }

    setActiveSection('pins');
}

function setActiveSection(section) {
    const pinsSection = document.getElementById('pinsSection');
    const supportedSection = document.getElementById('supportedSection');
    const donationLogsSection = document.getElementById('donationLogsSection');
    const showPinsBtn = document.getElementById('showPinsBtn');
    const showSupportedLocationsBtn = document.getElementById('showSupportedLocationsBtn');
    const showDonationLogsBtn = document.getElementById('showDonationLogsBtn');

    if (!pinsSection || !supportedSection || !donationLogsSection || !showPinsBtn || !showSupportedLocationsBtn || !showDonationLogsBtn) {
        return;
    }

    closeAllRowActionMenus();

    const isPins = section === 'pins';
    const isSupported = section === 'supported';
    const isDonationLogs = section === 'donationLogs';

    pinsSection.style.display = isPins ? 'block' : 'none';
    supportedSection.style.display = isSupported ? 'block' : 'none';
    donationLogsSection.style.display = isDonationLogs ? 'block' : 'none';

    showPinsBtn.classList.toggle('is-active', isPins);
    showSupportedLocationsBtn.classList.toggle('is-active', isSupported);
    showDonationLogsBtn.classList.toggle('is-active', isDonationLogs);
    showPinsBtn.setAttribute('aria-pressed', String(isPins));
    showSupportedLocationsBtn.setAttribute('aria-pressed', String(isSupported));
    showDonationLogsBtn.setAttribute('aria-pressed', String(isDonationLogs));

    if (isSupported) {
        renderSupportedLocationsTable();
    } else if (isDonationLogs) {
        renderDonationLogs();
    }
}

// Load locations from local storage
function loadLocationsFromLocalStorage() {
    try {
        const saved = localStorage.getItem('userReportedLocations');
        if (saved) {
            const localLocations = JSON.parse(saved);
            allLocations = Array.isArray(localLocations) ? localLocations : [];
            console.log(`Loaded ${allLocations.length} locations from local storage`);
            updateStats();
            applyFilters();
            renderSupportedLocationsTable();
            showSuccess('Using locally saved data (offline mode)');
            return true;
        }
    } catch (error) {
        console.error('Error loading from local storage:', error);
    }
    return false;
}

// Load all locations from Firestore with local fallback
async function loadAllLocations() {
    try {
        const { collection, onSnapshot, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        // First try to load from local storage for immediate display
        const hasLocalData = loadLocationsFromLocalStorage();

        // Set up real-time listener for Firestore
        if (unsubscribeListener) {
            unsubscribeListener();
        }

        const locationsQuery = query(collection(db, 'relief-locations'), orderBy('reportedAt', 'desc'));

        unsubscribeListener = onSnapshot(locationsQuery,
            (snapshot) => {
                allLocations = [];

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    data.firestoreId = doc.id;
                    allLocations.push(data);
                });

                console.log(`Loaded ${allLocations.length} locations from Firestore`);
                updateStats();
                applyFilters();
                renderSupportedLocationsTable();
                renderDonationLogs();

                // If we were using local data before, show a success message
                if (hasLocalData) {
                    showSuccess('Connected to server. Showing latest data.');
                }
            },
            (error) => {
                console.error('Error loading from Firestore:', error);

                // Only show error if we don't have local data to fall back to
                if (!hasLocalData) {
                    showError('Failed to load locations. Using local data if available.');
                    loadLocationsFromLocalStorage();
                }
            }
        );

    } catch (error) {
        console.error('Error setting up Firestore listener:', error);

        // Try to load from local storage if Firestore fails
        if (!loadLocationsFromLocalStorage()) {
            showError('Failed to load locations. Please check your connection and refresh the page.');
        }
    }
}

// Load donation logs from Firestore
async function loadDonationLogs() {
    const donationLogsBody = document.getElementById('donationLogsBody');
    const donationLogsEmpty = document.getElementById('donationLogsEmpty');

    if (!donationLogsBody || !donationLogsEmpty) {
        return;
    }

    try {
        const { collection, onSnapshot, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        if (donationLogsUnsubscribe) {
            donationLogsUnsubscribe();
        }

        const logsQuery = query(collection(db, 'donation-logs'), orderBy('submittedAt', 'desc'));

        donationLogsUnsubscribe = onSnapshot(
            logsQuery,
            (snapshot) => {
                donationLogs = [];

                snapshot.forEach((doc) => {
                    const data = doc.data() || {};
                    data.firestoreId = doc.id;
                    donationLogs.push(data);
                });

                renderDonationLogs();
                renderSupportedLocationsTable();
            },
            (error) => {
                console.error('Error loading donation logs:', error);
                donationLogs = [];
                renderDonationLogs();
                renderSupportedLocationsTable();
                showError('Failed to load donation logs. Please refresh the page.');
            }
        );
    } catch (error) {
        console.error('Error setting up donation log listener:', error);
        donationLogs = [];
        renderDonationLogs();
        renderSupportedLocationsTable();
        showError('Failed to load donation logs. Please check your connection and refresh.');
    }
}

// Render donation logs table
function renderDonationLogs() {
    const donationLogsBody = document.getElementById('donationLogsBody');
    const donationLogsEmpty = document.getElementById('donationLogsEmpty');

    if (!donationLogsBody || !donationLogsEmpty) {
        return;
    }

    if (!donationLogs.length) {
        donationLogsBody.innerHTML = '';
        donationLogsEmpty.style.display = 'flex';
        return;
    }

    const searchInput = document.getElementById('donationSearch');
    const deliveryFilter = document.getElementById('donationDeliveryFilter');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const deliveryFilterValue = deliveryFilter ? deliveryFilter.value : 'all';

    const filteredLogs = donationLogs
        .map((log) => ({
            log,
            deliveryStatus: getDonationDeliveryStatus(log)
        }))
        .filter(({ log, deliveryStatus }) => {
            const matchesSearch = !searchTerm || getDonationSearchText(log).includes(searchTerm);
            const matchesDelivery = deliveryFilterValue === 'all' ||
                (deliveryFilterValue === 'on-the-way' && deliveryStatus.status === 'on-the-way') ||
                (deliveryFilterValue === 'proof-submitted' && deliveryStatus.status === 'proof-submitted') ||
                (deliveryFilterValue === 'reached' && deliveryStatus.status === 'reached');
            return matchesSearch && matchesDelivery;
        });

    if (!filteredLogs.length) {
        donationLogsBody.innerHTML = '';
        donationLogsEmpty.style.display = 'flex';
        return;
    }

    donationLogsEmpty.style.display = 'none';

    donationLogsBody.innerHTML = filteredLogs.map(({ log, deliveryStatus }) => {
        const donorName = log.donorName || 'Anonymous';
        const donorEmail = log.donorEmail ? `<br><small class="text-muted">${escapeHtml(log.donorEmail)}</small>` : '';
        const locationName = log.location && log.location.name ? log.location.name : 'Unknown location';
        const coords = log.location && Array.isArray(log.location.coords) ? log.location.coords : null;
        const coordsLabel = coords && coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
            ? `<br><small class="text-muted">${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}</small>`
            : '';
        const itemsSummary = formatDonationItemsSummary(log.items);
        const cashLabel = formatCashAmount(log.cashAmount);
        const submittedLabel = formatDonationDate(log.submittedAt);

        return `
            <tr data-id="${log.firestoreId}">
                <td>
                    <strong>${escapeHtml(donorName)}</strong>${donorEmail}
                </td>
                <td>
                    <strong>${escapeHtml(locationName)}</strong>${coordsLabel}
                </td>
                <td>
                    <div class="donation-items-cell">${itemsSummary}</div>
                </td>
                <td>${cashLabel}</td>
                <td><small>${submittedLabel}</small></td>
                <td>
                    <span class="delivery-badge delivery-${deliveryStatus.status}">${deliveryStatus.label}</span>
                </td>
                <td class="actions-cell">
                    <button class="btn-icon btn-info" onclick="viewDonationLog('${log.firestoreId}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getDonationSearchText(log) {
    if (!log) {
        return '';
    }

    const locationName = log.location && log.location.name ? log.location.name : '';
    const coords = log.location && Array.isArray(log.location.coords) ? log.location.coords : null;
    const coordsLabel = coords && coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
        ? `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`
        : '';
    const itemsText = Array.isArray(log.items)
        ? log.items.map((item) => {
            const parts = [item.name, item.quantity, item.unit]
                .filter(value => value !== null && value !== undefined && value !== '');
            return parts.join(' ');
        }).join(' ')
        : '';
    const searchValues = [
        log.donorName,
        log.donorEmail,
        locationName,
        coordsLabel,
        itemsText,
        log.notes,
        log.cashAmount
    ];

    return searchValues
        .filter(value => value !== null && value !== undefined && value !== '')
        .map(value => value.toString().toLowerCase())
        .join(' ');
}

function getDonationDeliveryStatus(log) {
    if (!log || typeof log !== 'object') {
        return { status: 'pending', label: 'Awaiting update' };
    }

    const verificationStatus = normalizeDonationStatus(log.verificationStatus);
    const normalizedStatus = [
        log.deliveryStatus,
        log.delivery_status,
        log.responseStatus,
        log.supportStatus,
        log.support_status,
        log.status
    ]
        .map(value => (value || '').toString().toLowerCase().trim())
        .find(value => value);

    const hasReached = log.reached === true || log.hasReached === true || log.isReached === true || log.delivered === true;
    const isOnTheWay = log.onTheWay === true || log.on_the_way === true || log.isOnTheWay === true;

    let status = null;
    if (verificationStatus === 'approved' ||
        hasReached ||
        (normalizedStatus && (normalizedStatus.includes('reach') || normalizedStatus.includes('deliver') || normalizedStatus.includes('complete')))) {
        status = 'reached';
    } else if (verificationStatus === 'pending') {
        status = 'proof-submitted';
    } else if (isOnTheWay || (normalizedStatus && (normalizedStatus.includes('on the way') || normalizedStatus.includes('on_the_way') || normalizedStatus.includes('on-the-way') || normalizedStatus.includes('ontheway') || normalizedStatus.includes('enroute') || normalizedStatus.includes('en route')))) {
        status = 'on-the-way';
    } else {
        const locationStatus = getDonationLocationStatus(log);
        if (locationStatus && locationStatus.isReached) {
            status = 'reached';
        } else if (locationStatus && locationStatus.isProofSubmitted) {
            status = 'proof-submitted';
        } else if (locationStatus && locationStatus.isOnTheWay) {
            status = 'on-the-way';
        } else {
            status = 'pending';
        }
    }

    const label = status === 'reached'
        ? 'Donations reached'
        : status === 'proof-submitted'
            ? 'Proof submitted'
        : status === 'on-the-way'
            ? 'On-the-way operations'
            : 'Awaiting update';

    return { status, label };
}

function getDonationLocationStatus(log) {
    const location = findDonationLogLocation(log);
    if (!location) {
        return null;
    }

    const isReached = location.reached === true;
    const respondingName = [
        location.donorResponding,
        location.respondingTeam,
        location.responseTeam,
        location.reachedByTeam,
        location.supportedByName,
        location.supporterName
    ]
        .map(value => (value || '').toString().trim())
        .find(value => value);
    const responseStatusValue = (location.responseStatus || location.reliefStatus || '').toString().toLowerCase();
    const supportStatusValue = (location.supportStatus || location.support_status || '').toString().toLowerCase();
    const isProofSubmitted = !isReached && (
        supportStatusValue.includes('proof submitted') ||
        supportStatusValue.includes('proof_submitted') ||
        responseStatusValue.includes('proof submitted') ||
        responseStatusValue.includes('proof_submitted') ||
        location.proofVerificationStatus === 'pending' ||
        Boolean(location.proofSubmittedAt)
    );
    const isOnTheWay = !isReached && !isProofSubmitted && (
        location.onTheWay === true ||
        location.on_the_way === true ||
        supportStatusValue.includes('on the way') ||
        supportStatusValue.includes('on_the_way') ||
        supportStatusValue.includes('on-the-way') ||
        responseStatusValue.includes('on the way') ||
        responseStatusValue.includes('on_the_way') ||
        responseStatusValue.includes('on-the-way') ||
        responseStatusValue.includes('ontheway') ||
        responseStatusValue.includes('enroute') ||
        responseStatusValue.includes('en route') ||
        Boolean(respondingName)
    );

    return { isReached, isProofSubmitted, isOnTheWay };
}

function findDonationLogLocation(log) {
    if (!log || !log.location || !Array.isArray(allLocations) || !allLocations.length) {
        return null;
    }

    const locationId = log.locationId || log.location.id;
    if (locationId) {
        const idMatch = allLocations.find(location => location.firestoreId === locationId || location.id === locationId);
        if (idMatch) {
            return idMatch;
        }
    }

    const locationName = log.location.name ? log.location.name.toString().trim().toLowerCase() : '';
    if (locationName) {
        const nameMatch = allLocations.find(location => location.name && location.name.toString().trim().toLowerCase() === locationName);
        if (nameMatch) {
            return nameMatch;
        }
    }

    const coords = log.location.coords;
    if (Array.isArray(coords) && coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
        const targetCoords = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
        const coordsMatch = allLocations.find((location) => {
            if (!Array.isArray(location.coords) || location.coords.length !== 2) {
                return false;
            }
            const [lat, lng] = location.coords;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return false;
            }
            return `${lat.toFixed(4)},${lng.toFixed(4)}` === targetCoords;
        });
        if (coordsMatch) {
            return coordsMatch;
        }
    }

    return null;
}

function formatDonationItemsSummary(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<span class="text-muted">No items</span>';
    }

    const displayItems = items.slice(0, 2);
    const renderedItems = displayItems.map((item) => {
        const name = escapeHtml(item.name || 'Item');
        const quantityNumber = Number(item.quantity);
        const quantityValue = Number.isFinite(quantityNumber) ? quantityNumber : null;
        const unit = item.unit ? escapeHtml(item.unit) : '';
        const quantityLabel = quantityValue !== null ? `${quantityValue}${unit ? ` ${unit}` : ''}` : (unit ? unit : '');

        return `
            <div>
                ${name}${quantityLabel ? ` <span class="text-muted">(${quantityLabel})</span>` : ''}
            </div>
        `;
    }).join('');

    const extraCount = items.length - displayItems.length;
    const extraLabel = extraCount > 0 ? `<div class="text-muted">+${extraCount} more</div>` : '';

    return `
        <div class="donation-item-summary">
            ${renderedItems}
            ${extraLabel}
        </div>
    `;
}

function formatCashAmount(amount) {
    if (amount === null || amount === undefined || amount === '') {
        return '<span class="text-muted">—</span>';
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
        return '<span class="text-muted">—</span>';
    }

    const formatted = numericAmount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `₱${formatted}`;
}

function formatDonationDate(dateValue) {
    if (!dateValue) {
        return 'Unknown';
    }

    if (typeof dateValue === 'object') {
        if (typeof dateValue.toDate === 'function') {
            const date = dateValue.toDate();
            return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Unknown';
        }
        if (typeof dateValue.seconds === 'number') {
            const date = new Date(dateValue.seconds * 1000);
            return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
        }
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function normalizeDonationStatus(status) {
    const normalized = (status || 'pending').toString().toLowerCase();
    if (normalized.includes('approve')) {
        return 'approved';
    }
    if (normalized.includes('reject')) {
        return 'rejected';
    }
    return 'pending';
}

function getDonationStatusLabel(status) {
    switch (status) {
        case 'approved':
            return 'Approved';
        case 'rejected':
            return 'Rejected';
        default:
            return 'Pending';
    }
}

function formatDonationItemsDetailed(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<span class="text-muted">No items listed.</span>';
    }

    return items.map((item) => {
        const name = escapeHtml(item.name || 'Item');
        const numericQuantity = Number(item.quantity);
        const hasQuantity = item.quantity !== null && item.quantity !== undefined && item.quantity !== '' && Number.isFinite(numericQuantity);
        const unit = item.unit ? escapeHtml(item.unit) : '';
        const quantityLabel = hasQuantity
            ? `${numericQuantity}${unit ? ` ${unit}` : ''}`
            : (unit ? unit : '');
        const tagLabel = quantityLabel ? `${name} (${quantityLabel})` : name;

        return `<span class="relief-need-tag">${tagLabel}</span>`;
    }).join('');
}

function formatCashAmountValue(amount) {
    if (amount === null || amount === undefined || amount === '') {
        return '<span class="text-muted">No cash reported</span>';
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
        return '<span class="text-muted">No cash reported</span>';
    }

    const formatted = numericAmount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `<span>₱${formatted}</span>`;
}

function renderDonationImages(images) {
    const validImages = Array.isArray(images) ? images.filter(image => image && image.data) : [];

    if (!validImages.length) {
        return '<span class="text-muted">No photo proofs uploaded.</span>';
    }

    return `
        <div class="donation-photo-grid">
            ${validImages.map((image, index) => {
        const label = image.name ? escapeHtml(image.name) : `Photo ${index + 1}`;
        const uploadedAt = image.uploadedAt ? formatDonationDate(image.uploadedAt) : '';
        return `
                    <div class="donation-photo-card">
                        <img src="${image.data}" alt="Donation proof ${index + 1}">
                        <div class="donation-photo-meta">
                            <span>${label}</span>
                            ${uploadedAt ? `<small>${uploadedAt}</small>` : ''}
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function viewDonationLog(firestoreId) {
    const log = donationLogs.find(entry => entry.firestoreId === firestoreId);
    if (!log) {
        return;
    }

    selectedDonationLog = log;
    renderDonationLogDetails(log);

    const modal = document.getElementById('donationLogModal');
    if (modal) {
        modal.style.display = 'flex';
    }

    updateDonationActionButtons(normalizeDonationStatus(log.verificationStatus));
}

function renderDonationLogDetails(log) {
    const detailsDiv = document.getElementById('donationLogDetails');
    if (!detailsDiv || !log) {
        return;
    }

    const donorName = log.donorName || 'Anonymous';
    const donorEmail = log.donorEmail ? escapeHtml(log.donorEmail) : '';
    const donorId = log.donorId ? escapeHtml(log.donorId) : '';
    const locationName = log.location && log.location.name ? log.location.name : 'Unknown location';
    const locationTypeValue = log.location && log.location.type ? log.location.type : 'unknown';
    const locationTypeLabel = locationTypeValue === 'unreached'
        ? 'Existing location'
        : locationTypeValue === 'supported'
            ? 'Supported location'
            : locationTypeValue === 'pinned'
                ? 'Pinned on map'
                : locationTypeValue;
    const locationId = log.location && log.location.id ? escapeHtml(log.location.id) : '';
    const coords = log.location && Array.isArray(log.location.coords) ? log.location.coords : null;
    const coordsLabel = coords && coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
        ? `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`
        : null;
    const status = normalizeDonationStatus(log.verificationStatus);
    const statusLabel = getDonationStatusLabel(status);
    const verifiedAtHtml = log.verifiedAt
        ? `<span>${formatDonationDate(log.verifiedAt)}</span>`
        : '<span class="text-muted">Not yet verified</span>';
    const verifiedByHtml = log.verifiedBy
        ? `<span>${escapeHtml(log.verifiedBy)}</span>`
        : '<span class="text-muted">—</span>';
    const notesHtml = log.notes
        ? `<span>${escapeHtml(log.notes)}</span>`
        : '<span class="text-muted">No notes provided</span>';

    detailsDiv.innerHTML = `
        <div class="location-details-content donation-log-details">
            <div class="detail-section">
                <h4><i class="fas fa-user"></i> Donor</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Name</label>
                        <span>${escapeHtml(donorName)}</span>
                    </div>
                    ${donorEmail ? `
                        <div class="detail-item">
                            <label>Email</label>
                            <span>${donorEmail}</span>
                        </div>
                    ` : ''}
                    ${donorId ? `
                        <div class="detail-item">
                            <label>Donor ID</label>
                            <span class="text-muted" style="font-size: 0.85rem;">${donorId}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-map-marker-alt"></i> Drop-off Location</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Name</label>
                        <span>${escapeHtml(locationName)}</span>
                    </div>
                    ${coordsLabel ? `
                        <div class="detail-item">
                            <label>Coordinates</label>
                            <span>${coordsLabel}</span>
                        </div>
                    ` : ''}
                    <div class="detail-item">
                        <label>Location Type</label>
                        <span>${escapeHtml(locationTypeLabel)}</span>
                    </div>
                    ${locationId ? `
                        <div class="detail-item">
                            <label>Location ID</label>
                            <span class="text-muted" style="font-size: 0.85rem;">${locationId}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-box-open"></i> Items Delivered</h4>
                <div class="relief-needs-list">
                    ${formatDonationItemsDetailed(log.items)}
                </div>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-coins"></i> Cash & Notes</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Cash Donation</label>
                        ${formatCashAmountValue(log.cashAmount)}
                    </div>
                    <div class="detail-item">
                        <label>Notes</label>
                        ${notesHtml}
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-images"></i> Photo Proofs</h4>
                ${renderDonationImages(log.images)}
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-clipboard-check"></i> Verification</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Status</label>
                        <span class="status-badge status-${status}">${statusLabel}</span>
                    </div>
                    <div class="detail-item">
                        <label>Submitted At</label>
                        <span>${formatDonationDate(log.submittedAt)}</span>
                    </div>
                    <div class="detail-item">
                        <label>Verified At</label>
                        ${verifiedAtHtml}
                    </div>
                    <div class="detail-item">
                        <label>Verified By</label>
                        ${verifiedByHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function closeDonationLogModal() {
    const modal = document.getElementById('donationLogModal');
    if (modal) {
        modal.style.display = 'none';
    }
    selectedDonationLog = null;
}

function openHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important');
    }
}

function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.style.setProperty('display', 'none', 'important');
    }
}

async function syncLocationFromDonationDecision(log, status, verifierEmail, verifiedAtIso) {
    const location = findDonationLogLocation(log);
    if (!location || !location.firestoreId || !db) {
        return;
    }

    const nowIso = verifiedAtIso || new Date().toISOString();
    const responderName = [
        location.reachedByTeam,
        location.respondingTeam,
        location.responseTeam,
        location.supportedByName,
        location.supporterName,
        location.donorResponding,
        log && log.donorName
    ]
        .map(value => (value || '').toString().trim())
        .find(value => value) || 'Support Team';

    let locationUpdate = null;
    if (status === 'approved') {
        locationUpdate = {
            reached: true,
            reachedAt: nowIso,
            reachedBy: verifierEmail || 'master-admin',
            reachedByTeam: responderName,
            onTheWay: false,
            on_the_way: false,
            responseStatus: 'reached',
            supportStatus: 'reached',
            proofVerificationStatus: 'approved',
            proofSubmittedAt: location.proofSubmittedAt || (log.submittedAtIso || log.submittedAt || nowIso),
            proofSubmittedBy: location.proofSubmittedBy || log.donorName || responderName,
            proofVerifiedAt: nowIso,
            proofVerifiedBy: verifierEmail || 'master-admin',
            proofRejectedAt: null
        };
    } else if (status === 'rejected') {
        locationUpdate = {
            reached: false,
            reachedAt: null,
            reachedBy: null,
            reachedByTeam: null,
            onTheWay: true,
            on_the_way: true,
            responseStatus: 'on the way',
            supportStatus: 'on_the_way',
            proofVerificationStatus: 'rejected',
            proofSubmittedAt: location.proofSubmittedAt || (log.submittedAtIso || log.submittedAt || nowIso),
            proofSubmittedBy: location.proofSubmittedBy || log.donorName || responderName,
            proofVerifiedAt: nowIso,
            proofVerifiedBy: verifierEmail || 'master-admin',
            proofRejectedAt: nowIso
        };
    } else if (status === 'pending') {
        locationUpdate = {
            reached: false,
            reachedAt: null,
            reachedBy: null,
            reachedByTeam: null,
            onTheWay: true,
            on_the_way: true,
            responseStatus: 'proof submitted',
            supportStatus: 'proof_submitted',
            proofVerificationStatus: 'pending',
            proofSubmittedAt: location.proofSubmittedAt || (log.submittedAtIso || log.submittedAt || nowIso),
            proofSubmittedBy: location.proofSubmittedBy || log.donorName || responderName,
            proofVerifiedAt: null,
            proofVerifiedBy: null,
            proofRejectedAt: null
        };
    }

    if (!locationUpdate) {
        return;
    }

    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
    await updateDoc(doc(db, 'relief-locations', location.firestoreId), locationUpdate);

    const locationIndex = allLocations.findIndex((entry) => entry.firestoreId === location.firestoreId);
    if (locationIndex > -1) {
        allLocations[locationIndex] = {
            ...allLocations[locationIndex],
            ...locationUpdate
        };
    }
}

function updateDonationActionButtons(status) {
    const approveBtn = document.getElementById('approveDonationLog');
    const rejectBtn = document.getElementById('rejectDonationLog');
    const undoBtn = document.getElementById('undoDonationLogDecision');

    if (!approveBtn || !rejectBtn || !undoBtn) {
        return;
    }

    const isPending = status === 'pending';
    const isApproved = status === 'approved';
    const isRejected = status === 'rejected';

    approveBtn.style.display = isPending ? 'inline-flex' : 'none';
    rejectBtn.style.display = isPending ? 'inline-flex' : 'none';
    undoBtn.style.display = isPending ? 'none' : 'inline-flex';

    approveBtn.disabled = !isPending;
    rejectBtn.disabled = !isPending;
    undoBtn.disabled = isPending;

    approveBtn.innerHTML = '<i class="fas fa-check"></i> Approve';
    rejectBtn.innerHTML = '<i class="fas fa-times"></i> Reject';
    undoBtn.innerHTML = `<i class="fas fa-rotate-left"></i> ${isApproved ? 'Undo approval' : (isRejected ? 'Undo rejection' : 'Undo decision')}`;
}

function handleDonationLogApprove() {
    if (!selectedDonationLog) {
        return;
    }

    updateDonationLogStatus('approved');
}

function handleDonationLogReject() {
    if (!selectedDonationLog) {
        return;
    }

    const confirmed = confirm('Reject this donation log? This will mark it as rejected.');
    if (!confirmed) {
        return;
    }

    updateDonationLogStatus('rejected');
}

function handleDonationLogUndo() {
    if (!selectedDonationLog) {
        return;
    }

    const currentStatus = normalizeDonationStatus(selectedDonationLog.verificationStatus);
    if (currentStatus === 'pending') {
        return;
    }

    const actionLabel = currentStatus === 'approved' ? 'approval' : 'rejection';
    const confirmed = confirm(`Undo ${actionLabel} and set this donation log back to pending?`);
    if (!confirmed) {
        return;
    }

    updateDonationLogStatus('pending');
}

async function updateDonationLogStatus(status) {
    if (!selectedDonationLog) {
        return;
    }

    const approveBtn = document.getElementById('approveDonationLog');
    const rejectBtn = document.getElementById('rejectDonationLog');
    const undoBtn = document.getElementById('undoDonationLogDecision');
    const originalApproveHTML = approveBtn ? approveBtn.innerHTML : '';
    const originalRejectHTML = rejectBtn ? rejectBtn.innerHTML : '';
    const originalUndoHTML = undoBtn ? undoBtn.innerHTML : '';
    const targetBtn = status === 'approved'
        ? approveBtn
        : (status === 'rejected' ? rejectBtn : undoBtn);
    const loadingLabel = status === 'approved'
        ? 'Approving...'
        : (status === 'rejected' ? 'Rejecting...' : 'Reverting...');

    if (approveBtn) approveBtn.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;
    if (undoBtn) undoBtn.disabled = true;
    if (targetBtn) {
        targetBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingLabel}`;
    }

    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
        const isPendingStatus = status === 'pending';
        const verifiedAt = isPendingStatus ? null : new Date().toISOString();
        const verifiedBy = isPendingStatus ? null : (currentUser ? currentUser.email : 'admin');

        await updateDoc(doc(db, 'donation-logs', selectedDonationLog.firestoreId), {
            verificationStatus: status,
            verifiedAt,
            verifiedBy
        });

        selectedDonationLog = {
            ...selectedDonationLog,
            verificationStatus: status,
            verifiedAt,
            verifiedBy
        };

        const logIndex = donationLogs.findIndex(log => log.firestoreId === selectedDonationLog.firestoreId);
        if (logIndex > -1) {
            donationLogs[logIndex] = {
                ...donationLogs[logIndex],
                verificationStatus: status,
                verifiedAt,
                verifiedBy
            };
        }

        try {
            await syncLocationFromDonationDecision(selectedDonationLog, status, verifiedBy, verifiedAt || new Date().toISOString());
        } catch (syncError) {
            console.warn('Donation decision saved, but location sync failed:', syncError);
            showError('Donation log updated, but location status sync failed.');
        }

        updateStats();
        applyFilters();
        renderSupportedLocationsTable();
        renderDonationLogDetails(selectedDonationLog);
        updateDonationActionButtons(status);
        renderDonationLogs();
        showSuccess(status === 'pending' ? 'Donation log reset to pending.' : `Donation log ${status}.`);
    } catch (error) {
        console.error('Error updating donation log:', error);
        showError('Failed to update donation log. Please try again.');
        if (approveBtn) approveBtn.innerHTML = originalApproveHTML;
        if (rejectBtn) rejectBtn.innerHTML = originalRejectHTML;
        if (undoBtn) undoBtn.innerHTML = originalUndoHTML;
        updateDonationActionButtons(normalizeDonationStatus(selectedDonationLog.verificationStatus));
    }
}

// Update statistics
function updateStats() {
    const critical = allLocations.filter(loc => loc.urgencyLevel === 'critical').length;
    const urgent = allLocations.filter(loc => loc.urgencyLevel === 'urgent').length;
    const moderate = allLocations.filter(loc => loc.urgencyLevel === 'moderate').length;
    const reached = allLocations.filter(loc => loc.reached).length;
    const total = allLocations.length;

    document.getElementById('criticalCount').textContent = critical;
    document.getElementById('urgentCount').textContent = urgent;
    document.getElementById('moderateCount').textContent = moderate;
    document.getElementById('reachedCount').textContent = reached;
    document.getElementById('totalCount').textContent = total;
}

// Handle search
function handleSearch() {
    applyFilters();
}

// Apply filters and sorting
function applyFilters() {
    const searchTerm = document.getElementById('searchPins').value.toLowerCase().trim();
    const urgencyFilter = document.getElementById('urgencyFilter').value;
    const reachedFilter = document.getElementById('reachedFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    // Filter locations
    filteredLocations = allLocations.filter(location => {
        // Search filter
        const matchesSearch = !searchTerm ||
            location.name.toLowerCase().includes(searchTerm) ||
            location.source.toLowerCase().includes(searchTerm) ||
            (location.reporterName && location.reporterName.toLowerCase().includes(searchTerm)) ||
            (location.additionalInfo && location.additionalInfo.toLowerCase().includes(searchTerm)) ||
            (location.reachedByTeam && location.reachedByTeam.toLowerCase().includes(searchTerm)) ||
            location.reliefNeeds.some(need => need.toLowerCase().includes(searchTerm));

        // Urgency filter
        const matchesUrgency = urgencyFilter === 'all' || location.urgencyLevel === urgencyFilter;

        // Reached filter
        const isReached = location.reached || false;
        const matchesReached = reachedFilter === 'all' ||
            (reachedFilter === 'reached' && isReached) ||
            (reachedFilter === 'not-reached' && !isReached);

        return matchesSearch && matchesUrgency && matchesReached;
    });

    // Sort locations - ALWAYS put reached locations at top first
    filteredLocations.sort((a, b) => {
        const aReached = a.reached || false;
        const bReached = b.reached || false;

        // Primary sort: Reached status (reached items first)
        if (aReached !== bReached) {
            return bReached ? 1 : -1; // Reached items come first
        }

        // Secondary sort: Based on selected sort option
        switch (sortBy) {
            case 'date-desc':
                return new Date(b.reportedAt) - new Date(a.reportedAt);
            case 'date-asc':
                return new Date(a.reportedAt) - new Date(b.reportedAt);
            case 'urgency':
                const urgencyOrder = { 'critical': 3, 'urgent': 2, 'moderate': 1 };
                return (urgencyOrder[b.urgencyLevel] || 0) - (urgencyOrder[a.urgencyLevel] || 0);
            case 'name':
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });

    renderTable();
}

function buildRowActionsMenu(location, context = 'pins') {
    if (!location || !location.firestoreId) {
        return '';
    }

    const firestoreId = String(location.firestoreId);
    const safeMenuId = `rowActions_${context}_${firestoreId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const donationAction = context === 'supported'
        ? `
            <button type="button" class="row-actions-item" onclick="closeAllRowActionMenus(); openDonationWorkflowForLocation('${firestoreId}')">
                <i class="fas fa-hand-holding-heart"></i> Donation workflow
            </button>
        `
        : '';

    return `
        <div class="row-actions-menu">
            <button type="button" class="btn-icon row-actions-trigger" onclick="toggleRowActionsMenu(event, '${safeMenuId}')" title="More actions">
                <i class="fas fa-ellipsis-vertical"></i>
            </button>
            <div id="${safeMenuId}" class="row-actions-dropdown">
                <button type="button" class="row-actions-item" onclick="closeAllRowActionMenus(); viewDetails('${firestoreId}')">
                    <i class="fas fa-eye"></i> View details
                </button>
                <button type="button" class="row-actions-item" onclick="closeAllRowActionMenus(); openLocationOnMapById('${firestoreId}')">
                    <i class="fas fa-map-marker-alt"></i> Open on map
                </button>
                ${donationAction}
                <button type="button" class="row-actions-item" onclick="closeAllRowActionMenus(); openEditLocationModal('${firestoreId}')">
                    <i class="fas fa-pen-to-square"></i> Edit pin
                </button>
                <button type="button" class="row-actions-item is-danger" onclick="closeAllRowActionMenus(); showDeleteModal('${firestoreId}')">
                    <i class="fas fa-trash"></i> Delete pin
                </button>
            </div>
        </div>
    `;
}

function toggleRowActionsMenu(event, menuId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const menu = document.getElementById(menuId);
    if (!menu) {
        return;
    }

    const shouldOpen = !menu.classList.contains('is-open');
    closeAllRowActionMenus();

    if (shouldOpen) {
        menu.classList.add('is-open');
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.alignItems = 'stretch';
        menu.style.gap = '2px';
        activeRowActionsMenuId = menuId;
    }
}

function closeAllRowActionMenus() {
    document.querySelectorAll('.row-actions-dropdown.is-open').forEach((menu) => {
        menu.classList.remove('is-open');
        menu.style.display = 'none';
        menu.style.removeProperty('flex-direction');
        menu.style.removeProperty('align-items');
        menu.style.removeProperty('gap');
    });
    activeRowActionsMenuId = null;
}

function findLocationByAnyId(locationId) {
    if (!locationId) {
        return null;
    }

    return allLocations.find((loc) => (
        loc &&
        (
            loc.firestoreId === locationId ||
            loc.id === locationId ||
            loc.locationId === locationId
        )
    )) || null;
}

function openLocationOnMapById(firestoreId) {
    const location = findLocationByAnyId(firestoreId);
    if (!location || !Array.isArray(location.coords) || location.coords.length !== 2) {
        showError('Location coordinates are not available.');
        return;
    }

    const lat = Number(location.coords[0]);
    const lng = Number(location.coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showError('Location coordinates are not valid.');
        return;
    }

    closeAllRowActionMenus();
    window.open(`admin-map.html#${lat},${lng},15`, '_blank');
}

function openDonationWorkflowForLocation(firestoreId) {
    const location = findLocationByAnyId(firestoreId);
    if (!location) {
        return;
    }

    closeAllRowActionMenus();
    setActiveSection('donationLogs');

    const donationSearchInput = document.getElementById('donationSearch');
    if (donationSearchInput) {
        donationSearchInput.value = location.name || '';
    }

    renderDonationLogs();
    showSuccess('Opened Donation Logs. Approving proof will mark the location as reached automatically.');
}

function pingSupporterForProof(firestoreId) {
    const location = findLocationByAnyId(firestoreId);
    if (!location) {
        return;
    }

    const responderName = [
        location.donorResponding,
        location.respondingTeam,
        location.responseTeam,
        location.supportedByName,
        location.supporterName
    ]
        .map(value => (value || '').toString().trim())
        .find(value => value) || 'assigned supporter';
    const contact = (location.supporterContact || '').toString().trim();

    openDonationWorkflowForLocation(firestoreId);

    if (contact) {
        showSuccess(`Ping supporter: Ask ${responderName} (${contact}) to submit donation proof.`);
    } else {
        showSuccess(`Ping supporter: Ask ${responderName} to submit donation proof.`);
    }
}

function donationLogBelongsToLocation(log, location) {
    if (!log || !location) {
        return false;
    }

    const normalizeText = (value) => (value || '').toString().trim().toLowerCase();
    const locationIdCandidates = [
        log.locationId,
        log.location && log.location.id,
        log.location && log.location.firestoreId
    ]
        .filter(Boolean)
        .map(String);
    const locationIdentityCandidates = [
        location.firestoreId,
        location.id
    ]
        .filter(Boolean)
        .map(String);

    if (locationIdCandidates.some(id => locationIdentityCandidates.includes(id))) {
        return true;
    }

    const logLocationName = normalizeText(log.location && log.location.name);
    const locationName = normalizeText(location.name);
    if (logLocationName && locationName && logLocationName === locationName) {
        return true;
    }

    const logCoords = log.location && Array.isArray(log.location.coords) ? log.location.coords : null;
    const locCoords = Array.isArray(location.coords) ? location.coords : null;
    if (Array.isArray(logCoords) && logCoords.length === 2 && Array.isArray(locCoords) && locCoords.length === 2) {
        const [logLat, logLng] = [Number(logCoords[0]), Number(logCoords[1])];
        const [locLat, locLng] = [Number(locCoords[0]), Number(locCoords[1])];
        if (Number.isFinite(logLat) && Number.isFinite(logLng) && Number.isFinite(locLat) && Number.isFinite(locLng)) {
            const roundedLog = `${logLat.toFixed(4)},${logLng.toFixed(4)}`;
            const roundedLoc = `${locLat.toFixed(4)},${locLng.toFixed(4)}`;
            if (roundedLog === roundedLoc) {
                return true;
            }
        }
    }

    return false;
}

function hasApprovedDonationProofForLocation(firestoreId) {
    const location = findLocationByAnyId(firestoreId);
    if (!location) {
        return false;
    }

    return donationLogs.some((log) => (
        normalizeDonationStatus(log.verificationStatus) === 'approved' &&
        donationLogBelongsToLocation(log, location)
    ));
}

// Render pins table
function renderTable() {
    const tbody = document.getElementById('pinsTableBody');
    const emptyState = document.getElementById('emptyState');

    if (filteredLocations.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    const html = filteredLocations.map(location => {
        const urgencyLevel = String(location.urgencyLevel || 'moderate').toLowerCase();
        const urgencyColor = getUrgencyColor(urgencyLevel);
        const urgencyText = urgencyLevel.charAt(0).toUpperCase() + urgencyLevel.slice(1);
        const date = new Date(location.reportedAt).toLocaleString();
        const reliefNeeds = Array.isArray(location.reliefNeeds) ? location.reliefNeeds.join(', ') : 'N/A';
        const reporter = location.reporterName || 'Anonymous';
        const isReached = location.reached || false;
        const latitude = Array.isArray(location.coords) ? Number(location.coords[0]) : Number.NaN;
        const longitude = Array.isArray(location.coords) ? Number(location.coords[1]) : Number.NaN;
        const coordsLabel = Number.isFinite(latitude) && Number.isFinite(longitude)
            ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            : 'Unknown coordinates';

        const actionButtons = buildRowActionsMenu(location, 'pins');

        return `
            <tr data-id="${location.firestoreId}" class="${isReached ? 'reached-location' : ''}">
                <td>
                    <strong>${escapeHtml(String(location.name || 'Unknown location'))}</strong>
                    <br>
                    <small class="text-muted">${coordsLabel}</small>
                    ${isReached ? `<br><span class="reached-badge"><i class="fas fa-check-circle"></i> Reached${location.reachedByTeam ? ' by ' + escapeHtml(location.reachedByTeam) : ''}</span>` : ''}
                </td>
                <td>
                    <span class="urgency-badge" style="color: ${urgencyColor};">
                        ${urgencyText}
                    </span>
                </td>
                <td>
                    <span class="source-badge">${escapeHtml(String(location.source || 'unknown').toUpperCase())}</span>
                </td>
                <td>
                    <div class="relief-needs-cell">${escapeHtml(reliefNeeds)}</div>
                </td>
                <td>${escapeHtml(String(reporter))}</td>
                <td>
                    <small>${date}</small>
                </td>
                <td class="actions-cell">
                    ${actionButtons}
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

function getLocationResponseStatus(location) {
    if (!location || typeof location !== 'object') {
        return {
            isReached: false,
            isProofSubmitted: false,
            isOnTheWay: false,
            status: 'unreached',
            statusLabel: 'Unreached',
            respondingName: '',
            updatedAt: null
        };
    }

    const isReached = location.reached === true;
    const respondingName = [
        location.donorResponding,
        location.respondingTeam,
        location.responseTeam,
        location.reachedByTeam,
        location.supportedByName,
        location.supporterName
    ]
        .map(value => (value || '').toString().trim())
        .find(value => value) || '';

    const responseStatusValue = (location.responseStatus || location.reliefStatus || '').toString().toLowerCase();
    const supportStatusValue = (location.supportStatus || location.support_status || '').toString().toLowerCase();
    const hasPendingProof = Array.isArray(donationLogs) && donationLogs.some((log) => (
        normalizeDonationStatus(log.verificationStatus) === 'pending' &&
        donationLogBelongsToLocation(log, location)
    ));
    const isProofSubmitted = !isReached && (
        hasPendingProof ||
        supportStatusValue.includes('proof submitted') ||
        supportStatusValue.includes('proof_submitted') ||
        responseStatusValue.includes('proof submitted') ||
        responseStatusValue.includes('proof_submitted') ||
        location.proofVerificationStatus === 'pending' ||
        Boolean(location.proofSubmittedAt)
    );
    const isOnTheWay = !isReached && !isProofSubmitted && (
        location.onTheWay === true ||
        location.on_the_way === true ||
        supportStatusValue.includes('on the way') ||
        supportStatusValue.includes('on_the_way') ||
        supportStatusValue.includes('on-the-way') ||
        responseStatusValue.includes('on the way') ||
        responseStatusValue.includes('on_the_way') ||
        responseStatusValue.includes('on-the-way') ||
        responseStatusValue.includes('ontheway') ||
        responseStatusValue.includes('enroute') ||
        responseStatusValue.includes('en route') ||
        Boolean(respondingName)
    );

    const status = isReached
        ? 'reached'
        : (isProofSubmitted ? 'proof-submitted' : (isOnTheWay ? 'on-the-way' : 'unreached'));
    const statusLabel = isReached
        ? 'Reached'
        : (isProofSubmitted ? 'Proof submitted' : (isOnTheWay ? 'On the way' : 'Unreached'));
    const updatedAt = location.reachedAt ||
        location.proofSubmittedAt ||
        location.respondingAt ||
        location.supportedAt ||
        location.reportedAt ||
        null;

    return {
        isReached,
        isProofSubmitted,
        isOnTheWay,
        status,
        statusLabel,
        respondingName,
        updatedAt
    };
}

function formatSupportedUpdatedAt(value) {
    if (!value) {
        return 'Unknown';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function renderSupportedLocationsTable() {
    const tbody = document.getElementById('supportedLocationsBody');
    const emptyState = document.getElementById('supportedLocationsEmpty');

    if (!tbody || !emptyState) {
        return;
    }

    const searchTerm = (document.getElementById('supportedSearch')?.value || '').toLowerCase().trim();
    const statusFilter = (document.getElementById('supportedStatusFilter')?.value || 'all').toLowerCase();
    const urgencyFilter = (document.getElementById('supportedUrgencyFilter')?.value || 'all').toLowerCase();

    filteredSupportedLocations = allLocations
        .map((location) => ({
            location,
            statusData: getLocationResponseStatus(location)
        }))
        .filter(({ statusData }) => statusData.isOnTheWay || statusData.isProofSubmitted || statusData.isReached)
        .filter(({ location, statusData }) => {
            const reliefNeeds = Array.isArray(location.reliefNeeds) ? location.reliefNeeds : [];
            const matchesSearch = !searchTerm ||
                String(location.name || '').toLowerCase().includes(searchTerm) ||
                String(location.source || '').toLowerCase().includes(searchTerm) ||
                String(location.reporterName || '').toLowerCase().includes(searchTerm) ||
                String(statusData.respondingName || '').toLowerCase().includes(searchTerm) ||
                reliefNeeds.some(need => String(need).toLowerCase().includes(searchTerm));

            const matchesStatus = statusFilter === 'all' || statusData.status === statusFilter;
            const matchesUrgency = urgencyFilter === 'all' || String(location.urgencyLevel || '').toLowerCase() === urgencyFilter;
            return matchesSearch && matchesStatus && matchesUrgency;
        })
        .sort((a, b) => {
            const statusPriority = { 'proof-submitted': 3, 'on-the-way': 2, reached: 1 };
            const aPriority = statusPriority[a.statusData.status] || 0;
            const bPriority = statusPriority[b.statusData.status] || 0;
            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }

            const aTime = new Date(a.statusData.updatedAt || a.location.reportedAt || 0).getTime();
            const bTime = new Date(b.statusData.updatedAt || b.location.reportedAt || 0).getTime();
            return bTime - aTime;
        });

    if (!filteredSupportedLocations.length) {
        tbody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = filteredSupportedLocations.map(({ location, statusData }) => {
        const locationIdentifier = location.firestoreId || location.id || '';
        const urgencyColor = getUrgencyColor(location.urgencyLevel);
        const urgencyText = location.urgencyLevel ? location.urgencyLevel.toUpperCase() : 'MODERATE';
        const responder = statusData.respondingName || 'Unassigned';
        const latitude = Array.isArray(location.coords) ? Number(location.coords[0]) : Number.NaN;
        const longitude = Array.isArray(location.coords) ? Number(location.coords[1]) : Number.NaN;
        const coordsLabel = Number.isFinite(latitude) && Number.isFinite(longitude)
            ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            : 'Unknown coordinates';
        const updatedAt = formatSupportedUpdatedAt(statusData.updatedAt);
        const statusBadgeClass = statusData.isReached
            ? 'supported-status-reached'
            : (statusData.isProofSubmitted ? 'supported-status-proof-submitted' : 'supported-status-on-the-way');
        const statusAction = statusData.isProofSubmitted
            ? `<button class="btn btn-info btn-sm supported-action-btn" onclick="openDonationWorkflowForLocation('${locationIdentifier}')">
                    <i class="fas fa-clipboard-check"></i> Review Proof
               </button>`
            : statusData.isOnTheWay
                ? `<button class="btn btn-info btn-sm supported-action-btn" onclick="pingSupporterForProof('${locationIdentifier}')">
                    <i class="fas fa-bell"></i> Ping for Proof
               </button>`
            : `<button class="btn btn-secondary btn-sm supported-action-btn" onclick="toggleReached('${locationIdentifier}', false)">
                    <i class="fas fa-rotate-left"></i> Undo Reached
               </button>`;
        const moreActions = buildRowActionsMenu(
            location.firestoreId ? location : { ...location, firestoreId: locationIdentifier },
            'supported'
        );

        return `
            <tr data-id="${locationIdentifier}" class="${statusData.isReached ? 'reached-location' : ''}">
                <td>
                    <strong>${escapeHtml(location.name || 'Unknown location')}</strong>
                    <br>
                    <small class="text-muted">${coordsLabel}</small>
                </td>
                <td>
                    <span class="urgency-badge" style="color: ${urgencyColor};">
                        ${urgencyText}
                    </span>
                </td>
                <td>${escapeHtml(responder)}</td>
                <td>
                    <span class="supported-status-badge ${statusBadgeClass}">
                        ${escapeHtml(statusData.statusLabel)}
                    </span>
                </td>
                <td><small>${escapeHtml(updatedAt)}</small></td>
                <td class="actions-cell">
                    <div class="supported-actions-wrap">
                        ${statusAction}
                        ${moreActions}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showEditLocationError(message) {
    const errorElement = document.getElementById('editLocationError');
    if (!errorElement) {
        return;
    }

    if (!message) {
        errorElement.style.display = 'none';
        errorElement.textContent = '';
        return;
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function openEditLocationModal(firestoreId) {
    const location = allLocations.find(loc => loc.firestoreId === firestoreId);
    const modal = document.getElementById('editLocationModal');
    if (!location || !modal) {
        return;
    }

    selectedLocationForEdit = location;
    closeAllRowActionMenus();

    const nameInput = document.getElementById('editLocationName');
    const urgencyInput = document.getElementById('editUrgencyLevel');
    const sourceInput = document.getElementById('editLocationSource');
    const reliefInput = document.getElementById('editReliefNeeds');
    const additionalInfoInput = document.getElementById('editAdditionalInfo');
    const meta = document.getElementById('editLocationMeta');

    if (nameInput) {
        nameInput.value = location.name || '';
    }
    if (urgencyInput) {
        const normalizedUrgency = String(location.urgencyLevel || '').toLowerCase();
        urgencyInput.value = ['critical', 'urgent', 'moderate'].includes(normalizedUrgency)
            ? normalizedUrgency
            : 'moderate';
    }
    if (sourceInput) {
        sourceInput.value = location.source || '';
    }
    if (reliefInput) {
        reliefInput.value = Array.isArray(location.reliefNeeds) ? location.reliefNeeds.join(', ') : '';
    }
    if (additionalInfoInput) {
        additionalInfoInput.value = location.additionalInfo || '';
    }
    if (meta) {
        meta.textContent = `Document: ${location.firestoreId}`;
    }

    showEditLocationError('');
    modal.style.display = 'flex';

    if (nameInput) {
        nameInput.focus();
        nameInput.select();
    }
}

function closeEditLocationModal() {
    const modal = document.getElementById('editLocationModal');
    if (modal) {
        modal.style.display = 'none';
    }
    selectedLocationForEdit = null;
    showEditLocationError('');
}

async function saveEditLocation() {
    if (!selectedLocationForEdit) {
        return;
    }

    const nameInput = document.getElementById('editLocationName');
    const urgencyInput = document.getElementById('editUrgencyLevel');
    const sourceInput = document.getElementById('editLocationSource');
    const reliefInput = document.getElementById('editReliefNeeds');
    const additionalInfoInput = document.getElementById('editAdditionalInfo');
    const saveBtn = document.getElementById('saveEditLocation');
    if (!nameInput || !urgencyInput || !sourceInput || !reliefInput || !additionalInfoInput || !saveBtn) {
        return;
    }

    const name = nameInput.value.trim();
    const urgency = urgencyInput.value;
    const source = sourceInput.value.trim();
    const additionalInfo = additionalInfoInput.value.trim();
    const parsedNeeds = parseReliefNeeds(reliefInput.value || '');

    if (!name) {
        showEditLocationError('Location name is required.');
        nameInput.focus();
        return;
    }
    if (!['critical', 'urgent', 'moderate'].includes(urgency)) {
        showEditLocationError('Select a valid urgency level.');
        urgencyInput.focus();
        return;
    }
    if (!source) {
        showEditLocationError('Source is required.');
        sourceInput.focus();
        return;
    }
    if (!parsedNeeds.length) {
        showEditLocationError('Add at least one relief need.');
        reliefInput.focus();
        return;
    }

    showEditLocationError('');
    const originalLabel = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
        const updatedAt = new Date().toISOString();
        const updatePayload = {
            name,
            urgencyLevel: urgency,
            source,
            reliefNeeds: parsedNeeds,
            additionalInfo,
            updatedAt,
            updatedBy: currentUser ? currentUser.email : 'master-admin'
        };

        await updateDoc(doc(db, 'relief-locations', selectedLocationForEdit.firestoreId), updatePayload);

        const targetIndex = allLocations.findIndex(loc => loc.firestoreId === selectedLocationForEdit.firestoreId);
        if (targetIndex > -1) {
            allLocations[targetIndex] = {
                ...allLocations[targetIndex],
                ...updatePayload
            };
        }

        updateStats();
        applyFilters();
        renderSupportedLocationsTable();
        renderDonationLogs();
        closeEditLocationModal();
        showSuccess('Location updated successfully.');
    } catch (error) {
        console.error('Error updating location:', error);
        showEditLocationError('Failed to save changes. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalLabel;
    }
}

// Get urgency color
function getUrgencyColor(urgency) {
    switch (urgency) {
        case 'critical':
            return '#dc3545';
        case 'urgent':
            return '#fd7e14';
        case 'moderate':
            return '#ffc107';
        default:
            return '#6c757d';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show delete modal
function showDeleteModal(firestoreId) {
    const location = allLocations.find(loc => loc.firestoreId === firestoreId);
    if (!location) return;

    selectedLocationForDeletion = location;

    const infoDiv = document.getElementById('deleteLocationInfo');
    infoDiv.innerHTML = `
        <div class="delete-location-preview">
            <p><strong>Location:</strong> ${escapeHtml(location.name)}</p>
            <p><strong>Urgency:</strong> <span style="color: ${getUrgencyColor(location.urgencyLevel)};">${location.urgencyLevel.toUpperCase()}</span></p>
            <p><strong>Source:</strong> ${escapeHtml(location.source)}</p>
            <p><strong>Reporter:</strong> ${escapeHtml(location.reporterName || 'Anonymous')}</p>
            <p><strong>Reported:</strong> ${new Date(location.reportedAt).toLocaleString()}</p>
        </div>
    `;

    document.getElementById('deleteModal').style.display = 'flex';
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    selectedLocationForDeletion = null;
}

// Handle delete confirmation
async function handleDeleteConfirm() {
    if (!selectedLocationForDeletion) return;

    // Debug: Log authentication and deletion details
    console.log('🗑️ Attempting to delete location:', {
        name: selectedLocationForDeletion.name,
        firestoreId: selectedLocationForDeletion.firestoreId,
        currentUser: currentUser ? currentUser.email : 'Not logged in',
        authState: auth.currentUser ? auth.currentUser.email : 'No auth user'
    });

    const confirmBtn = document.getElementById('confirmDelete');
    const originalHTML = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    confirmBtn.disabled = true;

    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        await deleteDoc(doc(db, 'relief-locations', selectedLocationForDeletion.firestoreId));

        console.log('Location deleted successfully:', selectedLocationForDeletion.name);

        // Manually remove from local array to update UI immediately
        const index = allLocations.findIndex(loc => loc.firestoreId === selectedLocationForDeletion.firestoreId);
        if (index > -1) {
            allLocations.splice(index, 1);
            updateStats();
            applyFilters();
        }

        showSuccess(`Successfully deleted "${selectedLocationForDeletion.name}"`);

        closeDeleteModal();

    } catch (error) {
        console.error('❌ Error deleting location:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Attempted to delete firestoreId:', selectedLocationForDeletion.firestoreId);

        // Show more specific error message
        let errorMessage = 'Failed to delete location. ';
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Please ensure you are logged in as a master admin.';
        } else if (error.code === 'not-found') {
            errorMessage += 'Location not found in database.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Database unavailable. Check your internet connection.';
        } else {
            errorMessage += 'Please try again. Error: ' + (error.message || 'Unknown error');
        }

        showError(errorMessage);
    } finally {
        // Reset button
        confirmBtn.innerHTML = originalHTML;
        confirmBtn.disabled = false;
    }
}

// View details
function viewDetails(firestoreId) {
    const location = allLocations.find(loc => loc.firestoreId === firestoreId);
    if (!location) return;

    selectedLocationForDetails = location;

    const detailsDiv = document.getElementById('locationDetails');
    const urgencyColor = getUrgencyColor(location.urgencyLevel);
    const isReached = location.reached || false;
    const respondingName = [
        location.donorResponding,
        location.respondingTeam,
        location.responseTeam,
        location.reachedByTeam
    ]
        .map(value => (value || '').toString().trim())
        .find(value => value);
    const safeRespondingName = respondingName ? escapeHtml(respondingName) : '';
    const responseStatusValue = (location.responseStatus || location.reliefStatus || '').toString().toLowerCase();
    const isOnTheWay = !isReached && (
        location.onTheWay === true ||
        location.on_the_way === true ||
        responseStatusValue.includes('on the way') ||
        responseStatusValue.includes('on_the_way') ||
        responseStatusValue.includes('on-the-way') ||
        responseStatusValue.includes('ontheway') ||
        responseStatusValue.includes('enroute') ||
        responseStatusValue.includes('en route') ||
        Boolean(respondingName)
    );
    const responseStatusSection = (() => {
        if (isReached) {
            return `
                <div class="detail-section" style="background: #d4edda; border-left: 4px solid #28a745; padding: 1rem; border-radius: 6px;">
                    <h4><i class="fas fa-check-circle" style="color: #28a745;"></i> Response Status</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Status:</label>
                            <span style="color: #28a745; font-weight: 600;">✓ Reached</span>
                        </div>
                        ${location.reachedByTeam ? `
                            <div class="detail-item">
                                <label>Response Team:</label>
                                <span style="font-weight: 600;">${escapeHtml(location.reachedByTeam)}</span>
                            </div>
                        ` : ''}
                        ${location.reachedBy ? `
                            <div class="detail-item">
                                <label>Marked By:</label>
                                <span>${escapeHtml(location.reachedBy)}</span>
                            </div>
                        ` : ''}
                        ${location.reachedAt ? `
                            <div class="detail-item">
                                <label>Reached At:</label>
                                <span>${new Date(location.reachedAt).toLocaleString()}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        const statusLabel = isOnTheWay ? 'On the way' : 'Unreached';
        const statusStyles = isOnTheWay
            ? {
                background: '#fff3cd',
                border: '#ffc107',
                text: '#856404',
                icon: 'fa-route',
                donor: safeRespondingName || 'Unassigned'
            }
            : {
                background: '#f8f9fa',
                border: '#6c757d',
                text: '#495057',
                icon: 'fa-clock',
                donor: 'None yet'
            };

        return `
                <div class="detail-section" style="background: ${statusStyles.background}; border-left: 4px solid ${statusStyles.border}; padding: 1rem; border-radius: 6px;">
                    <h4><i class="fas ${statusStyles.icon}" style="color: ${statusStyles.text};"></i> Response Status</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Status:</label>
                            <span style="color: ${statusStyles.text}; font-weight: 600;">${statusLabel}</span>
                        </div>
                        <div class="detail-item">
                            <label>Donor Responding:</label>
                            <span style="font-weight: 600;">${statusStyles.donor}</span>
                        </div>
                    </div>
                </div>
            `;
    })();

    detailsDiv.innerHTML = `
        <div class="location-details-content">
            <div class="detail-section">
                <h4><i class="fas fa-map-marker-alt"></i> Location Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Name:</label>
                        <span>${escapeHtml(location.name)}</span>
                    </div>
                    <div class="detail-item">
                        <label>Coordinates:</label>
                        <span>${location.coords[0].toFixed(6)}, ${location.coords[1].toFixed(6)}</span>
                    </div>
                    <div class="detail-item">
                        <label>Urgency Level:</label>
                        <span class="urgency-badge" style="color: ${urgencyColor};">
                            ${location.urgencyLevel.toUpperCase()}
                        </span>
                    </div>
                    <div class="detail-item">
                        <label>Source:</label>
                        <span class="source-badge">${escapeHtml(location.source.toUpperCase())}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4><i class="fas fa-hands-helping"></i> Relief Needs</h4>
                <div class="relief-needs-list">
                    ${location.reliefNeeds.map(need => `
                        <span class="relief-need-tag">${escapeHtml(need)}</span>
                    `).join('')}
                </div>
            </div>

            ${location.additionalInfo ? `
                <div class="detail-section">
                    <h4><i class="fas fa-info-circle"></i> Additional Information</h4>
                    <p class="additional-info">${escapeHtml(location.additionalInfo)}</p>
                </div>
            ` : ''}

            <div class="detail-section">
                <h4><i class="fas fa-user"></i> Reporter Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Name:</label>
                        <span>${escapeHtml(location.reporterName || 'Anonymous')}</span>
                    </div>
                    ${location.reporterContact ? `
                        <div class="detail-item">
                            <label>Contact:</label>
                            <span>${escapeHtml(location.reporterContact)}</span>
                        </div>
                    ` : ''}
                    <div class="detail-item">
                        <label>Reported At:</label>
                        <span>${new Date(location.reportedAt).toLocaleString()}</span>
                    </div>
                    ${location.userId ? `
                        <div class="detail-item">
                            <label>User ID:</label>
                            <span class="text-muted" style="font-size: 0.85rem;">${location.userId}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${responseStatusSection}

            <div class="detail-section">
                <h4><i class="fas fa-database"></i> Database Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Document ID:</label>
                        <span class="text-muted" style="font-size: 0.85rem;">${location.firestoreId}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('detailsModal').style.display = 'flex';
}

// Close details modal
function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
    selectedLocationForDetails = null;
}

// View on map
function viewOnMap() {
    if (!selectedLocationForDetails) return;

    const coords = selectedLocationForDetails.coords;
    window.open(`index.html#${coords[0]},${coords[1]},15`, '_blank');
}

// Show success message
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'toast toast-success';
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${escapeHtml(message)}</span>
    `;
    document.body.appendChild(successDiv);

    setTimeout(() => {
        successDiv.classList.add('show');
    }, 10);

    setTimeout(() => {
        successDiv.classList.remove('show');
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'toast toast-error';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${escapeHtml(message)}</span>
    `;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.classList.add('show');
    }, 10);

    setTimeout(() => {
        errorDiv.classList.remove('show');
        setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
}

// Toggle reached status
async function toggleReached(firestoreId, isReached) {
    closeAllRowActionMenus();
    const location = findLocationByAnyId(firestoreId);
    if (!location) {
        showError('Location not found.');
        return;
    }
    const targetFirestoreId = location.firestoreId || firestoreId;

    // If marking as reached, show team name modal
    if (isReached) {
        showTeamNameModal(targetFirestoreId);
    } else {
        // Unmarking as reached - proceed directly
        await updateReachedStatus(targetFirestoreId, false, null, {});
    }
}

// Show team name modal
function showTeamNameModal(firestoreId) {
    const modal = document.getElementById('teamNameModal');
    const input = document.getElementById('teamNameInput');
    const confirmBtn = document.getElementById('confirmTeamName');
    const cancelBtn = document.getElementById('cancelTeamName');
    const closeBtn = document.getElementById('closeTeamModal');
    const donationModeInput = document.getElementById('teamReachedFlowDonation');
    const manualModeInput = document.getElementById('teamReachedFlowManual');
    const manualReasonGroup = document.getElementById('teamManualReasonGroup');
    const manualReasonInput = document.getElementById('teamManualReasonInput');
    const locationLabel = document.getElementById('teamLocationLabel');
    const openDonationFlowBtn = document.getElementById('openDonationWorkflowFromReached');
    const modalError = document.getElementById('teamModalError');
    const location = findLocationByAnyId(firestoreId);

    if (!modal || !input || !confirmBtn || !cancelBtn || !closeBtn || !donationModeInput || !manualModeInput || !manualReasonGroup || !manualReasonInput || !locationLabel || !openDonationFlowBtn || !modalError || !location) {
        showError('Unable to open reached flow modal. Refresh and try again.');
        return;
    }

    const setModalError = (message) => {
        modalError.textContent = message || '';
        modalError.style.display = message ? 'block' : 'none';
    };

    const updateReasonVisibility = () => {
        const isManualMode = manualModeInput.checked;
        manualReasonGroup.style.display = isManualMode ? 'block' : 'none';
        if (!isManualMode) {
            manualReasonInput.value = '';
        }
    };

    // Pre-fill with saved team name
    const savedTeamName = localStorage.getItem('userTeamName');
    input.value = savedTeamName || (currentUser ? currentUser.displayName : '');
    input.style.borderColor = '#e0e0e0';

    // Reset flow fields
    donationModeInput.checked = true;
    manualModeInput.checked = false;
    manualReasonInput.value = '';
    updateReasonVisibility();
    setModalError('');
    locationLabel.innerHTML = `<i class="fas fa-map-marker-alt"></i> Selected location: ${escapeHtml(location.name || 'Unknown location')}`;

    // Show modal
    modal.style.display = 'flex';
    input.focus();
    input.select();

    // Handle confirm
    const handleConfirm = async () => {
        const teamName = input.value.trim();
        if (!teamName) {
            input.style.borderColor = '#dc3545';
            setModalError('Team name is required.');
            input.focus();
            return;
        }
        input.style.borderColor = '#e0e0e0';

        const isManualMode = manualModeInput.checked;
        const manualReason = manualReasonInput.value.trim();
        if (isManualMode && manualReason.length < 10) {
            setModalError('Manual mode requires a short reason (at least 10 characters).');
            manualReasonInput.focus();
            return;
        }
        if (!isManualMode && !hasApprovedDonationProofForLocation(firestoreId)) {
            setModalError('No approved donation log found for this location. Open Donation Logs workflow first.');
            return;
        }

        // Save team name for future use
        localStorage.setItem('userTeamName', teamName);

        // Close modal
        modal.style.display = 'none';
        cleanup();

        // Update status
        await updateReachedStatus(firestoreId, true, teamName, {
            verificationMode: isManualMode ? 'manual' : 'donation-log',
            manualReason: isManualMode ? manualReason : null
        });
    };

    // Handle cancel
    const handleCancel = () => {
        modal.style.display = 'none';
        cleanup();
    };

    const handleOpenDonationFlow = () => {
        modal.style.display = 'none';
        cleanup();
        openDonationWorkflowForLocation(firestoreId);
    };

    // Cleanup event listeners
    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keypress', handleEnter);
        donationModeInput.removeEventListener('change', handleFlowChange);
        manualModeInput.removeEventListener('change', handleFlowChange);
        openDonationFlowBtn.removeEventListener('click', handleOpenDonationFlow);
    };

    // Handle Enter key
    const handleEnter = (e) => {
        if (e.key === 'Enter' && e.target !== manualReasonInput) {
            handleConfirm();
        }
    };

    const handleFlowChange = () => {
        updateReasonVisibility();
        setModalError('');
    };

    // Add event listeners
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    input.addEventListener('keypress', handleEnter);
    donationModeInput.addEventListener('change', handleFlowChange);
    manualModeInput.addEventListener('change', handleFlowChange);
    openDonationFlowBtn.addEventListener('click', handleOpenDonationFlow);
}

// Update reached status in Firestore
async function updateReachedStatus(firestoreId, isReached, teamName, options = {}) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
        const reachedAt = isReached ? new Date().toISOString() : null;
        const reachedBy = isReached ? (currentUser ? currentUser.email : 'Unknown') : null;
        const reachedByTeam = isReached ? teamName : null;
        const reachedVerificationMode = isReached ? (options.verificationMode || null) : null;
        const reachedManualReason = isReached && reachedVerificationMode === 'manual'
            ? (options.manualReason || null)
            : null;

        await updateDoc(doc(db, 'relief-locations', firestoreId), {
            reached: isReached,
            reachedAt,
            reachedBy,
            reachedByTeam,
            reachedVerificationMode,
            reachedManualReason
        });

        const targetLocation = allLocations.find(location => location.firestoreId === firestoreId);
        if (targetLocation) {
            targetLocation.reached = isReached;
            targetLocation.reachedAt = reachedAt;
            targetLocation.reachedBy = reachedBy;
            targetLocation.reachedByTeam = reachedByTeam;
            targetLocation.reachedVerificationMode = reachedVerificationMode;
            targetLocation.reachedManualReason = reachedManualReason;
            updateStats();
            applyFilters();
            renderSupportedLocationsTable();
            renderDonationLogs();
        }

        const message = isReached
            ? ('Location marked as reached by ' + teamName)
            : 'Location marked as not reached';
        showSuccess(message);

        console.log('Location ' + firestoreId + ' marked as ' + (isReached ? 'reached' : 'not reached') + (isReached ? (' by ' + teamName) : ''));
    } catch (error) {
        console.error('Error updating reached status:', error);
        showError('Failed to update status. Please try again.');
    }
}

// Session timeout handler
function handleSessionTimeout() {
    alert('⏱️ Your session has expired due to inactivity. Please login again.');
    handleLogout();
}

// Session warning handler
function showSessionWarning(minutes) {
    const warning = confirm(`⚠️ Your session will expire in ${minutes} minute(s) due to inactivity. Click OK to stay logged in.`);
    if (warning && sessionManager) {
        sessionManager.updateActivity();
    }
}

// Download Excel function
function downloadExcel() {
    if (!window.XLSX) {
        showError('Excel library not loaded. Please refresh the page.');
        return;
    }

    if (filteredLocations.length === 0) {
        showError('No data to export. Please adjust your filters.');
        return;
    }

    try {
        // Prepare data for Excel
        const excelData = filteredLocations.map(location => {
            return {
                'Location Name': location.name,
                'Latitude': location.coords[0],
                'Longitude': location.coords[1],
                'Urgency Level': location.urgencyLevel.toUpperCase(),
                'Source': location.source.toUpperCase(),
                'Relief Needs': location.reliefNeeds.join(', '),
                'Additional Info': location.additionalInfo || '',
                'Reporter Name': location.reporterName || 'Anonymous',
                'Reporter Contact': location.reporterContact || '',
                'Reported Date': new Date(location.reportedAt).toLocaleString(),
                'Status': location.reached ? 'Reached' : 'Not Reached',
                'Response Team': location.reachedByTeam || '',
                'Reached By': location.reachedBy || '',
                'Reached Date': location.reachedAt ? new Date(location.reachedAt).toLocaleString() : '',
                'User ID': location.userId || '',
                'Document ID': location.firestoreId
            };
        });

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Set column widths
        const colWidths = [
            { wch: 30 }, // Location Name
            { wch: 12 }, // Latitude
            { wch: 12 }, // Longitude
            { wch: 15 }, // Urgency Level
            { wch: 15 }, // Source
            { wch: 40 }, // Relief Needs
            { wch: 50 }, // Additional Info
            { wch: 20 }, // Reporter Name
            { wch: 20 }, // Reporter Contact
            { wch: 20 }, // Reported Date
            { wch: 15 }, // Status
            { wch: 25 }, // Response Team
            { wch: 25 }, // Reached By
            { wch: 20 }, // Reached Date
            { wch: 30 }, // User ID
            { wch: 30 }  // Document ID
        ];
        ws['!cols'] = colWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Relief Locations');

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `Northern_Cebu_Relief_Map_${timestamp}.xlsx`;

        // Download file
        XLSX.writeFile(wb, filename);

        showSuccess(`Excel file downloaded: ${filename}`);
        console.log(`Downloaded ${filteredLocations.length} locations to Excel`);

    } catch (error) {
        console.error('Error downloading Excel:', error);
        showError('Failed to download Excel file. Please try again.');
    }
}

// Handle Excel import
async function handleExcelImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset file input for future uploads
    event.target.value = '';

    if (!window.XLSX) {
        showError('Excel library not loaded. Please refresh the page.');
        return;
    }

    // Validate file type - Accept Excel and JSON files
    const validExcelTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const validJsonTypes = ['application/json', 'text/json'];
    const isExcelFile = validExcelTypes.includes(file.type) || file.name.match(/\.(xlsx|xls)$/i);
    const isJsonFile = validJsonTypes.includes(file.type) || file.name.match(/\.json$/i);

    if (!isExcelFile && !isJsonFile) {
        showError('Please select a valid Excel file (.xlsx or .xls) or JSON file (.json)');
        return;
    }

    // Show loading indicator
    const importBtn = document.getElementById('importExcelBtn');
    const originalHTML = importBtn.innerHTML;
    importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
    importBtn.disabled = true;

    try {
        let jsonData;

        if (isJsonFile) {
            // Handle JSON file
            const textData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });

            try {
                jsonData = JSON.parse(textData);

                // Ensure it's an array
                if (!Array.isArray(jsonData)) {
                    showError('JSON file must contain an array of location objects.');
                    return;
                }
            } catch (parseError) {
                showError('Invalid JSON file format. Please check the file structure.');
                return;
            }
        } else {
            // Handle Excel file
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });

            // Parse Excel file
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            jsonData = XLSX.utils.sheet_to_json(worksheet);
        }

        if (jsonData.length === 0) {
            showError(`The ${isJsonFile ? 'JSON' : 'Excel'} file appears to be empty or has no valid data.`);
            return;
        }

        // Process and validate the imported data
        const processedData = await processImportedData(jsonData);

        if (processedData.length === 0) {
            showError(`No valid location data found in the ${isJsonFile ? 'JSON' : 'Excel'} file.`);
            return;
        }

        // Import the data to Firestore
        const importResults = await importDataToFirestore(processedData);

        // Show results
        const successCount = importResults.success;
        const errorCount = importResults.errors.length;
        const totalProcessed = processedData.length;
        const skippedCount = totalProcessed - successCount - errorCount;

        // Track imported IDs for undo functionality
        lastImportedIds = importResults.importedIds || [];

        let resultMessage = '';
        if (successCount > 0) {
            resultMessage += `✅ Successfully imported ${successCount} locations`;
            if (skippedCount > 0) {
                resultMessage += ` (${skippedCount} duplicates skipped)`;
            }
            showSuccess(resultMessage);

            // Show undo button
            document.getElementById('undoImportBtn').style.display = 'inline-block';

            // Refresh the locations list
            await loadAllLocations();
        }

        if (errorCount > 0) {
            console.warn('Import errors:', importResults.errors);
            showError(`❌ ${errorCount} locations failed to import. Check console for details.`);
        }

        if (successCount === 0 && errorCount === 0 && skippedCount > 0) {
            showError('ℹ️ All locations in the file already exist in the database.');
        }

    } catch (error) {
        console.error('Error importing file:', error);
        showError(`Failed to import ${isJsonFile ? 'JSON' : 'Excel'} file. Please check the file format and try again.`);
    } finally {
        // Reset button
        importBtn.innerHTML = originalHTML;
        importBtn.disabled = false;
    }
}

// Process imported Excel data and validate
async function processImportedData(jsonData) {
    const processedData = [];

    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        try {
            // Map Excel columns to our data structure
            const locationData = {
                id: generateLocationId(),
                name: row['Location Name'] || row['Name'] || row['location'] || '',
                coords: [
                    parseFloat(row['Latitude'] || row['lat'] || 0),
                    parseFloat(row['Longitude'] || row['lng'] || row['lon'] || 0)
                ],
                urgencyLevel: (row['Urgency Level'] || row['Urgency'] || 'moderate').toLowerCase(),
                reliefNeeds: parseReliefNeeds(row['Relief Needs'] || row['Needs'] || ''),
                source: row['Source'] || 'excel-import',
                additionalInfo: row['Additional Information'] || row['Additional Info'] || row['Description'] || row['Info'] || row['Details'] || row['Notes'] || row['Comments'] || '',
                reporterName: row['Reporter Name'] || row['Reporter'] || 'Excel Import',
                reporterContact: row['Reporter Contact'] || row['Contact'] || '',
                timestamp: new Date().toISOString(),
                reached: row['Reached'] === 'Yes' || row['Reached'] === true || row['reached'] === true || false
            };

            // Validate required fields
            if (!locationData.name.trim()) {
                console.warn(`Row ${i + 1}: Missing location name, skipping`);
                continue;
            }

            if (!locationData.coords[0] || !locationData.coords[1] ||
                isNaN(locationData.coords[0]) || isNaN(locationData.coords[1])) {
                console.warn(`Row ${i + 1}: Invalid coordinates, skipping`);
                continue;
            }

            // Validate urgency level
            const validUrgencyLevels = ['critical', 'urgent', 'moderate'];
            if (!validUrgencyLevels.includes(locationData.urgencyLevel)) {
                locationData.urgencyLevel = 'moderate';
            }

            // Validate coordinates are within reasonable bounds for Northern Cebu
            if (locationData.coords[0] < 10.0 || locationData.coords[0] > 12.0 ||
                locationData.coords[1] < 123.0 || locationData.coords[1] > 125.0) {
                console.warn(`Row ${i + 1}: Coordinates outside Northern Cebu region, but including anyway`);
            }

            // Debug log to verify additional info is included
            if (locationData.additionalInfo) {
                console.log(`Row ${i + 1}: Additional info included: "${locationData.additionalInfo}"`);
            }

            processedData.push(locationData);

        } catch (error) {
            console.warn(`Row ${i + 1}: Error processing data:`, error);
        }
    }

    return processedData;
}

// Parse relief needs from string
function parseReliefNeeds(needsString) {
    if (!needsString) return [];

    // Split by common delimiters and clean up
    const needs = needsString.split(/[,;|]/)
        .map(need => need.trim().toLowerCase())
        .filter(need => need.length > 0);

    return needs;
}

// Import processed data to Firestore
async function importDataToFirestore(locations) {
    const results = {
        success: 0,
        errors: [],
        importedIds: []
    };

    for (const location of locations) {
        try {
            // Check if location already exists (by name and approximate coordinates)
            const exists = allLocations.find(existing =>
                existing.name.toLowerCase() === location.name.toLowerCase() &&
                Math.abs(existing.coords[0] - location.coords[0]) < 0.001 &&
                Math.abs(existing.coords[1] - location.coords[1]) < 0.001
            );

            if (exists) {
                console.log(`Location "${location.name}" already exists, skipping`);
                continue;
            }

            // Save to Firestore and get the document ID
            const firestoreId = await saveLocationToFirestore(location);
            if (firestoreId) {
                results.importedIds.push(firestoreId);
                results.success++;
            }

        } catch (error) {
            console.error(`Failed to import location "${location.name}":`, error);
            results.errors.push({
                location: location.name,
                error: error.message
            });
        }
    }

    return results;
}

// Generate unique location ID
function generateLocationId() {
    return 'loc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save location to Firestore and return document ID
async function saveLocationToFirestore(location) {
    try {
        const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
        const docRef = await addDoc(collection(db, 'relief-locations'), {
            ...location,
            reportedAt: location.timestamp,
            userId: currentUser ? currentUser.uid : null,
            createdBy: location.createdBy || (currentUser ? currentUser.uid : null)
        });
        return docRef.id;
    } catch (error) {
        console.error('Error saving to Firestore:', error);
        throw error;
    }
}

// Handle undo import
async function handleUndoImport() {
    if (lastImportedIds.length === 0) {
        showError('No recent import to undo.');
        return;
    }

    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to undo the last import? This will delete ${lastImportedIds.length} imported locations. This action cannot be reversed.`);

    if (!confirmed) {
        return;
    }

    // Show loading indicator
    const undoBtn = document.getElementById('undoImportBtn');
    const originalHTML = undoBtn.innerHTML;
    undoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Undoing...';
    undoBtn.disabled = true;

    try {
        let deletedCount = 0;
        let errorCount = 0;

        // Delete each imported location
        for (const firestoreId of lastImportedIds) {
            try {
                const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
                await deleteDoc(doc(db, 'relief-locations', firestoreId));
                deletedCount++;
                console.log(`Deleted imported location: ${firestoreId}`);
            } catch (error) {
                console.error(`Failed to delete location ${firestoreId}:`, error);
                errorCount++;
            }
        }

        // Clear the imported IDs list
        lastImportedIds = [];

        // Hide undo button
        undoBtn.style.display = 'none';

        // Show results
        if (deletedCount > 0) {
            showSuccess(`✅ Successfully undid import - deleted ${deletedCount} locations`);

            // Refresh the locations list
            await loadAllLocations();
        }

        if (errorCount > 0) {
            showError(`❌ ${errorCount} locations failed to delete. Check console for details.`);
        }

    } catch (error) {
        console.error('Error undoing import:', error);
        showError('Failed to undo import. Please try again.');
    } finally {
        // Reset button
        undoBtn.innerHTML = originalHTML;
        undoBtn.disabled = false;
    }
}

// ========================================
// GOVERNMENT DATA SYNC FUNCTIONALITY
// ========================================

let govtDataMatches = null;

// Auto-sync button (no file needed)
document.getElementById('autoSyncGovtBtn')?.addEventListener('click', async () => {
    if (!confirm('Auto-fetch government data and sync?\n\nThis will automatically:\n1. Fetch reached locations from government site\n2. Match with your pinned locations\n3. Turn matching pins GREEN\n\nContinue?')) {
        return;
    }

    const btn = document.getElementById('autoSyncGovtBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    btn.disabled = true;

    try {
        const userEmail = window.firebaseAuth?.currentUser?.email || 'auto-sync';
        const result = await window.GovtAutoSync.autoSyncWithGovernment(allLocations, userEmail);

        showSuccess(`✅ Auto-sync complete!\n\n` +
            `📊 Government: ${result.govtTotal} locations\n` +
            `✅ Matched: ${result.matched} locations\n` +
            `🟢 Updated: ${result.updated} pins now GREEN`);

        // Refresh table
        await loadAllLocations();

    } catch (error) {
        showError(`Auto-sync failed: ${error.message}\n\nTip: Use "Manual Sync" to upload a CSV/JSON file instead.`);
        console.error('Auto-sync error:', error);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
});

// Manual sync button (file upload)
document.getElementById('syncGovtDataBtn')?.addEventListener('click', () => {
    document.getElementById('govtSyncModal').style.display = 'flex';
    document.getElementById('govtDataFileInput').click();
});

document.getElementById('govtDataFileInput')?.addEventListener('change', handleGovtDataFile);
document.getElementById('confirmSyncBtn')?.addEventListener('click', confirmGovtSync);
document.getElementById('cancelSyncBtn')?.addEventListener('click', closeGovtSyncModal);
document.getElementById('closeGovtSyncModal')?.addEventListener('click', closeGovtSyncModal);

async function handleGovtDataFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        showLoading('Processing government data...');

        const text = await file.text();
        let govtData;

        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
            govtData = window.GovtSync.parseCSV(text);
        } else if (file.name.endsWith('.json')) {
            govtData = window.GovtSync.parseJSON(text);
        } else {
            throw new Error('Unsupported file format. Use CSV or JSON.');
        }

        if (govtData.length === 0) {
            throw new Error('No valid location data found in file');
        }

        // Sync and find matches
        const syncResult = await window.GovtSync.syncWithGovernmentData(
            govtData,
            allLocations,
            { nameSimilarityThreshold: 0.7, maxDistanceKm: 2 }
        );

        govtDataMatches = syncResult.matches;
        displayMatchResults(syncResult);

        document.getElementById('govtSyncModal').style.display = 'flex';
        document.getElementById('confirmSyncBtn').style.display = govtDataMatches.length > 0 ? 'inline-block' : 'none';

        hideLoading();

    } catch (error) {
        hideLoading();
        showError(`Error processing file: ${error.message}`);
        console.error('Government data sync error:', error);
    }

    event.target.value = '';
}

function displayMatchResults(syncResult) {
    const container = document.getElementById('matchResults');

    container.innerHTML = `
        <div style="background: #e7f3ff; padding: 1rem; border-radius: 6px; margin: 1rem 0;">
            <h5 style="margin: 0 0 1rem 0;">📊 Sync Summary</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;">
                <div style="text-align: center; padding: 0.75rem; background: white; border-radius: 6px; border: 2px solid #dee2e6;">
                    <strong style="display: block; font-size: 1.5rem;">${syncResult.summary.total}</strong>
                    <span style="font-size: 0.85rem; color: #666;">Gov't Locations</span>
                </div>
                <div style="text-align: center; padding: 0.75rem; background: #d4edda; border-radius: 6px; border: 2px solid #28a745;">
                    <strong style="display: block; font-size: 1.5rem; color: #28a745;">${syncResult.summary.matched}</strong>
                    <span style="font-size: 0.85rem; color: #666;">Matched</span>
                </div>
                <div style="text-align: center; padding: 0.75rem; background: #fff3cd; border-radius: 6px; border: 2px solid #ffc107;">
                    <strong style="display: block; font-size: 1.5rem; color: #856404;">${syncResult.summary.unmatched}</strong>
                    <span style="font-size: 0.85rem; color: #666;">Not Found</span>
                </div>
                <div style="text-align: center; padding: 0.75rem; background: white; border-radius: 6px; border: 2px solid #dee2e6;">
                    <strong style="display: block; font-size: 1.5rem;">${syncResult.summary.matchRate}</strong>
                    <span style="font-size: 0.85rem; color: #666;">Match Rate</span>
                </div>
            </div>
        </div>
        
        ${syncResult.matches.length > 0 ? `
            <div style="margin: 1.5rem 0;">
                <h5>✅ Matched Locations (${syncResult.matches.length})</h5>
                <p>These locations will be marked as <strong style="color: #28a745;">reached</strong> and turned <strong style="color: #28a745;">green</strong> on the map:</p>
                <div style="max-height: 300px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; padding: 0.5rem; margin-top: 0.5rem;">
                    ${syncResult.matches.map(match => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f8f9fa; border-radius: 4px; margin-bottom: 0.5rem;">
                            <div style="flex: 1;">
                                <strong style="display: block; color: #333;">${match.pinnedLocation.name}</strong>
                                <span style="display: block; font-size: 0.85rem; color: #666; margin-top: 0.25rem;">
                                    Matches: "${match.govtLocation.name}" (${Math.round(match.matchInfo.nameSimilarity * 100)}% similarity${match.matchInfo.distance !== null ? `, ${match.matchInfo.distance.toFixed(2)}km` : ''})
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '<p style="color: #856404; background: #fff3cd; padding: 1rem; border-radius: 6px; margin: 1rem 0;"><i class="fas fa-exclamation-triangle"></i> No matches found in your pinned locations.</p>'}
        
        ${syncResult.unmatched.length > 0 ? `
            <div style="margin: 1.5rem 0;">
                <h5>❌ Not Found (${syncResult.unmatched.length})</h5>
                <details style="margin-top: 0.5rem;">
                    <summary style="cursor: pointer; color: #007bff;">Show unmatched locations</summary>
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; padding: 0.5rem; margin-top: 0.5rem;">
                        ${syncResult.unmatched.slice(0, 20).map(loc => `
                            <div style="padding: 0.5rem; border-bottom: 1px solid #dee2e6;">${loc.name}</div>
                        `).join('')}
                        ${syncResult.unmatched.length > 20 ? `<div style="padding: 0.5rem; font-style: italic;">... and ${syncResult.unmatched.length - 20} more</div>` : ''}
                    </div>
                </details>
            </div>
        ` : ''}
    `;
}

async function confirmGovtSync() {
    if (!govtDataMatches || govtDataMatches.length === 0) {
        showError('No matched locations to sync');
        return;
    }

    try {
        showLoading(`Marking ${govtDataMatches.length} locations as reached...`);

        const userEmail = window.firebaseAuth?.currentUser?.email || 'government-sync';
        const results = await window.GovtSync.markLocationsAsReached(govtDataMatches, userEmail);

        hideLoading();
        closeGovtSyncModal();

        showSuccess(`✅ Successfully marked ${results.success.length} locations as reached! Pins are now green on the map.`);

        if (results.failed.length > 0) {
            showError(`⚠️ ${results.failed.length} locations failed to update. Check console for details.`);
        }

        // Refresh the table
        await loadAllLocations();

    } catch (error) {
        hideLoading();
        showError(`Sync failed: ${error.message}`);
        console.error('Government sync error:', error);
    }
}

function closeGovtSyncModal() {
    document.getElementById('govtSyncModal').style.display = 'none';
    document.getElementById('matchResults').innerHTML = '';
    document.getElementById('confirmSyncBtn').style.display = 'none';
    govtDataMatches = null;
}

// Make functions globally available
window.showDeleteModal = showDeleteModal;
window.viewDetails = viewDetails;
window.toggleReached = toggleReached;
window.viewDonationLog = viewDonationLog;

