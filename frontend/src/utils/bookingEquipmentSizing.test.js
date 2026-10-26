import { describe, expect, it } from 'vitest';

import {
  buildEquipmentSizingPayload,
  isInstructorCertification,
  isNitroxQualifyingCertification,
} from './bookingEquipmentSizing';

const baseState = {
  wetsuitGender: 'MEN',
  wetsuitSize: 'None',
  wetsuitThickness: '5mm',
  bcdGender: 'MEN',
  bcdSize: 'None',
  finType: 'OPEN_HEEL',
  finSize: 'None',
  bootSize: 'None',
  shoeSizeEu: '43',
  rentalRegulator: false,
  rentalMask: false,
  hasOwnLeadWeights: true,
  selectedProfileId: null,
  rentalComputer: false,
  regulatorFitting: 'DIN',
  weightSystem: 'INTEGRATED',
  weightSystems: ['INTEGRATED'],
  secondaryNitroxCert: '',
  leadKg: '5',
  hasInsurance: 'OWN',
  insuranceProvider: 'DAN',
  insurancePolicyNumber: '123',
  finalExpiryDate: '2030-01-01',
  emergencyContactName: 'Bob',
  emergencyContactPhone: '+30111',
  emergencyContactRelation: 'Friend',
};

describe('buildEquipmentSizingPayload', () => {
  it('maps NONE accessories to null sizes and false rental flags', () => {
    const eq = buildEquipmentSizingPayload({
      ...baseState,
      torchOption: 'NONE',
      hoodOption: 'NONE',
      hoodSize: 'M',
      glovesOption: 'NONE',
      glovesSize: 'L',
      smbOption: 'NONE',
    });
    expect(eq.torch_option).toBe('NONE');
    expect(eq.rental_torch).toBe(false);
    expect(eq.has_own_torch).toBe(false);
    expect(eq.hood_option).toBe('NONE');
    expect(eq.hood_size).toBeNull();
    expect(eq.gloves_size).toBeNull();
    expect(eq.smb_option).toBe('NONE');
    expect(eq.rental_smb).toBe(false);
  });

  it('maps OWN without charging rental flags', () => {
    const eq = buildEquipmentSizingPayload({
      ...baseState,
      torchOption: 'OWN',
      smbOption: 'OWN',
      hoodOption: 'OWN',
      hoodSize: 'M',
    });
    expect(eq.has_own_torch).toBe(true);
    expect(eq.rental_torch).toBe(false);
    expect(eq.has_own_smb).toBe(true);
    expect(eq.rental_smb).toBe(false);
    expect(eq.hood_option).toBe('OWN');
    expect(eq.hood_size).toBeNull();
  });

  it('maps RENT with sizes for hood/gloves', () => {
    const eq = buildEquipmentSizingPayload({
      ...baseState,
      torchOption: 'RENT',
      hoodOption: 'RENT',
      hoodSize: 'M',
      glovesOption: 'RENT',
      glovesSize: 'S',
      smbOption: 'RENT',
    });
    expect(eq.rental_torch).toBe(true);
    expect(eq.hood_size).toBe('M');
    expect(eq.gloves_size).toBe('S');
    expect(eq.rental_smb).toBe(true);
    expect(eq.smb_option).toBe('RENT');
  });

  it('is identical for hold and paperwork when state is identical', () => {
    const state = {
      ...baseState,
      torchOption: 'RENT',
      hoodOption: 'OWN',
      smbOption: 'NONE',
    };
    expect(buildEquipmentSizingPayload(state)).toEqual(buildEquipmentSizingPayload(state));
  });
});

describe('isInstructorCertification and isNitroxQualifyingCertification', () => {
  it('recognizes instructor levels as de facto Nitrox qualified', () => {
    expect(isInstructorCertification('Open Water Instructor')).toBe(true);
    expect(isInstructorCertification('Assistant Instructor')).toBe(true);
    expect(isInstructorCertification('Open Water Scuba Instructor (OWSI)')).toBe(true);
    expect(isInstructorCertification('PADI OWSI #123456')).toBe(true);
    expect(isInstructorCertification('Master Scuba Diver Trainer (MSDT)')).toBe(true);
    expect(isInstructorCertification('Course Director')).toBe(true);

    expect(isNitroxQualifyingCertification({ certLevel: 'Open Water Instructor' })).toBe(true);
    expect(isNitroxQualifyingCertification({ certLevel: 'Assistant Instructor' })).toBe(true);
    expect(isNitroxQualifyingCertification({ certLevel: 'Course Director' })).toBe(true);
  });

  it('rejects qualifications up to Divemaster unless separate Nitrox is provided', () => {
    expect(isInstructorCertification('Divemaster')).toBe(false);
    expect(isInstructorCertification('SSI Divemaster')).toBe(false);
    expect(isInstructorCertification('Dive Guide')).toBe(false);
    expect(isInstructorCertification('Rescue Diver')).toBe(false);
    expect(isInstructorCertification('Master Scuba Diver')).toBe(false);
    expect(isInstructorCertification('Advanced Open Water Diver (AOWD)')).toBe(false);
    expect(isInstructorCertification('Open Water Diver (OWD)')).toBe(false);

    expect(isNitroxQualifyingCertification({ certLevel: 'Divemaster', gases: null })).toBe(false);
    expect(isNitroxQualifyingCertification({ certLevel: 'Divemaster', gases: 'Air' })).toBe(false);
    expect(isNitroxQualifyingCertification({ certLevel: 'Open Water Diver', gases: 'Air' })).toBe(
      false
    );

    // If Divemaster has explicit Nitrox gases or technical specialty
    expect(
      isNitroxQualifyingCertification({ certLevel: 'Divemaster', gases: 'Nitrox up to 40% O2' })
    ).toBe(true);
    expect(isNitroxQualifyingCertification({ certLevel: 'Enriched Air Diver', gases: 'Air' })).toBe(
      true
    );
  });
});
