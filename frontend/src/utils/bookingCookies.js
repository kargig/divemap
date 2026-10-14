/**
 * Booking Wizard Fast-Checkout Cookies & Storage Helper
 * Safely persists diver personal info, equipment preferences, emergency contacts,
 * and insurance details in browser cookies/storage when opted in by the user.
 *
 * Scoped by authenticated user ID (or 'guest') to prevent cross-account
 * personal data leaks on shared devices.
 */

export const BOOKING_PREFS_COOKIE_NAME = 'divemap_fast_checkout_prefs';
export const BOOKING_PREFS_STORAGE_BACKUP = 'divemap_fast_checkout_backup';

export function getBookingPreferencesCookieName(userId = null) {
  if (userId) {
    return `${BOOKING_PREFS_COOKIE_NAME}_u_${userId}`;
  }
  return `${BOOKING_PREFS_COOKIE_NAME}_guest`;
}

export function getBookingPreferencesStorageKey(userId = null) {
  if (userId) {
    return `${BOOKING_PREFS_STORAGE_BACKUP}_u_${userId}`;
  }
  return `${BOOKING_PREFS_STORAGE_BACKUP}_guest`;
}

export function setCookie(name, value, days = 180) {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${d.toUTCString()}`;
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const encoded = encodeURIComponent(serialized);
  const secure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encoded}; ${expires}; path=/; SameSite=Lax${secure}`;
}

export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      try {
        const raw = decodeURIComponent(c.substring(nameEQ.length, c.length));
        return JSON.parse(raw);
      } catch (_e) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
  }
  return null;
}

export function deleteCookie(name) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

/**
 * Retrieve saved diver checkout preferences from cookie (with localStorage fallback).
 * Scoped to a specific user ID if authenticated, or 'guest'.
 * @param {string|number|null} [userId]
 * @returns {Record<string, any> | null}
 */
export function getBookingPreferencesFromCookie(userId = null) {
  if (typeof window === 'undefined') return null;

  const cookieName = getBookingPreferencesCookieName(userId);
  const storageKey = getBookingPreferencesStorageKey(userId);

  try {
    // 1. Try scoped cookie
    const fromCookie = getCookie(cookieName);
    if (fromCookie && typeof fromCookie === 'object') {
      return fromCookie;
    }

    // 2. Try scoped localStorage
    const fromStorage = localStorage.getItem(storageKey);
    if (fromStorage) {
      const parsed = JSON.parse(fromStorage);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }

    // 3. Fallback to un-scoped legacy cookie if this is a guest or migrating
    if (!userId) {
      const legacyCookie = getCookie(BOOKING_PREFS_COOKIE_NAME);
      if (legacyCookie && typeof legacyCookie === 'object') {
        return legacyCookie;
      }
      const legacyStorage = localStorage.getItem(BOOKING_PREFS_STORAGE_BACKUP);
      if (legacyStorage) {
        const parsedLegacy = JSON.parse(legacyStorage);
        if (parsedLegacy && typeof parsedLegacy === 'object') {
          return parsedLegacy;
        }
      }
    }
  } catch (_e) {
    // Non-blocking fallback
  }

  return null;
}

/**
 * Persist or delete diver checkout preferences in cookie and storage.
 * Scoped to a specific user ID if authenticated, or 'guest'.
 * @param {Record<string, any>} prefs
 * @param {boolean} remember
 * @param {string|number|null} [userId]
 */
export function saveBookingPreferencesToCookie(prefs, remember = true, userId = null) {
  if (typeof window === 'undefined') return;

  if (!remember) {
    clearBookingPreferencesCookie(userId);
    return;
  }

  const cookieName = getBookingPreferencesCookieName(userId);
  const storageKey = getBookingPreferencesStorageKey(userId);

  try {
    // Extract only clean, safe fields
    const sanitized = {
      userId: userId || undefined,

      // Diver Info — no passport (high-sensitivity ID); keep low-risk prefs only
      diverName: prefs.diverName || undefined,
      diverEmail: prefs.diverEmail || undefined,
      diverPhone: prefs.diverPhone || undefined,
      diverNationality: prefs.diverNationality || undefined,
      dateOfBirth: prefs.dateOfBirth || undefined,
      loggedDives: prefs.loggedDives || undefined,

      // Certification Credentials
      certAgency: prefs.certAgency || undefined,
      certLevel: prefs.certLevel || undefined,
      certNumber: prefs.certNumber || undefined,

      // Equipment Preferences
      selectedTankId: prefs.selectedTankId || '12',
      selectedGasMixId: prefs.selectedGasMixId || 'air',
      regulatorFitting: prefs.regulatorFitting || 'DIN',
      weightSystem: prefs.weightSystem || undefined,
      leadKg: prefs.leadKg || undefined,
      wetsuitGender: prefs.wetsuitGender || undefined,
      wetsuitSize: prefs.wetsuitSize || undefined,
      wetsuitThickness: prefs.wetsuitThickness || undefined,
      bcdGender: prefs.bcdGender || undefined,
      bcdSize: prefs.bcdSize || undefined,
      finType: prefs.finType || undefined,
      finSize: prefs.finSize || undefined,
      bootSize: prefs.bootSize || undefined,
      shoeSizeEu: prefs.shoeSizeEu || undefined,
      rentalTorch: Boolean(prefs.rentalTorch),
      rentalComputer: Boolean(prefs.rentalComputer),

      // Emergency Contact
      emergencyContactName: prefs.emergencyContactName || undefined,
      emergencyContactPhone: prefs.emergencyContactPhone || undefined,
      emergencyContactRelation: prefs.emergencyContactRelation || undefined,

      // Insurance — provider/preference only; omit policy number from durable cookies
      hasInsurance: prefs.hasInsurance || 'OWN',
      insuranceProvider: prefs.insuranceProvider || undefined,
      insuranceExpiryDate: prefs.insuranceExpiryDate || undefined,

      updatedAt: Date.now(),
    };

    setCookie(cookieName, sanitized, 180);
    localStorage.setItem(storageKey, JSON.stringify(sanitized));

    // Clear legacy global un-scoped cookie if present
    deleteCookie(BOOKING_PREFS_COOKIE_NAME);
    localStorage.removeItem(BOOKING_PREFS_STORAGE_BACKUP);
  } catch (_e) {
    // Ignore storage quota errors
  }
}

/**
 * Clear stored fast-checkout preferences.
 * If userId is provided, clears only that user's preferences.
 * If userId is null/undefined, clears all fast-checkout preference cookies on this device.
 * @param {string|number|null} [userId]
 */
export function clearBookingPreferencesCookie(userId = null) {
  if (typeof document === 'undefined') return;

  if (userId) {
    const cookieName = getBookingPreferencesCookieName(userId);
    const storageKey = getBookingPreferencesStorageKey(userId);
    deleteCookie(cookieName);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (_e) {
        // Ignore
      }
    }
    return;
  }

  // Clear all variants (legacy, guest, and user-scoped)
  deleteCookie(BOOKING_PREFS_COOKIE_NAME);
  deleteCookie(`${BOOKING_PREFS_COOKIE_NAME}_guest`);

  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const name = cookies[i].split('=')[0].trim();
    if (name.startsWith(BOOKING_PREFS_COOKIE_NAME)) {
      deleteCookie(name);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(BOOKING_PREFS_STORAGE_BACKUP);
      localStorage.removeItem(`${BOOKING_PREFS_STORAGE_BACKUP}_guest`);

      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(BOOKING_PREFS_STORAGE_BACKUP)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (_e) {
      // Ignore
    }
  }
}
