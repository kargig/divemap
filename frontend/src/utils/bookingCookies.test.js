import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearBookingPreferencesCookie,
  getBookingPreferencesFromCookie,
  saveBookingPreferencesToCookie,
} from './bookingCookies';

describe('bookingCookies 3-way accessory options', () => {
  beforeEach(() => {
    // jsdom cookie jar
    document.cookie.split(';').forEach(c => {
      const name = c.split('=')[0].trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
    localStorage.clear();
  });

  it('persists and restores torch/hood/gloves/smb Option fields', () => {
    saveBookingPreferencesToCookie(
      {
        diverName: 'Ada',
        torchOption: 'OWN',
        hoodOption: 'RENT',
        hoodSize: 'M',
        glovesOption: 'NONE',
        smbOption: 'RENT',
        rentalTorch: false,
        rentalSmb: true,
      },
      true,
      'user-42'
    );

    const prefs = getBookingPreferencesFromCookie('user-42');
    expect(prefs.torchOption).toBe('OWN');
    expect(prefs.hoodOption).toBe('RENT');
    expect(prefs.hoodSize).toBe('M');
    expect(prefs.glovesOption).toBe('NONE');
    expect(prefs.smbOption).toBe('RENT');
  });

  it('derives smbOption OWN from hasOwnSmb when smbOption omitted', () => {
    saveBookingPreferencesToCookie(
      {
        hasOwnSmb: true,
        rentalSmb: false,
      },
      true,
      null
    );
    const prefs = getBookingPreferencesFromCookie(null);
    expect(prefs.smbOption).toBe('OWN');
  });

  it('derives torchOption RENT from legacy rentalTorch when option omitted', () => {
    saveBookingPreferencesToCookie(
      {
        rentalTorch: true,
      },
      true,
      'guest-legacy'
    );
    const prefs = getBookingPreferencesFromCookie('guest-legacy');
    expect(prefs.torchOption).toBe('RENT');
    expect(prefs.rentalTorch).toBe(true);
  });

  it('scopes prefs by user id and does not leak across users', () => {
    saveBookingPreferencesToCookie({ torchOption: 'RENT', diverName: 'A' }, true, 1);
    saveBookingPreferencesToCookie({ torchOption: 'OWN', diverName: 'B' }, true, 2);

    expect(getBookingPreferencesFromCookie(1).torchOption).toBe('RENT');
    expect(getBookingPreferencesFromCookie(2).torchOption).toBe('OWN');
  });

  it('clears prefs when remember is false', () => {
    saveBookingPreferencesToCookie({ torchOption: 'RENT' }, true, 'x');
    saveBookingPreferencesToCookie({ torchOption: 'RENT' }, false, 'x');
    expect(getBookingPreferencesFromCookie('x')).toBeNull();
    clearBookingPreferencesCookie('x');
  });
});
