/**
 * Build OCTO equipmentSizing payload from wizard UI state.
 * 3-way accessory options (NONE | OWN | RENT) are the source of truth.
 *
 * @param {Record<string, any>} state
 * @returns {Record<string, any>}
 */
export function buildEquipmentSizingPayload(state) {
  const {
    wetsuitGender,
    wetsuitSize,
    wetsuitThickness,
    bcdGender,
    bcdSize,
    finType,
    finSize,
    bootSize,
    shoeSizeEu,
    rentalRegulator,
    rentalMask,
    hasOwnLeadWeights,
    selectedProfileId,
    torchOption = 'NONE',
    rentalComputer,
    hoodOption = 'NONE',
    hoodSize,
    glovesOption = 'NONE',
    glovesSize,
    smbOption = 'NONE',
    regulatorFitting,
    weightSystem,
    weightSystems,
    secondaryNitroxCert,
    leadKg,
    hasInsurance,
    insuranceProvider,
    insurancePolicyNumber,
    finalExpiryDate,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
  } = state;

  return {
    wetsuit_gender: wetsuitGender,
    wetsuit_size: wetsuitSize === 'None' ? null : wetsuitSize,
    wetsuit_thickness: wetsuitThickness,
    bcd_gender: bcdGender,
    bcd_size: bcdSize === 'None' ? null : bcdSize,
    fin_type: finType,
    fin_size: finSize === 'None' ? null : finSize,
    boot_size: bootSize === 'None' ? null : bootSize,
    rental_fins: finSize !== 'None',
    has_own_fins: finSize === 'None',
    rental_boots: bootSize !== 'None',
    has_own_boots: bootSize === 'None',
    shoe_size_eu: parseFloat(shoeSizeEu) || 43.0,
    rental_regulator: rentalRegulator,
    has_own_regulator: !rentalRegulator,
    rental_mask: rentalMask,
    has_own_mask: !rentalMask,
    has_own_lead_weights: hasOwnLeadWeights,
    selected_profile_id: selectedProfileId || undefined,
    rental_torch: torchOption === 'RENT',
    has_own_torch: torchOption === 'OWN',
    torch_option: torchOption,
    rental_dive_computer: rentalComputer,
    has_own_dive_computer: !rentalComputer,
    hood_size: hoodOption === 'RENT' && hoodSize !== 'None' ? hoodSize : null,
    hood_option: hoodOption,
    gloves_size: glovesOption === 'RENT' && glovesSize !== 'None' ? glovesSize : null,
    gloves_option: glovesOption,
    rental_smb: smbOption === 'RENT',
    has_own_smb: smbOption === 'OWN',
    smb_option: smbOption,
    regulator_fitting: regulatorFitting,
    weight_system: weightSystem,
    weight_systems: weightSystems,
    secondary_nitrox_cert: (secondaryNitroxCert || '').trim() || undefined,
    estimated_lead_kg: parseFloat(leadKg) || 5.0,
    lead_kg: parseFloat(leadKg) || 5.0,
    insurance_type: hasInsurance,
    insurance_provider:
      hasInsurance === 'OWN'
        ? (insuranceProvider || '').trim() || undefined
        : 'Center Daily Coverage',
    insurance_policy_number:
      hasInsurance === 'OWN' ? (insurancePolicyNumber || '').trim() || undefined : undefined,
    insurance_expiry_date: hasInsurance === 'OWN' ? finalExpiryDate || undefined : undefined,
    emergency_contact_name: (emergencyContactName || '').trim() || undefined,
    emergency_contact_phone: (emergencyContactPhone || '').trim() || undefined,
    emergency_contact_relation: (emergencyContactRelation || '').trim() || undefined,
  };
}

export const INSTRUCTOR_KEYWORDS = ['instructor', 'owsi', 'msdt', 'course director'];

/**
 * Checks if a certification level represents an Instructor qualification.
 * Under SSI / ISO 24802 standards, Enriched Air Nitrox 40 is a mandatory prerequisite
 * for the Instructor Training Course (ITC/IE), making instructors de facto Nitrox certified.
 * Qualifications up to Divemaster do not de facto grant Nitrox.
 */
export function isInstructorCertification(certLevel) {
  if (!certLevel || typeof certLevel !== 'string') return false;
  const cl = certLevel.toLowerCase();
  return INSTRUCTOR_KEYWORDS.some(kw => cl.includes(kw));
}

/**
 * Determines whether a certification level or gases specification qualifies a diver for Nitrox.
 */
export function isNitroxQualifyingCertification({ certLevel, gases } = {}) {
  if (isInstructorCertification(certLevel)) {
    return true;
  }
  if (gases && typeof gases === 'string') {
    const lg = gases.toLowerCase();
    if (
      lg.includes('nitrox') ||
      lg.includes('safeair') ||
      lg.includes('trimix') ||
      lg.includes('triox') ||
      lg.includes('100% o2') ||
      lg.includes('40% o2') ||
      lg.includes('deco')
    ) {
      return true;
    }
  }
  if (certLevel && typeof certLevel === 'string') {
    const cl = certLevel.toLowerCase();
    const techOrNitroxKeywords = [
      'nitrox',
      'ean',
      'enriched air',
      'safeair',
      'extended range',
      'xr',
      'tec',
      'technical',
      'trimix',
      'helitrox',
      'triox',
      'rebreather',
      'ccr',
      'decompression',
      'fundamentals',
      'fundies',
    ];
    if (techOrNitroxKeywords.some(kw => cl.includes(kw))) {
      return true;
    }
  }
  return false;
}
