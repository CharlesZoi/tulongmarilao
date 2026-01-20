// Security Module for Northern Cebu Relief Map
// Implements cybersecurity measures to protect admin accounts

// Rate Limiting for Login Attempts
class LoginRateLimiter {
    constructor() {
        this.attempts = new Map();
        this.lockouts = new Map();
        this.MAX_ATTEMPTS = 5;
        this.LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
        this.ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes
    }

    // Check if email is locked out
    isLockedOut(email) {
        const lockoutTime = this.lockouts.get(email);
        if (lockoutTime && Date.now() < lockoutTime) {
            const remainingTime = Math.ceil((lockoutTime - Date.now()) / 60000);
            return {
                locked: true,
                remainingMinutes: remainingTime
            };
        }
        // Clear expired lockout
        if (lockoutTime) {
            this.lockouts.delete(email);
        }
        return { locked: false };
    }

    // Record a failed login attempt
    recordFailedAttempt(email) {
        const now = Date.now();
        const attempts = this.attempts.get(email) || [];
        
        // Remove old attempts outside the window
        const recentAttempts = attempts.filter(time => now - time < this.ATTEMPT_WINDOW);
        recentAttempts.push(now);
        
        this.attempts.set(email, recentAttempts);

        // Check if should lock out
        if (recentAttempts.length >= this.MAX_ATTEMPTS) {
            this.lockouts.set(email, now + this.LOCKOUT_DURATION);
            this.attempts.delete(email);
            return {
                shouldLockout: true,
                attemptsCount: recentAttempts.length
            };
        }

        return {
            shouldLockout: false,
            attemptsCount: recentAttempts.length,
            remainingAttempts: this.MAX_ATTEMPTS - recentAttempts.length
        };
    }

    // Clear attempts on successful login
    clearAttempts(email) {
        this.attempts.delete(email);
        this.lockouts.delete(email);
    }

    // Get remaining attempts
    getRemainingAttempts(email) {
        const attempts = this.attempts.get(email) || [];
        const now = Date.now();
        const recentAttempts = attempts.filter(time => now - time < this.ATTEMPT_WINDOW);
        return Math.max(0, this.MAX_ATTEMPTS - recentAttempts.length);
    }
}

// Password Strength Validator
class PasswordValidator {
    static MIN_LENGTH = 8;
    static REQUIRE_UPPERCASE = true;
    static REQUIRE_LOWERCASE = true;
    static REQUIRE_NUMBER = true;
    static REQUIRE_SPECIAL = true;

    static validate(password) {
        const errors = [];
        const warnings = [];

        // Length check
        if (password.length < this.MIN_LENGTH) {
            errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
        }

        // Uppercase check
        if (this.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        // Lowercase check
        if (this.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        // Number check
        if (this.REQUIRE_NUMBER && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        // Special character check
        if (this.REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        // Common password check
        const commonPasswords = ['password', '12345678', 'qwerty', 'admin', 'letmein', 'welcome'];
        if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
            errors.push('Password is too common. Please choose a more unique password');
        }

        // Sequential characters check
        if (/(.)\1{2,}/.test(password)) {
            warnings.push('Avoid repeating characters');
        }

        // Calculate strength score
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            strength: strength,
            strengthLabel: this.getStrengthLabel(strength)
        };
    }

    static getStrengthLabel(score) {
        if (score <= 2) return 'Weak';
        if (score <= 4) return 'Medium';
        return 'Strong';
    }
}

// Session Manager
class SessionManager {
    constructor() {
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        this.WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
        this.lastActivity = Date.now();
        this.timeoutWarningShown = false;
        this.sessionCheckInterval = null;
    }

    // Start session monitoring
    startMonitoring(onTimeout, onWarning) {
        this.updateActivity();

        // Track user activity
        const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        activityEvents.forEach(event => {
            document.addEventListener(event, () => this.updateActivity(), { passive: true });
        });

        // Check session every minute
        this.sessionCheckInterval = setInterval(() => {
            this.checkSession(onTimeout, onWarning);
        }, 60000);
    }

    updateActivity() {
        this.lastActivity = Date.now();
        this.timeoutWarningShown = false;
    }

    checkSession(onTimeout, onWarning) {
        const now = Date.now();
        const timeSinceActivity = now - this.lastActivity;

        // Session expired
        if (timeSinceActivity >= this.SESSION_TIMEOUT) {
            this.stopMonitoring();
            if (onTimeout) onTimeout();
        }
        // Show warning
        else if (timeSinceActivity >= (this.SESSION_TIMEOUT - this.WARNING_TIME) && !this.timeoutWarningShown) {
            this.timeoutWarningShown = true;
            const remainingMinutes = Math.ceil((this.SESSION_TIMEOUT - timeSinceActivity) / 60000);
            if (onWarning) onWarning(remainingMinutes);
        }
    }

    stopMonitoring() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
    }

    getRemainingTime() {
        const timeSinceActivity = Date.now() - this.lastActivity;
        return Math.max(0, this.SESSION_TIMEOUT - timeSinceActivity);
    }
}

// Input Sanitizer (prevent XSS attacks)
class InputSanitizer {
    static sanitize(input) {
        if (typeof input !== 'string') return input;
        
        // Remove script tags
        let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove event handlers
        sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        
        // Remove javascript: protocol
        sanitized = sanitized.replace(/javascript:/gi, '');
        
        return sanitized;
    }

    static sanitizeObject(obj) {
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = this.sanitize(obj[key]);
            }
        }
        return sanitized;
    }
}

// Email Validator
class EmailValidator {
    static validate(email) {
        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                isValid: false,
                error: 'Invalid email format'
            };
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
            /\.\./,  // Double dots
            /^\./, // Starting with dot
            /\.$/, // Ending with dot
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(email)) {
                return {
                    isValid: false,
                    error: 'Email contains invalid characters'
                };
            }
        }

        return { isValid: true };
    }
}

// Security Headers Helper
class SecurityHeaders {
    static setSecurityHeaders() {
        // Note: These are client-side recommendations
        // Actual headers should be set on the server
        console.log('🔒 Security recommendations:');
        console.log('- Use HTTPS for all connections');
        console.log('- Enable Content-Security-Policy');
        console.log('- Enable X-Frame-Options: DENY');
        console.log('- Enable X-Content-Type-Options: nosniff');
        console.log('- Enable Strict-Transport-Security');
    }

    static checkSecureConnection() {
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            console.warn('⚠️ WARNING: Not using HTTPS! Connection is not secure.');
            return false;
        }
        return true;
    }
}

// Export for use in other modules
export {
    LoginRateLimiter,
    PasswordValidator,
    SessionManager,
    InputSanitizer,
    EmailValidator,
    SecurityHeaders
};

// Make available globally
window.SecurityModule = {
    LoginRateLimiter,
    PasswordValidator,
    SessionManager,
    InputSanitizer,
    EmailValidator,
    SecurityHeaders
};

console.log('🔐 Security module loaded');
