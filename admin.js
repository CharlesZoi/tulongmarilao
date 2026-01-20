// Admin Panel
let db = null;
let auth = null;
let currentUser = null;
let allLocations = [];
let filteredLocations = [];
let currentDeleteId = null;
let lastImportedIds = []; let selectedLocationForDeletion = null;
let selectedLocationForDetails = null;
let unsubscribeListener = null;
let rateLimiter = null;
let sessionManager = null;

document.addEventListener('DOMContentLoaded', initAdmin);

// Firebase wait
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
                currentUser = user;
                showDashboard();
                await loadAllLocations();

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

// Event listeners
function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    document.getElementById('searchPins').addEventListener('input', handleSearch);

    document.getElementById('urgencyFilter').addEventListener('change', applyFilters);
    document.getElementById('reachedFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applyFilters);

    document.getElementById('refreshBtn').addEventListener('click', async () => {
        const btn = document.getElementById('refreshBtn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        btn.disabled = true;

        await loadAllLocations();

        btn.innerHTML = originalHTML;
        btn.disabled = false;
    });

    document.getElementById('downloadExcelBtn').addEventListener('click', downloadExcel);


    document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDelete').addEventListener('click', handleDeleteConfirm);

    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);
    document.getElementById('closeDetailsBtn').addEventListener('click', closeDetailsModal);
    document.getElementById('viewOnMapBtn').addEventListener('click', viewOnMap);

    document.getElementById('deleteModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });
    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') closeDetailsModal();
    });
}

// Login handler
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    // Clear previous errors
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Rate limit
    if (rateLimiter) {
        const lockoutStatus = rateLimiter.isLockedOut(email);
        if (lockoutStatus.locked) {
            errorDiv.textContent = `🔒 Account temporarily locked due to too many failed attempts. Please try again in ${lockoutStatus.remainingMinutes} minute(s).`;
            errorDiv.style.display = 'block';
            return;
        }
    }

    // Email validation
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

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;

        await signInWithEmailAndPassword(auth, email, password);

        // Block restricted admin accounts from this panel
        const restrictedAdminEmails = ['louisejane1007@gmail.com'];
        if (restrictedAdminEmails.includes(email.toLowerCase())) {
            await auth.signOut();
            errorDiv.textContent = '🔒 Access denied. Please use your authorized access point.';
            errorDiv.style.display = 'block';
            errorDiv.style.background = '#f8d7da';
            errorDiv.style.borderLeft = '4px solid #dc3545';
            errorDiv.style.padding = '1rem';
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            submitBtn.disabled = false;
            return;
        }

        // Reset rate limit
        if (rateLimiter) {
            rateLimiter.clearAttempts(email);
        }
        console.log('✅ User admin login successful');

    } catch (error) {
        console.error('❌ Login error:', error);

        // Record failed login
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

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        submitBtn.disabled = false;

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

// Logout handler
async function handleLogout() {
    try {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
        await signOut(auth);

        if (unsubscribeListener) {
            unsubscribeListener();
            unsubscribeListener = null;
        }

        currentUser = null;
        allLocations = [];
        filteredLocations = [];

        showLoginScreen();
        console.log('Logout successful');
    } catch (error) {
        console.error('Logout error:', error);
        showError('Failed to logout. Please try again.');
    }
}

// Show login
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminDashboard').style.display = 'none';

    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';

    if (currentUser && currentUser.email) {
        document.getElementById('adminUserEmail').textContent = currentUser.email;

        const viewMapBtn = document.getElementById('viewMapBtn');
        const mapBtnText = document.getElementById('mapBtnText');
        const mapAccessText = document.getElementById('mapAccessText');
        const adminPanelTitle = document.getElementById('adminPanelTitle');
        const adminPanelSubtitle = document.getElementById('adminPanelSubtitle');
        const adminPanelIcon = document.getElementById('adminPanelIcon');

        if (viewMapBtn) {
            viewMapBtn.href = 'index.html';
            viewMapBtn.title = 'View public map';
        }
        if (mapBtnText) mapBtnText.textContent = 'View Map';

        if (adminPanelTitle) adminPanelTitle.textContent = 'User Admin Dashboard';
        if (adminPanelSubtitle) adminPanelSubtitle.textContent = 'Relief Map Coordination';
        if (adminPanelIcon) adminPanelIcon.className = 'fas fa-th-large';

        if (mapAccessText) {
            mapAccessText.innerHTML = `
                <strong style="color: #0066cc;">User Admin Access</strong>
                <p style="margin: 0.25rem 0 0 0; color: #333; font-size: 0.9rem;">
                    Click <strong>"View Map"</strong> to access the public map. 
                    You can view and add pins, but cannot delete them. Use the checkboxes here to mark locations as reached.
                </p>
            `;
        }
    }
}

// Local storage fallback
function loadLocationsFromLocalStorage() {
    try {
        const saved = localStorage.getItem('userReportedLocations');
        if (saved) {
            const localLocations = JSON.parse(saved);
            allLocations = Array.isArray(localLocations) ? localLocations : [];
            console.log(`Loaded ${allLocations.length} locations from local storage`);
            updateStats();
            applyFilters();
            showSuccess('Using locally saved data (offline mode)');
            return true;
        }
    } catch (error) {
        console.error('Error loading from local storage:', error);
    }
    return false;
}

// Load locations
async function loadAllLocations() {
    try {
        const { collection, onSnapshot, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        const hasLocalData = loadLocationsFromLocalStorage();

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

                if (hasLocalData) {
                    showSuccess('Connected to server. Showing latest data.');
                }
            },
            (error) => {
                console.error('Error loading from Firestore:', error);

                if (!hasLocalData) {
                    showError('Failed to load locations. Using local data if available.');
                    loadLocationsFromLocalStorage();
                }
            }
        );

    } catch (error) {
        console.error('Error setting up Firestore listener:', error);

        if (!loadLocationsFromLocalStorage()) {
            showError('Failed to load locations. Please check your connection and refresh the page.');
        }
    }
}

// Update stats
function updateStats() {
    const critical = allLocations.filter(loc => loc.urgencyLevel === 'critical').length;
    const urgent = allLocations.filter(loc => loc.urgencyLevel === 'urgent').length;
    const moderate = allLocations.filter(loc => loc.urgencyLevel === 'moderate').length;
    const total = allLocations.length;

    document.getElementById('criticalCount').textContent = critical;
    document.getElementById('urgentCount').textContent = urgent;
    document.getElementById('moderateCount').textContent = moderate;
    document.getElementById('totalCount').textContent = total;
}

// Search
function handleSearch() {
    applyFilters();
}

// Filter/sort
function applyFilters() {
    const searchTerm = document.getElementById('searchPins').value.toLowerCase().trim();
    const urgencyFilter = document.getElementById('urgencyFilter').value;
    const reachedFilter = document.getElementById('reachedFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    filteredLocations = allLocations.filter(location => {
        filter
        const matchesSearch = !searchTerm ||
            location.name.toLowerCase().includes(searchTerm) ||
            location.source.toLowerCase().includes(searchTerm) ||
            (location.reporterName && location.reporterName.toLowerCase().includes(searchTerm)) ||
            (location.additionalInfo && location.additionalInfo.toLowerCase().includes(searchTerm)) ||
            (location.reachedByTeam && location.reachedByTeam.toLowerCase().includes(searchTerm)) ||
            location.reliefNeeds.some(need => need.toLowerCase().includes(searchTerm));

        const matchesUrgency = urgencyFilter === 'all' || location.urgencyLevel === urgencyFilter;

        const isReached = location.reached || false;
        const matchesReached = reachedFilter === 'all' ||
            (reachedFilter === 'reached' && isReached) ||
            (reachedFilter === 'not-reached' && !isReached);

        return matchesSearch && matchesUrgency && matchesReached;
    });

    // Sort reached first
    filteredLocations.sort((a, b) => {
        const aReached = a.reached || false;
        const bReached = b.reached || false;

        if (aReached !== bReached) {
            return bReached ? 1 : -1; // Reached items come first
        }

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

// Render table
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
        const urgencyColor = getUrgencyColor(location.urgencyLevel);
        const urgencyText = location.urgencyLevel.charAt(0).toUpperCase() + location.urgencyLevel.slice(1);
        const date = new Date(location.reportedAt).toLocaleString();
        const reliefNeeds = location.reliefNeeds.join(', ');
        const reporter = location.reporterName || 'Anonymous';
        const isReached = location.reached || false;
        const peopleCount = Number.isFinite(location.peopleCount)
            ? location.peopleCount.toLocaleString()
            : '—';

        const actionButtons = `
            <button class="btn-icon btn-info" onclick="viewDetails('${location.firestoreId}')" title="View Details">
                <i class="fas fa-eye"></i>
            </button>
            <label class="checkbox-container" title="${isReached ? 'Mark as not reached' : 'Mark as reached'}">
                <input type="checkbox" 
                       ${isReached ? 'checked' : ''} 
                       onchange="toggleReached('${location.firestoreId}', this.checked)">
                <span class="checkmark"></span>
                <span class="checkbox-label">${isReached ? 'Reached' : 'Mark Reached'}</span>
            </label>
        `;

        return `
            <tr data-id="${location.firestoreId}" class="${isReached ? 'reached-location' : ''}">
                <td>
                    <strong>${escapeHtml(location.name)}</strong>
                    <br>
                    <small class="text-muted">${location.coords[0].toFixed(4)}, ${location.coords[1].toFixed(4)}</small>
                    ${isReached ? `<br><span class="reached-badge"><i class="fas fa-check-circle"></i> Reached${location.reachedByTeam ? ' by ' + escapeHtml(location.reachedByTeam) : ''}</span>` : ''}
                </td>
                <td>
                    <span class="urgency-badge" style="background-color: ${urgencyColor};">
                        ${urgencyText}
                    </span>
                </td>
                <td>
                    <span class="source-badge">${escapeHtml(location.source.toUpperCase())}</span>
                </td>
                <td>
                    <div class="relief-needs-cell">${escapeHtml(reliefNeeds)}</div>
                </td>
                <td>${peopleCount}</td>
                <td>${escapeHtml(reporter)}</td>
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

// Urgency color
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

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Delete modal
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

// Close modal
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    selectedLocationForDeletion = null;
}

// Confirm delete
async function handleDeleteConfirm() {
    if (!selectedLocationForDeletion) return;

    const confirmBtn = document.getElementById('confirmDelete');
    const originalHTML = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    confirmBtn.disabled = true;

    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        await deleteDoc(doc(db, 'relief-locations', selectedLocationForDeletion.firestoreId));

        console.log('Location deleted successfully:', selectedLocationForDeletion.name);
        showSuccess(`Successfully deleted "${selectedLocationForDeletion.name}"`);

        closeDeleteModal();

    } catch (error) {
        console.error('Error deleting location:', error);
        showError('Failed to delete location. Please try again.');

        confirmBtn.innerHTML = originalHTML;
        confirmBtn.disabled = false;
    }
}

// Details
function viewDetails(firestoreId) {
    const location = allLocations.find(loc => loc.firestoreId === firestoreId);
    if (!location) return;

    selectedLocationForDetails = location;

    const detailsDiv = document.getElementById('locationDetails');
    const urgencyColor = getUrgencyColor(location.urgencyLevel);

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
                        <span class="urgency-badge" style="background-color: ${urgencyColor};">
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

            ${location.reached ? `
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
            ` : ''}

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

// Close modal
function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
    selectedLocationForDetails = null;
}

// View map
function viewOnMap() {
    if (!selectedLocationForDetails) return;

    const coords = selectedLocationForDetails.coords;
    window.open(`index.html#${coords[0]},${coords[1]},15`, '_blank');
}

// Success message
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

// Toggle reached
async function toggleReached(firestoreId, isReached) {
    // If marking as reached, show team name modal
    if (isReached) {
        showTeamNameModal(firestoreId);
    } else {
        // Unmarking as reached - proceed directly
        await updateReachedStatus(firestoreId, false, null);
    }
}

// Team name modal
function showTeamNameModal(firestoreId) {
    const modal = document.getElementById('teamNameModal');
    const input = document.getElementById('teamNameInput');
    const confirmBtn = document.getElementById('confirmTeamName');
    const cancelBtn = document.getElementById('cancelTeamName');
    const closeBtn = document.getElementById('closeTeamModal');

    // Pre-fill with saved team name
    const savedTeamName = localStorage.getItem('userTeamName');
    input.value = savedTeamName || (currentUser ? currentUser.displayName : '');

    // Show modal
    modal.style.display = 'flex';
    input.focus();
    input.select();

    // Handle confirm
    const handleConfirm = async () => {
        const teamName = input.value.trim();
        if (!teamName) {
            input.style.borderColor = '#dc3545';
            input.focus();
            return;
        }

        // Save team name for future use
        localStorage.setItem('userTeamName', teamName);

        // Close modal
        modal.style.display = 'none';

        // Update status
        await updateReachedStatus(firestoreId, true, teamName);

        // Cleanup
        cleanup();
    };

    // Handle cancel
    const handleCancel = () => {
        modal.style.display = 'none';
        // Uncheck the checkbox
        const checkbox = document.querySelector(`input[onchange*="${firestoreId}"]`);
        if (checkbox) checkbox.checked = false;
        cleanup();
    };

    // Cleanup event listeners
    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keypress', handleEnter);
    };

    // Handle Enter key
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    // Add event listeners
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    input.addEventListener('keypress', handleEnter);
}

// Update reached status in Firestore
async function updateReachedStatus(firestoreId, isReached, teamName) {
    try {
        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        await updateDoc(doc(db, 'relief-locations', firestoreId), {
            reached: isReached,
            reachedAt: isReached ? new Date().toISOString() : null,
            reachedBy: isReached ? (currentUser ? currentUser.email : 'Unknown') : null,
            reachedByTeam: isReached ? teamName : null
        });

        const message = isReached
            ? `✅ Location marked as reached by ${teamName}`
            : 'Location marked as not reached';
        showSuccess(message);

        console.log(`Location ${firestoreId} marked as ${isReached ? 'reached' : 'not reached'}${isReached ? ' by ' + teamName : ''}`);

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
        undoBtn.innerHTML = originalHTML;
        undoBtn.disabled = false;
    }
}

// Make functions globally available
window.showDeleteModal = showDeleteModal;
window.viewDetails = viewDetails;
window.toggleReached = toggleReached;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initAdmin);
