// Marilao Bulacan Community Relief Map Guide
// Community reporting map for locations needing help

// ========================================
// GOOGLE MAPS CONFIGURATION
// ========================================

// Google Maps configuration
const ENV_CONFIG = (typeof window !== 'undefined' && (window.__env || window.env)) || {};
const GOOGLE_MAPS_API_KEY = ENV_CONFIG.GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY";
const USE_GOOGLE_MAPS = (() => {
    const rawValue = ENV_CONFIG.USE_GOOGLE_MAPS;
    if (typeof rawValue === 'boolean') return rawValue;
    if (typeof rawValue === 'string') return rawValue.toLowerCase() === 'true';
    return false;
})();

const GOOGLE_MAPS_ENABLED = USE_GOOGLE_MAPS && GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY';

if (USE_GOOGLE_MAPS && !GOOGLE_MAPS_ENABLED) {
    console.warn('Google Maps geocoding requested but API key is missing. Falling back to OpenStreetMap.');
}

// Custom alert function to show "System says" instead of URL
function systemAlert(message) {
    // Check if there's already an alert modal to prevent stacking
    const existingAlert = document.querySelector('.system-alert-modal');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Create custom modal instead of browser alert
    const alertModal = document.createElement('div');
    alertModal.className = 'system-alert-modal';
    alertModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(28, 57, 41, 0.35);
        z-index: 100010;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    alertModal.innerHTML = `
        <div style="
            background: white;
            padding: 2rem;
            border-radius: 12px;
            border: 1px solid #d1e7dd;
            box-shadow: 0 12px 30px rgba(22, 64, 45, 0.2);
            max-width: 400px;
            width: 90%;
            text-align: center;
        ">
            <div style="
                font-size: 1.1rem;
                margin-bottom: 1.5rem;
                color: #1b4332;
                line-height: 1.4;
            ">${message}</div>
            <button onclick="this.closest('.system-alert-modal').remove()" style="
                background: #28a745;
                color: white;
                border: none;
                padding: 0.75rem 2rem;
                border-radius: 8px;
                cursor: pointer;
                font-size: 1rem;
                box-shadow: 0 6px 14px rgba(40, 167, 69, 0.25);
            ">OK</button>
        </div>
    `;

    document.body.appendChild(alertModal);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (alertModal.parentElement) {
            alertModal.remove();
        }
    }, 10000);
}

// Override the default alert function
window.alert = systemAlert;

// Custom confirmation dialog
function showCustomConfirm(message, subtitle = '') {
    return new Promise((resolve) => {
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 100002;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        confirmModal.innerHTML = `
            <div style="
                background: white;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 90%;
                text-align: center;
            ">
                <div style="
                    font-size: 1.2rem;
                    margin-bottom: 1rem;
                    color: #333;
                    font-weight: 600;
                ">System says</div>
                <div style="
                    font-size: 1rem;
                    margin-bottom: ${subtitle ? '0.5rem' : '1.5rem'};
                    color: #333;
                    line-height: 1.4;
                ">${message}</div>
                ${subtitle ? `<div style="
                    font-size: 0.9rem;
                    margin-bottom: 1.5rem;
                    color: #666;
                    line-height: 1.4;
                ">${subtitle}</div>` : ''}
                <div style="
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                ">
                    <button id="confirmCancel" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1rem;
                    ">Cancel</button>
                    <button id="confirmOk" style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1rem;
                    ">Remove</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        // Handle button clicks
        document.getElementById('confirmOk').onclick = () => {
            confirmModal.remove();
            resolve(true);
        };

        document.getElementById('confirmCancel').onclick = () => {
            confirmModal.remove();
            resolve(false);
        };

        // Handle click outside to cancel
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
                resolve(false);
            }
        };

        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                confirmModal.remove();
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

const DONOR_DISPLAY_NAME_KEY = 'donorDisplayName';
const DONOR_TEAM_NAME_KEY = 'donorTeamName';

const GUEST_SESSION_KEY = 'guestSessionId';
const GUEST_ACTIVITY_KEY = 'guestActivityLogs';

function generateGuestId() {
    const randomSegment = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    return `Guest${randomSegment}`;
}

function getStoredGuestId() {
    return localStorage.getItem(GUEST_SESSION_KEY);
}

function updateDashboardTitle(guestId = null) {
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (!dashboardTitle) {
        return;
    }

    if (guestId) {
        dashboardTitle.textContent = `${guestId}'s Dashboard`;
    } else {
        dashboardTitle.textContent = 'Dashboard';
    }
}

function ensureGuestSession(options = {}) {
    console.log('ensureGuestSession called with options:', options);
    const { showAlert = false } = options;
    const existingGuestId = getStoredGuestId();
    if (existingGuestId) {
        updateDashboardTitle(existingGuestId);
        if (showAlert) {
            systemAlert(`Welcome back, ${existingGuestId}. Your activity log is saved on this device.`);
        }
        return existingGuestId;
    }

    const guestId = generateGuestId();
    localStorage.setItem(GUEST_SESSION_KEY, guestId);
    if (!localStorage.getItem(GUEST_ACTIVITY_KEY)) {
        localStorage.setItem(GUEST_ACTIVITY_KEY, JSON.stringify([]));
    }
    updateDashboardTitle(guestId);
    if (showAlert) {
        systemAlert(`Welcome! You're now exploring as ${guestId}. Your activity log stays on this device.`);
    }
    return guestId;
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

function saveGuestActivities(activities) {
    localStorage.setItem(GUEST_ACTIVITY_KEY, JSON.stringify(activities));
}

function addGuestActivity(entry) {
    const guestId = getStoredGuestId();
    if (!guestId) {
        return;
    }

    const activities = loadGuestActivities();
    const activity = {
        id: `activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        guestId,
        timestamp: new Date().toISOString(),
        ...entry
    };

    const updated = [...activities, activity].slice(-200);
    saveGuestActivities(updated);

    const activityModal = document.getElementById('activityLogModal');
    if (activityModal && activityModal.style.display === 'flex') {
        updateActivityLogDisplay();
    }
}

function getGuestActivities() {
    const guestId = getStoredGuestId();
    if (!guestId) {
        return [];
    }

    return loadGuestActivities().filter(activity => activity.guestId === guestId);
}

function getLocationNameById(locationId) {
    if (!locationId || !Array.isArray(userReportedLocations)) {
        return '';
    }

    const location = userReportedLocations.find(item => (item.firestoreId || item.id) === locationId);
    return location ? (location.name || location.locationName || '') : '';
}

function getDonorDisplayName() {
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        return window.firebaseAuth.currentUser.displayName || window.firebaseAuth.currentUser.email || 'Donor';
    }

    const storedName = localStorage.getItem(DONOR_DISPLAY_NAME_KEY);
    if (storedName) {
        return storedName;
    }

    const guestId = getStoredGuestId();
    if (guestId) {
        return guestId;
    }

    return 'Donor';
}

function getDonorNameCandidates() {
    const candidates = new Set();
    const savedTeamName = localStorage.getItem(DONOR_TEAM_NAME_KEY);
    if (savedTeamName) {
        candidates.add(savedTeamName.trim());
    }

    const displayName = getDonorDisplayName();
    if (displayName) {
        candidates.add(displayName.trim());
    }

    return Array.from(candidates)
        .filter(Boolean)
        .map(name => name.toLowerCase());
}

function isCurrentDonorResponding(respondingName) {
    if (!respondingName) {
        return false;
    }

    const candidates = getDonorNameCandidates();
    return candidates.includes(respondingName.toLowerCase());
}

function getCurrentSupporterId() {
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        return window.firebaseAuth.currentUser.uid;
    }

    if (window.getCurrentUserId) {
        return window.getCurrentUserId();
    }

    return getStoredGuestId();
}

function isLocationSupportedByCurrentUser(location, statusData = null) {
    if (!location) {
        return false;
    }

    const supporterId = getCurrentSupporterId();
    const supporterIdValue = supporterId ? supporterId.toString() : '';
    const supportedIds = [
        location.supportedBy,
        location.supportedById,
        location.supporterId,
        location.supporterUid,
        location.donorId
    ]
        .filter(Boolean)
        .map(id => id.toString());

    if (supporterIdValue && supportedIds.includes(supporterIdValue)) {
        return true;
    }

    const status = statusData || getResponseStatusData(location);
    return isCurrentDonorResponding(status.respondingName) ||
        isCurrentDonorResponding(location.reachedByTeam) ||
        isCurrentDonorResponding(location.supportedByName);
}

function promptForDonorSupporterName(defaults = {}) {
    return new Promise((resolve) => {
        const existingModal = document.getElementById('donorSupporterModal');
        if (existingModal) {
            existingModal.remove();
        }

        const { individualName = '', teamName = '' } = defaults || {};
        const nameParts = individualName ? individualName.trim().split(/\s+/) : [];
        const defaultFirstName = nameParts.shift() || '';
        const defaultLastName = nameParts.join(' ');
        const preferTeam = Boolean(teamName && !individualName);

        const modal = document.createElement('div');
        modal.id = 'donorSupporterModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.55);
            z-index: 100003;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
        `;

        modal.innerHTML = `
            <div style="
                background: #ffffff;
                padding: 1.5rem;
                border-radius: 14px;
                box-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);
                max-width: 420px;
                width: 100%;
                text-align: center;
            ">
                <div style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem;">
                    Support this location
                </div>
                <p style="margin: 0 0 1rem; color: #475569; font-size: 0.95rem;">
                    Enter your details to mark this location as "on the way".
                </p>
                <p style="margin: 0 0 1rem; color: #b45309; font-size: 0.85rem;">
                    Please provide accurate information so we can coordinate support.
                </p>

                <div style="margin-bottom: 1rem; text-align: left;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Support Type</label>
                    <div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
                        <label style="flex: 1; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="supporterType" value="individual" ${preferTeam ? '' : 'checked'} style="margin: 0;">
                            <span style="font-size: 0.9rem;">Individual</span>
                        </label>
                        <label style="flex: 1; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="supporterType" value="team" ${preferTeam ? 'checked' : ''} style="margin: 0;">
                            <span style="font-size: 0.9rem;">Team/Organization</span>
                        </label>
                    </div>
                </div>

                <div id="supporterIndividualFields" style="margin-bottom: 1rem; text-align: left;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">First name</label>
                    <input id="supporterFirstNameInput" type="text" placeholder="First name" required aria-required="true" style="
                        width: 100%;
                        padding: 0.75rem 0.85rem;
                        border: 1px solid #cbd5f5;
                        border-radius: 10px;
                        font-size: 0.95rem;
                        outline: none;
                        margin-bottom: 0.35rem;
                    ">
                    <div id="supporterFirstNameError" style="display: none; color: #dc2626; font-size: 0.8rem; margin-bottom: 0.75rem;">Input is required.</div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Last name</label>
                    <input id="supporterLastNameInput" type="text" placeholder="Last name" required aria-required="true" style="
                        width: 100%;
                        padding: 0.75rem 0.85rem;
                        border: 1px solid #cbd5f5;
                        border-radius: 10px;
                        font-size: 0.95rem;
                        outline: none;
                        margin-bottom: 0.35rem;
                    ">
                    <div id="supporterLastNameError" style="display: none; color: #dc2626; font-size: 0.8rem; margin-bottom: 0.75rem;">Input is required.</div>
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin-top: 0.75rem; color: #475569;">
                        <input type="checkbox" id="supporterAnonymousToggle" style="margin: 0;">
                        <span>Support anonymously</span>
                    </label>
                </div>

                <div id="supporterTeamFields" style="margin-bottom: 1rem; text-align: left; display: none;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Team/Organization name</label>
                    <input id="supporterTeamNameInput" type="text" placeholder="Team or organization name" required aria-required="true" style="
                        width: 100%;
                        padding: 0.75rem 0.85rem;
                        border: 1px solid #cbd5f5;
                        border-radius: 10px;
                        font-size: 0.95rem;
                        outline: none;
                        margin-bottom: 0.35rem;
                    ">
                    <div id="supporterTeamNameError" style="display: none; color: #dc2626; font-size: 0.8rem; margin-bottom: 0.75rem;">Input is required.</div>
                </div>

                <div style="margin-bottom: 1rem; text-align: left;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Contact number</label>
                    <input id="supporterContactNumberInput" type="tel" inputmode="numeric" maxlength="11" pattern="[0-9]{11}" placeholder="Contact number" required aria-required="true" style="
                        width: 100%;
                        padding: 0.75rem 0.85rem;
                        border: 1px solid #cbd5f5;
                        border-radius: 10px;
                        font-size: 0.95rem;
                        outline: none;
                        margin-bottom: 0.35rem;
                    ">
                    <div id="supporterContactError" style="display: none; color: #dc2626; font-size: 0.8rem; margin-bottom: 0.75rem;">Input is required.</div>
                </div>

                <div style="margin-bottom: 1rem; text-align: left;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #475569;">
                        <input type="checkbox" id="supporterPrivacyConsent" style="margin: 0;">
                        <span>I consent to the collection and use of this information for coordination.</span>
                    </label>
                    <div id="supporterPrivacyError" style="display: none; color: #dc2626; font-size: 0.8rem; margin-top: 0.35rem;">Consent is required.</div>
                </div>

                <div style="display: flex; gap: 0.75rem; justify-content: center;">
                    <button id="donorSupporterCancel" style="
                        background: #e2e8f0;
                        color: #0f172a;
                        border: none;
                        padding: 0.7rem 1.4rem;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Cancel</button>
                    <button id="donorSupporterConfirm" style="
                        background: #22c55e;
                        color: white;
                        border: none;
                        padding: 0.7rem 1.4rem;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Confirm Support</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const supporterTypeInputs = modal.querySelectorAll('input[name="supporterType"]');
        const individualFields = modal.querySelector('#supporterIndividualFields');
        const teamFields = modal.querySelector('#supporterTeamFields');
        const anonymousToggle = modal.querySelector('#supporterAnonymousToggle');
        const firstNameInput = modal.querySelector('#supporterFirstNameInput');
        const lastNameInput = modal.querySelector('#supporterLastNameInput');
        const teamNameInput = modal.querySelector('#supporterTeamNameInput');
        const contactInput = modal.querySelector('#supporterContactNumberInput');
        const confirmBtn = modal.querySelector('#donorSupporterConfirm');
        const cancelBtn = modal.querySelector('#donorSupporterCancel');

        const firstNameError = modal.querySelector('#supporterFirstNameError');
        const lastNameError = modal.querySelector('#supporterLastNameError');
        const teamNameError = modal.querySelector('#supporterTeamNameError');
        const contactError = modal.querySelector('#supporterContactError');
        const privacyConsent = modal.querySelector('#supporterPrivacyConsent');
        const privacyError = modal.querySelector('#supporterPrivacyError');
        const allInputs = [firstNameInput, lastNameInput, teamNameInput, contactInput];
        const errorMap = new Map([
            [firstNameInput, firstNameError],
            [lastNameInput, lastNameError],
            [teamNameInput, teamNameError],
            [contactInput, contactError]
        ]);

        const resetFieldStyle = (input) => {
            if (!input) {
                return;
            }
            input.style.borderColor = '#cbd5f5';
            const error = errorMap.get(input);
            if (error) {
                error.style.display = 'none';
            }
        };

        const markInvalid = (input) => {
            if (!input) {
                return;
            }
            input.style.borderColor = '#dc3545';
            const error = errorMap.get(input);
            if (error) {
                error.style.display = 'block';
            }
        };

        const setPrivacyErrorVisible = (isVisible) => {
            if (privacyError) {
                privacyError.style.display = isVisible ? 'block' : 'none';
            }
        };

        const setConfirmButtonState = (isEnabled) => {
            if (!confirmBtn) {
                return;
            }
            confirmBtn.disabled = !isEnabled;
            confirmBtn.style.background = isEnabled ? '#22c55e' : '#cbd5e1';
            confirmBtn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
            confirmBtn.style.color = isEnabled ? '#ffffff' : '#64748b';
        };

        const getSelectedType = () => {
            const selected = modal.querySelector('input[name="supporterType"]:checked');
            return selected ? selected.value : 'individual';
        };

        const getFormState = () => {
            const supporterType = getSelectedType();
            const isAnonymous = supporterType === 'individual' && anonymousToggle && anonymousToggle.checked;
            return { supporterType, isAnonymous };
        };

        const getRequiredInputs = ({ supporterType, isAnonymous }) => {
            if (isAnonymous) {
                return [contactInput];
            }
            if (supporterType === 'individual') {
                return [firstNameInput, lastNameInput, contactInput];
            }
            return [teamNameInput, contactInput];
        };

        const CONTACT_NUMBER_PATTERN = /^\d{11}$/;

        const getContactValidationMessage = (value) => {
            if (!value) {
                return 'Input is required.';
            }
            if (!CONTACT_NUMBER_PATTERN.test(value)) {
                return 'Contact number must be 11 digits.';
            }
            return '';
        };

        const validateContactInput = (showErrors = false) => {
            if (!contactInput) {
                return true;
            }
            const message = getContactValidationMessage(contactInput.value.trim());
            if (message) {
                if (showErrors) {
                    if (contactError) {
                        contactError.textContent = message;
                    }
                    markInvalid(contactInput);
                }
                return false;
            }
            if (showErrors) {
                resetFieldStyle(contactInput);
                if (contactError) {
                    contactError.textContent = 'Input is required.';
                }
            }
            return true;
        };

        const validateForm = (showErrors = false) => {
            const { supporterType, isAnonymous } = getFormState();
            const requiredInputs = getRequiredInputs({ supporterType, isAnonymous }).filter(Boolean);
            let isValid = true;

            requiredInputs.forEach((input) => {
                if (input === contactInput) {
                    const contactValid = validateContactInput(showErrors);
                    if (!contactValid) {
                        isValid = false;
                    }
                    return;
                }

                const hasValue = Boolean(input && input.value.trim());
                if (!hasValue) {
                    isValid = false;
                    if (showErrors) {
                        markInvalid(input);
                    }
                } else if (showErrors) {
                    resetFieldStyle(input);
                }
            });

            if (showErrors) {
                allInputs.forEach((input) => {
                    if (input && !requiredInputs.includes(input)) {
                        resetFieldStyle(input);
                    }
                });
            }

            const consentChecked = privacyConsent ? privacyConsent.checked : true;
            if (!consentChecked) {
                isValid = false;
                if (showErrors) {
                    setPrivacyErrorVisible(true);
                }
            } else {
                setPrivacyErrorVisible(false);
            }

            setConfirmButtonState(isValid);
            return { isValid, supporterType, isAnonymous };
        };

        const handleFieldInput = (input) => {
            resetFieldStyle(input);
            validateForm();
        };

        const handleFieldBlur = (input) => {
            const { supporterType, isAnonymous } = getFormState();
            const requiredInputs = getRequiredInputs({ supporterType, isAnonymous });
            if (input === contactInput) {
                validateContactInput(true);
                validateForm();
                return;
            }
            if (requiredInputs.includes(input) && input && !input.value.trim()) {
                markInvalid(input);
            } else {
                resetFieldStyle(input);
            }
            validateForm();
        };

        const updateAnonymousState = () => {
            const isAnonymous = getSelectedType() === 'individual' && anonymousToggle && anonymousToggle.checked;
            [firstNameInput, lastNameInput].forEach((input) => {
                if (!input) {
                    return;
                }
                input.disabled = isAnonymous;
                if (isAnonymous) {
                    input.value = '';
                }
            });
            if (contactInput) {
                contactInput.disabled = false;
            }
            if (isAnonymous) {
                [firstNameInput, lastNameInput].forEach((input) => resetFieldStyle(input));
            }
            validateForm();
        };

        const updateSupporterType = (type) => {
            const isIndividual = type === 'individual';
            if (individualFields) {
                individualFields.style.display = isIndividual ? 'block' : 'none';
            }
            if (teamFields) {
                teamFields.style.display = isIndividual ? 'none' : 'block';
            }
            if (!isIndividual && anonymousToggle) {
                anonymousToggle.checked = false;
            }
            if (isIndividual) {
                resetFieldStyle(teamNameInput);
            } else {
                resetFieldStyle(firstNameInput);
                resetFieldStyle(lastNameInput);
            }
            updateAnonymousState();
        };

        supporterTypeInputs.forEach((input) => {
            input.addEventListener('change', () => updateSupporterType(input.value));
        });

        if (anonymousToggle) {
            anonymousToggle.addEventListener('change', updateAnonymousState);
        }

        [firstNameInput, lastNameInput, teamNameInput, contactInput].forEach((input) => {
            if (input) {
                input.addEventListener('input', () => handleFieldInput(input));
                input.addEventListener('blur', () => handleFieldBlur(input));
            }
        });

        if (privacyConsent) {
            privacyConsent.addEventListener('change', () => {
                setPrivacyErrorVisible(false);
                validateForm();
            });
        }

        const cleanup = () => {
            document.removeEventListener('keydown', handleEscape);
            modal.remove();
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        const handleConfirm = () => {
            const { isValid, supporterType, isAnonymous } = validateForm(true);
            if (!isValid) {
                const firstInvalid = modal.querySelector('input[style*="#dc3545"]');
                if (firstInvalid) {
                    firstInvalid.focus();
                } else if (privacyConsent && !privacyConsent.checked) {
                    privacyConsent.focus();
                }
                return;
            }

            const firstName = firstNameInput ? firstNameInput.value.trim() : '';
            const lastName = lastNameInput ? lastNameInput.value.trim() : '';
            const teamNameValue = teamNameInput ? teamNameInput.value.trim() : '';
            const contactValue = contactInput ? contactInput.value.trim() : '';

            const displayName = isAnonymous
                ? 'Anonymous'
                : supporterType === 'team'
                    ? teamNameValue
                    : `${firstName} ${lastName}`.trim();

            cleanup();
            resolve({
                type: supporterType,
                isAnonymous,
                firstName: isAnonymous ? '' : firstName,
                lastName: isAnonymous ? '' : lastName,
                teamName: supporterType === 'team' ? teamNameValue : '',
                contact: contactValue,
                displayName
            });
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                handleCancel();
            }
            if (event.key === 'Enter' && modal.contains(document.activeElement)) {
                handleConfirm();
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                handleCancel();
            }
        });
        document.addEventListener('keydown', handleEscape);

        if (firstNameInput) {
            firstNameInput.value = defaultFirstName;
        }
        if (lastNameInput) {
            lastNameInput.value = defaultLastName;
        }
        if (teamNameInput) {
            teamNameInput.value = teamName;
        }

        updateSupporterType(preferTeam ? 'team' : 'individual');

        if (preferTeam && teamNameInput) {
            teamNameInput.focus();
            teamNameInput.select();
        } else if (firstNameInput) {
            firstNameInput.focus();
            firstNameInput.select();
        }
    });
}

// Custom confirmation dialog for chat message deletion
function showChatDeleteConfirm() {
    return new Promise((resolve) => {
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.55);
            z-index: 100002;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
        `;

        confirmModal.innerHTML = `
            <div style="
                background: #ffffff;
                padding: 1.5rem;
                border-radius: 14px;
                box-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);
                max-width: 360px;
                width: 100%;
                text-align: left;
            ">
                <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                    <div style="
                        width: 38px;
                        height: 38px;
                        border-radius: 50%;
                        background: rgba(220, 53, 69, 0.12);
                        color: #dc3545;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1rem;
                    ">
                        <i class="fa-solid fa-trash-can"></i>
                    </div>
                    <div>
                        <div style="font-size: 1.05rem; font-weight: 700; color: #1f2937; margin-bottom: 0.25rem;">
                            Unsend this message?
                        </div>
                        <div style="font-size: 0.9rem; color: #6b7280; line-height: 1.4;">
                            This action cannot be undone.
                        </div>
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
                    <button id="chatDeleteCancel" style="
                        background: #e2e8f0;
                        color: #334155;
                        border: none;
                        padding: 0.6rem 1.2rem;
                        border-radius: 999px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 600;
                    ">Cancel</button>
                    <button id="chatDeleteConfirm" style="
                        background: #dc3545;
                        color: #ffffff;
                        border: none;
                        padding: 0.6rem 1.2rem;
                        border-radius: 999px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 600;
                        display: inline-flex;
                        align-items: center;
                        gap: 0.4rem;
                        box-shadow: 0 10px 18px rgba(220, 53, 69, 0.3);
                    "><i class="fa-solid fa-trash-can"></i> Unsend</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        const cleanup = () => {
            if (confirmModal.parentElement) {
                confirmModal.remove();
            }
            document.removeEventListener('keydown', handleEscape);
        };

        document.getElementById('chatDeleteConfirm').onclick = () => {
            cleanup();
            resolve(true);
        };

        document.getElementById('chatDeleteCancel').onclick = () => {
            cleanup();
            resolve(false);
        };

        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) {
                cleanup();
                resolve(false);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
    });
}

let map;
let markerLayers = {};
let userReportedLocations = [];
let isReportingMode = false;
let isSupportModeActive = false;
let pendingReportCoords = null;
let confirmLocationContext = null;
let confirmedLocationName = '';
let donationPinLabel = '';
let donationPinModeActive = false;
let donationTempMarker = null;
let donationUploadedImages = [];
let confirmMiniMap = null;
let confirmMiniMapMarker = null;
let pendingDonationSelection = null;
let donationConfirmedLocationId = '';
let marilaoBoundsOutline = null;
let marilaoBoundaryLayer = null;
let mapDefaultBounds = null;
let activePopupLatLng = null;
let lastZoomLevel = null;

// Firebase Firestore functions
let db = null;
let unsubscribeListener = null;

// Initialize Firebase connection
function initFirebase() {
    // Wait for Firebase to be loaded
    if (window.firestoreDb) {
        db = window.firestoreDb;
        updateSyncStatus('online', 'Public Server Online');

        // Check if this is admin map
        if (!window.isAdminMap) {
            // Public map - no delete privileges
            window.isAdminAuthenticated = false;
        }

        // Initialize simple authentication for user identification
        import('./simple-auth.js').then(authModule => {
            authModule.initSimpleAuth();
        }).catch(error => {
            console.warn('Simple auth system not available:', error);
        });

        return true;
    } else {
        updateSyncStatus('offline', 'Local only');
        return false;
    }
}

async function saveDonationLogToFirestore(donationLog) {
    if (!db) {
        throw new Error('Firestore not initialized');
    }

    const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
    const docRef = await addDoc(collection(db, 'donation-logs'), donationLog);
    return docRef.id;
}

async function addMarilaoBoundaryLayer() {
    if (!map) return false;

    try {
        const response = await fetch('data/marilao-boundary.geojson', { cache: 'no-store' });
        if (!response.ok) {
            console.warn('Marilao boundary GeoJSON not found at data/marilao-boundary.geojson');
            return false;
        }

        const boundaryData = await response.json();
        marilaoBoundaryLayer = L.geoJSON(boundaryData, {
            style: {
                color: '#f97316',
                weight: 2,
                fill: true,
                fillColor: '#f97316',
                fillOpacity: 0.25
            },
            interactive: false
        }).addTo(map);

        if (marilaoBoundsOutline) {
            map.removeLayer(marilaoBoundsOutline);
            marilaoBoundsOutline = null;
        }

        const boundaryBounds = marilaoBoundaryLayer.getBounds();
        if (boundaryBounds.isValid()) {
            mapDefaultBounds = boundaryBounds;
            if (!window.location.hash) {
                map.fitBounds(boundaryBounds, { padding: [20, 20] });
            }
        }

        return true;
    } catch (error) {
        console.warn('Failed to load Marilao boundary GeoJSON.', error);
        return false;
    }
}

// Update sync status indicator
function updateSyncStatus(status, message) {
    const syncStatus = document.getElementById('syncStatus');
    const syncIcon = document.getElementById('syncIcon');
    const syncText = document.getElementById('syncText');

    if (!syncStatus) return;

    // Remove all status classes
    syncStatus.classList.remove('online', 'offline', 'connecting');

    // Add current status class
    syncStatus.classList.add(status);

    // Update text with public server context
    let displayMessage = message;
    if (status === 'online') {
        displayMessage = '🌐 Public Server Online - Real-time sync active';
    } else if (status === 'offline') {
        displayMessage = '📱 Local Mode - Connect to internet for sync';
    } else if (status === 'connecting') {
        displayMessage = '🔄 Connecting to public server...';
    }

    if (syncText) syncText.textContent = displayMessage;
}

// Firestore helper functions
async function saveLocationToFirestore(location) {
    if (!db) {
        console.warn('Firestore not initialized, falling back to localStorage');
        return saveToLocalStorage(location);
    }

    try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firestore save timeout after 10 seconds')), 10000);
        });

        const savePromise = (async () => {
            const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            const docRef = await addDoc(collection(db, 'relief-locations'), location);
            return docRef.id;
        })();

        // Race between save and timeout
        return await Promise.race([savePromise, timeoutPromise]);

    } catch (error) {
        console.error('Error saving to Firestore:', error);
        // Fallback to localStorage
        return saveToLocalStorage(location);
    }
}

async function loadLocationsFromFirestore() {
    if (!db) {
        console.warn('Firestore not initialized, loading from localStorage');
        return loadFromLocalStorage();
    }

    try {
        const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
        const querySnapshot = await getDocs(collection(db, 'relief-locations'));

        userReportedLocations = [];
        allLocationImages.clear(); // Clear existing image cache

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.firestoreId = doc.id; // Store Firestore document ID
            userReportedLocations.push(data);

            // Cache images for this location if they exist
            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                allLocationImages.set(data.id || data.firestoreId, data.images);
            }
        });

        return userReportedLocations;
    } catch (error) {
        console.error('Error loading from Firestore:', error);
        // Fallback to localStorage
        return loadFromLocalStorage();
    }
}

async function deleteLocationFromFirestore(firestoreId) {
    if (!db || !firestoreId) {
        console.warn('Firestore not initialized or no ID provided');
        return false;
    }

    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
        await deleteDoc(doc(db, 'relief-locations', firestoreId));
        return true;
    } catch (error) {
        console.error('❌ Error deleting from Firestore:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        // Check for specific error types
        if (error.code === 'permission-denied') {
            console.error('🔒 Permission denied - User does not have permission to delete this location');
        } else if (error.code === 'not-found') {
            console.error('📍 Location not found in Firestore');
        } else if (error.code === 'unavailable') {
            console.error('🌐 Network error - Firestore unavailable');
        }

        return false;
    }
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Batch update markers for better performance
let markerUpdateQueue = [];
let isProcessingMarkers = false;

async function processMarkerQueue() {
    if (isProcessingMarkers || markerUpdateQueue.length === 0) return;

    isProcessingMarkers = true;
    const batch = markerUpdateQueue.splice(0, 10); // Process 10 at a time

    batch.forEach(item => {
        if (item.type === 'add') {
            addUserReportedMarker(item.data);
        } else if (item.type === 'remove') {
            removeMarkerFromLayers(item.coords);
        }
    });

    isProcessingMarkers = false;

    if (markerUpdateQueue.length > 0) {
        requestAnimationFrame(() => processMarkerQueue());
    }
}

// Real-time listener for new locations with performance optimization
async function setupRealtimeListener() {
    if (!db) return;

    try {
        const { onSnapshot, collection } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        unsubscribeListener = onSnapshot(collection(db, 'relief-locations'), (snapshot) => {
            const changes = snapshot.docChanges();

            // Batch process changes for better performance
            changes.forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    data.firestoreId = change.doc.id;

                    // Check if this location is already in our local array
                    const exists = userReportedLocations.some(loc =>
                        (loc.firestoreId && loc.firestoreId === data.firestoreId) ||
                        (loc.id && data.id && loc.id === data.id)
                    );
                    if (!exists) {
                        userReportedLocations.push(data);
                        markerUpdateQueue.push({ type: 'add', data: data });

                        // Cache images for this location if they exist
                        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                            allLocationImages.set(data.id || data.firestoreId, data.images);
                        }
                    }
                }

                if (change.type === 'modified') {
                    const modifiedId = change.doc.id;
                    const index = userReportedLocations.findIndex(loc => loc.firestoreId === modifiedId);
                    if (index > -1) {
                        const data = change.doc.data();
                        data.firestoreId = modifiedId;

                        // Remove old marker and add updated one
                        markerUpdateQueue.push({ type: 'remove', coords: userReportedLocations[index].coords });
                        userReportedLocations[index] = data;
                        markerUpdateQueue.push({ type: 'add', data: data });

                        // Update cached images for this location
                        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                            allLocationImages.set(data.id || data.firestoreId, data.images);
                        } else {
                            // Remove from cache if no images
                            allLocationImages.delete(data.id || data.firestoreId);
                        }
                    }
                }

                if (change.type === 'removed') {
                    const removedId = change.doc.id;
                    const index = userReportedLocations.findIndex(loc => loc.firestoreId === removedId);
                    if (index > -1) {
                        const removedLocation = userReportedLocations[index];
                        userReportedLocations.splice(index, 1);
                        markerUpdateQueue.push({ type: 'remove', coords: removedLocation.coords });

                        // Remove from image cache
                        allLocationImages.delete(removedLocation.id || removedLocation.firestoreId);

                        map.closePopup();
                    }
                }
            });

            // Process marker updates in batches
            processMarkerQueue();

            // Debounced list update
            debouncedListUpdate();

            // Update localStorage
            localStorage.setItem('userReportedLocations', JSON.stringify(userReportedLocations));
        });
    } catch (error) {
        console.error('Error setting up real-time listener:', error);
    }
}

// Debounced list update
const debouncedListUpdate = debounce(() => {
    updatePinnedLocationsList();
}, 500);

// Fallback localStorage functions
function saveToLocalStorage(location) {
    try {
        const saved = localStorage.getItem('userReportedLocations');
        const locations = saved ? JSON.parse(saved) : [];
        locations.push(location);
        localStorage.setItem('userReportedLocations', JSON.stringify(locations));
        return location.id;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return null;
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('userReportedLocations');
        const locations = saved ? JSON.parse(saved) : [];

        // Cache images for each location
        allLocationImages.clear();
        locations.forEach(location => {
            if (location.images && Array.isArray(location.images) && location.images.length > 0) {
                allLocationImages.set(location.id || location.firestoreId, location.images);
            }
        });

        return locations;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return [];
    }
}

// Default map center (Marilao, Bulacan)
const MAP_DEFAULT_CENTER = [14.7578, 120.9483];
const MAP_DEFAULT_ZOOM = 13;

// Bounding box for Marilao/Bulacan coverage
const MAP_LAND_BOUNDS = {
    north: 14.82,
    south: 14.70,
    east: 121.02,
    west: 120.88
};

// Broader bounds used for map search/geocoding around Marilao and nearby towns
const MARILAO_SEARCH_BOUNDS = {
    north: 14.90,
    south: 14.65,
    east: 121.10,
    west: 120.85
};

// Known land reference points for validation around Marilao
const LAND_REFERENCE_POINTS = [
    { name: 'Marilao Municipal Hall', coords: [14.7586, 120.9543] },
    { name: 'Meycauayan City Hall', coords: [14.7366, 120.9602] },
    { name: 'SM Marilao', coords: [14.7589, 120.9488] },
    { name: 'Bocaue Town Center', coords: [14.7981, 120.9265] },
    { name: 'Balagtas Town Center', coords: [14.8167, 120.8667] },
    { name: 'Guiguinto Town Center', coords: [14.8337, 120.8831] },
    { name: 'Obando Municipal Hall', coords: [14.7099, 120.9369] },
    { name: 'Marilao River (Lias Area)', coords: [14.7523, 120.9699] },
    { name: 'Philippine Arena', coords: [14.7949, 120.9551] }
];

// Function to calculate distance between two coordinates (in kilometers)
function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Function to validate if a location is on land (not in the sea)
function isLocationOnLand(coords) {
    const [lat, lon] = coords;

    // First check: Must be within reasonable bounds of Marilao/Bulacan
    if (lat < MAP_LAND_BOUNDS.south || lat > MAP_LAND_BOUNDS.north ||
        lon < MAP_LAND_BOUNDS.west || lon > MAP_LAND_BOUNDS.east) {
        return false;
    }

    // Second check: Must be within reasonable distance of known land points
    const maxDistanceFromLand = 8; // Maximum 8km from any known land point

    for (const landPoint of LAND_REFERENCE_POINTS) {
        const distance = calculateDistance(coords, landPoint.coords);
        if (distance <= maxDistanceFromLand) {
            return true;
        }
    }

    // Third check: Exclude obvious out-of-bounds coordinates
    if (lon > MAP_LAND_BOUNDS.east + 0.03) {
        return false;
    }

    if (lon < MAP_LAND_BOUNDS.west - 0.03) {
        return false;
    }

    if (lat > MAP_LAND_BOUNDS.north + 0.03 || lat < MAP_LAND_BOUNDS.south - 0.03) {
        return false;
    }

    return false;
}


// Check URL hash for coordinates to pan to
function checkUrlHash() {
    const hash = window.location.hash;
    if (!hash || !map) return;

    // Hash format: #lat,lng,zoom
    const hashValue = hash.substring(1); // Remove the '#'
    const parts = hashValue.split(',');

    if (parts.length === 3) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        const zoom = parseInt(parts[2]);

        if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
            console.log(`Panning to coordinates from URL: ${lat}, ${lng}, zoom ${zoom}`);

            // Pan and zoom to the coordinates
            map.setView([lat, lng], zoom, {
                animate: true,
                duration: 1
            });

            // Find and open the popup for this location if it exists
            setTimeout(() => {
                let foundMarker = null;
                markerLayers.userReported.eachLayer(layer => {
                    const markerLatLng = layer.getLatLng();
                    // Check if marker is at or very close to these coordinates
                    if (Math.abs(markerLatLng.lat - lat) < 0.0001 &&
                        Math.abs(markerLatLng.lng - lng) < 0.0001) {
                        foundMarker = layer;
                    }
                });

                if (foundMarker) {
                    foundMarker.openPopup();
                }
            }, 500);
        }
    }
}

// Initialize the map
async function initMap() {
    // Create map centered on Marilao, Bulacan with performance options
    map = L.map('map', {
        preferCanvas: true, // Use Canvas renderer for better performance
        zoomControl: false,
        attributionControl: true,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true
    }).setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);

    lastZoomLevel = map.getZoom();

    map.on('popupopen', (event) => {
        activePopupLatLng = event.popup.getLatLng();
    });

    map.on('popupclose', () => {
        activePopupLatLng = null;
    });

    map.on('zoomanim', (event) => {
        if (!activePopupLatLng || lastZoomLevel === null) return;

        if (event.zoom < lastZoomLevel) {
            map.closePopup();
            activePopupLatLng = null;
        }
    });

    map.on('zoomend', () => {
        const currentZoom = map.getZoom();

        if (activePopupLatLng && lastZoomLevel !== null && currentZoom < lastZoomLevel) {
            map.closePopup();
            activePopupLatLng = null;
        } else {
            recenterActivePopup();
        }

        lastZoomLevel = currentZoom;
    });

    const marilaoBounds = L.latLngBounds(
        [MAP_LAND_BOUNDS.south, MAP_LAND_BOUNDS.west],
        [MAP_LAND_BOUNDS.north, MAP_LAND_BOUNDS.east]
    );

    mapDefaultBounds = marilaoBounds;

    map.setMaxBounds(marilaoBounds);
    map.options.maxBoundsViscosity = 1.0;

    // Add tile layer with performance optimizations
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 11,
        updateWhenIdle: false, // Update tiles while panning
        updateWhenZooming: false, // Don't update while zooming
        keepBuffer: 2 // Keep tiles in buffer for smoother panning
    }).addTo(map);

    marilaoBoundsOutline = L.rectangle(marilaoBounds, {
        color: '#0f766e',
        weight: 2,
        fill: false
    }).addTo(map);

    const boundaryLoaded = await addMarilaoBoundaryLayer();
    if (!boundaryLoaded) {
        map.fitBounds(marilaoBounds, { padding: [20, 20] });
    }

    // Initialize layer groups - only user reported locations
    markerLayers = {
        userReported: L.layerGroup().addTo(map)
    };

    // Initialize Firebase
    initFirebase();

    // Load user reported locations from Firestore/localStorage
    await loadUserReportedLocations();

    // Set up real-time listener for new locations
    setupRealtimeListener();

    // Set up event listeners
    setupEventListeners();
}

function resetMapView() {
    if (!map) return;

    map.closePopup();
    activePopupLatLng = null;

    const fitOptions = {
        padding: [20, 20],
        animate: true,
        duration: 0.8
    };

    map.once('moveend', () => {
        recenterActivePopup({ duration: 0.4 });
    });

    if (mapDefaultBounds) {
        map.fitBounds(mapDefaultBounds, fitOptions);
    } else {
        map.setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, {
            animate: true,
            duration: 0.8
        });
    }
}

// Event listeners
function setupEventListeners() {
    // Report location button
    const reportLocationBtn = document.getElementById('reportLocation');
    if (reportLocationBtn) {
        reportLocationBtn.addEventListener('click', startReportingMode);
    }

    const resetMapViewBtn = document.getElementById('resetMapView');
    if (resetMapViewBtn) {
        resetMapViewBtn.addEventListener('click', resetMapView);
    }

    // Info panel buttons
    const infoPanel = document.getElementById('infoPanel');
    const infoBackdrop = document.getElementById('infoPanelBackdrop');
    const startGuestSessionBtn = document.getElementById('startGuestSession');

    const hideInfoPanel = () => {
        console.log('hideInfoPanel called');
        if (infoPanel) {
            infoPanel.style.display = 'none';
            console.log('Info panel hidden');
        } else {
            console.log('Info panel not found');
        }
        if (infoBackdrop) {
            infoBackdrop.classList.remove('is-visible');
            console.log('Info backdrop hidden');
        } else {
            console.log('Info backdrop not found');
        }
    };

    // Info panel close button
    const closeInfoBtn = document.getElementById('closeInfo');
    if (closeInfoBtn) {
        closeInfoBtn.addEventListener('click', hideInfoPanel);
    }

    if (infoBackdrop) {
        infoBackdrop.addEventListener('click', hideInfoPanel);
    }

    if (startGuestSessionBtn) {
        console.log('Start Guest Session button found, adding event listener');
        startGuestSessionBtn.addEventListener('click', (e) => {
            console.log('Start Guest Session button clicked!');
            console.log('Event object:', e);
            console.log('Button element:', startGuestSessionBtn);
            e.preventDefault();
            e.stopPropagation();

            try {
                console.log('Calling ensureGuestSession...');
                const result = ensureGuestSession({ showAlert: true });
                console.log('ensureGuestSession returned:', result);

                console.log('Calling hideInfoPanel...');
                hideInfoPanel();
                console.log('hideInfoPanel completed');
            } catch (error) {
                console.error('Error in Start Guest Session click handler:', error);
                alert('Error starting guest session: ' + error.message);
            }
        });
    } else {
        console.log('Start Guest Session button NOT found!');
    }

    // Hero CTA button (hide info panel) - exclude startGuestSessionBtn
    document.querySelectorAll('.info-start-btn').forEach((button) => {
        if (button.id !== 'startGuestSession') {
            button.addEventListener('click', hideInfoPanel);
        }
    });

    // Modal event listeners
    const closeReportModalBtn = document.getElementById('closeReportModal');
    if (closeReportModalBtn) {
        closeReportModalBtn.addEventListener('click', closeReportModal);
    }

    const cancelReportBtn = document.getElementById('cancelReport');
    if (cancelReportBtn) {
        cancelReportBtn.addEventListener('click', closeReportModal);
    }

    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', submitLocationReport);
    }

    // Privacy Policy Modal Event Listeners
    const viewPrivacyPolicyBtn = document.getElementById('viewPrivacyPolicy');
    const privacyPolicyModal = document.getElementById('privacyPolicyModal');
    const closePrivacyModalBtn = document.getElementById('closePrivacyModal');
    const consentPrivacyBtn = document.getElementById('consentPrivacy');
    const disagreePrivacyBtn = document.getElementById('disagreePrivacy');
    const consentStatus = document.getElementById('consentStatus');

    // Privacy consent state
    let privacyConsented = false;

    // Open privacy policy modal
    if (viewPrivacyPolicyBtn) {
        viewPrivacyPolicyBtn.addEventListener('click', () => {
            if (privacyPolicyModal) {
                privacyPolicyModal.style.display = 'flex';
            }
        });
    }

    // Close privacy policy modal
    if (closePrivacyModalBtn) {
        closePrivacyModalBtn.addEventListener('click', () => {
            if (privacyPolicyModal) {
                privacyPolicyModal.style.display = 'none';
            }
        });
    }

    // Consent to privacy policy
    if (consentPrivacyBtn) {
        consentPrivacyBtn.addEventListener('click', () => {
            privacyConsented = true;
            updateConsentStatus(true);
            if (privacyPolicyModal) {
                privacyPolicyModal.style.display = 'none';
            }
        });
    }

    // Disagree with privacy policy
    if (disagreePrivacyBtn) {
        disagreePrivacyBtn.addEventListener('click', () => {
            privacyConsented = false;
            updateConsentStatus(false);
            if (privacyPolicyModal) {
                privacyPolicyModal.style.display = 'none';
            }
            // Close report modal if user disagrees
            closeReportModal();
        });
    }

    // Close modal when clicking outside
    if (privacyPolicyModal) {
        privacyPolicyModal.addEventListener('click', (e) => {
            if (e.target.id === 'privacyPolicyModal') {
                privacyPolicyModal.style.display = 'none';
            }
        });
    }

    // Update consent status display
    function updateConsentStatus(consented) {
        if (consentStatus) {
            if (consented) {
                consentStatus.classList.add('consented');
                consentStatus.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    <span>Privacy consent given</span>
                `;
            } else {
                consentStatus.classList.remove('consented');
                consentStatus.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Privacy consent required</span>
                `;
            }
        }
        
        // Enable/disable submit button based on consent
        const submitBtn = document.querySelector('#reportForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = !consented;
            if (consented) {
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            } else {
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
            }
        }
    }

    // Initialize consent status
    updateConsentStatus(false);

    // Urgency button event listeners
    const urgencyButtons = document.querySelectorAll('.urgency-btn');
    const urgencyLevelInput = document.getElementById('urgencyLevel');

    if (urgencyButtons.length > 0 && urgencyLevelInput) {
        urgencyButtons.forEach(button => {
            button.addEventListener('click', function () {
                // Remove selected class from all buttons
                urgencyButtons.forEach(btn => btn.classList.remove('selected'));

                // Add selected class to clicked button
                this.classList.add('selected');

                // Set the hidden input value
                const urgencyValue = this.getAttribute('data-urgency');
                urgencyLevelInput.value = urgencyValue;

                // Optional: Add visual feedback
                console.log('Urgency selected:', urgencyValue);
            });
        });
    }

    const donationLogForm = document.getElementById('donationLogForm');
    if (donationLogForm) {
        donationLogForm.addEventListener('submit', submitDonationLog);
    }

    // Confirm location modal listeners
    const confirmLocationYes = document.getElementById('confirmLocationYes');
    if (confirmLocationYes) {
        confirmLocationYes.addEventListener('click', confirmLocationAndOpenReport);
    }

    const confirmLocationNo = document.getElementById('confirmLocationNo');
    if (confirmLocationNo) {
        confirmLocationNo.addEventListener('click', chooseDifferentLocation);
    }

    const closeConfirmLocationModalBtn = document.getElementById('closeConfirmLocationModal');
    if (closeConfirmLocationModalBtn) {
        closeConfirmLocationModalBtn.addEventListener('click', chooseDifferentLocation);
    }

    const copyConfirmCoordsBtn = document.getElementById('copyConfirmCoords');
    if (copyConfirmCoordsBtn) {
        copyConfirmCoordsBtn.addEventListener('click', copyConfirmLocationCoords);
    }

    const confirmLocationWazeBtn = document.getElementById('confirmLocationWaze');
    if (confirmLocationWazeBtn) {
        confirmLocationWazeBtn.addEventListener('click', openConfirmLocationInWaze);
    }

    const confirmLocationGoogleMapsBtn = document.getElementById('confirmLocationGoogleMaps');
    if (confirmLocationGoogleMapsBtn) {
        confirmLocationGoogleMapsBtn.addEventListener('click', openConfirmLocationInGoogleMaps);
    }

    const confirmLocationModal = document.getElementById('confirmLocationModal');
    if (confirmLocationModal) {
        confirmLocationModal.addEventListener('click', (e) => {
            if (e.target.id === 'confirmLocationModal') {
                chooseDifferentLocation();
            }
        });
    }

    // Image upload functionality
    setupImageUpload();
    setupDonationImageUpload();
    bindDonationModalControls();


    // Close modal when clicking outside
    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target.id === 'reportModal') {
                closeReportModal();
            }
        });
    }

    const donationLogModal = document.getElementById('donationLogModal');
    if (donationLogModal) {
        donationLogModal.addEventListener('click', (event) => {
            if (event.target.id === 'donationLogModal') {
                closeDonationLogModal();
            }
        });
    }

    // Search functionality with autocomplete (only when search UI is present)
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchLocation');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', searchLocation);

        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keydown', handleSearchKeydown);
        searchInput.addEventListener('blur', () => {
            // Delay hiding suggestions to allow clicks
            setTimeout(() => hideSuggestions(), 150);
        });
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) {
                handleSearchInput();
            }
        });
    }

    // Clear search functionality (no clear button in new design)

    // Welcome guide functionality
    const startUsingMap = document.getElementById('startUsingMap');
    if (startUsingMap) {
        startUsingMap.addEventListener('click', hideWelcomeGuide);
    }

    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarPanel = document.getElementById('sidebarPanel');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarReportLocation = document.getElementById('sidebarReportLocation');
    const sidebarSupportLocation = document.getElementById('sidebarSupportLocation');
    const sidebarLogDonation = document.getElementById('sidebarLogDonation');
    // Activity Logs is now a direct link to user-dashboard.html
    const activityLogModal = document.getElementById('activityLogModal');
    const closeActivityLogModalBtn = document.getElementById('closeActivityLogModal');
    const reachedViewToggle = document.getElementById('reachedViewToggle');
    const unreachedSearch = document.getElementById('unreachedSearch');
    const unreachedFilter = document.getElementById('unreachedFilter');
    const claimsSearch = document.getElementById('claimsSearch');
    const claimsFilter = document.getElementById('claimsFilter');

    const moveFocusOutsideSidebar = () => {
        if (!sidebarPanel) {
            return;
        }
        if (sidebarPanel.contains(document.activeElement)) {
            if (sidebarToggle) {
                sidebarToggle.focus();
            } else if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        }
    };

    const openSidebar = () => {
        if (sidebarPanel) {
            sidebarPanel.classList.add('is-open');
            sidebarPanel.setAttribute('aria-hidden', 'false');
            sidebarPanel.removeAttribute('inert');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.add('is-visible');
        }
        if (sidebarClose) {
            sidebarClose.focus();
        }
    };

    const closeSidebar = () => {
        moveFocusOutsideSidebar();
        if (sidebarPanel) {
            sidebarPanel.classList.remove('is-open');
            sidebarPanel.setAttribute('aria-hidden', 'true');
            sidebarPanel.setAttribute('inert', '');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('is-visible');
        }
    };

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (sidebarPanel && sidebarPanel.classList.contains('is-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    if (sidebarReportLocation) {
        sidebarReportLocation.addEventListener('click', () => {
            closeSidebar();
            startReportingMode();
        });
    }

    if (sidebarSupportLocation) {
        sidebarSupportLocation.addEventListener('click', () => {
            closeSidebar();
            startSupportMode();
        });
    }

    if (sidebarLogDonation) {
        sidebarLogDonation.addEventListener('click', () => {
            closeSidebar();
            openDonationLogModal();
        });
    }

    // Activity Logs is now a direct link to user-dashboard.html

    if (closeActivityLogModalBtn) {
        closeActivityLogModalBtn.addEventListener('click', closeActivityLogModal);
    }

    if (activityLogModal) {
        activityLogModal.addEventListener('click', (event) => {
            if (event.target.id === 'activityLogModal') {
                closeActivityLogModal();
            }
        });
    }

    if (reachedViewToggle) {
        reachedViewToggle.addEventListener('change', (event) => {
            setReachedViewActive(event.target.checked);
        });
    }

    // Sync map toggle with sidebar toggle
    const reachedViewToggleMap = document.getElementById('reachedViewToggleMap');
    if (reachedViewToggleMap) {
        reachedViewToggleMap.addEventListener('change', (event) => {
            setReachedViewActive(event.target.checked);
            // Sync with sidebar toggle
            if (reachedViewToggle) {
                reachedViewToggle.checked = event.target.checked;
            }
        });
    }

    if (window.isDonorMap) {
        [unreachedSearch, claimsSearch].forEach((input) => {
            if (input) {
                input.addEventListener('input', updateDonorDashboardOverview);
            }
        });

        [unreachedFilter, claimsFilter].forEach((select) => {
            if (select) {
                select.addEventListener('change', updateDonorDashboardOverview);
            }
        });
    }


    // Hide search suggestions when clicking on map
    document.addEventListener('click', (e) => {
        const searchSuggestions = document.getElementById('searchSuggestions');
        const searchContainer = document.querySelector('.search-container');

        // Check if click is outside search container and suggestions are visible
        if (searchSuggestions && searchContainer &&
            !searchContainer.contains(e.target) &&
            (searchSuggestions.classList.contains('show') || searchSuggestions.style.display === 'block')) {
            // Hide suggestions using both methods to ensure it works
            searchSuggestions.classList.remove('show');
            searchSuggestions.style.display = 'none';
            currentSuggestionIndex = -1;
        }
    });

    // Directions panel close button
    const closeDirectionsBtn = document.getElementById('closeDirections');
    if (closeDirectionsBtn) {
        closeDirectionsBtn.addEventListener('click', () => {
            const directionsPanel = document.getElementById('directionsPanel');
            if (directionsPanel) {
                directionsPanel.style.display = 'none';
            }
        });
    }

    // Pinned locations dropdown
    const viewPinnedBtn = document.getElementById('viewPinnedBtn');
    if (viewPinnedBtn) {
        viewPinnedBtn.addEventListener('click', togglePinnedLocationsList);
    }

    const closePinnedListBtn = document.getElementById('closePinnedList');
    if (closePinnedListBtn) {
        closePinnedListBtn.addEventListener('click', hidePinnedLocationsList);
    }

    // Pinned locations search and filter
    const pinnedSearchInput = document.getElementById('pinnedSearchInput');
    if (pinnedSearchInput) {
        pinnedSearchInput.addEventListener('input', filterPinnedLocations);
    }
    document.querySelectorAll('.urgency-filter').forEach(filter => {
        filter.addEventListener('click', handleUrgencyFilter);
    });

    // Close pinned list when clicking outside
    const dropdown = document.querySelector('.pinned-locations-dropdown');
    const pinnedList = document.getElementById('pinnedLocationsList');
    if (dropdown && pinnedList) {
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && pinnedList.style.display === 'block') {
                hidePinnedLocationsList();
            }
        });
    }

    updateReachedViewUI();
}

// Search functionality with geocoding and autocomplete
let searchMarker = null;
let searchCache = new Map();
let searchTimeout = null;
let currentSuggestionIndex = -1;
let suggestions = [];

// Marilao/Bulacan location database with geocoded coordinates
const commonLocations = [
    // Municipalities & Cities
    { name: 'Marilao', address: 'Marilao, Bulacan', type: 'Municipality', coords: [14.7578, 120.9483] },
    { name: 'Meycauayan City', address: 'Meycauayan, Bulacan', type: 'City', coords: [14.7366, 120.9602] },
    { name: 'Bocaue', address: 'Bocaue, Bulacan', type: 'Municipality', coords: [14.7981, 120.9265] },
    { name: 'Obando', address: 'Obando, Bulacan', type: 'Municipality', coords: [14.7099, 120.9369] },
    { name: 'Balagtas', address: 'Balagtas, Bulacan', type: 'Municipality', coords: [14.8167, 120.8667] },
    { name: 'Guiguinto', address: 'Guiguinto, Bulacan', type: 'Municipality', coords: [14.8337, 120.8831] },

    // Marilao Barangays & Landmarks
    { name: 'Barangay Lias', address: 'Lias, Marilao, Bulacan', type: 'Barangay', coords: [14.7446, 120.9727] },
    { name: 'Barangay Patubig', address: 'Patubig, Marilao, Bulacan', type: 'Barangay', coords: [14.7512, 120.9401] },
    { name: 'Barangay Ibayo', address: 'Ibayo, Marilao, Bulacan', type: 'Barangay', coords: [14.7569, 120.9557] },
    { name: 'Barangay Saog', address: 'Saog, Marilao, Bulacan', type: 'Barangay', coords: [14.7434, 120.9556] },
    { name: 'Barangay Lambakin', address: 'Lambakin, Marilao, Bulacan', type: 'Barangay', coords: [14.7716, 120.9512] },
    { name: 'Marilao Municipal Hall', address: 'Municipal Hall, Marilao, Bulacan', type: 'Landmark', coords: [14.7586, 120.9543] },
    { name: 'SM City Marilao', address: 'SM City Marilao, Bulacan', type: 'Mall', coords: [14.7589, 120.9488] },
    { name: 'Marilao Public Market', address: 'Public Market, Marilao, Bulacan', type: 'Landmark', coords: [14.7562, 120.9517] },
    { name: 'Marilao Community Hospital', address: 'Community Hospital, Marilao, Bulacan', type: 'Hospital', coords: [14.7634, 120.9554] },
    { name: 'Prenza I', address: 'Prenza I, Marilao, Bulacan', type: 'Barangay', coords: [14.8015, 120.9495] },
    { name: 'Prenza II', address: 'Prenza II, Marilao, Bulacan', type: 'Barangay', coords: [14.7895, 120.9490] },
    { name: 'Santa Rosa I', address: 'Santa Rosa I, Marilao, Bulacan', type: 'Barangay', coords: [14.7958, 120.9556] },
    { name: 'Santa Rosa II', address: 'Santa Rosa II, Marilao, Bulacan', type: 'Barangay', coords: [14.7922, 120.9523] },
    { name: 'Loma de Gato', address: 'Loma de Gato, Marilao, Bulacan', type: 'Barangay', coords: [14.8088, 120.9674] },
    { name: 'Tabing Ilog', address: 'Tabing Ilog, Marilao, Bulacan', type: 'Barangay', coords: [14.7610, 120.9296] },
    { name: 'Abangan Norte', address: 'Abangan Norte, Marilao, Bulacan', type: 'Barangay', coords: [14.7655, 120.9439] },
    { name: 'Abangan Sur', address: 'Abangan Sur, Marilao, Bulacan', type: 'Barangay', coords: [14.7595, 120.9465] },
    { name: 'Poblacion I', address: 'Poblacion I, Marilao, Bulacan', type: 'Barangay', coords: [14.7584, 120.9512] },
    { name: 'Poblacion II', address: 'Poblacion II, Marilao, Bulacan', type: 'Barangay', coords: [14.7568, 120.9498] },
    { name: 'Nagbalon', address: 'Nagbalon, Marilao, Bulacan', type: 'Barangay', coords: [14.7484, 120.9379] },
    { name: 'Prenza 1', address: 'Prenza 1, Marilao, Bulacan', type: 'Barangay', coords: [14.8015, 120.9495] },
    { name: 'Prenza 2', address: 'Prenza 2, Marilao, Bulacan', type: 'Barangay', coords: [14.7895, 120.9490] },

    // Nearby landmarks
    { name: 'Philippine Arena', address: 'Ciudad de Victoria, Bocaue, Bulacan', type: 'Landmark', coords: [14.7949, 120.9551] },
    { name: 'Paseo Del Congreso', address: 'Paseo Del Congreso, Malolos, Bulacan', type: 'Landmark', coords: [14.8444, 120.8111] },
    { name: 'Meycauayan Public Market', address: 'Public Market, Meycauayan, Bulacan', type: 'Landmark', coords: [14.7390, 120.9575] },
    { name: 'Obando Church', address: 'San Pascual Baylon Parish, Obando, Bulacan', type: 'Religious', coords: [14.7079, 120.9367] },
    { name: 'NLEX Marilao Exit', address: 'NLEX Marilao Exit, Bulacan', type: 'Transport', coords: [14.7672, 120.9636] }
];

// Search suggestion handling
let searchDebounceTimer = null;

function clearSearchMarker() {
    if (currentSearchMarker) {
        map.removeLayer(currentSearchMarker);
        currentSearchMarker = null;
    }
}

function handleSearchInput(e) {
    // Handle cases where event might not have target
    let query = '';
    if (e && e.target && e.target.value) {
        query = e.target.value.trim();
    } else {
        // Fallback to getting value directly from search input
        const searchInput = document.getElementById('searchLocation');
        if (searchInput && searchInput.value) {
            query = searchInput.value.trim();
        }
    }

    const suggestionsContainer = document.getElementById('searchSuggestions');

    if (!suggestionsContainer) {
        console.warn('Search suggestions container not found');
        return;
    }

    clearTimeout(searchDebounceTimer);

    if (!query) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.remove('show');
        // Clear search marker when search is cleared
        clearSearchMarker();
        // Restore all pins when search is cleared
        restoreAllPins();
        return;
    }

    searchDebounceTimer = setTimeout(() => {
        try {
            const results = searchCommonLocations(query);
            renderSearchSuggestions(results);

            // Real-time pin filtering based on search query
            filterPinsRealTime(query);
        } catch (error) {
            console.error('Search suggestions error:', error);
        }
    }, 300);
}

function searchCommonLocations(query) {
    const searchLower = query.toLowerCase();

    // Define priority areas (higher priority locations)
    const priorityAreas = [
        'Marilao', 'Meycauayan City', 'Bocaue', 'Santa Maria', 'Balagtas', 'Obando', 'Guiguinto',
        'Barangay Lias', 'Barangay Patubig', 'Barangay Ibayo', 'Barangay Saog', 'Barangay Lambakin',
        'Prenza I', 'Prenza II', 'Prenza 1', 'Prenza 2', 'Santa Rosa I', 'Santa Rosa II', 'Tabing Ilog',
        'Abangan Norte', 'Abangan Sur', 'Nagbalon', 'Poblacion I', 'Poblacion II', 'Loma de Gato',
        'Lias', 'Lambakin', 'Philippine Arena', 'SM City Marilao',
        'Marilao Public Market', 'Marilao Community Hospital', 'NLEX Marilao Exit'
    ];

    // Filter locations that match the search query
    const filteredLocations = commonLocations.filter(location =>
        location.name.toLowerCase().includes(searchLower) ||
        location.address.toLowerCase().includes(searchLower) ||
        location.type.toLowerCase().includes(searchLower)
    );

    // Sort by priority and relevance
    filteredLocations.sort((a, b) => {
        const aNameMatch = a.name.toLowerCase().startsWith(searchLower);
        const bNameMatch = b.name.toLowerCase().startsWith(searchLower);
        const aIsPriority = priorityAreas.includes(a.name);
        const bIsPriority = priorityAreas.includes(b.name);

        // Priority 1: Exact name matches from priority areas
        if (aNameMatch && aIsPriority && !(bNameMatch && bIsPriority)) return -1;
        if (bNameMatch && bIsPriority && !(aNameMatch && aIsPriority)) return 1;

        // Priority 2: Any exact name matches
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        // Priority 3: Priority areas (even partial matches)
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;

        // Priority 4: Sort by location type importance
        const typeOrder = ['City', 'Municipality', 'Barangay', 'Barangay Center', 'Town Center',
            'Landmark', 'School', 'Religious', 'Area', 'Sitio', 'Purok', 'Coastal Area'];
        const aTypeIndex = typeOrder.indexOf(a.type);
        const bTypeIndex = typeOrder.indexOf(b.type);

        if (aTypeIndex !== bTypeIndex) {
            return (aTypeIndex === -1 ? 999 : aTypeIndex) - (bTypeIndex === -1 ? 999 : bTypeIndex);
        }

        // Final: Sort alphabetically
        return a.name.localeCompare(b.name);
    });

    // Return in the format expected by renderSearchSuggestions
    const results = filteredLocations.map(location => ({
        lat: location.coords[0],
        lon: location.coords[1],
        display_name: location.address,
        name: location.name,
        type: location.type
    }));

    return results;
}

function renderSearchSuggestions(results) {
    const suggestionsContainer = document.getElementById('searchSuggestions');

    if (!suggestionsContainer) {
        return;
    }

    if (!results || results.length === 0) {
        suggestionsContainer.innerHTML = '<div class="suggestion-item">No results found</div>';
        suggestionsContainer.classList.add('show');
        return;
    }

    const limitedResults = results.slice(0, 8);
    suggestionsContainer.innerHTML = limitedResults.map((result) => {
        const safeDisplay = result.display_name.replace(/"/g, '&quot;');
        const typeIcon = getLocationTypeIcon(result.type);
        return `
            <div class="suggestion-item" data-lat="${result.lat}" data-lon="${result.lon}" data-display="${safeDisplay}">
                <div class="suggestion-main">
                    <i class="${typeIcon}"></i>
                    ${result.name}
                </div>
                <div class="suggestion-address">${result.display_name}</div>
                <div class="suggestion-details">
                    <span class="suggestion-type">${result.type}</span>
                </div>
            </div>
        `;
    }).join('');

    suggestionsContainer.classList.add('show');

    // Add click event listeners to suggestions
    Array.from(suggestionsContainer.querySelectorAll('.suggestion-item')).forEach(item => {
        item.addEventListener('click', () => {
            const lat = parseFloat(item.getAttribute('data-lat'));
            const lon = parseFloat(item.getAttribute('data-lon'));
            const displayName = item.getAttribute('data-display');
            const locationName = item.querySelector('.suggestion-main').textContent.trim();

            suggestionsContainer.classList.remove('show');
            document.getElementById('searchLocation').value = locationName;
            showSearchResult([lat, lon], displayName, locationName);
        });
    });
}

function getLocationTypeIcon(type) {
    const icons = {
        'City': 'fas fa-city',
        'Municipality': 'fas fa-building',
        'Barangay': 'fas fa-home',
        'Sitio': 'fas fa-map-pin',
        'Purok': 'fas fa-map-marker-alt',
        'School': 'fas fa-school',
        'Landmark': 'fas fa-landmark',
        'Religious': 'fas fa-church',
        'Area': 'fas fa-map',
        'Barangay Center': 'fas fa-dot-circle',
        'Town Center': 'fas fa-city',
        'Coastal Area': 'fas fa-water'
    };
    return icons[type] || 'fas fa-map-marker-alt';
}

// Global variable to track current search result marker
let currentSearchMarker = null;

// Autocomplete functions (using enhanced search suggestion handling above)

function handleSearchKeydown(e) {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    const suggestionItems = suggestionsDiv.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, suggestionItems.length - 1);
        highlightSuggestion();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
        highlightSuggestion();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentSuggestionIndex >= 0 && suggestionItems[currentSuggestionIndex]) {
            // Trigger click on the highlighted suggestion
            suggestionItems[currentSuggestionIndex].click();
        } else if (!isSearching) {
            searchLocation();
        }
    } else if (e.key === 'Escape') {
        hideSuggestions();
        document.getElementById('searchLocation').blur();
    }
}

function hideSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.remove('show');
        suggestionsContainer.innerHTML = '';
    }
    currentSuggestionIndex = -1;
}

function highlightSuggestion() {
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    suggestionItems.forEach((item, index) => {
        if (index === currentSuggestionIndex) {
            item.classList.add('highlighted');
        } else {
            item.classList.remove('highlighted');
        }
    });
}

async function fetchSuggestions(searchTerm) {
    try {
        // Check cache first
        const cacheKey = searchTerm.toLowerCase();
        if (searchCache.has(cacheKey)) {
            displaySuggestions(searchCache.get(cacheKey), searchTerm);
            return;
        }

        // Combine local suggestions with geocoding
        const localSuggestions = getLocalSuggestions(searchTerm);
        const geocodingSuggestions = await getGeocodingSuggestions(searchTerm);

        // Merge and deduplicate
        const allSuggestions = [...localSuggestions, ...geocodingSuggestions];
        const uniqueSuggestions = deduplicateSuggestions(allSuggestions);

        // Cache results
        searchCache.set(cacheKey, uniqueSuggestions);

        displaySuggestions(uniqueSuggestions, searchTerm);

    } catch (error) {
        console.error('Error fetching suggestions:', error);
        // Show local suggestions only
        const localSuggestions = getLocalSuggestions(searchTerm);
        displaySuggestions(localSuggestions, searchTerm);
    }
}

function getLocalSuggestions(searchTerm) {
    const term = searchTerm.toLowerCase();
    const exactMatches = [];
    const startsWithMatches = [];
    const containsMatches = [];

    // Search in common locations with improved matching
    commonLocations.forEach(location => {
        const locationName = location.name.toLowerCase();
        const locationAddress = location.address.toLowerCase();

        // Exact name match gets highest priority
        if (locationName === term) {
            exactMatches.push({
                name: location.name,
                shortAddress: location.address,
                type: location.type,
                coords: location.coords,
                source: 'local_exact',
                priority: 0
            });
            return;
        }

        // Check if name starts with the search term
        const nameStartsWith = locationName.startsWith(term);

        // Check if any word in the address starts with the search term
        const addressWords = locationAddress.split(/[,\s]+/).map(word => word.trim()).filter(word => word.length > 0);
        const addressWordStartsWith = addressWords.some(word => word.startsWith(term));

        // Check if name contains the term (for partial matches)
        const nameContains = locationName.includes(term);

        if (nameStartsWith || addressWordStartsWith) {
            startsWithMatches.push({
                name: location.name,
                shortAddress: location.address,
                type: location.type,
                coords: location.coords,
                source: 'local',
                priority: nameStartsWith ? 1 : 2
            });
        } else if (nameContains && term.length >= 3) {
            // Only include contains matches for longer search terms
            containsMatches.push({
                name: location.name,
                shortAddress: location.address,
                type: location.type,
                coords: location.coords,
                source: 'local_partial',
                priority: 3
            });
        }
    });

    // Search in user reported locations
    userReportedLocations.forEach(location => {
        const locationName = location.name.toLowerCase();

        if (locationName === term) {
            exactMatches.push({
                name: location.name,
                shortAddress: location.name,
                type: 'Reported Location',
                coords: location.coords,
                source: 'user_reported_exact',
                urgency: location.urgencyLevel,
                priority: 0
            });
        } else if (locationName.startsWith(term)) {
            startsWithMatches.push({
                name: location.name,
                shortAddress: location.name,
                type: 'Reported Location',
                coords: location.coords,
                source: 'user_reported',
                urgency: location.urgencyLevel,
                priority: 1
            });
        }
    });

    // Combine all matches with priority order: exact -> starts with -> contains
    const allMatches = [...exactMatches, ...startsWithMatches, ...containsMatches];

    // Sort by priority, then by name length (shorter names first for same priority)
    allMatches.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.name.length - b.name.length;
    });

    return allMatches.slice(0, 8);
}

// Geocoding service selection is controlled via USE_GOOGLE_MAPS (see top-level config)

async function getGeocodingSuggestions(searchTerm) {
    try {
        // Use Google Maps if API key is configured, otherwise fallback to OpenStreetMap
        if (GOOGLE_MAPS_ENABLED) {
            return await getGoogleMapsGeocodingSuggestions(searchTerm);
        } else {
            return await getOpenStreetMapGeocodingSuggestions(searchTerm);
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        return [];
    }
}

async function getGoogleMapsGeocodingSuggestions(searchTerm) {
    try {
        // Try multiple search strategies for better precision
        const searches = [
            // Exact search with Marilao/Bulacan context
            `${searchTerm}, Marilao, Bulacan, Philippines`,
            `${searchTerm}, Bulacan, Philippines`,
            `${searchTerm}, Central Luzon, Philippines`,
            searchTerm
        ];

        let allResults = [];

        for (const query of searches) {
            const encodedQuery = encodeURIComponent(query);
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&bounds=${MARILAO_SEARCH_BOUNDS.south},${MARILAO_SEARCH_BOUNDS.west}|${MARILAO_SEARCH_BOUNDS.north},${MARILAO_SEARCH_BOUNDS.east}&region=ph&key=${GOOGLE_MAPS_API_KEY}`;

            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();

                if (data.status === 'OK' && data.results) {
                    // Filter results to Marilao/Bulacan area and exclude water locations
                    const filteredResults = data.results.filter(result => {
                        const location = result.geometry.location;
                        const lat = location.lat;
                        const lng = location.lng;
                        const formattedAddress = result.formatted_address.toLowerCase();

                        // Check if coordinates are within Marilao/Bulacan bounds
                        const withinBounds = lat >= MARILAO_SEARCH_BOUNDS.south &&
                            lat <= MARILAO_SEARCH_BOUNDS.north &&
                            lng >= MARILAO_SEARCH_BOUNDS.west &&
                            lng <= MARILAO_SEARCH_BOUNDS.east;

                        // Exclude water/sea locations
                        const isWaterLocation = formattedAddress.includes('sea') ||
                            formattedAddress.includes('ocean') ||
                            formattedAddress.includes('strait') ||
                            formattedAddress.includes('channel') ||
                            formattedAddress.includes('bay') ||
                            formattedAddress.includes('reef') ||
                            result.types.includes('natural_feature') &&
                            (formattedAddress.includes('water') || formattedAddress.includes('coast'));

                        // Check if it's a valid land location
                        const isValidLandLocation = isLocationOnLand([lat, lng]);

                        // Must be within bounds, not water, on land, and in Bulacan area
                        return withinBounds && !isWaterLocation && isValidLandLocation && (
                            formattedAddress.includes('marilao') ||
                            formattedAddress.includes('bulacan') ||
                            formattedAddress.includes('meycauayan') ||
                            formattedAddress.includes('bocaue') ||
                            formattedAddress.includes('sta. maria') ||
                            formattedAddress.includes('santa maria') ||
                            formattedAddress.includes('balagtas') ||
                            formattedAddress.includes('guiguinto') ||
                            formattedAddress.includes('obando')
                        );
                    });

                    const mappedResults = filteredResults.map(result => ({
                        name: getGoogleMapsLocationName(result, searchTerm),
                        fullName: result.formatted_address,
                        shortAddress: getGoogleMapsShortAddress(result.formatted_address),
                        type: getGoogleMapsPlaceType(result.types),
                        coords: [result.geometry.location.lat, result.geometry.location.lng],
                        source: 'google_maps',
                        relevance: calculateGoogleMapsRelevance(result, searchTerm)
                    }));

                    allResults = allResults.concat(mappedResults);
                }
            }

            // If we found good results in the first search, don't need to continue
            if (allResults.length >= 5) break;
        }

        // Remove duplicates and sort by relevance
        const uniqueResults = deduplicateByCoords(allResults);
        uniqueResults.sort((a, b) => b.relevance - a.relevance);

        return uniqueResults.slice(0, 5);

    } catch (error) {
        console.error('Google Maps geocoding error:', error);
        // Fallback to OpenStreetMap
        return await getOpenStreetMapGeocodingSuggestions(searchTerm);
    }
}

async function getOpenStreetMapGeocodingSuggestions(searchTerm) {
    try {
        // Try multiple search strategies for better precision
        const searches = [
            // Exact search with Marilao/Bulacan context
            `${searchTerm}, Marilao, Bulacan, Philippines`,
            `${searchTerm}, Bulacan, Philippines`,
            `${searchTerm}, Central Luzon, Philippines`,
            searchTerm
        ];

        let allResults = [];

        for (const query of searches) {
            const encodedQuery = encodeURIComponent(query);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=ph&limit=8&addressdetails=1&bounded=1&viewbox=${MARILAO_SEARCH_BOUNDS.west},${MARILAO_SEARCH_BOUNDS.north},${MARILAO_SEARCH_BOUNDS.east},${MARILAO_SEARCH_BOUNDS.south}&extratags=1&exclude_place_ids=&layer=address,poi,railway,natural,manmade`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Marilao Bulacan Community Relief Map'
                }
            });

            if (response.ok) {
                const results = await response.json();

                // Filter results to prioritize Marilao/Bulacan area and exclude water/sea locations
                const filteredResults = results.filter(result => {
                    const displayName = result.display_name.toLowerCase();
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);

                    // Check if coordinates are within Marilao/Bulacan bounds
                    const withinBounds = lat >= MAP_LAND_BOUNDS.south - 0.1 &&
                        lat <= MAP_LAND_BOUNDS.north + 0.1 &&
                        lon >= MAP_LAND_BOUNDS.west - 0.1 &&
                        lon <= MAP_LAND_BOUNDS.east + 0.1;

                    // Exclude water/sea locations
                    const isWaterLocation = displayName.includes('sea') ||
                        displayName.includes('ocean') ||
                        displayName.includes('strait') ||
                        displayName.includes('channel') ||
                        displayName.includes('bay') ||
                        displayName.includes('reef') ||
                        displayName.includes('island') && !displayName.includes('cebu') ||
                        result.class === 'natural' && (result.type === 'water' || result.type === 'coastline');

                    // Check if it's a valid land location
                    const isValidLandLocation = isLocationOnLand([lat, lon]);

                    // Must be within bounds, not water, on land, and in Bulacan area
                    return withinBounds && !isWaterLocation && isValidLandLocation && (
                        displayName.includes('marilao') ||
                        displayName.includes('bulacan') ||
                        displayName.includes('meycauayan') ||
                        displayName.includes('bocaue') ||
                        displayName.includes('sta. maria') ||
                        displayName.includes('santa maria') ||
                        displayName.includes('balagtas') ||
                        displayName.includes('guiguinto') ||
                        displayName.includes('obando')
                    );
                });

                const mappedResults = filteredResults.map(result => ({
                    name: getLocationName(result.display_name, searchTerm),
                    fullName: result.display_name,
                    shortAddress: getShortAddress(result.display_name),
                    type: getPlaceType(result.type, result.class),
                    coords: [parseFloat(result.lat), parseFloat(result.lon)],
                    source: 'geocoding',
                    relevance: calculateRelevance(result.display_name, searchTerm)
                }));

                allResults = allResults.concat(mappedResults);
            }

            // If we found good results in the first search, don't need to continue
            if (allResults.length >= 5) break;
        }

        // Remove duplicates and sort by relevance
        const uniqueResults = deduplicateByCoords(allResults);
        uniqueResults.sort((a, b) => b.relevance - a.relevance);

        return uniqueResults.slice(0, 5);

    } catch (error) {
        console.error('Geocoding error:', error);
        return [];
    }
}

function getLocationName(displayName, searchTerm) {
    // Try to extract the most relevant part of the name
    const parts = displayName.split(',');
    const searchLower = searchTerm.toLowerCase();

    // Find the part that best matches the search term
    for (const part of parts) {
        const partTrimmed = part.trim();
        if (partTrimmed.toLowerCase().includes(searchLower)) {
            return partTrimmed;
        }
    }

    // Fallback to first part
    return parts[0].trim();
}

function calculateRelevance(displayName, searchTerm) {
    const nameLower = displayName.toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    let score = 0;

    // Exact match gets highest score
    if (nameLower.includes(searchLower)) score += 10;

    // Bulacan locations get bonus points
    if (nameLower.includes('marilao')) score += 6;
    if (nameLower.includes('bulacan')) score += 4;
    if (nameLower.includes('meycauayan')) score += 4;
    if (nameLower.includes('bocaue')) score += 4;
    if (nameLower.includes('santa maria') || nameLower.includes('sta. maria')) score += 4;
    if (nameLower.includes('balagtas')) score += 3;
    if (nameLower.includes('guiguinto')) score += 3;
    if (nameLower.includes('obando')) score += 3;

    // Specific area types get bonus
    if (nameLower.includes('barangay')) score += 2;
    if (nameLower.includes('purok')) score += 2;
    if (nameLower.includes('sitio')) score += 2;

    return score;
}

function deduplicateByCoords(results) {
    const seen = new Map();
    return results.filter(result => {
        const key = `${result.coords[0].toFixed(4)},${result.coords[1].toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
}

function getPlaceType(type, placeClass) {
    if (type === 'city' || type === 'town') return 'City/Town';
    if (type === 'village' || type === 'hamlet') return 'Barangay';
    if (placeClass === 'place') return 'Place';
    if (placeClass === 'highway') return 'Road';
    return 'Location';
}

// Google Maps helper functions
function getGoogleMapsLocationName(result, searchTerm) {
    // Try to extract the most relevant part of the name from Google Maps result
    const addressComponents = result.address_components;
    const searchLower = searchTerm.toLowerCase();

    // Look for the component that best matches the search term
    for (const component of addressComponents) {
        const longName = component.long_name.toLowerCase();
        const shortName = component.short_name.toLowerCase();

        if (longName.includes(searchLower) || shortName.includes(searchLower)) {
            return component.long_name;
        }
    }

    // Fallback to the first address component (usually the most specific)
    if (addressComponents.length > 0) {
        return addressComponents[0].long_name;
    }

    // Final fallback to formatted address first part
    return result.formatted_address.split(',')[0].trim();
}

function getGoogleMapsShortAddress(formattedAddress) {
    // Extract meaningful address parts for Marilao/Bulacan from Google Maps
    const parts = formattedAddress.split(',').map(part => part.trim());

    // Remove "Philippines" if present
    const filtered = parts.filter(part =>
        !part.toLowerCase().includes('philippines') &&
        part.length > 0
    );

    // Take first 3 meaningful parts
    if (filtered.length <= 3) {
        return filtered.join(', ');
    } else {
        // For longer addresses, prioritize: Place, Municipality, Province
        return filtered.slice(0, 3).join(', ');
    }
}

function getGoogleMapsPlaceType(types) {
    // Map Google Maps place types to our categories
    if (types.includes('locality') || types.includes('administrative_area_level_2')) return 'City/Municipality';
    if (types.includes('sublocality') || types.includes('administrative_area_level_3')) return 'Barangay';
    if (types.includes('neighborhood') || types.includes('sublocality_level_1')) return 'Area';
    if (types.includes('establishment') || types.includes('point_of_interest')) return 'Landmark';
    if (types.includes('route')) return 'Road';
    if (types.includes('premise') || types.includes('street_address')) return 'Address';
    return 'Location';
}

function calculateGoogleMapsRelevance(result, searchTerm) {
    const formattedAddress = result.formatted_address.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const types = result.types;

    let score = 0;

    // Exact match gets highest score
    if (formattedAddress.includes(searchLower)) score += 10;

    // Bulacan locations get bonus points
    if (formattedAddress.includes('marilao')) score += 6;
    if (formattedAddress.includes('bulacan')) score += 4;
    if (formattedAddress.includes('meycauayan')) score += 4;
    if (formattedAddress.includes('bocaue')) score += 4;
    if (formattedAddress.includes('santa maria') || formattedAddress.includes('sta. maria')) score += 4;
    if (formattedAddress.includes('balagtas')) score += 3;
    if (formattedAddress.includes('guiguinto')) score += 3;
    if (formattedAddress.includes('obando')) score += 3;

    // Place type bonuses
    if (types.includes('locality')) score += 4;
    if (types.includes('sublocality')) score += 3;
    if (types.includes('establishment')) score += 2;

    // Specific area types get bonus
    if (formattedAddress.includes('barangay')) score += 2;
    if (formattedAddress.includes('purok')) score += 2;
    if (formattedAddress.includes('sitio')) score += 2;

    return score;
}

function getShortAddress(fullAddress) {
    // Extract meaningful address parts for Marilao/Bulacan
    const parts = fullAddress.split(',').map(part => part.trim());

    // Remove "Philippines" and "Central Visayas" if present
    const filtered = parts.filter(part =>
        !part.toLowerCase().includes('philippines') &&
        !part.toLowerCase().includes('central visayas') &&
        !part.toLowerCase().includes('region vii') &&
        part.length > 0
    );

    // Take first 3-4 meaningful parts
    if (filtered.length <= 3) {
        return filtered.join(', ');
    } else {
        // For longer addresses, prioritize: Place, Municipality, Province
        return filtered.slice(0, 3).join(', ');
    }
}

function deduplicateSuggestions(suggestions) {
    const seen = new Set();
    return suggestions.filter(suggestion => {
        const key = suggestion.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function displaySuggestions(suggestionList, searchTerm) {
    suggestions = suggestionList;
    currentSuggestionIndex = -1;

    const suggestionsDiv = document.getElementById('searchSuggestions');

    if (suggestions.length === 0) {
        suggestionsDiv.innerHTML = '<div class="no-suggestions">No locations found</div>';
        suggestionsDiv.style.display = 'block';
        return;
    }

    const html = suggestions.map((suggestion, index) => {
        const urgencyColor = suggestion.urgency ? getUrgencyColor(suggestion.urgency) : '';
        const urgencyIndicator = suggestion.urgency ?
            `<span class="suggestion-distance" style="color: ${urgencyColor}">⚠️ ${suggestion.urgency}</span>` : '';

        // Show complete address to distinguish between similar names
        const addressDisplay = suggestion.shortAddress || suggestion.fullName || suggestion.name;
        const isUserReported = suggestion.source === 'user_reported' || suggestion.source === 'user_reported_exact';
        const isLocalExact = suggestion.source === 'local_exact';

        // Add accuracy indicator
        let accuracyIndicator = '';
        if (isLocalExact) {
            accuracyIndicator = '<span class="suggestion-distance" style="color: #28a745;">📍 Precise Location</span>';
        } else if (suggestion.source === 'local' || suggestion.source === 'local_partial') {
            accuracyIndicator = '<span class="suggestion-distance" style="color: #17a2b8;">📍 Local Database</span>';
        } else if (isUserReported) {
            accuracyIndicator = '<span class="suggestion-distance" style="color: #dc3545;">📍 Relief Location</span>';
        }

        return `
            <div class="suggestion-item" onclick="selectSuggestion(suggestions[${index}])">
                <div class="suggestion-main">${highlightMatch(suggestion.name, searchTerm)}</div>
                <div class="suggestion-address">${addressDisplay}</div>
                <div class="suggestion-details">
                    <span class="suggestion-type">${suggestion.type}</span>
                    ${urgencyIndicator}
                    ${accuracyIndicator}
                </div>
            </div>
        `;
    }).join('');

    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';
}

function highlightMatch(text, searchTerm) {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

function selectSuggestion(suggestion) {
    document.getElementById('searchLocation').value = suggestion.name;
    hideSuggestions();

    if (suggestion.coords) {
        // Use existing coordinates
        showSearchResult(suggestion.coords, suggestion.fullName || suggestion.name, suggestion.type);
    } else {
        // Need to geocode - use the full address for better results
        const searchTerm = suggestion.shortAddress || suggestion.name;
        performGeocodingSearch(searchTerm, suggestion.name);
    }
}

async function performGeocodingSearch(searchTerm, originalName) {
    // Show loading state
    const searchBtn = document.getElementById('searchBtn');
    const originalHTML = searchBtn.innerHTML;
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    searchBtn.disabled = true;

    try {
        let bestResult = null;

        // Use Google Maps if available, otherwise fallback to OpenStreetMap
        if (GOOGLE_MAPS_ENABLED) {
            bestResult = await performGoogleMapsGeocodingSearch(searchTerm, originalName);
        } else {
            bestResult = await performOpenStreetMapGeocodingSearch(searchTerm, originalName);
        }

        resetSearchButton(searchBtn, originalHTML);

        if (bestResult) {
            // Handle both Google Maps and OpenStreetMap coordinate formats
            const coords = bestResult.geometry ?
                [bestResult.geometry.location.lat, bestResult.geometry.location.lng] :
                [parseFloat(bestResult.lat), parseFloat(bestResult.lon)];
            const displayName = bestResult.formatted_address || bestResult.display_name;
            showSearchResult(coords, displayName, 'Found Location');
        } else {
            // If no results found, show a more helpful message
            alert(`Location "${originalName}" not found in mapping data. This might be a very specific area not yet mapped. Try searching for the nearest barangay or municipality instead.`);
        }

    } catch (error) {
        resetSearchButton(searchBtn, originalHTML);
        console.error('❌ Geocoding error:', error);
        alert('Search failed. Please check your internet connection and try again.');
    }
}

async function performGoogleMapsGeocodingSearch(searchTerm, originalName) {
    try {
        // Try multiple search variations for better accuracy
        const searchVariations = [
            `${originalName}, Marilao, Bulacan, Philippines`,
            `${originalName}, Bulacan, Philippines`,
            `${searchTerm}, Meycauayan, Bulacan, Philippines`,
            `${searchTerm}, Bocaue, Bulacan, Philippines`,
            searchTerm
        ];

        for (const query of searchVariations) {
            const encodedQuery = encodeURIComponent(query);
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&bounds=${MARILAO_SEARCH_BOUNDS.south},${MARILAO_SEARCH_BOUNDS.west}|${MARILAO_SEARCH_BOUNDS.north},${MARILAO_SEARCH_BOUNDS.east}&region=ph&key=${GOOGLE_MAPS_API_KEY}`;

            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();

                if (data.status === 'OK' && data.results && data.results.length > 0) {
                    // Filter results to Marilao/Bulacan area and exclude water locations
                    const filteredResults = data.results.filter(result => {
                        const location = result.geometry.location;
                        const lat = location.lat;
                        const lng = location.lng;
                        const formattedAddress = result.formatted_address.toLowerCase();

                        // Check bounds and land validation
                        const withinBounds = lat >= MARILAO_SEARCH_BOUNDS.south &&
                            lat <= MARILAO_SEARCH_BOUNDS.north &&
                            lng >= MARILAO_SEARCH_BOUNDS.west &&
                            lng <= MARILAO_SEARCH_BOUNDS.east;

                        const isWaterLocation = formattedAddress.includes('sea') ||
                            formattedAddress.includes('ocean') ||
                            formattedAddress.includes('strait') ||
                            formattedAddress.includes('channel') ||
                            formattedAddress.includes('bay') ||
                            formattedAddress.includes('reef') ||
                            result.types.includes('natural_feature');

                        const isValidLandLocation = isLocationOnLand([lat, lng]);

                        return withinBounds && !isWaterLocation && isValidLandLocation && (
                            formattedAddress.includes('marilao') ||
                            formattedAddress.includes('bulacan') ||
                            formattedAddress.includes('meycauayan') ||
                            formattedAddress.includes('bocaue') ||
                            formattedAddress.includes('sta. maria') ||
                            formattedAddress.includes('santa maria') ||
                            formattedAddress.includes('balagtas') ||
                            formattedAddress.includes('guiguinto')
                        );
                    });

                    if (filteredResults.length > 0) {
                        return filteredResults[0];
                    }
                }
            }
        }

        return null;
    } catch (error) {
        console.error('Google Maps geocoding error:', error);
        // Fallback to OpenStreetMap
        return await performOpenStreetMapGeocodingSearch(searchTerm, originalName);
    }
}

async function performOpenStreetMapGeocodingSearch(searchTerm, originalName) {
    try {
        // Try multiple search variations for better accuracy
        const searchVariations = [
            searchTerm,
            `${searchTerm}, Philippines`,
            `${originalName}, Bulacan, Philippines`,
            `${originalName}, Marilao, Bulacan, Philippines`
        ];

        for (const query of searchVariations) {
            const encodedQuery = encodeURIComponent(query);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=ph&limit=3&addressdetails=1&bounded=1&viewbox=${MARILAO_SEARCH_BOUNDS.west},${MARILAO_SEARCH_BOUNDS.north},${MARILAO_SEARCH_BOUNDS.east},${MARILAO_SEARCH_BOUNDS.south}&layer=address,poi,railway,natural,manmade`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Marilao Bulacan Community Relief Map'
                }
            });

            if (response.ok) {
                const results = await response.json();

                if (results && results.length > 0) {
                    // Filter results to prioritize Marilao/Bulacan locations and exclude water areas
                    const filteredResults = results.filter(result => {
                        const displayName = result.display_name.toLowerCase();
                        const lat = parseFloat(result.lat);
                        const lon = parseFloat(result.lon);

                        // Check bounds and land validation
                        const withinBounds = lat >= MARILAO_SEARCH_BOUNDS.south &&
                            lat <= MARILAO_SEARCH_BOUNDS.north &&
                            lon >= MARILAO_SEARCH_BOUNDS.west &&
                            lon <= MARILAO_SEARCH_BOUNDS.east;

                        const isWaterLocation = displayName.includes('sea') ||
                            displayName.includes('ocean') ||
                            displayName.includes('strait') ||
                            displayName.includes('channel') ||
                            displayName.includes('bay') ||
                            displayName.includes('reef') ||
                            result.class === 'natural' && result.type === 'water';

                        const isValidLandLocation = isLocationOnLand([lat, lon]);

                        return withinBounds && !isWaterLocation && isValidLandLocation && (
                            displayName.includes('marilao') ||
                            displayName.includes('bulacan') ||
                            displayName.includes('meycauayan') ||
                            displayName.includes('bocaue') ||
                            displayName.includes('sta. maria') ||
                            displayName.includes('santa maria') ||
                            displayName.includes('balagtas') ||
                            displayName.includes('guiguinto') ||
                            displayName.includes('obando') ||
                            displayName.includes('prenza') ||
                            displayName.includes('loma de gato') ||
                            displayName.includes('tabing ilog') ||
                            displayName.includes('abangan')
                        );
                    });

                    if (filteredResults.length > 0) {
                        return filteredResults[0];
                    } else if (results.length > 0) {
                        return results[0];
                    }
                }
            }
        }

        return null;
    } catch (error) {
        console.error('OpenStreetMap geocoding error:', error);
        return null;
    }
}

function hideSuggestions() {
    document.getElementById('searchSuggestions').style.display = 'none';
    currentSuggestionIndex = -1;
}

function searchLocation() {
    // Prevent multiple simultaneous searches
    if (isSearching) {
        return;
    }

    const searchTerm = document.getElementById('searchLocation').value.trim();

    if (!searchTerm) {
        alert('Please enter a location to search for.');
        return;
    }

    // Set search state
    isSearching = true;
    hideSuggestions();

    // Show loading state
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchLocation');
    const originalHTML = searchBtn.innerHTML;

    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    searchBtn.disabled = true;
    searchInput.disabled = true;

    // First, search in local common locations (highest priority)
    const localResults = searchCommonLocations(searchTerm);
    if (localResults && localResults.length > 0) {
        const bestResult = localResults[0]; // Use first (best) result
        showSearchResult([bestResult.lat, bestResult.lon], bestResult.display_name, bestResult.name);
        resetSearchButton(searchBtn, originalHTML);
        return;
    }

    // Second, search in user reported locations
    const userReported = userReportedLocations.find(location =>
        location.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (userReported) {
        showSearchResult(userReported.coords, userReported.name, 'User Reported Location');
        resetSearchButton(searchBtn, originalHTML);
        return;
    }

    // Last resort: use geocoding API
    geocodeLocation(searchTerm)
        .then(results => {
            resetSearchButton(searchBtn, originalHTML);

            if (results && results.length > 0) {
                // Filter results to prioritize Marilao/Bulacan locations and exclude water areas
                const validResults = results.filter(result => {
                    const displayName = result.display_name.toLowerCase();
                    const lat = parseFloat(result.lat);
                    const lon = parseFloat(result.lon);

                    // Check if it's in Marilao/Bulacan area
                    const isWithinBulacan = displayName.includes('marilao') ||
                        displayName.includes('bulacan') ||
                        displayName.includes('meycauayan') ||
                        displayName.includes('bocaue') ||
                        displayName.includes('santa maria') ||
                        displayName.includes('sta. maria') ||
                        displayName.includes('balagtas') ||
                        displayName.includes('guiguinto') ||
                        displayName.includes('obando');

                    // Check if it's not a water location
                    const isWaterLocation = displayName.includes('sea') ||
                        displayName.includes('ocean') ||
                        displayName.includes('strait') ||
                        displayName.includes('channel') ||
                        displayName.includes('bay') ||
                        displayName.includes('reef') ||
                        result.class === 'natural' && result.type === 'water';

                    // Check if it's on land
                    const isValidLandLocation = isLocationOnLand([lat, lon]);

                    return isWithinBulacan && !isWaterLocation && isValidLandLocation;
                });

                // Use filtered results if available, otherwise fall back to original results
                const bestResult = validResults.length > 0 ? validResults[0] :
                    (results.filter(r => r.display_name.toLowerCase().includes('philippines'))[0] || results[0]);
                const coords = [parseFloat(bestResult.lat), parseFloat(bestResult.lon)];

                // Final validation before showing result
                if (isLocationOnLand(coords)) {
                    showSearchResult(coords, bestResult.display_name, 'Found Location');
                } else {
                    systemAlert(`Location "${searchTerm}" appears to be outside the supported Marilao/Bulacan coverage area. Please try searching for a nearby barangay or municipality within Bulacan instead.`);
                }
            } else {
                systemAlert('Location not found. Please try a different search term or check the spelling.');
            }
        })
        .catch(error => {
            resetSearchButton(searchBtn, originalHTML);
            console.error('Geocoding error:', error);
            systemAlert('Search failed. Please check your internet connection and try again.');
        });
}

async function geocodeLocation(query) {
    // Use Google Maps if available, otherwise fallback to OpenStreetMap
    if (GOOGLE_MAPS_ENABLED) {
        return await geocodeLocationWithGoogleMaps(query);
    } else {
        return await geocodeLocationWithOpenStreetMap(query);
    }
}

async function geocodeLocationWithGoogleMaps(query) {
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&bounds=${MARILAO_SEARCH_BOUNDS.south},${MARILAO_SEARCH_BOUNDS.west}|${MARILAO_SEARCH_BOUNDS.north},${MARILAO_SEARCH_BOUNDS.east}&region=ph&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        if (data.status === 'OK' && data.results) {
            // Convert Google Maps format to match OpenStreetMap format for compatibility
            return data.results.map(result => ({
                lat: result.geometry.location.lat.toString(),
                lon: result.geometry.location.lng.toString(),
                display_name: result.formatted_address,
                type: result.types[0] || 'location',
                class: result.types.includes('establishment') ? 'amenity' : 'place'
            }));
        } else {
            // Fallback to OpenStreetMap if Google Maps fails
            return await geocodeLocationWithOpenStreetMap(query);
        }
    } catch (error) {
        console.error('Google Maps geocoding error:', error);
        // Fallback to OpenStreetMap
        return await geocodeLocationWithOpenStreetMap(query);
    }
}

async function geocodeLocationWithOpenStreetMap(query) {
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=ph&limit=5&addressdetails=1&bounded=1&viewbox=${MARILAO_SEARCH_BOUNDS.west},${MARILAO_SEARCH_BOUNDS.north},${MARILAO_SEARCH_BOUNDS.east},${MARILAO_SEARCH_BOUNDS.south}&layer=address,poi,railway,natural,manmade`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Marilao Bulacan Community Relief Map'
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return await response.json();
    } catch (error) {
        console.error('OpenStreetMap geocoding error:', error);
        throw error;
    }
}

function showSearchResult(coords, displayName, resultType) {
    // Remove previous search marker if exists
    if (currentSearchMarker) {
        map.removeLayer(currentSearchMarker);
        currentSearchMarker = null;
    }

    // Center map on the location
    map.setView(coords, 14);

    // Add search result marker
    currentSearchMarker = L.marker(coords, {
        icon: L.divIcon({
            className: 'search-result-marker',
            html: '<i class="fas fa-search" style="color: #007bff; font-size: 20px; background: white; padding: 5px; border-radius: 50%; border: 2px solid #007bff;"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(map);

    // Store search data for potential help reporting
    window.currentSearchResult = {
        coords: coords,
        displayName: displayName,
        resultType: resultType
    };

    // Filter map pins to show only those near the searched location
    filterPinsBySearchLocation(coords, displayName);

    // Create compact popup content
    const popupContent = `
        <div class="popup-content compact-popup">
            <!-- Header with navigation in one line -->
            <div class="popup-header">
                <h4><i class="fas fa-map-marker-alt"></i> Search Result</h4>
                <div class="nav-buttons-inline">
                    <button onclick="openWazeNavigation(${coords[0]}, ${coords[1]}, '${displayName.replace(/'/g, "\\'")}');" 
                            class="nav-circle-btn-small waze-circle" title="Waze">
                        <i class="fas fa-route"></i>
                    </button>
                    <button onclick="openGoogleMapsNavigation(${coords[0]}, ${coords[1]}, '${displayName.replace(/'/g, "\\'")}');" 
                            class="nav-circle-btn-small gmaps-circle" title="Maps">
                        <i class="fas fa-map-marked-alt"></i>
                    </button>
                </div>
            </div>
            
            <div class="popup-body">
                <p><strong>${displayName}</strong></p>
                <p class="popup-meta">${resultType} • ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}</p>
                <div class="popup-actions">
                    <button onclick="pinHelpFromSearch()" class="btn-compact btn-success">
                        <i class="fas fa-plus-circle"></i> Pin Help
                    </button>
                    <button onclick="clearSearchResult()" class="btn-compact btn-secondary">
                        <i class="fas fa-times"></i> Clear
                    </button>
                </div>
            </div>
        </div>
    `;

    currentSearchMarker.bindPopup(popupContent);

    // Add click event to center popup on screen
    currentSearchMarker.on('click', function (e) {
        const newLatLng = centerPopupOnScreen(e.latlng, {
            offsetMultiplier: 1.2
        });

        map.panTo(newLatLng, {
            animate: true,
            duration: 0.5,
            easeLinearity: 0.25
        });
    });

    currentSearchMarker.openPopup();

    // Auto-remove the marker after 30 seconds
    setTimeout(() => {
        if (currentSearchMarker) {
            map.removeLayer(currentSearchMarker);
            currentSearchMarker = null;
        }
    }, 30000);
}

function clearSearchResult() {
    if (currentSearchMarker) {
        map.removeLayer(currentSearchMarker);
        currentSearchMarker = null;
    }
    window.currentSearchResult = null;
    map.closePopup();

    // Restore all pins when clearing search
    restoreAllPins();
}

function pinHelpFromSearch() {
    if (!window.currentSearchResult) {
        alert('No search result available. Please search for a location first.');
        return;
    }

    const searchData = window.currentSearchResult;

    // Set pending coordinates from search result
    pendingReportCoords = {
        lat: searchData.coords[0],
        lng: searchData.coords[1]
    };

    // Clear the search marker since we're now reporting it
    clearSearchResult();

    // Add temporary marker at search location
    const tempMarker = L.marker(searchData.coords, {
        icon: L.divIcon({
            className: 'temp-report-marker',
            html: '<i class="fas fa-map-marker-alt" style="color: #28a745; font-size: 20px; animation: bounce 1s infinite;"></i>',
            iconSize: [25, 25],
            iconAnchor: [12, 25]
        })
    }).addTo(map);

    window.tempReportMarker = tempMarker;

    // Pre-populate the form with search data
    document.getElementById('locationName').value = extractLocationName(searchData.displayName);

    // Open report modal
    document.getElementById('reportModal').style.display = 'flex';
}

function extractLocationName(displayName) {
    // Extract a clean location name from the full display name
    // Example: "Bogo, Cebu, Central Visayas, Philippines" -> "Bogo, Cebu"
    const parts = displayName.split(',');

    if (parts.length >= 2) {
        // Take first two parts (usually city/barangay and province)
        return parts.slice(0, 2).map(part => part.trim()).join(', ');
    } else {
        // If only one part, return as is
        return parts[0].trim();
    }
}

function resetSearchButton(button, originalHTML) {
    button.innerHTML = originalHTML;
    button.disabled = false;

    // Re-enable search input and reset search state
    const searchInput = document.getElementById('searchLocation');
    if (searchInput) {
        searchInput.disabled = false;
    }
    isSearching = false;
}

// User reporting functions
function startReportingMode() {
    isReportingMode = true;

    // Add reporting mode class for enhanced cursor styling
    document.body.classList.add('reporting-mode');
    document.body.classList.add('pinning-focus');

    // Show instruction overlay with improved design
    const instruction = document.createElement('div');
    instruction.id = 'clickInstruction';
    instruction.className = 'click-to-mark-instruction';
    instruction.innerHTML = `
        <h4><i class="fas fa-map-marker-alt"></i> Pin Relief Location</h4>
        <p>Click anywhere on the map to mark a location that needs assistance. The pin will help relief teams identify areas requiring help.</p>
        <div class="instruction-actions">
            <button onclick="cancelReportingMode()" class="btn btn-secondary btn-sm">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>
        <div class="esc-hint">
            <i class="fas fa-keyboard"></i> Press ESC to cancel
        </div>
    `;
    document.body.appendChild(instruction);

    // Set up map click handler
    map.once('click', handleMapClickForReport);

    // Add ESC key listener for cancellation
    document.addEventListener('keydown', handleReportingModeKeydown);
}

function cancelReportingMode() {
    isReportingMode = false;

    // Remove reporting mode class and reset cursor
    document.body.classList.remove('reporting-mode');
    document.body.classList.remove('pinning-focus');
    document.body.style.cursor = 'default';

    // Remove instruction overlay
    const instruction = document.getElementById('clickInstruction');
    if (instruction) {
        instruction.remove();
    }

    // Clean up event listeners
    map.off('click', handleMapClickForReport);
    document.removeEventListener('keydown', handleReportingModeKeydown);
}

// Handle keyboard events during reporting mode
function handleReportingModeKeydown(e) {
    if (e.key === 'Escape' && isReportingMode) {
        e.preventDefault();
        cancelReportingMode();
    }
}

function startSupportMode() {
    if (isSupportModeActive) {
        return;
    }

    if (isReportingMode) {
        cancelReportingMode();
    }

    if (donationPinModeActive) {
        cancelDonationPinMode({ reopenModal: true });
    }

    isSupportModeActive = true;
    document.body.classList.add('support-mode');

    const existingInstruction = document.getElementById('supportModeInstruction');
    if (existingInstruction) {
        existingInstruction.remove();
    }

    const instruction = document.createElement('div');
    instruction.id = 'supportModeInstruction';
    instruction.className = 'click-to-mark-instruction';
    instruction.innerHTML = `
        <h4><i class="fas fa-hand-holding-heart"></i> Support a Location</h4>
        <p>Click a map pin to claim it and mark the response as on the way.</p>
        <div class="instruction-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="cancelSupportMode">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>
        <div class="esc-hint">
            <i class="fas fa-keyboard"></i> Press ESC to cancel
        </div>
    `;
    document.body.appendChild(instruction);

    const cancelButton = document.getElementById('cancelSupportMode');
    if (cancelButton) {
        cancelButton.addEventListener('click', cancelSupportMode);
    }

    document.addEventListener('keydown', handleSupportModeKeydown);
}

function cancelSupportMode() {
    if (!isSupportModeActive) {
        return;
    }

    isSupportModeActive = false;
    document.body.classList.remove('support-mode');

    const instruction = document.getElementById('supportModeInstruction');
    if (instruction) {
        instruction.remove();
    }

    document.removeEventListener('keydown', handleSupportModeKeydown);
}

function handleSupportModeKeydown(event) {
    if (event.key === 'Escape' && isSupportModeActive) {
        event.preventDefault();
        cancelSupportMode();
    }
}

function handleMapClickForReport(e) {
    pendingReportCoords = e.latlng;
    cancelReportingMode();

    // Keep map UI hidden while confirming pin
    document.body.classList.add('pinning-focus');

    // Add temporary marker
    const tempMarker = L.marker([e.latlng.lat, e.latlng.lng], {
        icon: L.divIcon({
            className: 'temp-report-marker',
            html: '<i class="fas fa-map-marker-alt" style="color: #28a745; font-size: 20px; animation: bounce 1s infinite;"></i>',
            iconSize: [25, 25],
            iconAnchor: [12, 25]
        })
    }).addTo(map);

    window.tempReportMarker = tempMarker;

    // Zoom into the clicked location
    const targetZoom = Math.max(map.getZoom(), 17);
    map.flyTo([e.latlng.lat, e.latlng.lng], targetZoom, { duration: 0.6 });

    // Show confirmation modal
    openConfirmLocationModal(e.latlng);
}

function openConfirmLocationModal(coords, options = {}) {
    const {
        context = 'report',
        onConfirm = null,
        onCancel = null,
        label = ''
    } = options;
    confirmLocationContext = {
        type: context,
        onConfirm,
        onCancel
    };
    const details = document.getElementById('confirmLocationDetails');
    if (details && coords) {
        const formatted = `Lat: ${coords.lat.toFixed(6)}, Lng: ${coords.lng.toFixed(6)}`;
        const textEl = details.querySelector('.confirm-location-text');

        if (textEl) {
            textEl.textContent = formatted;
        }

        details.dataset.coords = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }
    const modal = document.getElementById('confirmLocationModal');
    if (modal) {
        modal.style.display = 'flex';
    }
    updateConfirmPanelLayout(true);
    updateConfirmLocationName(coords, label);
    updateConfirmLocationPreview(coords);
}

function updateConfirmPanelLayout(isOpen) {
    const isDesktop = window.matchMedia('(min-width: 769px)').matches;

    if (!isDesktop) {
        document.body.classList.remove('confirm-side-panel-open');
        return;
    }

    document.body.classList.toggle('confirm-side-panel-open', isOpen);

    if (typeof map !== 'undefined' && map) {
        setTimeout(() => map.invalidateSize(), 150);
    }

    if (confirmMiniMap) {
        setTimeout(() => confirmMiniMap.invalidateSize(), 200);
    }
}

function updateConfirmLocationName(coords, label = '') {
    const nameEl = document.getElementById('confirmLocationName');
    const textEl = nameEl ? nameEl.querySelector('.confirm-location-name-text') : null;

    if (!textEl) {
        return;
    }

    if (label) {
        textEl.textContent = `Location: ${label}`;
        confirmedLocationName = label;
        return;
    }

    textEl.textContent = 'Location: Looking up...';

    fetchConfirmLocationName(coords)
        .then((name) => {
            const displayName = name || 'Unnamed location';
            textEl.textContent = `Location: ${displayName}`;
            confirmedLocationName = displayName;
        })
        .catch((error) => {
            console.warn('Failed to resolve location name:', error);
            textEl.textContent = 'Location: Unable to resolve';
            confirmedLocationName = 'Unable to resolve';
        });
}

function updateConfirmLocationPreview(coords) {
    const previewContainer = document.getElementById('confirmLocationMiniMap');
    const previewWrapper = document.getElementById('confirmLocationPreviewWrapper');
    if (!previewContainer || !coords) {
        return;
    }

    if (previewWrapper) {
        previewWrapper.style.backgroundImage = `url('${getConfirmPreviewUrl(coords)}')`;
    }

    if (!confirmMiniMap) {
        setTimeout(() => {
            if (confirmMiniMap) {
                return;
            }

            confirmMiniMap = L.map('confirmLocationMiniMap', {
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                tap: false,
                touchZoom: false
            }).setView([coords.lat, coords.lng], 17);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
                minZoom: 11
            }).addTo(confirmMiniMap);

            confirmMiniMapMarker = L.marker([coords.lat, coords.lng], {
                interactive: false
            }).addTo(confirmMiniMap);

            confirmMiniMap.invalidateSize();
        }, 120);
        return;
    } else {
        confirmMiniMap.setView([coords.lat, coords.lng], 17);
    }

    if (!confirmMiniMapMarker) {
        confirmMiniMapMarker = L.marker([coords.lat, coords.lng], {
            interactive: false
        }).addTo(confirmMiniMap);
    } else {
        confirmMiniMapMarker.setLatLng([coords.lat, coords.lng]);
    }

    setTimeout(() => {
        if (confirmMiniMap) {
            confirmMiniMap.invalidateSize();
        }
    }, 200);
}

function getConfirmPreviewUrl(coords) {
    const lat = coords.lat.toFixed(6);
    const lng = coords.lng.toFixed(6);
    const zoom = 17;
    const size = '640x420';

    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=mapnik`;
}

function getConfirmCoords() {
    if (pendingReportCoords) {
        return pendingReportCoords;
    }

    const details = document.getElementById('confirmLocationDetails');
    if (!details || !details.dataset.coords) {
        return null;
    }

    const [latString, lngString] = details.dataset.coords.split(',').map(value => value.trim());
    const lat = parseFloat(latString);
    const lng = parseFloat(lngString);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
    }

    return { lat, lng };
}

function openConfirmLocationInWaze() {
    const coords = getConfirmCoords();
    if (!coords) {
        systemAlert('Coordinates are not available yet. Please click a location on the map first.');
        return;
    }

    openWazeNavigation(coords.lat, coords.lng, 'Pinned location');
}

function openConfirmLocationInGoogleMaps() {
    const coords = getConfirmCoords();
    if (!coords) {
        systemAlert('Coordinates are not available yet. Please click a location on the map first.');
        return;
    }

    openGoogleMapsNavigation(coords.lat, coords.lng, 'Pinned location');
}

async function fetchConfirmLocationName(coords) {
    if (!coords) {
        return '';
    }

    if (GOOGLE_MAPS_ENABLED) {
        return await reverseGeocodeWithGoogleMaps(coords);
    }

    return await reverseGeocodeWithOpenStreetMap(coords);
}

async function reverseGeocodeWithGoogleMaps(coords) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    if (data.status !== 'OK' || !data.results || !data.results.length) {
        return '';
    }

    return extractLocationName(data.results[0].formatted_address || '');
}

async function reverseGeocodeWithOpenStreetMap(coords) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Marilao Bulacan Community Relief Map'
        }
    });

    if (!response.ok) {
        throw new Error('Reverse geocoding failed');
    }

    const data = await response.json();
    return extractLocationName(data.display_name || '');
}

function copyConfirmLocationCoords() {
    const details = document.getElementById('confirmLocationDetails');
    if (!details || !details.dataset.coords) {
        systemAlert('Coordinates are not available yet. Please click a location on the map first.');
        return;
    }

    const coords = details.dataset.coords;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(coords)
            .then(() => systemAlert('Coordinates copied to clipboard.'))
            .catch(() => systemAlert('Unable to copy coordinates. Please try again.'));
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = coords;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        const copied = document.execCommand('copy');
        systemAlert(copied ? 'Coordinates copied to clipboard.' : 'Unable to copy coordinates.');
    } catch (error) {
        console.error('Copy failed:', error);
        systemAlert('Unable to copy coordinates. Please try again.');
    } finally {
        document.body.removeChild(textarea);
    }
}

function closeConfirmLocationModal() {
    const modal = document.getElementById('confirmLocationModal');
    if (modal) modal.style.display = 'none';
    updateConfirmPanelLayout(false);
}

function confirmLocationAndOpenReport() {
    const context = confirmLocationContext;
    confirmLocationContext = null;
    closeConfirmLocationModal();
    document.body.classList.remove('pinning-focus');
    if (context && context.type === 'donation') {
        if (typeof context.onConfirm === 'function') {
            context.onConfirm();
        }
        return;
    }

    // Show and populate the chosen location display
    const chosenLocationDisplay = document.getElementById('chosenLocationDisplay');
    const chosenLocationName = document.getElementById('chosenLocationName');
    if (chosenLocationDisplay && chosenLocationName && confirmedLocationName) {
        chosenLocationDisplay.style.display = 'block';
        chosenLocationName.textContent = confirmedLocationName;
    }

    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
        reportModal.style.display = 'flex';
    }
}

function chooseDifferentLocation() {
    const context = confirmLocationContext;
    confirmLocationContext = null;
    closeConfirmLocationModal();

    if (context && context.type === 'donation') {
        document.body.classList.remove('pinning-focus');
        if (typeof context.onCancel === 'function') {
            context.onCancel();
        }
        return;
    }

    if (window.tempReportMarker) {
        map.removeLayer(window.tempReportMarker);
        window.tempReportMarker = null;
    }

    pendingReportCoords = null;
    startReportingMode();
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    const form = document.getElementById('reportForm');

    if (modal) {
        modal.style.display = 'none';
    }

    if (form) {
        form.reset();

        // Re-enable submit button if it was disabled
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Submit Report';
        }

        // Clear uploaded images
        clearUploadedImages();
    }

    // Hide the chosen location display
    const chosenLocationDisplay = document.getElementById('chosenLocationDisplay');
    if (chosenLocationDisplay) {
        chosenLocationDisplay.style.display = 'none';
    }

    // Remove temporary marker
    if (window.tempReportMarker) {
        map.removeLayer(window.tempReportMarker);
        window.tempReportMarker = null;
    }

    // Clear search result data
    window.currentSearchResult = null;

    pendingReportCoords = null;
    confirmedLocationName = '';
}

function updateDonationDonorFields() {
    const isOrganization = document.getElementById('donorTypeOrganization')?.checked;
    const individualField = document.getElementById('donorIndividualField');
    const organizationField = document.getElementById('donorOrganizationField');
    const individualInput = document.getElementById('donorFullName');
    const organizationInput = document.getElementById('donorOrganizationName');

    if (isOrganization) {
        if (individualField) {
            individualField.hidden = true;
        }
        if (organizationField) {
            organizationField.hidden = false;
        }
        if (individualInput) {
            individualInput.disabled = true;
            individualInput.required = false;
        }
        if (organizationInput) {
            organizationInput.disabled = false;
            organizationInput.required = true;
        }
        return;
    }

    if (individualField) {
        individualField.hidden = false;
    }
    if (organizationField) {
        organizationField.hidden = true;
    }
    if (individualInput) {
        individualInput.disabled = false;
        individualInput.required = true;
    }
    if (organizationInput) {
        organizationInput.disabled = true;
        organizationInput.required = false;
    }
}

function updateDonationLocationModeFields(options = {}) {
    const { preserveSelection = false } = options;
    const selectedMode = document.querySelector('input[name="donationLocationMode"]:checked');
    const selectedValue = selectedMode ? selectedMode.value : '';
    const unreachedCard = document.getElementById('donationOptionUnreached');
    const pinCard = document.getElementById('donationOptionPin');
    const locationSelect = document.getElementById('donationLocationSelect');
    const pinButton = document.getElementById('donationPinLocationBtn');
    const hadSelectedLocation = Boolean(locationSelect && locationSelect.value);
    if (!selectedValue) {
        if (unreachedCard) {
            unreachedCard.hidden = true;
        }
        if (pinCard) {
            pinCard.hidden = true;
        }
        if (locationSelect) {
            locationSelect.disabled = true;
            locationSelect.required = false;
        }
        if (pinButton) {
            pinButton.disabled = true;
        }
        return;
    }

    const isUnreached = selectedValue === 'unreached';
    if (unreachedCard) {
        unreachedCard.hidden = !isUnreached;
    }
    if (pinCard) {
        pinCard.hidden = isUnreached;
    }
    if (locationSelect) {
        locationSelect.disabled = !isUnreached;
        locationSelect.required = isUnreached;
        if (!isUnreached) {
            locationSelect.value = '';
        }
    }
    if (pinButton) {
        pinButton.disabled = isUnreached;
    }
    if (isUnreached) {
        if (!preserveSelection) {
            clearDonationPinSelection();
        }
    } else if (hadSelectedLocation) {
        clearDonationPinSelection();
    } else if (!donationPinCoords) {
        const preview = document.getElementById('donationPinPreview');
        if (preview) {
            preview.innerHTML = '<span class="donation-pin-label">No pin selected yet.</span>';
        }
    }
}

function getDonationDonorType() {
    const selected = document.querySelector('input[name="donorType"]:checked');
    return selected ? selected.value : 'individual';
}

function getDonationDonorName() {
    const donorType = getDonationDonorType();
    const individualInput = document.getElementById('donorFullName');
    const organizationInput = document.getElementById('donorOrganizationName');

    if (donorType === 'organization') {
        return organizationInput ? organizationInput.value.trim() : '';
    }

    return individualInput ? individualInput.value.trim() : '';
}

function normalizeCashAmountValue(value) {
    if (!value) {
        return '';
    }

    const cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '');
    const decimalIndex = cleaned.indexOf('.');
    if (decimalIndex === -1) {
        return cleaned;
    }

    return `${cleaned.slice(0, decimalIndex + 1)}${cleaned
        .slice(decimalIndex + 1)
        .replace(/\./g, '')}`;
}

function formatCashAmountInput(value) {
    const cleaned = normalizeCashAmountValue(value);
    if (!cleaned) {
        return '';
    }

    const parts = cleaned.split('.');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1] ? parts[1].slice(0, 2) : '';
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (cleaned.includes('.')) {
        return `${formattedInteger}.${decimalPart}`;
    }

    return formattedInteger;
}

function formatCashAmountFinal(value) {
    const cleaned = normalizeCashAmountValue(value);
    const numericValue = parseFloat(cleaned);
    if (!Number.isFinite(numericValue)) {
        return cleaned ? formatCashAmountInput(cleaned) : '';
    }

    return numericValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function setupDonationCashAmountInput() {
    const cashInput = document.getElementById('donationCashAmount');
    if (!cashInput || cashInput.dataset.currencyBound === 'true') {
        return;
    }

    cashInput.dataset.currencyBound = 'true';

    cashInput.addEventListener('input', () => {
        const oldValue = cashInput.value;
        const formattedValue = formatCashAmountInput(oldValue);
        if (formattedValue === oldValue) {
            return;
        }

        const selectionStart = cashInput.selectionStart ?? oldValue.length;
        const lengthDelta = formattedValue.length - oldValue.length;
        cashInput.value = formattedValue;
        const newPosition = Math.max(selectionStart + lengthDelta, 0);
        cashInput.setSelectionRange(newPosition, newPosition);
    });

    cashInput.addEventListener('blur', () => {
        cashInput.value = formatCashAmountFinal(cashInput.value);
    });
}

function openDonationLogModal(options = {}) {
    const { preserveSelection = false } = options;
    const modal = document.getElementById('donationLogModal');
    if (modal) {
        modal.style.display = 'flex';
    }
    updateDonationDonorFields();
    refreshDonationLocationOptions();
    updateDonationLocationModeFields({ preserveSelection });
}

function closeDonationLogModal(options = {}) {
    const { preserveForm = false } = options;
    const modal = document.getElementById('donationLogModal');
    const form = document.getElementById('donationLogForm');

    if (modal) {
        modal.style.display = 'none';
    }

    if (form && !preserveForm) {
        form.reset();
        const donationItems = document.getElementById('donationItems');
        if (donationItems) {
            donationItems.innerHTML = '';
        }
    }

    if (!preserveForm) {
        clearDonationImages();
        clearDonationPinSelection();
    }
}

function openActivityLogModal() {
    const modal = document.getElementById('activityLogModal');
    if (modal) {
        modal.style.display = 'flex';
    }
    updateActivityLogDisplay();
}

function closeActivityLogModal() {
    const modal = document.getElementById('activityLogModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function formatActivityTimestamp(timestamp) {
    if (!timestamp) {
        return '';
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function buildActivityLogItem(activity) {
    if (!activity) {
        return '';
    }

    const activityType = activity.type || 'report';
    const typeConfig = {
        report: { label: 'Report Submitted', icon: 'fa-map-pin', accent: '#0f766e' },
        donation: { label: 'Donation Logged', icon: 'fa-hand-holding-heart', accent: '#15803d' },
        chat: { label: 'Relief Thread Message', icon: 'fa-comments', accent: '#2563eb' }
    };
    const config = typeConfig[activityType] || typeConfig.report;

    let title = '';
    let details = '';
    const pills = [];

    if (activityType === 'report') {
        title = escapeHtml(activity.locationName || 'Reported location');
        const urgency = activity.urgency ? escapeHtml(String(activity.urgency)) : '';
        const needs = Array.isArray(activity.reliefNeeds)
            ? activity.reliefNeeds.filter(Boolean).map(need => escapeHtml(String(need)))
            : [];
        if (urgency) {
            pills.push(urgency.toUpperCase());
        }
        if (needs.length) {
            details = `Needs: ${needs.join(', ')}`;
        }
    } else if (activityType === 'donation') {
        title = escapeHtml(activity.locationName || 'Donation drop-off');
        const donorName = escapeHtml(activity.donorName || 'Anonymous');
        details = `Donor: ${donorName}`;
        const itemCount = Number(activity.itemCount ?? activity.itemsCount);
        if (Number.isFinite(itemCount) && itemCount > 0) {
            pills.push(`${itemCount} item${itemCount !== 1 ? 's' : ''}`);
        }
        const cashAmount = Number(activity.cashAmount);
        if (Number.isFinite(cashAmount) && cashAmount > 0) {
            pills.push(`₱${cashAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }
    } else if (activityType === 'chat') {
        title = escapeHtml(activity.locationName || getLocationNameById(activity.locationId) || 'Relief thread');
        const message = typeof activity.message === 'string' ? activity.message : '';
        const safeMessage = escapeHtml(message);
        const snippet = safeMessage.length > 140 ? `${safeMessage.slice(0, 140)}…` : safeMessage;
        details = snippet ? `“${snippet}”` : 'Message sent.';
    }

    const detailsMarkup = details ? `<div class="activity-log-details">${details}</div>` : '';
    const pillsMarkup = pills.length
        ? `<div class="activity-log-meta">${pills.map(pill => `<span class="activity-log-pill">${pill}</span>`).join('')}</div>`
        : '';

    return `
        <div class="activity-log-item" style="--activity-accent: ${config.accent}">
            <div class="activity-log-header">
                <div class="activity-log-type">
                    <span class="activity-log-icon"><i class="fas ${config.icon}"></i></span>
                    <span>${config.label}</span>
                </div>
                <span class="activity-log-time">${formatActivityTimestamp(activity.timestamp)}</span>
            </div>
            <div class="activity-log-title">${title}</div>
            ${detailsMarkup}
            ${pillsMarkup}
        </div>
    `;
}

function updateActivityLogDisplay() {
    const guestId = getStoredGuestId();
    const activityLogGuest = document.getElementById('activityLogGuest');
    const activityLogCount = document.getElementById('activityLogCount');
    const activityLogList = document.getElementById('activityLogList');
    const activityLogEmpty = document.getElementById('activityLogEmpty');

    if (activityLogGuest) {
        activityLogGuest.textContent = guestId || '--';
    }

    if (!activityLogList) {
        return;
    }

    if (!guestId) {
        if (activityLogCount) {
            activityLogCount.textContent = '0';
        }
        activityLogList.innerHTML = '';
        if (activityLogEmpty) {
            activityLogEmpty.textContent = 'Start exploring as guest to log reports, donations, and relief thread messages.';
            activityLogEmpty.style.display = 'block';
        }
        return;
    }

    const activities = getGuestActivities()
        .slice()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (activityLogCount) {
        activityLogCount.textContent = String(activities.length);
    }

    if (!activities.length) {
        activityLogList.innerHTML = '';
        if (activityLogEmpty) {
            activityLogEmpty.textContent = 'No activity yet. Your reports, donations, and relief thread messages will appear here.';
            activityLogEmpty.style.display = 'block';
        }
        return;
    }

    if (activityLogEmpty) {
        activityLogEmpty.style.display = 'none';
    }

    activityLogList.innerHTML = activities.map(buildActivityLogItem).join('');
}

function refreshDonationLocationOptions() {
    const donationLocationSelect = document.getElementById('donationLocationSelect');
    if (!donationLocationSelect) {
        return;
    }

    const selectedValue = donationLocationSelect.value;
    const supportedLocations = Array.isArray(userReportedLocations)
        ? userReportedLocations.filter((location) => {
            const status = getResponseStatusData(location);
            if (!status.isReached && !status.isOnTheWay) {
                return false;
            }
            return isLocationSupportedByCurrentUser(location, status);
        })
        : [];

    const placeholderText = supportedLocations.length
        ? 'Select supported location...'
        : 'No supported locations yet';
    donationLocationSelect.innerHTML = `<option value="">${placeholderText}</option>`;

    supportedLocations.forEach((location) => {
        const option = document.createElement('option');
        const identifier = location.firestoreId || location.id || '';
        option.value = identifier;
        option.textContent = location.name || 'Unnamed location';
        option.dataset.coords = Array.isArray(location.coords) ? location.coords.join(',') : '';
        donationLocationSelect.appendChild(option);
    });

    if (selectedValue) {
        donationLocationSelect.value = selectedValue;
    }
}

function setupDonationImageUpload() {
    const uploadBtn = document.getElementById('donationPhotoUploadBtn');
    const uploadInput = document.getElementById('donationPhotoUpload');

    if (!uploadBtn || !uploadInput) {
        return;
    }

    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', handleDonationImageSelection);
}

function handleDonationImageSelection(event) {
    const files = Array.from(event.target.files || []);
    const maxFileSize = 5 * 1024 * 1024;
    const maxImages = 6;

    files.forEach((file) => {
        if (file.size > maxFileSize) {
            systemAlert(`File "${file.name}" is too large. Maximum size is 5MB.`);
            return;
        }
        if (!file.type.startsWith('image/')) {
            systemAlert(`File "${file.name}" is not an image.`);
            return;
        }
        if (donationUploadedImages.length >= maxImages) {
            systemAlert(`Maximum ${maxImages} images allowed.`);
            return;
        }

        compressImage(file, (compressedDataUrl) => {
            donationUploadedImages.push({
                id: Date.now() + Math.random(),
                name: file.name,
                data: compressedDataUrl,
                size: file.size
            });
            updateDonationPhotoPreview();
        });
    });

    event.target.value = '';
}

function updateDonationPhotoPreview() {
    const preview = document.getElementById('donationPhotoPreview');
    if (!preview) {
        return;
    }

    preview.innerHTML = '';
    donationUploadedImages.forEach((image) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'image-preview-item';
        previewItem.innerHTML = `
            <img src="${image.data}" alt="${image.name}">
            <button type="button" class="image-remove-btn" data-image-id="${image.id}" title="Remove image">
                <i class="fas fa-times"></i>
            </button>
        `;
        preview.appendChild(previewItem);
    });

    preview.querySelectorAll('.image-remove-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const imageId = button.dataset.imageId;
            donationUploadedImages = donationUploadedImages.filter(image => String(image.id) !== imageId);
            updateDonationPhotoPreview();
        });
    });
}

function clearDonationImages() {
    donationUploadedImages = [];
    updateDonationPhotoPreview();
}

function clearDonationPinSelection() {
    donationPinCoords = null;
    donationPinLabel = '';
    donationPinModeActive = false;
    pendingDonationSelection = null;
    donationConfirmedLocationId = '';

    if (donationTempMarker && map) {
        map.removeLayer(donationTempMarker);
        donationTempMarker = null;
    }

    const preview = document.getElementById('donationPinPreview');
    if (preview) {
        preview.innerHTML = '<span class="donation-pin-label">No pin selected yet.</span>';
    }
}

function setDonationPinPreview(label, coords) {
    const preview = document.getElementById('donationPinPreview');
    if (!preview) {
        return;
    }

    const coordText = coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : '--';
    preview.innerHTML = `
        <span class="donation-pin-label">${label}</span>
        <span class="donation-pin-coords">${coordText}</span>
    `;
}

function confirmDonationLocationSelection() {
    if (!pendingDonationSelection) {
        openDonationLogModal({ preserveSelection: true });
        return;
    }

    const { id, label, coords } = pendingDonationSelection;
    donationPinCoords = coords;
    donationPinLabel = label || 'Selected location';
    donationConfirmedLocationId = id || '';
    pendingDonationSelection = null;

    const locationSelect = document.getElementById('donationLocationSelect');
    if (locationSelect && donationConfirmedLocationId) {
        locationSelect.value = donationConfirmedLocationId;
    }

    if (donationTempMarker && map) {
        map.removeLayer(donationTempMarker);
        donationTempMarker = null;
    }

    setDonationPinPreview(donationPinLabel, donationPinCoords);
    document.body.classList.remove('pinning-focus');
    openDonationLogModal({ preserveSelection: true });
}

function cancelDonationLocationSelection() {
    const locationSelect = document.getElementById('donationLocationSelect');
    if (locationSelect) {
        locationSelect.value = donationConfirmedLocationId || '';
    }
    pendingDonationSelection = null;
    document.body.classList.remove('pinning-focus');

    if (donationConfirmedLocationId && donationPinCoords) {
        setDonationPinPreview(donationPinLabel || 'Selected location', donationPinCoords);
    } else {
        clearDonationPinSelection();
    }

    openDonationLogModal({ preserveSelection: true });
}

function startDonationPinMode() {
    if (!map) {
        return;
    }

    donationPinModeActive = true;
    document.body.classList.add('reporting-mode');
    document.body.classList.add('pinning-focus');

    const instruction = document.createElement('div');
    instruction.id = 'donationPinInstruction';
    instruction.className = 'click-to-mark-instruction';
    instruction.innerHTML = `
        <h4><i class="fas fa-location-dot"></i> Pin Drop-off Location</h4>
        <p>Click anywhere on the map to mark the donation drop-off point.</p>
        <div class="instruction-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="cancelDonationPin">
                <i class="fas fa-times"></i> Cancel
            </button>
        </div>
        <div class="esc-hint">
            <i class="fas fa-keyboard"></i> Press ESC to cancel
        </div>
    `;
    document.body.appendChild(instruction);

    map.once('click', handleDonationPinClick);
    document.addEventListener('keydown', handleDonationPinKeydown);

    const cancelButton = document.getElementById('cancelDonationPin');
    if (cancelButton) {
        cancelButton.addEventListener('click', cancelDonationPinMode);
    }
}

function handleDonationPinClick(event) {
    if (!event || !event.latlng) {
        return;
    }

    donationPinCoords = event.latlng;
    donationPinLabel = 'Pinned location';
    cancelDonationPinMode({ reopenModal: false });

    if (donationTempMarker && map) {
        map.removeLayer(donationTempMarker);
    }

    donationTempMarker = L.marker([event.latlng.lat, event.latlng.lng], {
        icon: L.divIcon({
            className: 'temp-report-marker',
            html: '<i class="fas fa-map-marker-alt" style="color: #1f8f4a; font-size: 20px; animation: bounce 1s infinite;"></i>',
            iconSize: [25, 25],
            iconAnchor: [12, 25]
        })
    }).addTo(map);

    const targetZoom = Math.max(map.getZoom(), 17);
    map.flyTo([event.latlng.lat, event.latlng.lng], targetZoom, { duration: 0.6 });

    setDonationPinPreview(donationPinLabel, event.latlng);
    openDonationLogModal();

    fetchConfirmLocationName(event.latlng)
        .then((name) => {
            donationPinLabel = name || 'Pinned location';
            setDonationPinPreview(donationPinLabel, event.latlng);
        })
        .catch(() => {
            donationPinLabel = 'Pinned location';
            setDonationPinPreview(donationPinLabel, event.latlng);
        });
}

function cancelDonationPinMode(options = {}) {
    const { reopenModal = true } = options;
    donationPinModeActive = false;
    document.body.classList.remove('reporting-mode');
    document.body.classList.remove('pinning-focus');
    document.body.style.cursor = 'default';

    const instruction = document.getElementById('donationPinInstruction');
    if (instruction) {
        instruction.remove();
    }

    if (map) {
        map.off('click', handleDonationPinClick);
    }
    document.removeEventListener('keydown', handleDonationPinKeydown);

    if (reopenModal) {
        openDonationLogModal();
    }
}

function handleDonationPinKeydown(event) {
    if (event.key === 'Escape' && donationPinModeActive) {
        event.preventDefault();
        cancelDonationPinMode();
    }
}

function bindDonationModalControls() {
    const donationLogForm = document.getElementById('donationLogForm');
    const closeBtn = document.getElementById('closeDonationLogModal');
    const cancelBtn = document.getElementById('cancelDonationLog');
    const addItemBtn = document.getElementById('addDonationItem');
    const donationItems = document.getElementById('donationItems');
    const donationLocationSelect = document.getElementById('donationLocationSelect');
    const pinButton = document.getElementById('donationPinLocationBtn');
    const donorTypeInputs = document.querySelectorAll('input[name="donorType"]');
    const donationLocationModeInputs = document.querySelectorAll('input[name="donationLocationMode"]');

    if (donationLogForm) {
        donationLogForm.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') {
                return;
            }

            const target = event.target;
            const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';
            const type = target && target.type ? target.type.toLowerCase() : '';

            if (tagName === 'textarea' || type === 'submit' || type === 'button') {
                return;
            }

            event.preventDefault();
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeDonationLogModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeDonationLogModal);
    }
    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            if (!donationItems) {
                return;
            }
            const row = document.createElement('div');
            row.className = 'donation-item-row';
            row.innerHTML = `
                <input type="text" placeholder="Item name" required>
                <input type="number" placeholder="Qty" min="0" required>
                <input type="text" placeholder="Unit (packs, boxes)" required>
                <button type="button" class="btn btn-danger btn-sm donation-remove-item" aria-label="Remove item">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            donationItems.appendChild(row);
        });
    }
    if (donationItems) {
        donationItems.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('.donation-remove-item');
            if (!removeBtn) {
                return;
            }
            const row = removeBtn.closest('.donation-item-row');
            if (!row) {
                return;
            }
            row.remove();
        });
    }
    if (donationLocationSelect) {
        donationLocationSelect.addEventListener('change', () => {
            const locationMode = document.querySelector('input[name="donationLocationMode"]:checked');
            if (!locationMode || locationMode.value !== 'unreached') {
                return;
            }
            const selectedOption = donationLocationSelect.selectedOptions[0];
            if (!selectedOption || !selectedOption.value) {
                clearDonationPinSelection();
                return;
            }
            const coordsData = selectedOption.dataset.coords || '';
            const coordsParts = coordsData.split(',').map(value => parseFloat(value.trim()));
            if (coordsParts.length !== 2 || !Number.isFinite(coordsParts[0]) || !Number.isFinite(coordsParts[1])) {
                systemAlert('Unable to load the selected location. Please choose another option.');
                clearDonationPinSelection();
                return;
            }

            const coords = { lat: coordsParts[0], lng: coordsParts[1] };
            pendingDonationSelection = {
                id: selectedOption.value,
                label: selectedOption.textContent || 'Selected location',
                coords
            };

            if (donationTempMarker && map) {
                map.removeLayer(donationTempMarker);
                donationTempMarker = null;
            }

            closeDonationLogModal({ preserveForm: true });
            document.body.classList.add('pinning-focus');
            if (map) {
                const targetZoom = Math.max(map.getZoom(), 17);
                map.flyTo([coords.lat, coords.lng], targetZoom, { duration: 0.6 });
            }
            openConfirmLocationModal(coords, {
                context: 'donation',
                onConfirm: confirmDonationLocationSelection,
                onCancel: cancelDonationLocationSelection,
                label: pendingDonationSelection.label
            });
        });
    }
    if (pinButton) {
        pinButton.addEventListener('click', () => {
            if (donationLocationSelect) {
                donationLocationSelect.value = '';
            }
            clearDonationPinSelection();
            closeDonationLogModal({ preserveForm: true });
            startDonationPinMode();
        });
    }
    if (donorTypeInputs.length) {
        donorTypeInputs.forEach((input) => {
            input.addEventListener('change', updateDonationDonorFields);
        });
    }
    if (donationLocationModeInputs.length) {
        donationLocationModeInputs.forEach((input) => {
            input.addEventListener('change', updateDonationLocationModeFields);
        });
    }
    setupDonationCashAmountInput();
    updateDonationDonorFields();
    updateDonationLocationModeFields();
}

async function submitDonationLog(event) {
    event.preventDefault();

    if (event.target && !event.target.checkValidity()) {
        event.target.reportValidity();
        return;
    }

    const donationLocationSelect = document.getElementById('donationLocationSelect');
    const selectedOption = donationLocationSelect ? donationLocationSelect.selectedOptions[0] : null;
    const selectedLocationId = selectedOption && selectedOption.value ? selectedOption.value : null;
    const locationModeInput = document.querySelector('input[name="donationLocationMode"]:checked');
    const locationMode = locationModeInput ? locationModeInput.value : '';

    if (!locationMode) {
        systemAlert('Please choose how you want to set the drop-off location.');
        return;
    }

    if (locationMode === 'unreached') {
        if (!selectedLocationId) {
            systemAlert('Please select a supported location from the list.');
            return;
        }
        if (selectedLocationId !== donationConfirmedLocationId) {
            systemAlert('Please confirm the drop-off location on the map.');
            return;
        }
    }

    if (locationMode === 'pin' && !donationPinCoords) {
        systemAlert('Please pin a drop-off point on the map.');
        return;
    }

    if (donationUploadedImages.length < 2) {
        systemAlert('Please upload at least 2 photos for verification.');
        return;
    }

    const donationItems = [];
    const itemRows = document.querySelectorAll('#donationItems .donation-item-row');
    itemRows.forEach((row) => {
        const inputs = row.querySelectorAll('input');
        if (inputs.length < 3) {
            return;
        }
        const name = inputs[0].value.trim();
        const quantityValue = parseFloat(inputs[1].value);
        const quantity = Number.isFinite(quantityValue) ? quantityValue : 0;
        const unit = inputs[2].value.trim();

        if (name || unit || inputs[1].value) {
            donationItems.push({ name, quantity, unit });
        }
    });

    const cashAmountInput = document.getElementById('donationCashAmount');
    const cashAmountValue = cashAmountInput
        ? parseFloat(normalizeCashAmountValue(cashAmountInput.value))
        : null;
    const cashAmount = Number.isFinite(cashAmountValue) && cashAmountValue > 0 ? cashAmountValue : null;

    if (!donationItems.length && cashAmount === null) {
        systemAlert('Please add at least one donation item or a cash amount.');
        return;
    }

    const notesInput = document.getElementById('donationNotes');
    const donationNotes = notesInput ? notesInput.value.trim() : '';

    const donorType = getDonationDonorType();
    const donorName = getDonationDonorName() || getDonorDisplayName() || 'Anonymous';
    const donorEmail = window.firebaseAuth && window.firebaseAuth.currentUser
        ? window.firebaseAuth.currentUser.email
        : null;
    const donorId = window.firebaseAuth && window.firebaseAuth.currentUser
        ? window.firebaseAuth.currentUser.uid
        : (window.getCurrentUserId ? window.getCurrentUserId() : null);

    if (donorName) {
        if (donorType === 'organization') {
            localStorage.setItem(DONOR_TEAM_NAME_KEY, donorName);
        } else {
            localStorage.setItem(DONOR_DISPLAY_NAME_KEY, donorName);
        }
    }

    let locationCoords = null;
    let locationType = locationMode;
    let locationName = '';
    let locationId = null;

    if (locationMode === 'unreached') {
        locationType = 'supported';
        locationId = selectedLocationId;
        locationName = selectedOption ? selectedOption.textContent : 'Selected location';
        if (selectedOption && selectedOption.dataset.coords) {
            const coordsParts = selectedOption.dataset.coords.split(',').map(value => parseFloat(value.trim()));
            if (coordsParts.length === 2 && Number.isFinite(coordsParts[0]) && Number.isFinite(coordsParts[1])) {
                locationCoords = coordsParts;
            }
        }
    } else {
        locationType = 'pinned';
        locationName = donationPinLabel || 'Pinned location';
        locationCoords = donationPinCoords ? [donationPinCoords.lat, donationPinCoords.lng] : null;
    }

    const donationLog = {
        id: `donation_${Date.now()}`,
        donorId,
        donorName,
        donorType,
        donorEmail,
        submittedAt: new Date().toISOString(),
        location: {
            type: locationType,
            id: locationId,
            name: locationName,
            coords: locationCoords
        },
        items: donationItems,
        cashAmount,
        notes: donationNotes,
        images: donationUploadedImages.map(img => ({
            id: img.id,
            name: img.name,
            data: img.data,
            size: img.size,
            uploadedAt: new Date().toISOString()
        })),
        verificationStatus: 'pending',
        verifiedAt: null,
        verifiedBy: null
    };

    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        if (!db || !window.firebaseApp) {
            systemAlert('Donation log submission requires an online connection.');
            return;
        }

        await saveDonationLogToFirestore(donationLog);
        addGuestActivity({
            type: 'donation',
            locationId,
            locationName,
            donorName,
            donorType,
            itemCount: donationItems.length,
            cashAmount
        });
        showSuccessMessage('Donation log submitted for verification.');
        closeDonationLogModal();
    } catch (error) {
        console.error('Error submitting donation log:', error);
        systemAlert('Failed to submit donation log. Please try again.');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Submit donation log';
        }
    }
}

async function submitLocationReport(e) {
    e.preventDefault();

    // Check privacy consent
    if (!privacyConsented) {
        systemAlert('Please review and consent to the Privacy Policy before submitting your report.');
        return;
    }

    if (!pendingReportCoords) {
        systemAlert('No location selected. Please try again.');
        return;
    }

    // Get form data
    const reliefNeeds = [];
    document.querySelectorAll('#reportForm input[type="checkbox"]:checked').forEach(checkbox => {
        reliefNeeds.push(checkbox.value);
    });

    if (reliefNeeds.length === 0) {
        systemAlert('Please select at least one type of help needed.');
        return;
    }

    // Check if at least one photo is uploaded
    if (uploadedImages.length === 0) {
        systemAlert('Please attach at least one photo to help verify the location.');
        return;
    }

    // Disable submit button to prevent double submission
    const submitButton = document.querySelector('#reportForm button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        // Get user ID for ownership tracking
        let userId = null;
        let sessionId = localStorage.getItem('anonymousSessionId');
        const guestId = getStoredGuestId() || localStorage.getItem('guestSessionId');

        if (window.firebaseAuth && window.firebaseAuth.currentUser) {
            // Authenticated user
            userId = window.firebaseAuth.currentUser.uid;
        } else if (guestId) {
            userId = guestId;
        } else if (window.getCurrentUserId) {
            userId = window.getCurrentUserId();
        } else {
            // Anonymous user - create/use session ID
            if (!sessionId) {
                sessionId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('anonymousSessionId', sessionId);
            }
            userId = sessionId;
        }

        // Get form elements with null checks
        const landmarkEl = document.getElementById('landmark');
        const locationSourceEl = document.getElementById('locationSource');
        const urgencyLevelEl = document.getElementById('urgencyLevel');
        const peopleCountEl = document.getElementById('peopleCount');
        const additionalInfoEl = document.getElementById('additionalInfo');
        const reporterNameEl = document.getElementById('reporterName');
        const reporterContactEl = document.getElementById('reporterContact');

        // Validate required fields exist
        if (!landmarkEl || !locationSourceEl || !urgencyLevelEl) {
            systemAlert('Form error: Required fields not found. Please refresh the page and try again.');
            return;
        }

        // Validate landmark is filled
        if (!landmarkEl.value.trim()) {
            systemAlert('Please provide landmark details to help locate this place.');
            return;
        }

        // Debug: Check how many images we have before saving
        console.log('About to save location with images:', {
            uploadedImagesCount: uploadedImages.length,
            uploadedImages: uploadedImages.map(img => ({
                id: img.id,
                name: img.name,
                hasData: !!img.data,
                dataLength: img.data ? img.data.length : 0
            }))
        });

        const peopleCountValue = peopleCountEl && peopleCountEl.value
            ? parseInt(peopleCountEl.value, 10)
            : null;
        const normalizedPeopleCount = Number.isFinite(peopleCountValue) ? peopleCountValue : null;

        const reporterInputValue = reporterNameEl ? reporterNameEl.value.trim() : '';
        const actualReporter = (window.firebaseAuth && window.firebaseAuth.currentUser &&
            (window.firebaseAuth.currentUser.displayName || window.firebaseAuth.currentUser.email)) ||
            (guestId || 'Anonymous');

        // The input field is for contact person, not the reporter
        const contactPersonName = reporterInputValue || actualReporter;

        // Create user report object
        const userReport = {
            id: 'user_' + Date.now(),
            userId: userId, // Track who created this pin (authenticated or session ID)
            createdBy: userId,
            isAnonymous: !window.firebaseAuth || !window.firebaseAuth.currentUser,
            name: confirmedLocationName || 'Unnamed location', // Changed from locationName to name for Firestore compatibility
            locationName: confirmedLocationName || 'Unnamed location', // Keep for backward compatibility
            landmark: landmarkEl.value.trim(),
            coords: [pendingReportCoords.lat, pendingReportCoords.lng],
            source: locationSourceEl.value || '',
            reliefNeeds: reliefNeeds,
            urgency: urgencyLevelEl.value || '',
            urgencyLevel: urgencyLevelEl.value || '', // Added for Firestore compatibility
            peopleCount: normalizedPeopleCount,
            additionalInfo: additionalInfoEl ? additionalInfoEl.value || '' : '',
            reporterName: actualReporter, // Actual reporter from user ID/guest ID
            contactPerson: contactPersonName, // Contact person from input field
            reporterContact: reporterContactEl ? reporterContactEl.value || '' : '',
            reportedAt: new Date().toISOString(),
            status: 'user_reported',
            reliefStatus: 'needs_help',
            verified: false,
            images: uploadedImages.map(img => {
                console.log('Saving image to database:', {
                    id: img.id,
                    name: img.name,
                    dataLength: img.data ? img.data.length : 0,
                    size: img.size
                });
                return {
                    id: img.id,
                    name: img.name,
                    data: img.data,
                    size: img.size,
                    uploadedAt: new Date().toISOString()
                };
            })
        };

        let savedId = null;
        let saveMethod = 'unknown';

        // Check if Firebase is properly configured (not placeholder values)
        const isFirebaseConfigured = !!(db && window.firebaseApp);

        if (isFirebaseConfigured) {
            try {
                // Save to Firestore (with localStorage fallback) - with timeout
                savedId = await Promise.race([
                    saveLocationToFirestore(userReport),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Overall submission timeout')), 15000)
                    )
                ]);
                saveMethod = 'firestore';
            } catch (error) {
                console.warn('Firestore save failed, using localStorage:', error);
                savedId = saveToLocalStorage(userReport);
                saveMethod = 'localStorage';
            }
        } else {
            // Skip Firebase, save directly to localStorage
            savedId = saveToLocalStorage(userReport);
            saveMethod = 'localStorage';
        }

        // Always add to local array and map regardless of save method
        if (savedId) {
            userReport.firestoreId = savedId;
        }

        const alreadyTracked = userReportedLocations.some(location =>
            (userReport.firestoreId && location.firestoreId === userReport.firestoreId) ||
            (userReport.id && location.id === userReport.id)
        );

        if (!alreadyTracked) {
            userReportedLocations.push(userReport);
            addUserReportedMarker(userReport);
        }

        // Update localStorage as backup
        localStorage.setItem('userReportedLocations', JSON.stringify(userReportedLocations));

        // Update pinned locations list
        updatePinnedLocationsList();

        addGuestActivity({
            type: 'report',
            locationId: userReport.firestoreId || userReport.id,
            locationName: userReport.locationName,
            urgency: userReport.urgency,
            reliefNeeds: userReport.reliefNeeds,
            peopleCount: userReport.peopleCount
        });

        // Remove temporary marker
        if (window.tempReportMarker) {
            map.removeLayer(window.tempReportMarker);
            window.tempReportMarker = null;
        }

        // Show success message
        showSuccessMessage('Location reported successfully! 🌐 Now visible to all users on the public server. Thank you for helping the relief efforts!');

    } catch (error) {
        console.error('❌ Error during form submission:', error);
        alert('Error submitting report: ' + error.message + '. Please try again.');

        // Re-enable submit button on error
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Submit Report';
        }
        return; // Don't close modal on error
    }

    // Close modal
    closeReportModal();

    // Re-enable submit button
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Submit Report';
    }
}

function addUserReportedMarker(report) {
    // Check if marker should be displayed based on current filter
    const matchesUrgency = currentUrgencyFilter === 'all' ||
        report.urgency === currentUrgencyFilter;

    const isReached = report.reached === true;
    const matchesReached = isReachedViewActive ? isReached : !isReached;

    if (matchesUrgency && matchesReached) {
        addUserReportedMarkerToMap(report);
    }
}

function getUrgencyColor(urgencyLevel) {
    switch (urgencyLevel) {
        case 'critical': return '#dc3545'; // Red
        case 'urgent': return '#fd7e14'; // Orange
        case 'moderate': return '#ffc107'; // Yellow
        default: return '#6c757d'; // Gray
    }
}

function getResponseStatusData(report) {
    const isReached = report.reached === true;
    const respondingName = [
        report.donorResponding,
        report.respondingTeam,
        report.responseTeam,
        report.reachedByTeam,
        report.supportedByName,
        report.supporterName
    ]
        .map(value => (value || '').toString().trim())
        .find(value => value) || '';
    const responseStatusValue = (report.responseStatus || report.reliefStatus || '').toString().toLowerCase();
    const supportStatusValue = (report.supportStatus || report.support_status || '').toString().toLowerCase();
    const isOnTheWay = !isReached && (
        report.onTheWay === true ||
        report.on_the_way === true ||
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

    return {
        isReached,
        isOnTheWay,
        respondingName,
        responseStatusValue
    };
}

function createUserReportPopup(report) {
    const urgencyValue = report.urgency || report.urgencyLevel || 'moderate';
    const urgencyBadge = `<span class="status-badge" style="background-color: ${getUrgencyColor(urgencyValue)}; color: white;">${urgencyValue.toUpperCase()}</span>`;
    const sourceBadge = `<span class="relief-badge relief-needs-help">${(report.source || 'unknown').toUpperCase()}</span>`;

    // Use a unique identifier that works for both local and Firestore items
    const uniqueId = report.firestoreId || report.id || `temp_${Date.now()}`;

    // Check if current user can delete this location
    let canDelete = false;
    let deleteReason = '';

    const ownershipCandidates = new Set();
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        ownershipCandidates.add(window.firebaseAuth.currentUser.uid);
    }

    if (window.getCurrentUserId) {
        const currentId = window.getCurrentUserId();
        if (currentId) {
            ownershipCandidates.add(currentId);
        }
    }

    const localFallbackId = localStorage.getItem('localUserId');
    if (localFallbackId) {
        ownershipCandidates.add(localFallbackId);
    }

    const sessionFallbackId = localStorage.getItem('anonymousSessionId');
    if (sessionFallbackId) {
        ownershipCandidates.add(sessionFallbackId);
    }

    const guestFallbackId = getStoredGuestId() || localStorage.getItem('guestSessionId');
    if (guestFallbackId) {
        ownershipCandidates.add(guestFallbackId);
    }

    const masterAdminEmails = ['louisejane1007@gmail.com'];
    const adminEmail = (
        (window.adminUser && window.adminUser.email) ||
        (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.email) ||
        ''
    ).toLowerCase();
    const isMasterAdmin = window.isAdminMap && masterAdminEmails.includes(adminEmail);

    // Users can delete their own pins; master admin can delete all pins on admin map
    const isOwner = Boolean(
        (report.userId && ownershipCandidates.has(report.userId)) ||
        (report.createdBy && ownershipCandidates.has(report.createdBy))
    );

    if (isMasterAdmin || isOwner) {
        canDelete = true;
        deleteReason = isMasterAdmin ? 'Master admin' : 'Your pin';
    }

    // Create appropriate action button
    const noDeleteMessage = window.isAdminMap
        ? 'Only master admins can remove this'
        : 'Only the creator can remove this';

    const { isReached, isOnTheWay, respondingName } = getResponseStatusData(report);
    const safeRespondingName = respondingName ? escapeHtml(respondingName) : '';
    const safeReachedTeam = report.reachedByTeam ? escapeHtml(report.reachedByTeam) : '';
    const donorIsResponding = isLocationSupportedByCurrentUser(report, { respondingName, isReached, isOnTheWay });
    const isDonorMap = window.isDonorMap === true;

    let actionButton = canDelete ?
        `<button onclick="removeUserReportedLocation('${uniqueId}')" class="btn btn-danger btn-sm" title="Remove this location">
            <i class="fas fa-trash"></i> Remove
        </button>` :
        `<span class="text-muted" style="font-size: 0.8rem; padding: 0.5rem;">
            <i class="fas fa-lock"></i> ${noDeleteMessage}
        </span>`;

    if (isDonorMap) {
        if (isReached) {
            const reachedMessage = safeReachedTeam
                ? `Reached by ${safeReachedTeam}`
                : 'Reached by another team';
            actionButton = `
                <span class="text-muted" style="font-size: 0.85rem; padding: 0.5rem; display: inline-flex; align-items: center; gap: 0.4rem;">
                    <i class="fas fa-flag-checkered"></i> ${reachedMessage}
                </span>
            `;
        } else if (isOnTheWay) {
            const supportMessage = donorIsResponding
                ? 'You are supporting this location'
                : `Currently supported by ${safeRespondingName || 'another team'}`;
            actionButton = `
                <span class="text-muted" style="font-size: 0.85rem; padding: 0.5rem; display: inline-flex; align-items: center; gap: 0.4rem;">
                    <i class="fas fa-route"></i> ${supportMessage}
                </span>
            `;
        } else {
            actionButton = `
                <button onclick="supportLocationForDonor('${uniqueId}')" class="btn btn-success btn-sm" title="Support this location">
                    <i class="fas fa-hand-holding-heart"></i> Support this location
                </button>
            `;
        }
    }
    const responseStatusBadge = (() => {
        if (isReached) {
            return `
        <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 0.75rem; margin: 0.5rem 0; border-radius: 4px;">
            <p style="margin: 0; color: #155724; font-weight: 600;">
                <i class="fas fa-check-circle"></i> Response Status: Reached
            </p>
            ${safeReachedTeam ? `<p style="margin: 0.25rem 0 0 0; color: #155724; font-size: 0.9rem;">
                <strong>Team Responding:</strong> ${safeReachedTeam}
            </p>` : ''}
        </div>
    `;
        }

        const statusLabel = isOnTheWay ? 'On the way' : 'Unreached';
        const supporterLabel = isOnTheWay ? 'Supported by' : 'Donor Responding';
        const statusStyles = isOnTheWay
            ? {
                background: '#dbeafe', // Light blue
                border: '#1d4ed8',     // Darker blue
                text: '#1e3a8a',       // Even darker blue
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

        // Get supporter type and contact for on-the-way locations
        let supporterTypeInfo = '';
        let contactInfo = '';
        if (isOnTheWay && report) {
            const supporterType = report.supporterType || 'individual';
            const supporterContact = report.supporterContact || '';
            const supporterAnonymous = report.supporterAnonymous === true;

            supporterTypeInfo = supporterAnonymous
                ? ''
                : supporterType === 'team'
                    ? `<span style="color: #1e3a8a; font-size: 0.8rem; margin-left: 0.25rem;">(Team)</span>`
                    : `<span style="color: #1e3a8a; font-size: 0.8rem; margin-left: 0.25rem;">(Individual)</span>`;

            if (supporterContact && !supporterAnonymous) {
                contactInfo = `<p style="margin: 0.25rem 0 0 0; color: #1e3a8a; font-size: 0.8rem;">
                    <strong>Contact:</strong> ${escapeHtml(supporterContact)}
                </p>`;
            }
        }

        return `
        <div style="background: ${statusStyles.background}; border-left: 4px solid ${statusStyles.border}; padding: 0.75rem; margin: 0.5rem 0; border-radius: 4px;">
            <p style="margin: 0; color: ${statusStyles.text}; font-weight: 600;">
                <i class="fas ${statusStyles.icon}"></i> Response Status: ${statusLabel}
            </p>
            <p style="margin: 0.25rem 0 0 0; color: ${statusStyles.text}; font-size: 0.9rem;">
                <strong>${supporterLabel}:</strong> ${statusStyles.donor}${supporterTypeInfo}
            </p>
            ${contactInfo}
        </div>
    `;
    })();

    // Initialize chat when popup is created
    setTimeout(() => {
        loadChatMessages(uniqueId);
    }, 500);

    return `
        <div class="popup-content compact-popup">
            <!-- Compact header with navigation in one line -->
            <div class="popup-header">
                <h4><i class="fas fa-map-marker-alt"></i> ${report.locationName || report.name || 'Unnamed location'}</h4>
                <div class="nav-buttons-inline">
                    <button onclick="openWazeNavigation(${report.coords[0]}, ${report.coords[1]}, '${(report.locationName || report.name || 'Location').replace(/'/g, "\\'")}');" 
                            class="nav-circle-btn-small waze-circle" title="Waze">
                        <i class="fas fa-route"></i>
                    </button>
                    <button onclick="openGoogleMapsNavigation(${report.coords[0]}, ${report.coords[1]}, '${(report.locationName || report.name || 'Location').replace(/'/g, "\\'")}');" 
                            class="nav-circle-btn-small gmaps-circle" title="Maps">
                        <i class="fas fa-map-marked-alt"></i>
                    </button>
                </div>
            </div>
            
            <div class="popup-body">
                ${responseStatusBadge}
                <div class="popup-badges">
                    ${sourceBadge} ${urgencyBadge}
                </div>
                <p class="popup-needs"><strong>Needs:</strong> ${report.reliefNeeds.join(', ')}</p>
                ${report.peopleCount !== undefined && report.peopleCount !== null && report.peopleCount !== ''
            ? `<p class="popup-people"><strong>People affected:</strong> ${report.peopleCount}</p>`
            : ''}
                ${report.additionalInfo ? `<p class="popup-details">${createCollapsibleText(report.additionalInfo, 150, uniqueId)}</p>` : ''}
                <p class="popup-meta">${new Date(report.reportedAt).toLocaleDateString()} • ${report.coords[0].toFixed(4)}, ${report.coords[1].toFixed(4)}</p>
                ${report.userId || report.createdBy ? `<p class="popup-reporter">By: ${report.userId || report.createdBy}</p>` : ''}
                
                ${(() => {
            return createImageGallery(report.images, uniqueId, report);
        })()}
                
                <div class="popup-actions">
                    ${actionButton}
                </div>
            </div>
            
            <!-- Chat Section -->
            <div id="chatSection-${uniqueId}" class="chat-section" style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 15px;">
                <div class="chat-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <h5 style="margin: 0; color: #333; font-size: 14px;">
                        <i class="fas fa-comments" style="color: #007bff; margin-right: 5px;"></i> Relief Thread
                    </h5>
                    <button onclick="toggleChat('${uniqueId}')" class="btn-chat-toggle" style="background: none; border: none; color: #666; cursor: pointer; padding: 5px;">
                        <i class="fas fa-chevron-down" id="chatToggle-${uniqueId}"></i>
                    </button>
                </div>
                
                <div id="chatContainer-${uniqueId}" class="chat-container" style="background: #f8f9fa; border-radius: 8px; padding: 10px; max-height: 200px; overflow-y: auto; margin-bottom: 10px; display: none;">
                    <div id="chatMessages-${uniqueId}" class="chat-messages">
                        <div class="loading-messages" style="text-align: center; color: #666; font-size: 12px; padding: 10px;">
                            <i class="fas fa-spinner fa-spin"></i> Loading messages...
                        </div>
                    </div>
                </div>
                
                <div class="chat-input-container" id="chatInputContainer-${uniqueId}" style="display: none; gap: 8px; align-items: center;">
                    <input type="text" id="chatInput-${uniqueId}" placeholder="Type your message..." 
                           style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 20px; font-size: 12px; outline: none;"
                           onkeypress="handleChatKeyPress(event, '${uniqueId}')"
                           maxlength="200">
                    <button onclick="sendChatMessage('${uniqueId}')" class="btn-send-chat" 
                            style="background: #007bff; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-paper-plane" style="font-size: 12px;"></i>
                    </button>
                </div>
                
                <div class="chat-info" style="margin-top: 8px; font-size: 10px; color: #888; text-align: center;">
                    ${getCurrentUserName() ? 'Signed in as ' + getCurrentUserName() : 'Sign in required to chat - Click user icon above'}
                </div>
            </div>
            
            ${!canDelete && !isDonorMap ? `
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #eee; font-size: 11px; color: #888; text-align: center; font-style: italic;">
                ${noDeleteMessage}
            </div>
            ` : ''}
        </div>
    `;
}

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
        <div style="background: #d4edda; color: #155724; padding: 1rem; border-radius: 5px; margin: 1rem; border: 1px solid #c3e6cb; position: fixed; top: 20px; right: 20px; z-index: 3000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <i class="fas fa-check-circle"></i> ${message}
        </div>
    `;
    document.body.appendChild(successDiv);

    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

// Load user reported locations from Firestore/localStorage on page load
async function loadUserReportedLocations() {
    try {
        // Try to load from Firestore first
        const locations = await loadLocationsFromFirestore();

        // Add markers for all loaded locations
        locations.forEach(report => {
            addUserReportedMarker(report);
        });

    } catch (error) {
        console.error('Error loading locations:', error);

        // Fallback to localStorage
        const saved = localStorage.getItem('userReportedLocations');
        if (saved) {
            userReportedLocations = JSON.parse(saved);
            userReportedLocations.forEach(report => {
                addUserReportedMarker(report);
            });
        }
    }
}

// Remove user reported location
async function removeUserReportedLocation(identifier) {
    // Show custom confirmation dialog instead of browser confirm
    const confirmed = await showCustomConfirm(
        'Are you sure you want to remove this reported location?',
        'This action cannot be undone.'
    );

    if (!confirmed) {
        return;
    }

    // Find the report in the array - check both firestoreId and local id
    let reportIndex = -1;
    let report = null;

    // First try to find by firestoreId (for items loaded from Firestore)
    reportIndex = userReportedLocations.findIndex(report => report.firestoreId === identifier);

    // If not found, try to find by local id (for locally created items)
    if (reportIndex === -1) {
        reportIndex = userReportedLocations.findIndex(report => report.id === identifier);
    }

    // If still not found, try to find by coordinates match (fallback)
    if (reportIndex === -1) {
        // This is a fallback - not ideal but helps with edge cases
        reportIndex = userReportedLocations.findIndex(report => {
            // Convert identifier back to check if it's a coordinate-based temp ID
            return report.id === identifier || report.firestoreId === identifier;
        });
    }

    if (reportIndex === -1) {
        systemAlert('Location not found. It may have already been removed by another user.');
        return;
    }

    report = userReportedLocations[reportIndex];

    // Try to delete from Firestore first
    let deletedFromFirestore = false;

    if (report.firestoreId) {
        deletedFromFirestore = await deleteLocationFromFirestore(report.firestoreId);

        if (!deletedFromFirestore) {
            // Deletion failed - show error
            systemAlert('Failed to delete location. You may not have permission to delete this pin, or there was a connection error.');
            return;
        }
    }

    // Only proceed with local deletion if Firestore deletion succeeded
    // Remove from local array
    userReportedLocations.splice(reportIndex, 1);

    // Update localStorage as backup
    localStorage.setItem('userReportedLocations', JSON.stringify(userReportedLocations));

    // Remove from map layers
    removeMarkerFromLayers(report.coords);

    // Show success message
    const message = deletedFromFirestore ?
        '✅ Location removed successfully from all devices.' :
        '✅ Location removed locally.';
    showSuccessMessage(message);

    // Close any open popups
    map.closePopup();

    // Update pinned locations list
    updatePinnedLocationsList();
}

async function supportLocationForDonor(identifier) {
    if (!identifier) {
        systemAlert('Unable to support this location right now.');
        return false;
    }

    let reportIndex = userReportedLocations.findIndex(report => report.firestoreId === identifier);
    if (reportIndex === -1) {
        reportIndex = userReportedLocations.findIndex(report => report.id === identifier);
    }

    if (reportIndex === -1) {
        reportIndex = userReportedLocations.findIndex(report => report.firestoreId === identifier || report.id === identifier);
    }

    if (reportIndex === -1) {
        systemAlert('Location not found. It may have been updated by another user.');
        return false;
    }

    const report = userReportedLocations[reportIndex];
    const { isReached, isOnTheWay } = getResponseStatusData(report);

    if (isReached) {
        systemAlert('This location is already marked as reached.');
        return false;
    }

    if (isOnTheWay) {
        systemAlert('This location is already being supported.');
        return false;
    }

    const defaultIndividualName = localStorage.getItem(DONOR_DISPLAY_NAME_KEY) || getDonorDisplayName();
    const defaultTeamName = localStorage.getItem(DONOR_TEAM_NAME_KEY) || '';
    let supporterId = getCurrentSupporterId();
    if (!supporterId) {
        supporterId = ensureGuestSession();
    }
    const supporterInfo = await promptForDonorSupporterName({
        individualName: defaultIndividualName,
        teamName: defaultTeamName
    });
    if (!supporterInfo) {
        return false;
    }

    const supporterType = supporterInfo.type || 'individual';
    const supporterAnonymous = Boolean(supporterInfo.isAnonymous);
    const supporterFirstName = supporterInfo.firstName || '';
    const supporterLastName = supporterInfo.lastName || '';
    const supporterTeamName = supporterInfo.teamName || '';
    const supporterContact = supporterAnonymous ? '' : (supporterInfo.contact || '');
    const supporterName = supporterInfo.displayName ||
        (supporterType === 'team'
            ? supporterTeamName
            : `${supporterFirstName} ${supporterLastName}`.trim()) ||
        'Anonymous';

    if (!supporterAnonymous) {
        if (supporterType === 'team' && supporterTeamName) {
            localStorage.setItem(DONOR_TEAM_NAME_KEY, supporterTeamName);
        } else if (supporterFirstName || supporterLastName) {
            localStorage.setItem(DONOR_DISPLAY_NAME_KEY, `${supporterFirstName} ${supporterLastName}`.trim());
        }
    }
    const supportedAt = new Date().toISOString();

    const updatePayload = {
        onTheWay: true,
        responseStatus: 'on the way',
        donorResponding: supporterName,
        respondingTeam: supporterName,
        responseTeam: supporterName,
        respondingAt: supportedAt,
        supportedBy: supporterId,
        supportedByName: supporterName,
        supportedAt,
        supportStatus: 'on_the_way',
        supporterType,
        supporterContact,
        supporterAnonymous,
        supporterFirstName,
        supporterLastName,
        supporterTeamName
    };

    if (report.firestoreId && db) {
        try {
            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            await updateDoc(doc(db, 'relief-locations', report.firestoreId), updatePayload);
        } catch (error) {
            console.error('Error updating donor support status:', error);
            systemAlert('Unable to update this location right now. Please try again.');
            return false;
        }
    }

    userReportedLocations[reportIndex] = {
        ...report,
        ...updatePayload
    };

    localStorage.setItem('userReportedLocations', JSON.stringify(userReportedLocations));

    // Record the support action in guest activities for user dashboard tracking
    addGuestActivity({
        type: 'support',
        locationId: report.firestoreId || report.id,
        locationName: report.locationName || report.name,
        supporterName,
        supporterType,
        supporterAnonymous
    });

    refreshMapMarkers();
    updatePinnedLocationsList();
    refreshDonationLocationOptions();
    if (isSupportModeActive) {
        cancelSupportMode();
    }
    const supporterTypeLabel = supporterType === 'team' ? 'Team' : 'Individual';
    const supporterSuffix = supporterAnonymous ? '' : ` (${supporterTypeLabel})`;
    showSuccessMessage(`✅ Support registered for ${supporterName}${supporterSuffix}.`);
    return true;
}

function focusLocationOnMap(location) {
    if (!map || !location || !Array.isArray(location.coords)) {
        return;
    }

    const targetLatLng = L.latLng(location.coords[0], location.coords[1]);
    const newLatLng = centerPopupOnScreen(targetLatLng, {
        zoom: 15,
        offsetMultiplier: 1.2
    });

    map.setView(newLatLng, 15, {
        animate: true,
        duration: 0.5,
        easeLinearity: 0.25
    });

    setTimeout(() => {
        markerLayers.userReported.eachLayer((layer) => {
            if (layer.getLatLng().lat === location.coords[0] &&
                layer.getLatLng().lng === location.coords[1]) {
                layer.openPopup();
            }
        });
    }, 300);
}

// Pinned locations dropdown functions
function togglePinnedLocationsList() {
    const pinnedList = document.getElementById('pinnedLocationsList');

    if (pinnedList.style.display === 'none' || pinnedList.style.display === '') {
        showPinnedLocationsList();
    } else {
        hidePinnedLocationsList();
    }
}

function showPinnedLocationsList() {
    // Reset pagination state
    currentPage = 0;
    loadedItems = [];
    hasMoreItems = true;

    // Initialize lazy loading
    initializePinnedLocationsList();

    const pinnedList = document.getElementById('pinnedLocationsList');

    // Show instantly with animation class already applied
    pinnedList.style.display = 'block';
    pinnedList.classList.add('show');
}

function hidePinnedLocationsList() {
    const pinnedList = document.getElementById('pinnedLocationsList');

    // Remove show class immediately to trigger slide down animation
    requestAnimationFrame(() => {
        pinnedList.classList.remove('show');

        // Hide after animation completes
        setTimeout(() => {
            pinnedList.style.display = 'none';
            refreshMapMarkers();
        }, 300);
    });
}

// Global variables for filtering
let currentSearchQuery = '';
let currentUrgencyFilter = 'all';
let isReachedViewActive = false;

function getReachedLocations() {
    return userReportedLocations.filter(location => location.reached);
}

function getUnreachedLocations() {
    return userReportedLocations.filter(location => !location.reached);
}

function getLocationsForView() {
    return isReachedViewActive ? getReachedLocations() : getUnreachedLocations();
}

function setReachedViewActive(isActive) {
    isReachedViewActive = Boolean(isActive);
    updateReachedViewUI();

    const pinnedList = document.getElementById('pinnedLocationsList');
    if (!pinnedList || pinnedList.style.display !== 'block') {
        refreshMapMarkers();
    }

    updatePinnedLocationsList();
}

function updateReachedViewUI() {
    const viewPinnedLabel = document.getElementById('viewPinnedLabel');
    const viewPinnedIcon = document.getElementById('viewPinnedIcon');
    const pinnedListTitle = document.getElementById('pinnedListTitle');
    const pinnedListIcon = document.getElementById('pinnedListIcon');
    const reachedToggle = document.getElementById('reachedViewToggle');

    if (reachedToggle && reachedToggle.checked !== isReachedViewActive) {
        reachedToggle.checked = isReachedViewActive;
    }

    // Sync with map toggle
    const reachedViewToggleMap = document.getElementById('reachedViewToggleMap');
    if (reachedViewToggleMap && reachedViewToggleMap.checked !== isReachedViewActive) {
        reachedViewToggleMap.checked = isReachedViewActive;
    }

    const labelText = isReachedViewActive ? 'View Reached Locations' : 'View Unreached Locations';
    const titleText = isReachedViewActive ? 'Reached Locations' : 'Unreached Locations';
    const iconClass = isReachedViewActive ? 'fa-check-circle' : 'fa-map-pin';
    const removeClass = isReachedViewActive ? 'fa-map-pin' : 'fa-check-circle';

    if (viewPinnedLabel) {
        viewPinnedLabel.textContent = labelText;
    }
    if (pinnedListTitle) {
        pinnedListTitle.textContent = titleText;
    }
    if (viewPinnedIcon) {
        viewPinnedIcon.classList.remove(removeClass);
        viewPinnedIcon.classList.add(iconClass);
    }
    if (pinnedListIcon) {
        pinnedListIcon.classList.remove(removeClass);
        pinnedListIcon.classList.add(iconClass);
    }
}

// Search state management
let isSearching = false;

// Pagination variables for lazy loading
let currentPage = 0;
let itemsPerPage = 30;
let isLoading = false;
let hasMoreItems = true;
let allFilteredLocations = [];
let loadedItems = [];

function updatePinnedLocationsList() {
    const pinnedCount = document.getElementById('pinnedCount');
    const pinnedList = document.getElementById('pinnedLocationsList');

    const locationsForView = getLocationsForView();

    if (!pinnedCount && !pinnedList) {
        return;
    }

    // Update count
    if (pinnedCount) {
        pinnedCount.textContent = locationsForView.length;
    }

    // If list is visible, refresh it with lazy loading
    if (pinnedList && pinnedList.style.display === 'block') {
        initializePinnedLocationsList();
    }

    updateDonorDashboardOverview();
    refreshDonationLocationOptions();
}

function updateDonorDashboardOverview() {
    if (!window.isDonorMap) {
        return;
    }

    const mapStatusLabel = document.getElementById('mapStatusLabel');
    const mapCountLabel = document.getElementById('mapCountLabel');
    const unreachedList = document.getElementById('unreachedList');
    const claimsList = document.getElementById('claimsList');
    const unreachedSearch = document.getElementById('unreachedSearch');
    const unreachedFilter = document.getElementById('unreachedFilter');
    const claimsSearch = document.getElementById('claimsSearch');
    const claimsFilter = document.getElementById('claimsFilter');

    if (!mapStatusLabel && !mapCountLabel && !unreachedList && !claimsList) {
        return;
    }

    const locations = Array.isArray(userReportedLocations) ? userReportedLocations : [];
    const statusData = locations.map(location => ({
        location,
        ...getResponseStatusData(location)
    }));

    const reachedCount = statusData.filter(item => item.isReached).length;
    const onTheWayCount = statusData.filter(item => item.isOnTheWay).length;
    const unreachedCount = statusData.filter(item => !item.isReached && !item.isOnTheWay).length;
    const totalCount = locations.length;

    if (mapStatusLabel) {
        if (!totalCount) {
            mapStatusLabel.textContent = 'Map ready for unreached locations.';
        } else {
            mapStatusLabel.textContent = isReachedViewActive
                ? `${reachedCount} reached locations on the map.`
                : `${unreachedCount} unreached locations on the map.`;
        }
    }

    if (mapCountLabel) {
        if (!totalCount) {
            mapCountLabel.textContent = '0 locations loaded';
        } else {
            const onTheWayText = onTheWayCount ? ` • ${onTheWayCount} on the way` : '';
            mapCountLabel.textContent = `${totalCount} locations loaded${onTheWayText}`;
        }
    }

    if (unreachedList) {
        const query = unreachedSearch ? unreachedSearch.value.toLowerCase().trim() : '';
        const urgencyFilter = unreachedFilter ? unreachedFilter.value : 'all';
        const filteredUnreached = statusData
            .filter(item => !item.isReached && !item.isOnTheWay)
            .map(item => item.location)
            .filter(location => matchesDonorSearch(location, query))
            .filter(location => urgencyFilter === 'all' || location.urgency === urgencyFilter);

        renderDonorLocationList(unreachedList, filteredUnreached, {
            emptyMessage: 'Unreached locations will appear here once loaded.',
            statusLabel: 'Unreached',
            statusClass: 'status-unreached',
            statusIcon: 'fa-clock',
            showSupportAction: true
        });
    }

    if (claimsList) {
        const query = claimsSearch ? claimsSearch.value.toLowerCase().trim() : '';
        const claimFilterValue = claimsFilter ? claimsFilter.value : 'all';
        const claimEntries = statusData
            .filter(item => (item.isOnTheWay || item.isReached))
            .filter(item => isLocationSupportedByCurrentUser(item.location, item))
            .map(item => ({
                location: item.location,
                claimStatus: item.isReached ? 'pending' : 'on-the-way',
                respondingName: item.respondingName
            }))
            .filter(entry => claimFilterValue === 'all' || entry.claimStatus === claimFilterValue)
            .filter(entry => matchesDonorSearch(entry.location, query, entry.respondingName));

        renderDonorLocationList(claimsList, claimEntries.map(entry => ({
            ...entry.location,
            _claimStatus: entry.claimStatus
        })), {
            emptyMessage: 'No claimed locations yet. Claim a location from the map tab.',
            statusLabel: 'On the way',
            statusClass: 'status-claimed',
            statusIcon: 'fa-route',
            showSupportAction: false
        });
    }
}

function matchesDonorSearch(location, query, respondingName = '') {
    if (!query) {
        return true;
    }

    const normalizedQuery = query.toLowerCase();
    const fields = [
        location.name,
        location.additionalInfo,
        location.source,
        location.reporterName,
        respondingName
    ];

    const needs = Array.isArray(location.reliefNeeds) ? location.reliefNeeds : [];
    return fields.some(field => field && field.toString().toLowerCase().includes(normalizedQuery)) ||
        needs.some(need => need && need.toString().toLowerCase().includes(normalizedQuery));
}

function renderDonorLocationList(container, locations, options) {
    if (!container) {
        return;
    }

    const {
        emptyMessage,
        statusLabel,
        statusClass,
        statusIcon,
        showSupportAction
    } = options;

    container.innerHTML = '';

    if (!locations.length) {
        const empty = document.createElement('p');
        empty.textContent = emptyMessage;
        container.appendChild(empty);
        return;
    }

    locations.forEach(location => {
        container.appendChild(buildDonorLocationCard(location, {
            statusLabel,
            statusClass,
            statusIcon,
            showSupportAction
        }));
    });
}

function buildDonorLocationCard(location, options) {
    const {
        statusLabel,
        statusClass,
        statusIcon,
        showSupportAction
    } = options;

    const card = document.createElement('div');
    card.className = 'location-card';

    let cardStatusLabel = statusLabel;
    let cardStatusClass = statusClass;
    let cardStatusIcon = statusIcon;
    if (location._claimStatus) {
        if (location._claimStatus === 'pending') {
            cardStatusLabel = 'Reached';
            cardStatusClass = 'status-pending';
            cardStatusIcon = 'fa-check-circle';
        } else if (location._claimStatus === 'on-the-way') {
            cardStatusLabel = 'On the way';
            cardStatusClass = 'status-claimed';
            cardStatusIcon = 'fa-route';
        }
    }

    const locationName = escapeHtml((location.locationName || 'Unnamed location').toString());
    const urgencyText = location.urgency
        ? location.urgency.charAt(0).toUpperCase() + location.urgency.slice(1)
        : 'Unknown';
    const urgencyColor = getUrgencyColor(location.urgency || '');
    const reportedDate = location.reportedAt ? new Date(location.reportedAt).toLocaleDateString() : '';
    const needs = Array.isArray(location.reliefNeeds)
        ? location.reliefNeeds.filter(Boolean).map(need => escapeHtml(String(need))).join(', ')
        : '';
    const notes = location.additionalInfo
        ? escapeHtml(String(location.additionalInfo).slice(0, 120))
        : '';
    const { respondingName } = getResponseStatusData(location);
    const safeRespondingName = respondingName ? escapeHtml(respondingName) : '';

    // Get supporter type info for display
    let supporterTypeDisplay = '';
    if (location.supporterType && !location.supporterAnonymous) {
        supporterTypeDisplay = location.supporterType === 'team'
            ? ' <span style="color: #1e3a8a; font-size: 0.8rem;">(Team)</span>'
            : ' <span style="color: #1e3a8a; font-size: 0.8rem;">(Individual)</span>';
    }

    const statusBadge = `
        <span class="status-badge ${cardStatusClass}">
            <i class="fas ${cardStatusIcon}"></i> ${cardStatusLabel}
        </span>
    `;
    const urgencyBadge = `
        <span class="status-badge" style="background: ${urgencyColor}; color: #fff;">
            ${urgencyText}
        </span>
    `;

    card.innerHTML = `
        <h4>${locationName}</h4>
        <div class="location-meta">
            ${statusBadge}
            ${urgencyBadge}
            ${location.source ? `<span>${escapeHtml((location.source || 'unknown').toUpperCase())}</span>` : ''}
            ${reportedDate ? `<span>${reportedDate}</span>` : ''}
        </div>
        ${needs ? `<div><strong>Needs:</strong> ${needs}</div>` : ''}
        ${notes ? `<div>${notes}${location.additionalInfo && location.additionalInfo.length > 120 ? '…' : ''}</div>` : ''}
        ${safeRespondingName ? `<div><strong>Responding:</strong> ${safeRespondingName}${supporterTypeDisplay}</div>` : ''}
    `;

    const actions = document.createElement('div');
    actions.className = 'location-actions';

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'donor-btn ghost';
    viewBtn.innerHTML = '<i class="fas fa-map"></i> View on map';
    viewBtn.addEventListener('click', () => focusLocationOnMap(location));
    actions.appendChild(viewBtn);

    if (showSupportAction) {
        const supportBtn = document.createElement('button');
        supportBtn.type = 'button';
        supportBtn.className = 'donor-btn primary';
        supportBtn.innerHTML = '<i class="fas fa-hand-holding-heart"></i> Support location';
        supportBtn.addEventListener('click', () => supportLocationForDonor(location.firestoreId || location.id));
        actions.appendChild(supportBtn);
    }

    card.appendChild(actions);
    return card;
}

function initializePinnedLocationsList() {
    const pinnedListContent = document.getElementById('pinnedListContent');
    const searchInput = document.getElementById('pinnedSearchInput');

    if (!pinnedListContent) {
        return;
    }

    // Get current search query
    currentSearchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Clear existing content
    pinnedListContent.innerHTML = '';

    // Reset pagination
    currentPage = 0;
    loadedItems = [];
    hasMoreItems = true;

    // Filter and sort all locations
    prepareFilteredLocations();

    // Load first batch
    loadMorePinnedLocations();

    // Setup infinite scroll
    setupInfiniteScroll();
}

function prepareFilteredLocations() {
    const locationsForView = getLocationsForView();

    if (locationsForView.length === 0) {
        allFilteredLocations = [];
        return;
    }

    // Filter locations based on search and urgency
    allFilteredLocations = locationsForView.filter(location => {
        // Search filter - enhanced to include location-based search
        const peopleCountMatch =
            location.peopleCount !== undefined &&
            location.peopleCount !== null &&
            String(location.peopleCount).includes(currentSearchQuery);
        const matchesSearch = !currentSearchQuery ||
            location.locationName?.toLowerCase().includes(currentSearchQuery) ||
            location.reliefNeeds.some(need => need.toLowerCase().includes(currentSearchQuery)) ||
            location.additionalInfo?.toLowerCase().includes(currentSearchQuery) ||
            peopleCountMatch ||
            isLocationNearCity(location, currentSearchQuery);

        // Urgency filter
        const matchesUrgency = currentUrgencyFilter === 'all' ||
            location.urgency === currentUrgencyFilter;

        return matchesSearch && matchesUrgency;
    });

    // Sort filtered locations by urgency and date
    allFilteredLocations.sort((a, b) => {
        const urgencyOrder = { 'critical': 3, 'urgent': 2, 'moderate': 1 };
        const urgencyA = urgencyOrder[a.urgency] || 0;
        const urgencyB = urgencyOrder[b.urgency] || 0;

        if (urgencyA !== urgencyB) {
            return urgencyB - urgencyA; // Higher urgency first
        }

        // If same urgency, sort by date (newest first)
        return new Date(b.reportedAt) - new Date(a.reportedAt);
    });

    // Update map markers to show only filtered locations
    updateMapMarkersWithFilter(allFilteredLocations);
}

function loadMorePinnedLocations() {
    if (isLoading || !hasMoreItems) return;

    isLoading = true;
    const pinnedListContent = document.getElementById('pinnedListContent');

    if (!pinnedListContent) {
        isLoading = false;
        return;
    }

    // Show loading indicator if not first load
    if (currentPage > 0) {
        showLoadingIndicator();
    }

    // Load items instantly (no delay needed for local data)
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const newItems = allFilteredLocations.slice(startIndex, endIndex);

    if (newItems.length === 0) {
        hasMoreItems = false;
        hideLoadingIndicator();

        // Show no results message if first page and no items
        if (currentPage === 0) {
            const hasFilters = currentSearchQuery || currentUrgencyFilter !== 'all';
            const noResultsMsg = isReachedViewActive
                ? (hasFilters
                    ? 'No reached locations match your search criteria.'
                    : 'No reached locations yet. Pins turn green once a team confirms arrival.')
                : (hasFilters
                    ? 'No unreached locations match your search criteria.'
                    : 'No unreached locations yet. Click "Report Location" to add one.');
            pinnedListContent.innerHTML = `<p class="no-pins">${noResultsMsg}</p>`;
        }

        isLoading = false;
        return;
    }

    // Add new items to loaded items array
    loadedItems.push(...newItems);

    // Render new items
    newItems.forEach((location, index) => {
        const listItem = createPinnedLocationItem(location, startIndex + index);
        pinnedListContent.appendChild(listItem);
    });

    // Check if we have more items
    if (endIndex >= allFilteredLocations.length) {
        hasMoreItems = false;
    }

    currentPage++;
    isLoading = false;
    hideLoadingIndicator();
}

function createPinnedLocationItem(location, index) {
    const urgencyColor = getUrgencyColor(location.urgency);
    const urgencyText = location.urgency
        ? location.urgency.charAt(0).toUpperCase() + location.urgency.slice(1)
        : 'Unknown';

    const listItem = document.createElement('div');
    listItem.className = 'pinned-item';
    listItem.onclick = () => {
        const targetLatLng = L.latLng(location.coords[0], location.coords[1]);
        const newLatLng = centerPopupOnScreen(targetLatLng, {
            zoom: 15,
            offsetMultiplier: 1.2
        });

        // Set view with centering offset
        map.setView(newLatLng, 15, {
            animate: true,
            duration: 0.5,
            easeLinearity: 0.25
        });

        // Find and open the marker popup after a short delay
        setTimeout(() => {
            markerLayers.userReported.eachLayer((layer) => {
                if (layer.getLatLng().lat === location.coords[0] &&
                    layer.getLatLng().lng === location.coords[1]) {
                    layer.openPopup();
                }
            });
        }, 300);

        // Hide the dropdown
        hidePinnedLocationsList();
    };

    // Bold search terms without adding spaces
    let displayName = location.name;
    if (currentSearchQuery) {
        const regex = new RegExp(`(${currentSearchQuery})`, 'gi');
        displayName = displayName.replace(regex, '<strong>$1</strong>');
    }

    listItem.innerHTML = `
        <div class="pinned-item-name" style="font-size: 0.9rem; font-weight: 600; color: #2c3e50; margin-bottom: 0.3rem;">${displayName}</div>
        <div class="pinned-item-details">
            <span class="pinned-item-urgency" style="background-color: ${urgencyColor};">${urgencyText}</span>
            <span class="pinned-item-source">${(location.source || 'unknown').toUpperCase()}</span>
            <span style="color: #666; font-size: 0.8rem;">${new Date(location.reportedAt).toLocaleDateString()}</span>
        </div>
        <div class="pinned-item-needs">${location.reliefNeeds.join(', ')}</div>
        <div class="pinned-item-coords" style="font-family: monospace; font-size: 0.75rem; color: #6c757d; margin-top: 0.25rem;">
            <i class="fas fa-map-pin" style="font-size: 0.7rem;"></i> ${location.coords[0].toFixed(6)}, ${location.coords[1].toFixed(6)}
        </div>
        <div class="pinned-item-actions" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; justify-content: flex-start;">
            <button class="waze-btn" onclick="event.stopPropagation(); openWazeNavigation(${location.coords[0]}, ${location.coords[1]}, '${location.name.replace(/'/g, "\\'")}');">
                <i class="fas fa-route"></i>
                Navigate with Waze
            </button>
            <button class="google-maps-btn" onclick="event.stopPropagation(); openGoogleMapsNavigation(${location.coords[0]}, ${location.coords[1]}, '${location.name.replace(/'/g, "\\'")}');">
                <i class="fas fa-map-marked-alt"></i>
                Google Maps
            </button>
        </div>
    `;

    return listItem;
}

function setupInfiniteScroll() {
    const pinnedListContent = document.getElementById('pinnedListContent');

    // Remove existing scroll listener if any
    pinnedListContent.removeEventListener('scroll', handleScroll);

    // Add new scroll listener
    pinnedListContent.addEventListener('scroll', handleScroll);
}

function handleScroll(e) {
    const container = e.target;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Load more when user scrolls to within 100px of bottom
    if (scrollTop + clientHeight >= scrollHeight - 100) {
        loadMorePinnedLocations();
    }
}

function showLoadingIndicator() {
    const pinnedListContent = document.getElementById('pinnedListContent');
    let loadingDiv = document.getElementById('loading-indicator');

    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = `
            <div style="text-align: center; padding: 1rem; color: #666;">
                <i class="fas fa-spinner fa-spin"></i> Loading more locations...
            </div>
        `;
    }

    pinnedListContent.appendChild(loadingDiv);
}

function hideLoadingIndicator() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function filterPinnedLocations() {
    // If list is visible, reinitialize with new filters
    const pinnedList = document.getElementById('pinnedLocationsList');
    if (pinnedList && pinnedList.style.display === 'block') {
        initializePinnedLocationsList();
    }
}

// Lazy loading optimization complete

function handleUrgencyFilter(e) {
    // Remove active class from all filters
    document.querySelectorAll('.urgency-filter').forEach(filter => {
        filter.classList.remove('active');
    });

    // Add active class to clicked filter
    e.target.closest('.urgency-filter').classList.add('active');

    // Update current filter
    currentUrgencyFilter = e.target.closest('.urgency-filter').dataset.urgency;

    // Apply filter to both pinned list and map markers
    filterPinnedLocations();
}

// Function to filter markers on the map based on urgency level and search query
function updateMapMarkersWithFilter(filteredLocations) {
    // Clear all existing markers
    markerLayers.userReported.clearLayers();

    // Add filtered markers back to the map
    filteredLocations.forEach(report => {
        addUserReportedMarker(report);
    });
}

// Lazy loading optimization implementation complete

function handleUrgencyFilter(e) {
    // Remove active class from all filters
    document.querySelectorAll('.urgency-filter').forEach(filter => {
        filter.classList.remove('active');
    });

    // Add active class to clicked filter
    e.target.closest('.urgency-filter').classList.add('active');

    // Update current filter
    currentUrgencyFilter = e.target.closest('.urgency-filter').dataset.urgency;

    // Apply filter to both pinned list and map markers
    filterPinnedLocations();
}

function handleUrgencyFilter(e) {
    // Remove active class from all filters
    document.querySelectorAll('.urgency-filter').forEach(filter => {
        filter.classList.remove('active');
    });

    // Add active class to clicked filter
    e.target.closest('.urgency-filter').classList.add('active');

    // Update current filter
    currentUrgencyFilter = e.target.closest('.urgency-filter').dataset.urgency;

    // Apply filter to both pinned list and map markers
    filterPinnedLocations();
}

// Function to filter markers on the map based on urgency level and search query
function filterMapMarkers() {
    // Clear all existing markers
    markerLayers.userReported.clearLayers();

    // Add back only markers that match both urgency and search filters
    userReportedLocations.forEach(report => {
        // Check urgency filter
        const matchesUrgency = currentUrgencyFilter === 'all' ||
            report.urgencyLevel === currentUrgencyFilter;

        // Check search filter
        const peopleCountMatch =
            report.peopleCount !== undefined &&
            report.peopleCount !== null &&
            String(report.peopleCount).includes(currentSearchQuery);
        const matchesSearch = !currentSearchQuery ||
            (report.locationName || report.name || '').toLowerCase().includes(currentSearchQuery) ||
            report.reliefNeeds.some(need => need.toLowerCase().includes(currentSearchQuery)) ||
            report.additionalInfo?.toLowerCase().includes(currentSearchQuery) ||
            peopleCountMatch ||
            isLocationNearCity(report, currentSearchQuery);

        // Only add marker if it matches both filters
        if (matchesUrgency && matchesSearch) {
            addUserReportedMarkerToMap(report);
        }
    });
}

// Helper function to check if location is near a place based on search query
function isLocationNearCity(location, searchQuery) {
    if (!searchQuery) return false;

    const query = searchQuery.toLowerCase().trim();

    // First, check if the location name contains the search term
    if (location.name.toLowerCase().includes(query)) {
        return true;
    }

    // Common Marilao/Bulacan cities and barangays with coordinates
    const marilaoPlaces = {
        'marilao': { lat: 14.7578, lng: 120.9483, radius: 6 },
        'meycauayan': { lat: 14.7366, lng: 120.9602, radius: 6 },
        'bocaue': { lat: 14.7981, lng: 120.9265, radius: 6 },
        'santa maria': { lat: 14.8184, lng: 120.9783, radius: 8 },
        'sta. maria': { lat: 14.8184, lng: 120.9783, radius: 8 },
        'balagtas': { lat: 14.8167, lng: 120.8667, radius: 8 },
        'guiguinto': { lat: 14.8337, lng: 120.8831, radius: 8 },
        'obando': { lat: 14.7099, lng: 120.9369, radius: 6 },
        'loma de gato': { lat: 14.8088, lng: 120.9674, radius: 4 },
        'pren 1': { lat: 14.8040, lng: 120.9430, radius: 3 },
        'prenza 1': { lat: 14.8040, lng: 120.9430, radius: 3 },
        'prenza 2': { lat: 14.7960, lng: 120.9485, radius: 3 },
        'prenza i': { lat: 14.8015, lng: 120.9495, radius: 3 },
        'prenza ii': { lat: 14.7895, lng: 120.9490, radius: 3 },
        'lambakin': { lat: 14.7716, lng: 120.9512, radius: 3 },
        'patubig': { lat: 14.7512, lng: 120.9401, radius: 3 },
        'ibayo': { lat: 14.7569, lng: 120.9557, radius: 3 },
        'saog': { lat: 14.7434, lng: 120.9556, radius: 3 },
        'lias': { lat: 14.7446, lng: 120.9727, radius: 3 },
        'tabing ilog': { lat: 14.7615, lng: 120.9290, radius: 3 },
        'abangan norte': { lat: 14.7645, lng: 120.9435, radius: 3 },
        'abangan sur': { lat: 14.7590, lng: 120.9460, radius: 3 },
        'santa rosa i': { lat: 14.7958, lng: 120.9556, radius: 3 },
        'santa rosa ii': { lat: 14.7922, lng: 120.9523, radius: 3 },
        'poblacion 1': { lat: 14.7585, lng: 120.9515, radius: 2 },
        'poblacion 2': { lat: 14.7572, lng: 120.9501, radius: 2 },
        'nagbalon': { lat: 14.7485, lng: 120.9380, radius: 3 },
        'philippine arena': { lat: 14.7949, lng: 120.9551, radius: 2 },
        'sm marilao': { lat: 14.7589, lng: 120.9488, radius: 2 },
        'nlex': { lat: 14.7672, lng: 120.9636, radius: 2 }
    };

    // Check if search query matches any known place
    const place = marilaoPlaces[query];

    if (place) {
        // Calculate distance between location and place center
        const distance = calculateDistance(
            location.coords[0], location.coords[1],
            place.lat, place.lng
        );

        // Return true if location is within place radius
        return distance <= place.radius;
    }

    // Enhanced proximity search: check if any existing location names contain the search term
    // and if so, find locations near those matching locations
    const matchingLocations = userReportedLocations.filter(loc =>
        loc.name.toLowerCase().includes(query) && loc !== location
    );

    if (matchingLocations.length > 0) {
        // Check if current location is within 5km of any matching location
        return matchingLocations.some(matchingLoc => {
            const distance = calculateDistance(
                location.coords[0], location.coords[1],
                matchingLoc.coords[0], matchingLoc.coords[1]
            );
            return distance <= 5; // 5km radius for proximity
        });
    }

    // Enhanced text matching for partial place names
    const locationParts = location.name.toLowerCase().split(/[\s,.-]+/);
    const queryParts = query.split(/[\s,.-]+/);

    // Check if any part of the query matches any part of the location name
    return queryParts.some(queryPart =>
        queryPart.length >= 3 && // Only consider parts with 3+ characters
        locationParts.some(locPart =>
            locPart.includes(queryPart) || queryPart.includes(locPart)
        )
    );
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Helper function to update map markers with filtered locations
function updateMapMarkersWithFilter(filteredLocations) {
    // Clear all existing markers
    markerLayers.userReported.clearLayers();

    // Add markers for filtered locations
    filteredLocations.forEach(report => {
        addUserReportedMarkerToMap(report);
    });
}

// Function to filter pins based on main search location
function filterPinsBySearchLocation(searchCoords, searchDisplayName) {
    // Clear all existing markers
    markerLayers.userReported.clearLayers();

    // Define search radius (in kilometers)
    const searchRadius = 10; // 10km radius around searched location

    // Filter locations based on proximity to searched location
    const nearbyLocations = userReportedLocations.filter(report => {
        const distance = calculateDistance(
            searchCoords[0], searchCoords[1],
            report.coords[0], report.coords[1]
        );
        return distance <= searchRadius;
    });

    // Add markers for nearby locations
    nearbyLocations.forEach(report => {
        addUserReportedMarkerToMap(report);
    });

    // Show notification about filtering
    const pinCount = nearbyLocations.length;
    const totalPins = userReportedLocations.length;

    if (pinCount < totalPins) {
        showFilterNotification(`Showing ${pinCount} of ${totalPins} pins within ${searchRadius}km of "${searchDisplayName}"`);
    }
}

// Function to restore all pins (clear main search filter)
function restoreAllPins() {
    // Clear all existing markers
    markerLayers.userReported.clearLayers();

    // Add all markers back (respecting pinned location filters if active)
    if (currentSearchQuery || currentUrgencyFilter !== 'all') {
        // If pinned location filters are active, use those
        filterPinnedLocations();
    } else {
        // Otherwise, show all pins
        userReportedLocations.forEach(report => {
            addUserReportedMarkerToMap(report);
        });
    }

    // Hide filter notification
    hideFilterNotification();
}

// Function to show filter notification
function showFilterNotification(message) {
    // Remove existing notification if any
    hideFilterNotification();

    const notification = document.createElement('div');
    notification.id = 'searchFilterNotification';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 123, 255, 0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        z-index: 2000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        
    `;
    notification.innerHTML = `
        <i class="fas fa-filter"></i> ${message}
        <button onclick="clearSearchResult()" style="background: none; border: none; color: white; margin-left: 8px; cursor: pointer;">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);
}

// Function to hide filter notification
function hideFilterNotification() {
    const notification = document.getElementById('searchFilterNotification');
    if (notification) {
        notification.remove();
    }
}

// Function to filter pins in real-time based on search query
function filterPinsRealTime(query) {
    if (!query || query.length < 2) {
        // If query is too short, restore all pins
        restoreAllPins();
        return;
    }

    // Clear all existing markers
    markerLayers.userReported.clearLayers();

    const queryLower = query.toLowerCase().trim();

    // Filter locations based on multiple criteria
    const matchingLocations = userReportedLocations.filter(report => {
        // Text-based matching (name, relief needs, additional info)
        const nameMatch = (report.locationName || report.name || '').toLowerCase().includes(queryLower);
        const reliefMatch = report.reliefNeeds.some(need =>
            need.toLowerCase().includes(queryLower)
        );
        const infoMatch = report.additionalInfo?.toLowerCase().includes(queryLower);
        const peopleCountMatch =
            report.peopleCount !== undefined &&
            report.peopleCount !== null &&
            String(report.peopleCount).includes(queryLower);

        // Location-based matching using existing function
        const locationMatch = isLocationNearCity(report, queryLower);

        return nameMatch || reliefMatch || infoMatch || peopleCountMatch || locationMatch;
    });

    // Add markers for matching locations
    matchingLocations.forEach(report => {
        addUserReportedMarkerToMap(report);
    });

    // Show real-time filter notification
    const pinCount = matchingLocations.length;
    const totalPins = userReportedLocations.length;

    if (pinCount < totalPins && pinCount > 0) {
        showRealTimeFilterNotification(`Showing ${pinCount} of ${totalPins} pins matching "${query}"`);
    } else if (pinCount === 0) {
        showRealTimeFilterNotification(`No pins match "${query}"`);
    } else {
        hideFilterNotification();
    }
}

// Function to show real-time filter notification (different style from location-based)
function showRealTimeFilterNotification(message) {
    // Remove existing notification if any
    hideFilterNotification();

    const notification = document.createElement('div');
    notification.id = 'searchFilterNotification';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(40, 167, 69, 0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        z-index: 2000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
     
    `;
    notification.innerHTML = `
        <i class="fas fa-search"></i> ${message}
        <button onclick="clearRealTimeSearch()" style="background: none; border: none; color: white; margin-left: 8px; cursor: pointer;" title="Clear search">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);
}

// Function to clear real-time search
function clearRealTimeSearch() {
    const searchInput = document.getElementById('searchLocation');
    if (searchInput) {
        searchInput.value = '';
        // Trigger input event to clear filters
        searchInput.dispatchEvent(new Event('input'));
    }
}

// Global variable to store uploaded images (for current form session)
let uploadedImages = [];

// Global variable to store all images from loaded locations (for persistence)
let allLocationImages = new Map(); // locationId -> images array

// Image compression function to reduce file size for Firestore storage
function compressImage(file, callback, maxWidth = 800, maxHeight = 600, quality = 0.8) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = function () {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;

        if (width > height) {
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Check if compression was effective (base64 should be under 500KB for Firestore)
        const sizeInBytes = Math.round(compressedDataUrl.length * 0.75);
        const maxSizeBytes = 500 * 1024; // 500KB limit for Firestore documents

        if (sizeInBytes > maxSizeBytes) {
            // Further compress if still too large
            const newQuality = Math.max(0.3, quality * 0.7);
            if (newQuality < quality) {
                compressImage(file, callback, maxWidth * 0.8, maxHeight * 0.8, newQuality);
                return;
            }
        }

        callback(compressedDataUrl);
    };

    img.onerror = function () {
        // Fallback to original file if compression fails
        const reader = new FileReader();
        reader.onload = function (event) {
            callback(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    // Load image
    const reader = new FileReader();
    reader.onload = function (event) {
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Image upload functionality
function setupImageUpload() {
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');

    if (!imageUploadBtn || !imageUpload || !imagePreview) {
        return;
    }

    // Click handler for upload button
    imageUploadBtn.addEventListener('click', () => {
        imageUpload.click();
    });

    // File selection handler
    imageUpload.addEventListener('change', handleImageSelection);
}

function handleImageSelection(e) {
    const files = Array.from(e.target.files);
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const maxImages = 5;

    files.forEach(file => {
        // Check file size
        if (file.size > maxFileSize) {
            alert(`File "${file.name}" is too large. Maximum size is 5MB.`);
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            alert(`File "${file.name}" is not an image.`);
            return;
        }

        // Check maximum number of images
        if (uploadedImages.length >= maxImages) {
            alert(`Maximum ${maxImages} images allowed.`);
            return;
        }

        // Compress and convert to base64
        compressImage(file, (compressedDataUrl) => {
            const imageData = {
                id: Date.now() + Math.random(),
                name: file.name,
                data: compressedDataUrl,
                size: file.size,
                compressedSize: Math.round(compressedDataUrl.length * 0.75) // Estimate compressed size
            };

            uploadedImages.push(imageData);
            updateImagePreview();
        });
    });

    // Clear the input so the same file can be selected again
    e.target.value = '';
}

function updateImagePreview() {
    const imagePreview = document.getElementById('imagePreview');

    if (!imagePreview) {
        return;
    }

    imagePreview.innerHTML = '';

    uploadedImages.forEach(image => {
        const previewItem = document.createElement('div');
        previewItem.className = 'image-preview-item';
        previewItem.innerHTML = `
            <img src="${image.data}" alt="${image.name}" title="${image.name}">
            <button type="button" class="image-remove-btn" onclick="removeImage('${image.id}')" title="Remove image">
                <i class="fas fa-times"></i>
            </button>
        `;
        imagePreview.appendChild(previewItem);
    });
}

function removeImage(imageId) {
    uploadedImages = uploadedImages.filter(img => img.id != imageId);
    updateImagePreview();
}

function clearUploadedImages() {
    uploadedImages = [];
    updateImagePreview();
}

// Function to create image gallery for popups
function createImageGallery(images, locationId, report) {
    // First try to get images from the cached data (for persistence after refresh)
    let actualImages = images;
    const cachedImages = allLocationImages.get(locationId || report.id || report.firestoreId);

    if (cachedImages && cachedImages.length > 0) {
        actualImages = cachedImages;
    } else if (images && images.length > 0) {
        actualImages = images;
    } else {
        actualImages = [];
    }



    const imageItems = actualImages && actualImages.length > 0 ? actualImages.map((image, index) => {

        return `
        <div class="popup-image-item" onclick="openImageModal('${image.data}', '${image.name}', '${report.locationName || report.name || 'Location'}', '${report.urgencyLevel || report.urgency || ''}', '${report.reliefNeeds.join(', ')}', '${new Date(report.reportedAt).toLocaleDateString()}')">
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
        <div class="popup-images" id="popupImages-${locationId}">
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
        const urgencyColor = getUrgencyColor(urgencyLevel || '');

        modalDetails.innerHTML = `
            <h4><i class="fa-solid fa-image"></i>${imageName}</h4>
            
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




// Helper function to update location in storage
async function updateLocationInStorage(location) {
    // Update in Firebase if available
    if (window.firestoreDb && location.firestoreId) {
        try {
            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            const locationRef = doc(window.firestoreDb, 'userReportedLocations', location.firestoreId);
            await updateDoc(locationRef, {
                images: location.images,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.warn('Firebase update failed, updating localStorage only:', error);
        }
    }

    // Always update localStorage as backup
    localStorage.setItem('userReportedLocations', JSON.stringify(userReportedLocations));
}

// Helper function to refresh map markers
function refreshMapMarkers() {
    // Clear existing markers
    markerLayers.userReported.clearLayers();

    // Re-add all markers with updated data
    userReportedLocations.forEach(report => {
        addUserReportedMarker(report);
    });
}

// Helper function to add marker to map without checking filters
function addUserReportedMarkerToMap(report) {
    // If location is reached, use green color; otherwise use urgency color
    const statusData = getResponseStatusData(report);
    const isReached = statusData.isReached;
    const isOnTheWay = statusData.isOnTheWay;
    const markerColor = isReached
        ? '#28a745'
        : (isOnTheWay ? '#1d4ed8' : getUrgencyColor(report.urgencyLevel));
    const badgeText = isReached ? '✓' : (isOnTheWay ? 'O' : 'U');
    const badgeColor = isReached ? '#28a745' : (isOnTheWay ? '#1d4ed8' : '#17a2b8');

    const icon = L.divIcon({
        className: 'user-reported-marker',
        html: `
            <div style="position: relative;">
                <i class="fas fa-map-marker-alt" style="color: ${markerColor}; font-size: 18px;"></i>
                <div class="user-reported-badge" style="background-color: ${badgeColor};">${badgeText}</div>
            </div>
        `,
        iconSize: [25, 25],
        iconAnchor: [12, 25]
    });

    const marker = L.marker(report.coords, { icon })
        .bindPopup(createUserReportPopup(report));

    // Add click event to center popup on screen
    marker.on('click', function (e) {
        const targetZoom = Math.max(map.getZoom(), 15);

        const newLatLng = centerPopupOnScreen(e.latlng, {
            offsetMultiplier: 1.2,
            zoom: targetZoom
        });

        map.setView(newLatLng, targetZoom, {
            animate: true,
            duration: 0.5,
            easeLinearity: 0.25
        });

        if (isSupportModeActive) {
            const identifier = report.firestoreId || report.id;
            if (identifier && !statusData.isReached && !statusData.isOnTheWay) {
                supportLocationForDonor(identifier);
            }
        }
    });

    markerLayers.userReported.addLayer(marker);
}

// Helper function to remove marker from all layers
function removeMarkerFromLayers(coords) {
    markerLayers.userReported.eachLayer(marker => {
        const markerCoords = marker.getLatLng();
        // Check if coordinates match (with small tolerance for floating point comparison)
        if (Math.abs(markerCoords.lat - coords[0]) < 0.0001 &&
            Math.abs(markerCoords.lng - coords[1]) < 0.0001) {
            markerLayers.userReported.removeLayer(marker);
        }
    });
}

// Function to open Waze navigation
function openWazeNavigation(lat, lng, locationName) {
    // Waze deep link format: https://waze.com/ul?ll=lat,lng&navigate=yes&zoom=17
    const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes&zoom=17`;

    // Try to open Waze app first, fallback to web version
    const wazeAppUrl = `waze://?ll=${lat},${lng}&navigate=yes`;

    // Create a temporary link to test if Waze app is available
    const tempLink = document.createElement('a');
    tempLink.href = wazeAppUrl;
    tempLink.style.display = 'none';
    document.body.appendChild(tempLink);

    // Try to open the app
    try {
        tempLink.click();
        // If app doesn't open within 2 seconds, open web version
        setTimeout(() => {
            window.open(wazeUrl, '_blank');
        }, 2000);
    } catch (error) {
        // Fallback to web version
        window.open(wazeUrl, '_blank');
    } finally {
        document.body.removeChild(tempLink);
    }

}

// Function to open Google Maps navigation
function openGoogleMapsNavigation(lat, lng, locationName) {
    // Google Maps navigation URL format
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    // Try to open Google Maps app first (on mobile), fallback to web version
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        // Try Google Maps app URL scheme
        const googleMapsAppUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;

        // Create a temporary link to test if Google Maps app is available
        const tempLink = document.createElement('a');
        tempLink.href = googleMapsAppUrl;
        tempLink.style.display = 'none';
        document.body.appendChild(tempLink);

        try {
            tempLink.click();
            // If app doesn't open within 2 seconds, open web version
            setTimeout(() => {
                window.open(googleMapsUrl, '_blank');
            }, 2000);
        } catch (error) {
            // Fallback to web version
            window.open(googleMapsUrl, '_blank');
        } finally {
            document.body.removeChild(tempLink);
        }
    } else {
        // Desktop - open web version directly
        window.open(googleMapsUrl, '_blank');
    }
}

// Welcome Guide Functions
function showWelcomeGuide() {
    const welcomeGuide = document.getElementById('welcomeGuide');
    if (welcomeGuide) {
        welcomeGuide.classList.add('show');
        // Disable interaction with the rest of the page
        document.body.style.overflow = 'hidden';
    }
}

function hideWelcomeGuide() {
    const welcomeGuide = document.getElementById('welcomeGuide');
    if (welcomeGuide) {
        welcomeGuide.classList.remove('show');
        // Re-enable interaction with the rest of the page
        document.body.style.overflow = 'auto';
        // Mark as completed so it doesn't show again
        localStorage.setItem('welcomeGuideCompleted', 'true');
        localStorage.setItem('welcomeGuideCompletedDate', new Date().toISOString());
    }
}

function shouldShowWelcomeGuide() {
    // Check if user has completed the welcome guide before
    const completed = localStorage.getItem('welcomeGuideCompleted');

    // Only show if user has NOT completed it yet
    return !completed;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Set initial status
    updateSyncStatus('connecting', 'Connecting...');

    const storedGuestId = getStoredGuestId();
    if (storedGuestId) {
        if (!localStorage.getItem(GUEST_ACTIVITY_KEY)) {
            localStorage.setItem(GUEST_ACTIVITY_KEY, JSON.stringify([]));
        }
        updateDashboardTitle(storedGuestId);
    }

    // Wait a bit for Firebase to load
    setTimeout(async () => {
        await initMap();

        // Check for URL hash to zoom to specific location
        checkUrlHash();
    }, 1000);
});

function recenterActivePopup(options = {}) {
    if (!map || !activePopupLatLng) return;

    const defaults = {
        offsetMultiplier: 1.2,
        animate: true,
        duration: 0.35,
        easeLinearity: 0.25,
        zoom: map.getZoom()
    };
    const config = { ...defaults, ...options };

    const newLatLng = centerPopupOnScreen(activePopupLatLng, {
        offsetMultiplier: config.offsetMultiplier,
        zoom: config.zoom
    });

    map.panTo(newLatLng, {
        animate: config.animate,
        duration: config.duration,
        easeLinearity: config.easeLinearity
    });
}

// Helper function to center popup on screen
function centerPopupOnScreen(latlng, options = {}) {
    if (!map) return latlng;

    const defaults = {
        zoom: map.getZoom(),
        offsetMultiplier: 7.0,
        controlPanelHeight: 120
    };
    const config = { ...defaults, ...options };

    const mapHeight = map.getSize().y;

    // Much more aggressive upward positioning
    const point = map.project(latlng, config.zoom);
    // Push the marker way up - use a large negative offset
    point.y -= (mapHeight * 0.2) + (config.offsetMultiplier * 50);

    return map.unproject(point, config.zoom);
}

// Helper function to create collapsible text with read more button
function createCollapsibleText(text, maxLength = 150, uniqueId) {
    if (!text || text.length <= maxLength) {
        return text;
    }

    const shortText = text.substring(0, maxLength);
    const remainingText = text.substring(maxLength);

    return `
        <span id="shortText-${uniqueId}">${shortText}...</span>
        <span id="fullText-${uniqueId}" style="display: none;">${shortText}${remainingText}</span>
        <br>
        <button id="readMoreBtn-${uniqueId}" onclick="toggleReadMore('${uniqueId}')" 
                class="btn-read-more" 
                style="background: none; border: none; color: #007bff; cursor: pointer; font-size: 12px; padding: 2px 0; text-decoration: underline;">
            <i class="fas fa-chevron-down"></i> Read More
        </button>
    `;
}

// Function to toggle read more/less
function toggleReadMore(uniqueId) {
    const shortText = document.getElementById(`shortText-${uniqueId}`);
    const fullText = document.getElementById(`fullText-${uniqueId}`);
    const button = document.getElementById(`readMoreBtn-${uniqueId}`);

    if (shortText && fullText && button) {
        if (fullText.style.display === 'none') {
            // Show full text
            shortText.style.display = 'none';
            fullText.style.display = 'inline';
            button.innerHTML = '<i class="fas fa-chevron-up"></i> Read Less';
        } else {
            // Show short text
            shortText.style.display = 'inline';
            fullText.style.display = 'none';
            button.innerHTML = '<i class="fas fa-chevron-down"></i> Read More';
        }
    }
}

// Utility functions for external use
window.cancelReportingMode = cancelReportingMode;
window.removeUserReportedLocation = removeUserReportedLocation;
window.clearSearchResult = clearSearchResult;
window.pinHelpFromSearch = pinHelpFromSearch;
window.toggleReadMore = toggleReadMore;

// Debug functions for testing
window.testModalClose = function () {
    closeReportModal();
};

window.testModalOpen = function () {
    document.getElementById('reportModal').style.display = 'flex';
};

window.testSearchSuggestions = function () {
    const container = document.getElementById('searchSuggestions');
    if (container) {
        container.innerHTML = `
            <div class="suggestion-item">
                <div class="suggestion-main">
                    <i class="fas fa-city"></i>
                    Test Location
                </div>
                <div class="suggestion-address">Test Address, Cebu</div>
                <div class="suggestion-details">
                    <span class="suggestion-type">Test</span>
                </div>
            </div>
        `;
        container.classList.add('show');
    }
};

// Emergency bypass function - use this if form is stuck
window.forceLocalMode = function () {
    window.firestoreDb = null;
    db = null;
    updateSyncStatus('offline', '📱 Local Mode - Firebase bypassed');
    alert('Switched to local-only mode. Form submissions will work but won\'t sync across devices.');
};
// ========================================
// CHAT FUNCTIONALITY
// ========================================
// 
// 💬 OVERVIEW:
// This chat system allows users to communicate about specific relief locations.
// Each location pin has its own chat thread where users can discuss needs,
// coordinate help, and share updates.
//
// 🔥 FIREBASE SETUP:
// - Uses SEPARATE Firebase project for chat messages (firebase-chat-config.js)
// - Main Firebase handles user authentication and relief data
// - Chat Firebase handles only chat messages for better scalability
//
// 🔐 AUTHENTICATION:
// - Only authenticated users can send messages
// - Anonymous users can read messages but cannot participate
// - User type is determined: "Reporter" (original poster) or "Respondent"
//
// 📊 DATA STRUCTURE:
// Collection: 'location-chats'
// Document fields:
// - locationId: string (unique ID of the relief location)
// - message: string (chat message content)
// - userId: string (Firebase user ID)
// - userName: string (display name or email)
// - userType: string ("Reporter" or "Respondent")
// - timestamp: Firestore serverTimestamp
//
// 🔄 REAL-TIME SYNC:
// - Uses Firestore onSnapshot for live message updates
// - Messages appear instantly across all devices
// - Automatic scroll to newest messages
//
// ========================================

/**
 * Get current user name for chat (authenticated users only)
 * 
 * @returns {string|null} User's display name, email, or null if not authenticated
 * 
 * Checks authentication sources in order:
 * 1. Main Firebase Auth (window.firebaseAuth)
 * 2. Chat Firebase Auth (window.firebaseChatAuth) 
 * 3. Local storage user data (simple auth fallback)
 * 
 * Returns null for anonymous users to prevent chat participation
 */
function getCurrentUserName() {
    // Check main Firebase auth first
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        return window.firebaseAuth.currentUser.displayName || window.firebaseAuth.currentUser.email;
    }

    // Check chat Firebase auth
    if (window.firebaseChatAuth && window.firebaseChatAuth.currentUser) {
        return window.firebaseChatAuth.currentUser.displayName || window.firebaseChatAuth.currentUser.email;
    }

    // Check simple auth
    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            return user.name || user.email;
        } catch (e) {
            console.warn('Error parsing user data:', e);
        }
    }

    // No anonymous users allowed for chat
    return null;
}

/**
 * Get current user ID for chat (authenticated users only)
 * 
 * @returns {string|null} User's unique Firebase UID or null if not authenticated
 * 
 * Checks authentication sources in order:
 * 1. Main Firebase Auth (window.firebaseAuth.currentUser.uid)
 * 2. Chat Firebase Auth (window.firebaseChatAuth.currentUser.uid)
 * 3. Local storage user data (simple auth fallback)
 * 
 * Used for:
 * - Message ownership verification
 * - Determining user type (Reporter vs Respondent)
 * - Authentication checks before sending messages
 */
function getCurrentUserId() {
    // Check main Firebase auth first
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        return window.firebaseAuth.currentUser.uid;
    }

    // Check chat Firebase auth
    if (window.firebaseChatAuth && window.firebaseChatAuth.currentUser) {
        return window.firebaseChatAuth.currentUser.uid;
    }

    // Check simple auth
    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            return user.id || user.email;
        } catch (e) {
            console.warn('Error parsing user data:', e);
        }
    }

    // No anonymous users allowed for chat
    return null;
}

/**
 * Toggle chat visibility for a specific location
 * 
 * @param {string} locationId - Unique identifier for the relief location
 * 
 * Toggles the display of:
 * - Chat messages container (chatContainer-{locationId})
 * - Chat input field (chatInputContainer-{locationId}) 
 * - Toggle icon (chatToggle-{locationId})
 * 
 * When opening chat:
 * - Loads messages from Firestore
 * - Sets up real-time listener for new messages
 * - Changes icon to up arrow
 * 
 * When closing chat:
 * - Hides chat interface
 * - Changes icon to down arrow
 * - Listener remains active for real-time updates
 */
function toggleChat(locationId) {
    const chatContainer = document.getElementById(`chatContainer-${locationId}`);
    const chatInputContainer = document.getElementById(`chatInputContainer-${locationId}`);
    const toggleIcon = document.getElementById(`chatToggle-${locationId}`);

    if (chatContainer && chatInputContainer && toggleIcon) {
        const isVisible = chatContainer.style.display !== 'none';
        chatContainer.style.display = isVisible ? 'none' : 'block';
        chatInputContainer.style.display = isVisible ? 'none' : 'flex';
        toggleIcon.className = isVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';

        // Load messages when opening chat
        if (!isVisible) {
            loadChatMessages(locationId);
        }
    }
}

/**
 * Handle keyboard input in chat input field
 * 
 * @param {KeyboardEvent} event - Keyboard event object
 * @param {string} locationId - Unique identifier for the relief location
 * 
 * Listens for Enter key press to send message
 * Prevents default form submission behavior
 */
function handleChatKeyPress(event, locationId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendChatMessage(locationId);
    }
}

/**
 * Send a chat message to a specific location's chat thread
 * 
 * @param {string} locationId - Unique identifier for the relief location
 * 
 * Process:
 * 1. Validates user authentication
 * 2. Gets message content from input field
 * 3. Determines user type (Reporter or Respondent)
 * 4. Saves message to Chat Firebase (firebase-chat-config.js)
 * 5. Clears input field
 * 6. Real-time listener automatically displays the message
 * 
 * Authentication required: Only logged-in users can send messages
 * Anonymous users see login prompt
 */
async function sendChatMessage(locationId) {
    const chatInput = document.getElementById(`chatInput-${locationId}`);
    const message = chatInput.value.trim();

    if (!message) return;

    let currentUser = getCurrentUserName();
    let currentUserId = getCurrentUserId();

    // Only authenticated users can send messages (guest fallback when enabled)
    if (!currentUser || !currentUserId) {
        const guestId = getStoredGuestId();
        if (guestId) {
            currentUser = guestId;
            currentUserId = guestId;
        } else {
            alert('Please sign in or start exploring as guest to send messages.');
            return;
        }
    }

    // Clear input immediately
    chatInput.value = '';

    const messageData = {
        locationId: locationId,
        message: message,
        userId: currentUserId,
        userName: currentUser,
        timestamp: new Date().toISOString(),
        userType: determineUserType(locationId, currentUserId)
    };

    try {
        // Save to Firestore - real-time listener will display the message
        await saveChatMessage(messageData);

        addGuestActivity({
            type: 'chat',
            locationId,
            locationName: getLocationNameById(locationId),
            message
        });

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
        // Restore the message in input if it failed
        chatInput.value = message;
    }
}

/**
 * Determine user type for chat message display
 * 
 * @param {string} locationId - Unique identifier for the relief location
 * @param {string} userId - Firebase UID of the current user
 * @returns {string} "Reporter" or "Respondent"
 * 
 * Logic:
 * - "Reporter": User who originally created/reported the location
 * - "Respondent": Any other authenticated user participating in chat
 * 
 * Used for:
 * - Message styling (different colors for Reporter vs Respondent)
 * - Icon display (different icons for each user type)
 * - UI differentiation in chat interface
 */
function determineUserType(locationId, userId) {
    // Find the location to check if user is the original reporter
    const location = userReportedLocations.find(loc =>
        (loc.firestoreId || loc.id) === locationId
    );

    if (location && location.userId === userId) {
        return 'Reporter';
    }

    return 'Respondent';
}

/**
 * Resolve the Firestore instance to use for chat writes/reads.
 *
 * Prefers the chat app when it has an authenticated user. Falls back to
 * the main app when the user is authenticated there (master admin flow).
 */
function getChatFirestore() {
    if (window.firestoreChatDb && window.firebaseChatAuth && window.firebaseChatAuth.currentUser) {
        return window.firestoreChatDb;
    }

    if (window.firestoreDb && window.firebaseAuth && window.firebaseAuth.currentUser) {
        return window.firestoreDb;
    }

    return window.firestoreChatDb || window.firestoreDb || null;
}

/**
 * Save chat message to Chat Firebase (authenticated users only)
 * 
 * @param {Object} messageData - Message object containing:
 *   - locationId: string (relief location ID)
 *   - message: string (message content)
 *   - userId: string (Firebase UID)
 *   - userName: string (display name or email)
 *   - userType: string ("Reporter" or "Respondent")
 *   - timestamp: string (ISO timestamp, will be replaced with serverTimestamp)
 * 
 * Process:
 * 1. Validates Chat Firebase connection (window.firestoreChatDb)
 * 2. Adds Firestore serverTimestamp for accurate ordering
 * 3. Saves to 'location-chats' collection in Chat Firebase
 * 4. Real-time listeners automatically update UI across all devices
 * 
 * Firebase Project: Uses firebase-chat-config.js (separate from main Firebase)
 * Collection: 'location-chats'
 * 
 * @throws {Error} If Chat Firebase not initialized or save fails
 */
async function saveChatMessage(messageData) {
    const chatDb = getChatFirestore();
    if (!chatDb) {
        console.error('Chat Firebase database not initialized');
        throw new Error('Database not available. Please refresh the page and try again.');
    }

    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        // Add server-side timestamp
        const messageWithTimestamp = {
            ...messageData,
            timestamp: serverTimestamp()
        };

        const docRef = await addDoc(collection(chatDb, 'location-chats'), messageWithTimestamp);
        console.log('Message saved to Firestore with ID:', docRef.id);
    } catch (error) {
        console.error('Error saving chat message:', error);
        throw new Error('Failed to send message. ' + (error.message || 'Please check your internet connection and try again.'));
    }
}

/**
 * Load and display chat messages for a specific location with real-time updates
 * 
 * @param {string} locationId - Unique identifier for the relief location
 * 
 * Features:
 * - Loads existing messages from Chat Firebase
 * - Sets up real-time listener for new messages (onSnapshot)
 * - Automatically updates UI when messages are added/changed
 * - Sorts messages by timestamp (oldest first)
 * - Auto-scrolls to newest messages
 * - Handles connection errors gracefully
 * 
 * Real-time Sync:
 * - Uses Firestore onSnapshot for live updates
 * - Messages appear instantly across all devices
 * - No manual refresh needed
 * 
 * Firebase Query:
 * - Collection: 'location-chats' 
 * - Filter: where('locationId', '==', locationId)
 * - Ordering handled client-side after fetch
 * 
 * UI Elements:
 * - Target: chatMessages-{locationId} container
 * - Shows loading state while connecting
 * - Displays "No messages yet" if empty
 * - Error handling with user-friendly messages
 */
async function loadChatMessages(locationId) {
    const messagesContainer = document.getElementById(`chatMessages-${locationId}`);
    if (!messagesContainer) return;

    try {
        const chatDb = getChatFirestore();
        if (!chatDb) {
            console.error('Chat Firebase database not initialized');
            messagesContainer.innerHTML = '<div style="text-align: center; color: #666; font-size: 12px; padding: 10px;">Chat unavailable - please refresh the page</div>';
            return;
        }

        const { collection, query, where, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        const chatQuery = query(
            collection(chatDb, 'location-chats'),
            where('locationId', '==', locationId)
        );

        // Clear existing messages
        messagesContainer.innerHTML = '<div style="text-align: center; color: #666; font-size: 12px; padding: 10px;">Loading messages...</div>';

        // Set up real-time listener for synchronized messages
        const unsubscribe = onSnapshot(chatQuery,
            (snapshot) => {
                const messages = [];
                let hasMessages = false;

                snapshot.forEach((doc) => {
                    const messageData = doc.data();
                    // Ensure we have required fields before adding
                    if (messageData.message && messageData.userName) {
                        // Add document ID for deletion functionality
                        messageData.messageId = doc.id;
                        messages.push(messageData);
                        hasMessages = true;
                    }
                });

                // Clear and update messages
                messagesContainer.innerHTML = '';

                if (!hasMessages) {
                    messagesContainer.innerHTML = '<div style="text-align: center; color: #666; font-size: 12px; padding: 10px;">No messages yet. Start the conversation!</div>';
                    return;
                }

                // Sort messages by timestamp just to be safe
                messages.sort((a, b) =>
                    getDateFromTimestamp(a.timestamp).getTime() -
                    getDateFromTimestamp(b.timestamp).getTime()
                );

                // Add messages to UI
                messages.forEach(message => {
                    addMessageToUI(locationId, message, false);
                });

                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            (error) => {
                console.error('Error in chat listener:', error);
                messagesContainer.innerHTML = '<div style="text-align: center; color: #dc3545; font-size: 12px; padding: 10px;">Error loading messages. Please refresh the page.</div>';
            }
        );

        // Store the unsubscribe function for cleanup
        if (!window.chatListeners) window.chatListeners = {};
        if (window.chatListeners[locationId]) {
            window.chatListeners[locationId](); // Unsubscribe previous listener
        }
        window.chatListeners[locationId] = unsubscribe;

    } catch (error) {
        console.error('Error initializing chat:', error);
        messagesContainer.innerHTML = '<div style="text-align: center; color: #dc3545; font-size: 12px; padding: 10px;">Failed to initialize chat. Please refresh the page.</div>';
    }
}


/**
 * Add a single chat message to the UI
 * 
 * @param {string} locationId - Unique identifier for the relief location
 * @param {Object} messageData - Message object from Firestore containing:
 *   - message: string (message content)
 *   - userName: string (sender's display name or email)
 *   - userType: string ("Reporter" or "Respondent")
 *   - timestamp: Firestore timestamp or ISO string
 * @param {boolean} scrollToBottom - Whether to auto-scroll to new message (default: true)
 * 
 * UI Features:
 * - Different styling for Reporter vs Respondent messages
 * - Color coding: Reporter (green), Respondent (blue)
 * - Icons: Reporter (edit icon), Respondent (users icon)
 * - Timestamp display (time + date)
 * - HTML escaping for security
 * - Auto-scroll to newest messages
 * 
 * Message Layout:
 * - Header: Icon + User Type + Timestamp
 * - Body: Message content (HTML escaped)
 * - Styling: Different colors based on user type
 * 
 * Called by:
 * - loadChatMessages() for each existing message
 * - Real-time listener when new messages arrive
 */
function addMessageToUI(locationId, messageData, scrollToBottom = true) {
    const messagesContainer = document.getElementById(`chatMessages-${locationId}`);
    if (!messagesContainer) return;

    // Remove loading/empty message if present
    const loadingMsg = messagesContainer.querySelector('.loading-messages');
    if (loadingMsg) loadingMsg.remove();

    const emptyMsg = messagesContainer.querySelector('div[style*="No messages yet"]');
    if (emptyMsg) emptyMsg.remove();

    // Convert timestamp to JavaScript Date
    const messageTimestamp = getDateFromTimestamp(messageData.timestamp);

    const messageTime = messageTimestamp.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    const messageDate = messageTimestamp.toLocaleDateString();

    const isReporter = messageData.userType === 'Reporter';
    const messageColor = isReporter ? '#28a745' : '#007bff';
    const messageIcon = isReporter ? 'fas fa-user-edit' : 'fas fa-user-friends';

    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.style.cssText = `
        margin-bottom: 8px;
        padding: 8px 10px;
        background: white;
        border-radius: 8px;
        border-left: 3px solid ${messageColor};
        font-size: 12px;
        line-height: 1.4;
    `;

    // Check if current user can unsend this message (only their own messages)
    const currentUserId = getCurrentUserId();
    const canDelete = Boolean(messageData.userId && currentUserId && messageData.userId === currentUserId);

    messageElement.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <i class="${messageIcon}" style="color: ${messageColor}; font-size: 10px;"></i>
                    <strong style="color: ${messageColor}; font-size: 11px;">${escapeHtml(messageData.userName || 'Anonymous')}</strong>
                </div>
                <span style="color: #888; font-size: 10px; margin-left: 15px;">${messageTime} ${messageDate}</span>
            </div>
            ${canDelete ? `<button onclick="deleteMessage('${locationId}', '${messageData.messageId || ''}')" 
                style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 2px; font-size: 12px; opacity: 0.7; transition: opacity 0.2s;" 
                onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" 
                title="Unsend message" aria-label="Unsend message"><i class="fa-solid fa-trash-can"></i></button>` : ''}
        </div>
        <div style="color: #333; margin-left: 15px;">${escapeHtml(messageData.message)}</div>
    `;

    messagesContainer.appendChild(messageElement);

    if (scrollToBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

// Utility function to convert Firestore timestamp to JavaScript Date
function getDateFromTimestamp(timestamp) {
    if (!timestamp) {
        return new Date(); // Fallback to current time
    }

    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        // Firestore timestamp object
        return timestamp.toDate();
    }

    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        // ISO string or Unix timestamp
        return new Date(timestamp);
    }

    // Fallback to current time
    return new Date();
}

/**
 * Delete a chat message (Reporter only - can delete their own messages)
 * 
 * @param {string} locationId - Unique identifier for the relief location
 * @param {string} messageId - Firestore document ID of the message to delete
 * 
 * Security:
 * - Only reporters can delete messages
 * - Users can only delete their own messages
 * - Confirmation dialog before deletion
 * - Real-time listener automatically updates UI
 */
async function deleteMessage(locationId, messageId) {
    if (!messageId) {
        console.error('No message ID provided for deletion');
        return;
    }

    // Confirm deletion
    const confirmed = await showChatDeleteConfirm();
    if (!confirmed) {
        return;
    }

    try {
        const chatDb = getChatFirestore();
        if (!chatDb) {
            throw new Error('Chat database not available');
        }

        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

        // Delete the message document
        await deleteDoc(doc(chatDb, 'location-chats', messageId));

        console.log('Message deleted successfully');

    } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message. Please try again.');
    }
}

// Make chat and photo functions globally available
window.toggleChat = toggleChat;
window.handleChatKeyPress = handleChatKeyPress;
window.sendChatMessage = sendChatMessage;
window.saveChatMessage = saveChatMessage;
window.loadChatMessages = loadChatMessages;
window.deleteMessage = deleteMessage;
window.togglePhotos = togglePhotos;

