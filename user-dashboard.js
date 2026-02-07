// User Dashboard JavaScript
// Handles personal activity tracking for guest users
let db = null;
let auth = null;
let currentUser = null;
let allLocations = [];
let userReportedLocations = [];
let userSupportedLocations = [];
let userDonationLogs = [];
let guestId = null;
let unsubscribeListener = null;
let donationLogsUnsubscribe = null;

// Guest session keys
const GUEST_SESSION_KEY = 'guestSessionId';
const GUEST_ACTIVITY_KEY = 'guestActivityLogs';

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);

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

async function initDashboard() {
    try {
        await waitForFirebase();
        console.log('Firebase loaded successfully');

        // Initialize guest session
        guestId = initializeGuestSession();
        updateUserDisplay();

        // Load data
        await loadAllLocations();
        await loadDonationLogs();
        loadGuestActivities();

        // Setup event listeners
        setupEventListeners();

        // Update stats and display
        updateStats();
        setActiveSection('reported');
    } catch (error) {
        console.error('Failed to initialize user dashboard:', error);
        showError('Failed to initialize. Please refresh the page.');
    }
}

// Guest session management
function generateGuestId() {
    const randomSegment = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    return `Guest${randomSegment}`;
}

function getStoredGuestId() {
    return localStorage.getItem(GUEST_SESSION_KEY);
}

function initializeGuestSession() {
    const existingGuestId = getStoredGuestId();
    if (existingGuestId) {
        return existingGuestId;
    }

    const newGuestId = generateGuestId();
    localStorage.setItem(GUEST_SESSION_KEY, newGuestId);
    if (!localStorage.getItem(GUEST_ACTIVITY_KEY)) {
        localStorage.setItem(GUEST_ACTIVITY_KEY, JSON.stringify([]));
    }
    return newGuestId;
}

function loadGuestActivities() {
    const stored = localStorage.getItem(GUEST_ACTIVITY_KEY);
    if (!stored) {
        return [];
    }

    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse guest activity logs:', error);
        return [];
    }
}

function getGuestActivities() {
    const activities = loadGuestActivities();
    return activities.filter(activity => activity.guestId === guestId);
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.getElementById('backToMapBtn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Section toggles
    document.getElementById('showReportedBtn').addEventListener('click', () => setActiveSection('reported'));
    document.getElementById('showSupportedBtn').addEventListener('click', () => setActiveSection('supported'));
    document.getElementById('showDonationsBtn').addEventListener('click', () => setActiveSection('donations'));

    // Reported locations controls
    document.getElementById('searchReported').addEventListener('input', renderReportedLocations);
    document.getElementById('reportedUrgencyFilter').addEventListener('change', renderReportedLocations);
    document.getElementById('reportedStatusFilter').addEventListener('change', renderReportedLocations);
    document.getElementById('reportedSortBy').addEventListener('change', renderReportedLocations);
    document.getElementById('refreshReportedBtn').addEventListener('click', async () => {
        await loadAllLocations();
        renderReportedLocations();
    });

    // Supported locations controls
    document.getElementById('searchSupported').addEventListener('input', renderSupportedLocations);
    document.getElementById('supportedStatusFilter').addEventListener('change', renderSupportedLocations);
    document.getElementById('refreshSupportedBtn').addEventListener('click', async () => {
        await loadAllLocations();
        renderSupportedLocations();
    });

    // Donation logs controls
    document.getElementById('searchDonations').addEventListener('input', renderDonationLogs);
    document.getElementById('donationsDeliveryFilter').addEventListener('change', renderDonationLogs);
    document.getElementById('refreshDonationsBtn').addEventListener('click', async () => {
        await loadDonationLogs();
        renderDonationLogs();
    });

    // Export data
    document.getElementById('exportDataBtn').addEventListener('click', exportUserData);

    // Download format
    document.getElementById('downloadFormatBtn').addEventListener('click', downloadSheetFormat);

    // Modal controls
    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);

    document.getElementById('closeDonationDetailsModal').addEventListener('click', closeDonationDetailsModal);
    document.getElementById('closeDonationDetailsBtn').addEventListener('click', closeDonationDetailsModal);

    // Edit location modal
    document.getElementById('closeEditLocationModal').addEventListener('click', closeEditLocationModal);
    document.getElementById('cancelEditLocation').addEventListener('click', closeEditLocationModal);
    document.getElementById('editLocationForm').addEventListener('submit', handleEditLocationSubmit);

    // Delete location modal
    document.getElementById('closeDeleteLocationModal').addEventListener('click', closeDeleteLocationModal);
    document.getElementById('cancelDeleteLocation').addEventListener('click', closeDeleteLocationModal);
    document.getElementById('confirmDeleteLocation').addEventListener('click', handleDeleteLocation);

    // Close modals on outside click
    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') closeDetailsModal();
    });
    document.getElementById('donationDetailsModal').addEventListener('click', (e) => {
        if (e.target.id === 'donationDetailsModal') closeDonationDetailsModal();
    });
    document.getElementById('editLocationModal').addEventListener('click', (e) => {
        if (e.target.id === 'editLocationModal') closeEditLocationModal();
    });
    document.getElementById('deleteLocationModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteLocationModal') closeDeleteLocationModal();
    });
}

// Load all locations from Firestore
async function loadAllLocations() {
    try {
        const { collection, onSnapshot, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

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
                filterUserLocations();
                updateStats();
                renderCurrentSection();
            },
            (error) => {
                console.error('Error loading from Firestore:', error);
                showError('Failed to load locations. Please refresh the page.');
            }
        );

    } catch (error) {
        console.error('Error setting up Firestore listener:', error);
        showError('Failed to load locations. Please check your connection and refresh.');
    }
}

// Load donation logs from Firestore
async function loadDonationLogs() {
    try {
        const { collection, onSnapshot, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        if (donationLogsUnsubscribe) {
            donationLogsUnsubscribe();
        }

        const logsQuery = query(collection(db, 'donation-logs'), orderBy('submittedAt', 'desc'));

        donationLogsUnsubscribe = onSnapshot(
            logsQuery,
            (snapshot) => {
                userDonationLogs = [];
                snapshot.forEach((doc) => {
                    const data = doc.data() || {};
                    data.firestoreId = doc.id;

                    // Filter by guest ID AND ensure it's for user's reported location
                    const isUserDonation = data.guestId === guestId ||
                        (data.donorEmail && data.donorEmail.includes(guestId.toLowerCase())) ||
                        (data.donorName && data.donorName.toLowerCase().includes(guestId.toLowerCase()));

                    if (isUserDonation) {
                        // Check if this donation is for a location the user reported
                        const guestActivities = getGuestActivities();
                        const reportedLocationIds = new Set();

                        guestActivities.forEach(activity => {
                            if (activity.type === 'report' && activity.locationId) {
                                reportedLocationIds.add(activity.locationId);
                            }
                        });

                        // Only include donation if it's for a user-reported location
                        if (data.locationId && reportedLocationIds.has(data.locationId)) {
                            userDonationLogs.push(data);
                        }
                    }
                });

                console.log(`Loaded ${userDonationLogs.length} user donation logs from Firestore`);
                console.log('✅ Donation logs are now limited to user-reported locations only');
                updateStats();
                renderCurrentSection();
            },
            (error) => {
                console.error('Error loading donation logs:', error);
                userDonationLogs = [];
                renderCurrentSection();
                showError('Failed to load donation logs. Please refresh the page.');
            }
        );
    } catch (error) {
        console.error('Error setting up donation log listener:', error);
        userDonationLogs = [];
        renderCurrentSection();
        showError('Failed to load donation logs. Please check your connection and refresh.');
    }
}

// Filter locations for current user
function filterUserLocations() {
    const guestActivities = getGuestActivities();

    // Get reported locations from guest activities
    const reportedLocationIds = new Set();
    guestActivities.forEach(activity => {
        if (activity.type === 'report' && activity.locationId) {
            reportedLocationIds.add(activity.locationId);
        }
    });

    // Get supported locations - ONLY from user's reported locations
    const supportedLocationIds = new Set();
    guestActivities.forEach(activity => {
        if ((activity.type === 'donation' || activity.type === 'support') && activity.locationId) {
            // Only add to supported if user reported this location
            if (reportedLocationIds.has(activity.locationId)) {
                supportedLocationIds.add(activity.locationId);
            }
        }
    });

    // Also check donation logs for supported locations - BUT ONLY for user's reported locations
    userDonationLogs.forEach(log => {
        if (log.locationId && reportedLocationIds.has(log.locationId)) {
            supportedLocationIds.add(log.locationId);
        }
    });

    // Filter locations
    userReportedLocations = allLocations.filter(location =>
        reportedLocationIds.has(location.firestoreId) || reportedLocationIds.has(location.id)
    );

    // IMPORTANT: Supported locations must be a subset of reported locations
    userSupportedLocations = allLocations.filter(location =>
        reportedLocationIds.has(location.firestoreId) || reportedLocationIds.has(location.id)
    ).filter(location =>
        supportedLocationIds.has(location.firestoreId) || supportedLocationIds.has(location.id)
    );

    console.log(`User filtering - Reported IDs: [${Array.from(reportedLocationIds).join(', ')}]`);
    console.log(`User filtering - Supported IDs: [${Array.from(supportedLocationIds).join(', ')}]`);
    console.log(`User reported: ${userReportedLocations.length}, supported: ${userSupportedLocations.length}`);
    console.log('✅ Supported locations are now limited to user-reported locations only');
}

// Update user display
function updateUserDisplay() {
    const userGuestIdElement = document.getElementById('userGuestId');
    if (userGuestIdElement) {
        userGuestIdElement.textContent = guestId;
    }
}

// Update statistics
function updateStats() {
    document.getElementById('reportedCount').textContent = userReportedLocations.length;
    document.getElementById('supportedCount').textContent = userSupportedLocations.length;
    document.getElementById('donationCount').textContent = userDonationLogs.length;

    const reachedCount = [...userReportedLocations, ...userSupportedLocations]
        .filter(location => location.reached === true).length;
    document.getElementById('reachedCount').textContent = reachedCount;

    const totalActivities = getGuestActivities().length;
    document.getElementById('activityCount').textContent = totalActivities;
}

// Section management
function setActiveSection(section) {
    const sections = ['reported', 'supported', 'donations'];
    const buttons = {
        'reported': 'showReportedBtn',
        'supported': 'showSupportedBtn',
        'donations': 'showDonationsBtn'
    };

    sections.forEach(s => {
        const sectionElement = document.getElementById(`${s}Section`);
        const buttonElement = document.getElementById(buttons[s]);

        if (sectionElement) {
            sectionElement.style.display = s === section ? 'block' : 'none';
        }
        if (buttonElement) {
            buttonElement.classList.toggle('is-active', s === section);
            buttonElement.setAttribute('aria-pressed', String(s === section));
        }
    });

    renderCurrentSection();
}

function renderCurrentSection() {
    const activeSection = document.querySelector('[id$="Section"]:not([style*="display: none"])');
    if (activeSection) {
        const sectionName = activeSection.id.replace('Section', '');
        switch (sectionName) {
            case 'reported':
                renderReportedLocations();
                break;
            case 'supported':
                renderSupportedLocations();
                break;
            case 'donations':
                renderDonationLogs();
                break;
        }
    }
}

// Render reported locations
function renderReportedLocations() {
    const tableBody = document.getElementById('reportedTableBody');
    const emptyState = document.getElementById('reportedEmptyState');

    if (!tableBody) return;

    const searchTerm = document.getElementById('searchReported')?.value.toLowerCase().trim() || '';
    const urgencyFilter = document.getElementById('reportedUrgencyFilter')?.value || 'all';
    const statusFilter = document.getElementById('reportedStatusFilter')?.value || 'all';
    const sortBy = document.getElementById('reportedSortBy')?.value || 'date-desc';

    let filtered = userReportedLocations.filter(location => {
        const matchesSearch = !searchTerm ||
            (location.locationName && location.locationName.toLowerCase().includes(searchTerm)) ||
            (location.landmark && location.landmark.toLowerCase().includes(searchTerm));

        const matchesUrgency = urgencyFilter === 'all' || location.urgency === urgencyFilter;

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'reached' && location.reached === true) ||
            (statusFilter === 'not-reached' && location.reached !== true);

        return matchesSearch && matchesUrgency && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date-asc':
                return new Date(a.reportedAt || 0).getTime() - new Date(b.reportedAt || 0).getTime();
            case 'date-desc':
                return new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime();
            case 'urgency':
                const urgencyOrder = { critical: 3, urgent: 2, moderate: 1 };
                return (urgencyOrder[b.urgency] || 0) - (urgencyOrder[a.urgency] || 0);
            case 'name':
                return (a.locationName || '').localeCompare(b.locationName || '');
            default:
                return 0;
        }
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = filtered.map(location => `
        <tr data-id="${location.firestoreId}">
            <td>
                <strong>${escapeHtml(location.locationName || location.name || 'Unknown')}</strong>
            </td>
            <td>
                <span class="urgency-badge urgency-${location.urgency || location.urgencyLevel || 'moderate'}">
                    ${capitalizeFirst(location.urgency || location.urgencyLevel || 'moderate')}
                </span>
            </td>
            <td>
                <small>${formatDate(location.reportedAt)}</small>
            </td>
            <td>
                ${location.reached === true
            ? '<span class="status-badge status-reached"><i class="fas fa-check"></i> Reached</span>'
            : '<span class="status-badge status-pending"><i class="fas fa-clock"></i> Pending</span>'
        }
            </td>
            <td class="actions-cell">
                <button class="btn-icon btn-info" onclick="showLocationDetails('${location.firestoreId}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon btn-warning" onclick="editLocation('${location.firestoreId}')" title="Edit Location">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" onclick="deleteLocation('${location.firestoreId}')" title="Delete Location">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Add click handlers for location details
    tableBody.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('click', () => {
            const locationId = row.dataset.id;
            const location = userReportedLocations.find(l => l.firestoreId === locationId);
            if (location) showLocationDetails(location);
        });
    });
}

// Render supported locations
function renderSupportedLocations() {
    const tableBody = document.getElementById('supportedTableBody');
    const emptyState = document.getElementById('supportedEmptyState');

    if (!tableBody) return;

    const searchTerm = document.getElementById('searchSupported')?.value.toLowerCase().trim() || '';
    const statusFilter = document.getElementById('supportedStatusFilter')?.value || 'all';

    let filtered = userSupportedLocations.filter(location => {
        const matchesSearch = !searchTerm ||
            (location.locationName && location.locationName.toLowerCase().includes(searchTerm));

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'reached' && location.reached === true) ||
            (statusFilter === 'not-reached' && location.reached !== true);

        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = filtered.map(location => {
        return `
            <tr data-id="${location.firestoreId}">
                <td>
                    <strong>${escapeHtml(location.locationName || location.name || 'Unknown')}</strong>
                </td>
                <td>
                    <span class="urgency-badge urgency-${location.urgency || location.urgencyLevel || 'moderate'}">
                        ${capitalizeFirst(location.urgency || location.urgencyLevel || 'moderate')}
                    </span>
                </td>
                <td>
                    <small>${formatDate(location.supportedAt || location.reportedAt)}</small>
                </td>
                <td>
                    ${location.reached === true
                ? '<span class="status-badge status-reached"><i class="fas fa-check"></i> Reached</span>'
                : '<span class="status-badge status-pending"><i class="fas fa-clock"></i> Pending</span>'
            }
                </td>
                <td class="actions-cell">
                    <button class="btn-icon btn-info" onclick="showLocationDetails('${location.firestoreId}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Add click handlers for location details
    tableBody.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('click', (e) => {
            if (!e.target.closest('.actions-cell')) {
                const locationId = row.dataset.id;
                const location = userSupportedLocations.find(l => l.firestoreId === locationId);
                if (location) showLocationDetails(location);
            }
        });
    });
}

// Render donation logs
function renderDonationLogs() {
    const tableBody = document.getElementById('donationsTableBody');
    const emptyState = document.getElementById('donationsEmptyState');

    if (!tableBody) return;

    const searchTerm = document.getElementById('searchDonations')?.value.toLowerCase().trim() || '';
    const deliveryFilter = document.getElementById('donationsDeliveryFilter')?.value || 'all';

    const filtered = userDonationLogs.filter(log => {
        const matchesSearch = !searchTerm || getDonationSearchText(log).includes(searchTerm);

        const deliveryStatus = getDonationDeliveryStatus(log);
        const matchesDelivery = deliveryFilter === 'all' ||
            (deliveryFilter === 'on-the-way' && deliveryStatus.status === 'on-the-way') ||
            (deliveryFilter === 'reached' && deliveryStatus.status === 'reached');

        return matchesSearch && matchesDelivery;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = filtered.map(log => {
        // Find the corresponding location from user's reported locations
        const location = userReportedLocations.find(loc =>
            loc.firestoreId === log.locationId || loc.id === log.locationId
        );
        const locationName = location ? (location.locationName || location.name || 'Unknown location') : 'Unknown location';

        const itemsSummary = formatDonationItemsSummary(log.items);
        const cashLabel = formatCashAmount(log.cashAmount);
        const submittedLabel = formatDonationDate(log.submittedAt);
        const deliveryStatus = getDonationDeliveryStatus(log);

        return `
            <tr data-id="${log.firestoreId}">
                <td>
                    <strong>${escapeHtml(locationName)}</strong>
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
                    <button class="btn-icon btn-info" onclick="showDonationDetails('${log.firestoreId}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Helper functions
function getSupportType(location) {
    // Check if user has donated to this location
    const hasDonation = userDonationLogs.some(log =>
        log.locationId === location.firestoreId || log.locationId === location.id
    );
    return hasDonation ? 'Donations' : 'Support';
}

function getDonationSearchText(log) {
    if (!log) return '';

    const locationName = log.location && log.location.name ? log.location.name : '';
    const itemsText = Array.isArray(log.items)
        ? log.items.map(item => {
            const parts = [item.name, item.quantity, item.unit]
                .filter(value => value !== null && value !== undefined && value !== '');
            return parts.join(' ');
        }).join(' ')
        : '';

    return [locationName, itemsText, log.notes, log.cashAmount]
        .filter(value => value !== null && value !== undefined && value !== '')
        .map(value => value.toString().toLowerCase())
        .join(' ');
}

function getDonationDeliveryStatus(log) {
    if (!log || typeof log !== 'object') {
        return { status: 'pending', label: 'Awaiting update' };
    }

    const hasReached = log.reached === true || log.hasReached === true || log.isReached === true || log.delivered === true;
    const isOnTheWay = log.onTheWay === true || log.on_the_way === true || log.isOnTheWay === true;

    let status = null;
    if (hasReached) {
        status = 'reached';
    } else if (isOnTheWay) {
        status = 'on-the-way';
    } else {
        status = 'pending';
    }

    const label = status === 'reached'
        ? 'Donations reached'
        : status === 'on-the-way'
            ? 'On-the-way operations'
            : 'Awaiting update';

    return { status, label };
}

function formatReliefNeeds(needs) {
    if (!needs || !Array.isArray(needs)) return '--';
    return needs.map(need => `<span class="need-tag">${escapeHtml(need)}</span>`).join(' ');
}

function formatDonationItemsSummary(items) {
    if (!items || !Array.isArray(items) || items.length === 0) return 'No items';
    return items.slice(0, 3).map(item => {
        const quantity = item.quantity || '';
        const unit = item.unit || '';
        const name = item.name || '';
        return `${quantity} ${unit} ${name}`.trim();
    }).join(', ') + (items.length > 3 ? '...' : '');
}

function formatCashAmount(amount) {
    if (!amount || amount === 0) return '--';
    return `₱${parseFloat(amount).toLocaleString()}`;
}

function formatDate(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDonationDate(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Modal functions
function showLocationDetails(location) {
    const modal = document.getElementById('detailsModal');
    const detailsContainer = document.getElementById('locationDetails');

    if (!modal || !detailsContainer || !location) return;

    // Clear any existing content first
    detailsContainer.innerHTML = '';

    const needs = location.reliefNeeds && Array.isArray(location.reliefNeeds)
        ? location.reliefNeeds.map(need => `<span class="need-tag">${escapeHtml(need)}</span>`).join(' ')
        : 'None specified';

    const coords = location.coords && Array.isArray(location.coords)
        ? [location.coords[0], location.coords[1]]
        : (location.lat && location.lng
            ? [location.lat, location.lng]
            : null);

    detailsContainer.innerHTML = `
        <div class="location-details-grid">
            <div class="location-details-left">
                <div class="location-details">
                    <h4>${escapeHtml(location.locationName || location.name || 'Unknown Location')}</h4>
                    ${location.landmark ? `<p><strong>Landmark:</strong> ${escapeHtml(location.landmark)}</p>` : ''}
                    <p><strong>Urgency:</strong> 
                        <span class="urgency-badge urgency-${location.urgency || location.urgencyLevel || 'moderate'}">
                            ${capitalizeFirst(location.urgency || location.urgencyLevel || 'moderate')}
                        </span>
                    </p>
                    <p><strong>Relief Needs:</strong> ${needs}</p>
                    ${location.peopleCount ? `<p><strong>People Affected:</strong> ${location.peopleCount}</p>` : ''}
                    ${location.additionalInfo ? `<p><strong>Additional Info:</strong> ${escapeHtml(location.additionalInfo)}</p>` : ''}
                    ${(() => {
            // Handle legacy data where contactPerson might not be set
            const reportedBy = location.reporterName || 'Anonymous';
            const contactPerson = location.contactPerson || reportedBy;

            // If reporterName looks like a guest ID or email, use it as reportedBy
            // Otherwise, it's likely the contact person from legacy data
            const actualReporter = (reportedBy.includes('Guest') || reportedBy.includes('@'))
                ? reportedBy
                : (location.userId || location.guestId || 'Anonymous');

            return `
                            <p><strong>Contact Person:</strong> ${escapeHtml(contactPerson)}</p>
                        `;
        })()}
                    ${location.reporterContact ? `<p><strong>Contact:</strong> ${escapeHtml(location.reporterContact)}</p>` : ''}
                    ${(() => {
            // Handle legacy data where contactPerson might not be set
            const reportedBy = location.reporterName || 'Anonymous';
            const contactPerson = location.contactPerson || reportedBy;

            // If reporterName looks like a guest ID or email, use it as reportedBy
            // Otherwise, it's likely the contact person from legacy data
            const actualReporter = (reportedBy.includes('Guest') || reportedBy.includes('@'))
                ? reportedBy
                : (location.userId || location.guestId || 'Anonymous');

            return `
                            <p><strong>Reported By:</strong> ${escapeHtml(actualReporter)}</p>
                        `;
        })()}
                    <p><strong>Reported:</strong> ${formatDate(location.reportedAt)}</p>
                    <p><strong>Status:</strong> 
                        ${location.reached === true
            ? '<span class="status-badge status-reached"><i class="fas fa-check"></i> Reached</span>'
            : '<span class="status-badge status-pending"><i class="fas fa-clock"></i> Pending</span>'
        }
                    </p>
                    ${coords ? `
                        <p><strong>Coordinates:</strong> ${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}</p>
                    ` : ''}
                </div>
            </div>
            <div class="location-details-right">
                <div class="mini-map-container">
                    <div class="confirm-location-preview" id="locationDetailsPreviewWrapper">
                        <div id="miniMap" class="confirm-location-preview-map"></div>
                        <div class="confirm-location-preview-pin">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                    </div>
                    ${coords ? `
                        <div class="map-actions">
                            <button class="btn btn-sm btn-primary" onclick="openInGoogleMaps(${coords[0]}, ${coords[1]}, '${escapeHtml(location.locationName || location.name || 'Location')}')" style="margin-right: 8px;">
                                <i class="fab fa-google"></i> Google Maps
                            </button>
                            <button class="btn btn-sm btn-info" onclick="openInWaze(${coords[0]}, ${coords[1]}, '${escapeHtml(location.locationName || location.name || 'Location')}')">
                                <i class="fab fa-waze"></i> Waze
                            </button>
                        </div>
                    ` : ''}
                    
                    <!-- Photo Gallery Section -->
                    ${(() => {
            return createImageGallery(location.images, location.firestoreId || location.id, location);
        })()}
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Initialize mini map after modal is shown
    setTimeout(() => {
        if (coords) {
            initializeMiniMap(coords);
        }
    }, 300);
}

function initializeMiniMap(coords, retryCount = 0) {
    const miniMapContainer = document.getElementById('miniMap');

    if (!miniMapContainer) {
        if (retryCount < 3) {
            setTimeout(() => initializeMiniMap(coords, retryCount + 1), 200);
        }
        return;
    }

    if (!coords) return;

    // Use static map for reliable display
    showStaticMap(miniMapContainer, coords);
}

// Static map display using same method as confirm location modal
function showStaticMap(container, coords) {
    // Use the same method as confirm location modal
    const previewWrapper = document.getElementById('locationDetailsPreviewWrapper');
    if (previewWrapper && coords) {
        // Convert array to object format like confirm location modal expects
        const coordsObj = { lat: coords[0], lng: coords[1] };
        const staticMapUrl = getConfirmPreviewUrl(coordsObj);

        // Set the background image
        previewWrapper.style.backgroundImage = `url('${staticMapUrl}')`;
        previewWrapper.style.backgroundSize = 'cover';
        previewWrapper.style.backgroundPosition = 'center';
        console.log('Static map URL:', staticMapUrl);

        // Add error handling - if the image fails to load, use a fallback
        const img = new Image();
        img.onload = function () {
            console.log('Map loaded successfully');
        };
        img.onerror = function () {
            console.log('Map failed to load, using fallback');
            // Use a simple tile as fallback
            const tileUrl = `https://tile.openstreetmap.org/17/${Math.floor((coordsObj.lng + 180) / 360 * Math.pow(2, 17))}/${Math.floor((1 - Math.log(Math.tan(coordsObj.lat * Math.PI / 180) + 1 / Math.cos(coordsObj.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 17))}.png`;
            previewWrapper.style.backgroundImage = `url('${tileUrl}')`;
            console.log('Fallback tile URL:', tileUrl);
        };
        img.src = staticMapUrl;
    }
}

// Get confirm preview URL (same as script_clean.js)
function getConfirmPreviewUrl(coords) {
    const lat = coords.lat.toFixed(6);
    const lng = coords.lng.toFixed(6);
    const zoom = 17;
    const size = '640x420';

    // Try multiple map services in order of preference
    const mapServices = [
        `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=mapnik`,
        `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=640&height=420&center=lonlat:${lng},${lat}&zoom=${zoom}&marker=lonlat:${lng},${lat};color:%23dc3545;size:small`,
        `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-l-marker+dc3545(${lng},${lat})/${lng},${lat},${zoom}/640x420@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`,
        `https://tile.openstreetmap.org/${zoom}/${Math.floor((lng + 180) / 360 * Math.pow(2, zoom))}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))}.png`
    ];

    return mapServices[0]; // Return first service for now
}

// Open location in Google Maps
function openInGoogleMaps(lat, lng, locationName) {
    const encodedName = encodeURIComponent(locationName || 'Location');
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(googleMapsUrl, '_blank');
}

// Open location in Waze
function openInWaze(lat, lng, locationName) {
    const encodedName = encodeURIComponent(locationName || 'Location');
    const wazeUrl = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    window.open(wazeUrl, '_blank');
}

function showDonationDetails(donationId) {
    const modal = document.getElementById('donationDetailsModal');
    const detailsContainer = document.getElementById('donationDetails');

    if (!modal || !detailsContainer) return;

    const donation = userDonationLogs.find(d => d.firestoreId === donationId);
    if (!donation) return;

    // Find the corresponding location from user's reported locations
    const location = userReportedLocations.find(loc =>
        loc.firestoreId === donation.locationId || loc.id === donation.locationId
    );
    const locationName = location ? (location.locationName || location.name || 'Unknown location') : 'Unknown location';

    const itemsHtml = donation.items && Array.isArray(donation.items)
        ? donation.items.map(item => `
            <li>
                ${item.quantity || ''} ${item.unit || ''} ${item.name || ''}
            </li>
        `).join('')
        : '<li>No items specified</li>';

    detailsContainer.innerHTML = `
        <div class="donation-details">
            <h4>Donation Details</h4>
            <p><strong>Donor:</strong> ${escapeHtml(donation.donorName || 'Anonymous')}</p>
            ${donation.donorEmail ? `<p><strong>Email:</strong> ${escapeHtml(donation.donorEmail)}</p>` : ''}
            <p><strong>Location:</strong> ${escapeHtml(locationName)}</p>
            <p><strong>Items:</strong></p>
            <ul>${itemsHtml}</ul>
            <p><strong>Cash Amount:</strong> ${formatCashAmount(donation.cashAmount)}</p>
            ${donation.notes ? `<p><strong>Notes:</strong> ${escapeHtml(donation.notes)}</p>` : ''}
            <p><strong>Submitted:</strong> ${formatDonationDate(donation.submittedAt)}</p>
            <p><strong>Delivery Status:</strong> 
                <span class="delivery-badge delivery-${getDonationDeliveryStatus(donation).status}">
                    ${getDonationDeliveryStatus(donation).label}
                </span>
            </p>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

function closeDonationDetailsModal() {
    document.getElementById('donationDetailsModal').style.display = 'none';
}

// Export functionality
function exportUserData() {
    try {
        const exportData = {
            guestId: guestId,
            exportDate: new Date().toISOString(),
            reportedLocations: userReportedLocations,
            supportedLocations: userSupportedLocations,
            donationLogs: userDonationLogs,
            activities: getGuestActivities()
        };

        const worksheet = XLSX.utils.json_to_sheet([]);

        // Add summary
        XLSX.utils.sheet_add_aoa(worksheet, [
            ['User Activity Export'],
            ['Guest ID:', guestId],
            ['Export Date:', new Date().toLocaleString()],
            [],
            ['Summary'],
            ['Reported Locations:', userReportedLocations.length],
            ['Supported Locations:', userSupportedLocations.length],
            ['Donation Logs:', userDonationLogs.length],
            ['Total Activities:', getGuestActivities().length],
            []
        ], { origin: 'A1' });

        // Create workbook and save
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');

        XLSX.writeFile(workbook, `tulong-marilao-user-activity-${guestId}.xlsx`);
        showSuccess('Data exported successfully!');
    } catch (error) {
        console.error('Export failed:', error);
        showError('Failed to export data. Please try again.');
    }
}

// Download sheet format for bulk data entry
function downloadSheetFormat() {
    console.log('Download format button clicked');

    try {
        if (!window.XLSX) {
            console.error('XLSX library not found');
            showError('Excel library not loaded. Please refresh the page.');
            return;
        }

        console.log('XLSX library found, creating template...');

        // Define headers for Reported Locations
        const reportedHeaders = [
            'Location Name', 'Latitude', 'Longitude', 'Landmark',
            'Relief Needs', 'Urgency', 'Contact Person', 'Contact Number'
        ];
        const reportedWorksheet = XLSX.utils.aoa_to_sheet([reportedHeaders]);
        // Set column widths for Reported Locations
        reportedWorksheet['!cols'] = [
            { wch: 20 }, // Location Name
            { wch: 12 }, // Latitude
            { wch: 12 }, // Longitude
            { wch: 25 }, // Landmark
            { wch: 20 }, // Relief Needs
            { wch: 10 }, // Urgency
            { wch: 18 }, // Contact Person
            { wch: 15 }  // Contact Number
        ];

        // Define headers for Donation Logs
        const donationHeaders = [
            'Donation Type', 'Item Name', 'Quantity', 'Unit',
            'Delivery Status', 'Notes'
        ];
        const donationWorksheet = XLSX.utils.aoa_to_sheet([donationHeaders]);
        // Set column widths for Donation Logs
        donationWorksheet['!cols'] = [
            { wch: 15 }, // Donation Type
            { wch: 20 }, // Item Name
            { wch: 10 }, // Quantity
            { wch: 10 }, // Unit
            { wch: 15 }, // Delivery Status
            { wch: 25 }  // Notes
        ];

        // Create workbook and save
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, reportedWorksheet, 'Reported Locations');
        XLSX.utils.book_append_sheet(workbook, donationWorksheet, 'Donation Logs');

        console.log('Saving workbook...');
        XLSX.writeFile(workbook, `tulong-marilao-bulk-entry-template.xlsx`);
        console.log('Workbook saved successfully');
        showSuccess('Template downloaded successfully! Fill in your data and use the Export Data button to upload.');
    } catch (error) {
        console.error('Template download failed:', error);
        showError('Failed to download template. Please try again. Error: ' + error.message);
    }
}

// Utility functions
function showError(message) {
    // Create a simple alert for now - can be enhanced with proper toast notifications
    alert(message);
}

function showSuccess(message) {
    // Create a simple alert for now - can be enhanced with proper toast notifications
    alert(message);
}

// Make functions globally accessible
window.showLocationDetails = showLocationDetails;
window.showDonationDetails = showDonationDetails;
window.editLocation = editLocation;
window.deleteLocation = deleteLocation;

// Edit location functions
function editLocation(locationId) {
    const location = userReportedLocations.find(l => l.firestoreId === locationId);
    if (!location) {
        showError('Location not found');
        return;
    }

    // Populate form with location data
    document.getElementById('editLocationId').value = location.firestoreId;
    document.getElementById('editLocationName').value = location.locationName || '';
    document.getElementById('editLandmark').value = location.landmark || '';
    document.getElementById('editUrgencyLevel').value = location.urgency || 'moderate';
    document.getElementById('editPeopleCount').value = location.peopleCount || '';
    document.getElementById('editAdditionalInfo').value = location.additionalInfo || '';
    document.getElementById('editReporterName').value = location.reporterName || 'Anonymous';
    document.getElementById('editContactPerson').value = location.contactPerson || '';
    document.getElementById('editReporterContact').value = location.reporterContact || '';

    // Set urgency buttons
    document.querySelectorAll('#editLocationModal .urgency-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.urgency === location.urgency);
    });

    // Set relief needs checkboxes
    const reliefNeeds = location.reliefNeeds || [];
    document.querySelectorAll('#editLocationModal .checkbox-group input').forEach(checkbox => {
        checkbox.checked = reliefNeeds.includes(checkbox.value);
    });

    // Show modal
    document.getElementById('editLocationModal').style.display = 'flex';
}

function closeEditLocationModal() {
    document.getElementById('editLocationModal').style.display = 'none';
    document.getElementById('editLocationForm').reset();
}

async function handleEditLocationSubmit(e) {
    e.preventDefault();

    const locationId = document.getElementById('editLocationId').value;
    const location = userReportedLocations.find(l => l.firestoreId === locationId);

    if (!location) {
        showError('Location not found');
        return;
    }

    try {
        const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        // Get relief needs from checkboxes
        const reliefNeeds = [];
        document.querySelectorAll('#editLocationModal .checkbox-group input:checked').forEach(checkbox => {
            reliefNeeds.push(checkbox.value);
        });

        // Update location data
        const updateData = {
            locationName: document.getElementById('editLocationName').value,
            landmark: document.getElementById('editLandmark').value,
            urgency: document.getElementById('editUrgencyLevel').value,
            reliefNeeds: reliefNeeds,
            peopleCount: parseInt(document.getElementById('editPeopleCount').value) || null,
            additionalInfo: document.getElementById('editAdditionalInfo').value,
            reporterName: document.getElementById('editReporterName').value,
            contactPerson: document.getElementById('editContactPerson').value,
            reporterContact: document.getElementById('editReporterContact').value,
            updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'relief-locations', locationId), updateData);

        showSuccess('Location updated successfully!');
        closeEditLocationModal();
    } catch (error) {
        console.error('Error updating location:', error);
        showError('Failed to update location. Please try again.');
    }
}

// Delete location functions
function deleteLocation(locationId) {
    const location = userReportedLocations.find(l => l.firestoreId === locationId);
    if (!location) {
        showError('Location not found');
        return;
    }

    // Show confirmation modal with location info
    const deleteInfo = document.getElementById('deleteLocationInfo');
    deleteInfo.innerHTML = `
        <p><strong>Location:</strong> ${escapeHtml(location.locationName || location.name || 'Unknown')}</p>
        <p><strong>Landmark:</strong> ${escapeHtml(location.landmark || 'Not specified')}</p>
        <p><strong>Urgency:</strong> ${capitalizeFirst(location.urgency || location.urgencyLevel || 'moderate')}</p>
        <p><strong>Reported By:</strong> ${escapeHtml(location.reporterName || 'Anonymous')}</p>
        ${location.contactPerson ? `<p><strong>Contact Person:</strong> ${escapeHtml(location.contactPerson)}</p>` : ''}
    `;

    // Store location ID for deletion
    window.locationToDeleteId = locationId;

    // Show modal
    document.getElementById('deleteLocationModal').style.display = 'flex';
}

function closeDeleteLocationModal() {
    document.getElementById('deleteLocationModal').style.display = 'none';
    window.locationToDeleteId = null;
}

async function handleDeleteLocation() {
    const locationId = window.locationToDeleteId;
    if (!locationId) {
        showError('No location selected for deletion');
        return;
    }

    try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        await deleteDoc(doc(db, 'relief-locations', locationId));

        showSuccess('Location deleted successfully!');
        closeDeleteLocationModal();
    } catch (error) {
        console.error('Error deleting location:', error);
        showError('Failed to delete location. Please try again.');
    }
}

// Photo Gallery Functions for User Dashboard
let allLocationImages = new Map(); // locationId -> images array

// Function to create image gallery for location details
function createImageGallery(images, locationId, report) {
    // First try to get images from the cached data
    let actualImages = images;
    const cachedImages = allLocationImages.get(locationId || report.id || report.firestoreId);

    if (cachedImages && cachedImages.length > 0) {
        actualImages = cachedImages;
    } else if (images && images.length > 0) {
        actualImages = images;
        // Cache the images
        allLocationImages.set(locationId || report.id || report.firestoreId, images);
    } else {
        actualImages = [];
    }

    const imageItems = actualImages && actualImages.length > 0 ? actualImages.map((image, index) => {
        return `
        <div class="popup-image-item" onclick="openImageModal('${image.data}', '${image.name}', '${report.locationName || report.name || 'Location'}', '${report.urgencyLevel || report.urgency || ''}', '${(report.reliefNeeds || []).join(', ')}', '${formatDate(report.reportedAt)}')">
            <img src="${image.data}" alt="${image.name}" title="Click to view full size">
        </div>
    `;
    }).join('') : '';

    const photoCount = actualImages ? actualImages.length : 0;
    const headerText = photoCount > 0 ? `Photos (${photoCount})` : 'Photos';

    // Only show photos section if there are photos
    if (photoCount === 0) {
        return '';
    }

    return `
        <div class="popup-images" id="popupImages-${locationId}" style="margin-top: 15px;">
            <div class="photos-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <h5 style="margin: 0;"><i class="fas fa-images"></i> ${headerText}</h5>
                <button onclick="togglePhotos('${locationId}')" class="btn-toggle-photos" style="background: none; border: none; color: #666; cursor: pointer; padding: 5px; border-radius: 4px; transition: background-color 0.2s;" title="Hide photos">
                    <i class="fas fa-eye" id="photoToggle-${locationId}"></i>
                </button>
            </div>
            <div class="popup-image-gallery" id="photoGallery-${locationId}" style="display: block;">
                ${imageItems}
            </div>
        </div>
    `;
}

// Toggle photos visibility
function togglePhotos(locationId) {
    const photoGallery = document.getElementById(`photoGallery-${locationId}`);
    const toggleIcon = document.getElementById(`photoToggle-${locationId}`);

    if (photoGallery && toggleIcon) {
        const isVisible = photoGallery.style.display !== 'none';
        photoGallery.style.display = isVisible ? 'none' : 'block';
        toggleIcon.className = isVisible ? 'fas fa-eye-slash' : 'fas fa-eye';

        // Update button title
        const toggleButton = toggleIcon.parentElement;
        if (toggleButton) {
            toggleButton.title = isVisible ? 'Show photos' : 'Hide photos';
        }
    }
}

// Function to open image modal
function openImageModal(imageSrc, imageName, locationName, urgencyLevel, reliefNeeds, reportedDate) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalDetails = document.getElementById('imageModalDetails');

    if (modal && modalImage && modalDetails) {
        // Set image
        modalImage.src = imageSrc;
        modalImage.alt = imageName;

        // Set location details
        const urgencyText = urgencyLevel
            ? urgencyLevel.charAt(0).toUpperCase() + urgencyLevel.slice(1)
            : 'Unknown';

        modalDetails.innerHTML = `
            <h4><i class="fa-solid fa-image"></i> ${imageName}</h4>
            <div class="detail-item"><strong>Location:</strong> ${locationName}</div>
            <div class="detail-item"><strong>Urgency:</strong> ${urgencyText}</div>
            <div class="detail-item"><strong>Relief Needs:</strong> ${reliefNeeds}</div>
            <div class="detail-item"><strong>Reported:</strong> ${reportedDate}</div>
        `;

        modal.classList.add('show');

        // Close modal when clicking outside the content
        modal.onclick = function (e) {
            if (e.target === modal) {
                closeImageModal();
            }
        };

        // Close modal with Escape key
        document.addEventListener('keydown', handleImageModalKeydown);
    }
}

// Function to close image modal
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.remove('show');
        document.removeEventListener('keydown', handleImageModalKeydown);
    }
}

// Handle keyboard events for image modal
function handleImageModalKeydown(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
}

// Make functions globally accessible
window.togglePhotos = togglePhotos;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;

// Setup urgency button handlers for edit modal
document.addEventListener('DOMContentLoaded', () => {
    // Edit modal urgency buttons
    document.querySelectorAll('#editLocationModal .urgency-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#editLocationModal .urgency-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('editUrgencyLevel').value = btn.dataset.urgency;
        });
    });
});
