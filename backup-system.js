// ========================================
// BACKUP & RESTORE SYSTEM
// ========================================
// Real-time backup to CSV/Excel with import functionality
// Prevents data loss if pins get deleted from Firebase

// Backup configuration
const BACKUP_CONFIG = {
    autoBackupInterval: 300000, // Auto-backup every 5 minutes (300,000 ms)
    maxLocalBackups: 10, // Keep last 10 backups in browser storage
    enableAutoBackup: true
};

// Auto-backup timer
let autoBackupTimer = null;

// Initialize backup system
function initBackupSystem() {
    console.log('📦 Initializing backup system...');
    
    // Start auto-backup if enabled
    if (BACKUP_CONFIG.enableAutoBackup) {
        startAutoBackup();
    }
    
    // Load backup history
    loadBackupHistory();
    
    // Set up event listeners for backup UI
    setupBackupEventListeners();
}

// ========================================
// EXPORT TO CSV/EXCEL
// ========================================

function exportToCSV() {
    try {
        if (!userReportedLocations || userReportedLocations.length === 0) {
            alert('No locations to export');
            return;
        }

        const csvData = convertToCSV(userReportedLocations);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `relief-map-backup-${timestamp}.csv`;
        
        downloadCSV(csvData, filename);
        
        // Save to backup history
        saveBackupToHistory('manual', userReportedLocations.length);
        
        console.log(`✅ Exported ${userReportedLocations.length} locations to ${filename}`);
        showNotification(`Successfully exported ${userReportedLocations.length} locations`, 'success');
        
    } catch (error) {
        console.error('❌ Export failed:', error);
        alert('Export failed: ' + error.message);
    }
}

function convertToCSV(locations) {
    // CSV Headers
    const headers = [
        'ID',
        'Name',
        'Latitude',
        'Longitude',
        'Urgency Level',
        'Relief Needs',
        'Source',
        'Reporter Name',
        'Reporter Contact',
        'Additional Info',
        'Timestamp',
        'Firestore ID'
    ];

    // Convert data to CSV rows
    const rows = locations.map(loc => {
        const reliefNeeds = Array.isArray(loc.reliefNeeds) ? loc.reliefNeeds.join('; ') : loc.reliefNeeds || '';
        const timestamp = loc.timestamp ? new Date(loc.timestamp).toISOString() : '';
        
        return [
            loc.id || '',
            escapeCSV(loc.name || ''),
            loc.coords[0] || '',
            loc.coords[1] || '',
            loc.urgencyLevel || '',
            escapeCSV(reliefNeeds),
            loc.source || '',
            escapeCSV(loc.reporterName || ''),
            escapeCSV(loc.reporterContact || ''),
            escapeCSV(loc.additionalInfo || ''),
            timestamp,
            loc.firestoreId || ''
        ];
    });

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
}

function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    
    const stringValue = String(value);
    
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (navigator.msSaveBlob) {
        // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// ========================================
// IMPORT FROM CSV/EXCEL
// ========================================

function importFromCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const csvContent = e.target.result;
                const locations = parseCSV(csvContent);
                
                console.log(`📥 Parsed ${locations.length} locations from CSV`);
                
                // Validate locations
                const validLocations = validateImportedLocations(locations);
                
                if (validLocations.length === 0) {
                    reject(new Error('No valid locations found in CSV'));
                    return;
                }
                
                // Show confirmation dialog
                const confirmed = await showImportConfirmation(validLocations.length);
                
                if (confirmed) {
                    await importLocationsToFirebase(validLocations);
                    resolve(validLocations.length);
                } else {
                    reject(new Error('Import cancelled by user'));
                }
                
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = function(error) {
            reject(error);
        };
        
        reader.readAsText(file);
    });
}

function parseCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid');
    }
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Parse data rows
    const locations = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        if (values.length < headers.length) continue; // Skip invalid rows
        
        const location = {
            id: values[0] || `imported-${Date.now()}-${i}`,
            name: values[1] || 'Imported Location',
            coords: [parseFloat(values[2]) || 0, parseFloat(values[3]) || 0],
            urgencyLevel: values[4] || 'moderate',
            reliefNeeds: values[5] ? values[5].split(';').map(n => n.trim()) : [],
            source: values[6] || 'imported',
            reporterName: values[7] || '',
            reporterContact: values[8] || '',
            additionalInfo: values[9] || '',
            timestamp: values[10] ? new Date(values[10]).getTime() : Date.now(),
            firestoreId: values[11] || null,
            imported: true,
            importDate: Date.now()
        };
        
        locations.push(location);
    }
    
    return locations;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add last field
    values.push(current.trim());
    
    return values;
}

function validateImportedLocations(locations) {
    return locations.filter(loc => {
        // Must have valid name
        if (!loc.name || loc.name.trim() === '') return false;
        
        // Must have valid coordinates
        if (!loc.coords || loc.coords.length !== 2) return false;
        if (isNaN(loc.coords[0]) || isNaN(loc.coords[1])) return false;
        
        // Coordinates must be within Northern Cebu bounds
        const [lat, lon] = loc.coords;
        if (lat < NORTHERN_CEBU_BOUNDS.south || lat > NORTHERN_CEBU_BOUNDS.north) return false;
        if (lon < NORTHERN_CEBU_BOUNDS.west || lon > NORTHERN_CEBU_BOUNDS.east) return false;
        
        // Must be on land, not water
        if (!isLocationOnLand(loc.coords)) return false;
        
        return true;
    });
}

async function showImportConfirmation(count) {
    return new Promise((resolve) => {
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 100003;
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
                max-width: 500px;
                width: 90%;
                text-align: center;
            ">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📥</div>
                <div style="
                    font-size: 1.2rem;
                    margin-bottom: 1rem;
                    color: #333;
                    font-weight: 600;
                ">Import Backup Data</div>
                <div style="
                    font-size: 1rem;
                    margin-bottom: 1.5rem;
                    color: #666;
                    line-height: 1.6;
                ">
                    <p><strong>${count} locations</strong> ready to import.</p>
                    <p style="margin-top: 0.5rem;">This will add these locations to the map. Existing locations will not be affected.</p>
                </div>
                <div style="
                    background: #fff3cd;
                    padding: 1rem;
                    border-radius: 5px;
                    margin-bottom: 1.5rem;
                    border-left: 4px solid #ffc107;
                    text-align: left;
                    font-size: 0.9rem;
                    color: #856404;
                ">
                    <strong>⚠️ Note:</strong> Imported locations will be synced to Firebase and visible to all users.
                </div>
                <div style="
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                ">
                    <button id="importCancel" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1rem;
                    ">Cancel</button>
                    <button id="importConfirm" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1rem;
                    ">Import Now</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        document.getElementById('importConfirm').onclick = () => {
            confirmModal.remove();
            resolve(true);
        };

        document.getElementById('importCancel').onclick = () => {
            confirmModal.remove();
            resolve(false);
        };

        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
                resolve(false);
            }
        };
    });
}

async function importLocationsToFirebase(locations) {
    let successCount = 0;
    let failCount = 0;

    // Show progress
    const progressModal = showProgressModal('Importing locations...', 0, locations.length);

    for (let i = 0; i < locations.length; i++) {
        try {
            // Remove firestoreId to create new document
            const locationData = { ...locations[i] };
            delete locationData.firestoreId;

            // Save to Firebase
            await saveLocationToFirestore(locationData);
            successCount++;

        } catch (error) {
            console.error(`Failed to import location ${locations[i].name}:`, error);
            failCount++;
        }

        // Update progress
        updateProgressModal(progressModal, i + 1, locations.length);
    }

    // Close progress modal
    setTimeout(() => {
        progressModal.remove();
        
        // Show result
        const message = `Import completed!\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`;
        showNotification(message, successCount > 0 ? 'success' : 'error');
        
    }, 500);
}

function showProgressModal(message, current, total) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 100004;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            padding: 2rem;
            border-radius: 8px;
            max-width: 400px;
            width: 90%;
            text-align: center;
        ">
            <div style="font-size: 2rem; margin-bottom: 1rem;">⏳</div>
            <div id="progressMessage" style="font-size: 1.1rem; margin-bottom: 1rem; color: #333;">${message}</div>
            <div style="
                background: #e9ecef;
                height: 20px;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 0.5rem;
            ">
                <div id="progressBar" style="
                    background: linear-gradient(90deg, #007bff, #0056b3);
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s;
                "></div>
            </div>
            <div id="progressText" style="font-size: 0.9rem; color: #666;">${current} / ${total}</div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

function updateProgressModal(modal, current, total) {
    const percentage = (current / total) * 100;
    const progressBar = modal.querySelector('#progressBar');
    const progressText = modal.querySelector('#progressText');
    
    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = `${current} / ${total}`;
}

// ========================================
// AUTO-BACKUP SYSTEM
// ========================================

function startAutoBackup() {
    stopAutoBackup(); // Clear any existing timer
    
    autoBackupTimer = setInterval(() => {
        if (userReportedLocations && userReportedLocations.length > 0) {
            performAutoBackup();
        }
    }, BACKUP_CONFIG.autoBackupInterval);
    
    console.log(`⏰ Auto-backup started (every ${BACKUP_CONFIG.autoBackupInterval / 60000} minutes)`);
}

function stopAutoBackup() {
    if (autoBackupTimer) {
        clearInterval(autoBackupTimer);
        autoBackupTimer = null;
    }
}

function performAutoBackup() {
    try {
        const backupData = {
            timestamp: Date.now(),
            locationCount: userReportedLocations.length,
            locations: userReportedLocations
        };
        
        // Save to localStorage
        saveBackupToLocalStorage(backupData);
        
        console.log(`💾 Auto-backup completed: ${userReportedLocations.length} locations`);
        
    } catch (error) {
        console.error('❌ Auto-backup failed:', error);
    }
}

function saveBackupToLocalStorage(backupData) {
    try {
        // Get existing backups
        const backups = JSON.parse(localStorage.getItem('reliefMapBackups') || '[]');
        
        // Add new backup
        backups.unshift(backupData);
        
        // Keep only last N backups
        const trimmedBackups = backups.slice(0, BACKUP_CONFIG.maxLocalBackups);
        
        // Save back
        localStorage.setItem('reliefMapBackups', JSON.stringify(trimmedBackups));
        
    } catch (error) {
        console.error('Failed to save backup to localStorage:', error);
    }
}

function getLocalBackups() {
    try {
        return JSON.parse(localStorage.getItem('reliefMapBackups') || '[]');
    } catch (error) {
        console.error('Failed to load backups:', error);
        return [];
    }
}

function restoreFromLocalBackup(backupIndex) {
    const backups = getLocalBackups();
    
    if (!backups[backupIndex]) {
        alert('Backup not found');
        return;
    }
    
    const backup = backups[backupIndex];
    const confirmed = confirm(`Restore ${backup.locationCount} locations from ${new Date(backup.timestamp).toLocaleString()}?`);
    
    if (confirmed) {
        importLocationsToFirebase(backup.locations);
    }
}

// ========================================
// BACKUP HISTORY
// ========================================

function saveBackupToHistory(type, count) {
    try {
        const history = JSON.parse(localStorage.getItem('backupHistory') || '[]');
        
        history.unshift({
            type: type, // 'manual' or 'auto'
            count: count,
            timestamp: Date.now()
        });
        
        // Keep last 50 entries
        localStorage.setItem('backupHistory', JSON.stringify(history.slice(0, 50)));
        
    } catch (error) {
        console.error('Failed to save backup history:', error);
    }
}

function loadBackupHistory() {
    try {
        return JSON.parse(localStorage.getItem('backupHistory') || '[]');
    } catch (error) {
        console.error('Failed to load backup history:', error);
        return [];
    }
}

// ========================================
// UI EVENT LISTENERS
// ========================================

function setupBackupEventListeners() {
    // Export button
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    // Import button
    const importBtn = document.getElementById('importDataBtn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });
    }
    
    // File input
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const count = await importFromCSV(file);
                    console.log(`✅ Imported ${count} locations`);
                } catch (error) {
                    console.error('❌ Import failed:', error);
                    alert('Import failed: ' + error.message);
                }
                // Reset input
                e.target.value = '';
            }
        });
    }
}

// Notification helper
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 100005;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        white-space: pre-line;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Make functions available globally
window.exportToCSV = exportToCSV;
window.importFromCSV = importFromCSV;
window.restoreFromLocalBackup = restoreFromLocalBackup;
window.initBackupSystem = initBackupSystem;

console.log('📦 Backup system module loaded');
