const DEFAULT_PACKAGE_ITEMS = ['regulator', 'bcd', 'wetsuit', 'fins_boots', 'mask_snorkel'];

/**
 * Client-side rental estimate mirroring backend partition/cap/upgrade rules.
 * Negative item prices are treated as not offered (excluded).
 *
 * @param {object} params
 * @returns {{
 *   basePrice: number,
 *   rentalItems: Array<{key?: string, label: string, price: number}>,
 *   totalRentalSurcharge: number,
 *   totalDue: number,
 *   isPackageApplied: boolean,
 *   coreSum: number,
 *   fullKitPackage: number,
 *   packageItems: string[],
 * }}
 */
export function computeWizardRentalEstimate({
  rentalPricing,
  selectedUnit,
  selectedUnitId,
  selectedTankId = '12',
  selectedGasMixId = 'air',
  wetsuitSize,
  bcdSize,
  finSize,
  bootSize,
  rentalRegulator,
  regulatorFitting = 'DIN',
  rentalMask,
  rentalComputer,
  torchOption = 'NONE',
  hoodOption = 'NONE',
  hoodSize,
  glovesOption = 'NONE',
  glovesSize,
  smbOption = 'NONE',
  hasInsurance,
  dailyInsurancePrice = 0,
}) {
  const basePrice = selectedUnit ? parseFloat(selectedUnit.retail_price) : 75;
  if (!rentalPricing || !rentalPricing.items) {
    return {
      basePrice,
      rentalItems: [],
      totalRentalSurcharge: 0,
      totalDue: basePrice,
      isPackageApplied: false,
      coreSum: 0,
      fullKitPackage: 30,
      packageItems: [...DEFAULT_PACKAGE_ITEMS],
    };
  }

  const items = rentalPricing.items;
  const fullKitPackage = rentalPricing.full_kit_package ?? 30.0;
  const rawPkg = rentalPricing.package_items;
  const packageItems = rawPkg && rawPkg.length > 0 ? rawPkg : [...DEFAULT_PACKAGE_ITEMS];
  const isFullRentalUnit =
    selectedUnitId === 'demo-unit-2' ||
    selectedUnitId === 'certified-diver-full-rental' ||
    selectedUnit?.unit_type === 'DIVER_RENTAL_GEAR' ||
    selectedUnit?.title?.toLowerCase().includes('full');

  const offeredPrice = raw =>
    raw !== undefined && raw !== null && Number(raw) >= 0 ? Number(raw) : null;

  const candidateRentals = [];

  const wetsuitPrice = offeredPrice(items.wetsuit);
  if (wetsuitSize && wetsuitSize !== 'None' && wetsuitPrice !== null) {
    candidateRentals.push({
      key: 'wetsuit',
      label: `Rental Wetsuit (${wetsuitSize})`,
      price: wetsuitPrice,
    });
  }

  const bcdPrice = offeredPrice(items.bcd);
  if (bcdSize && bcdSize !== 'None' && bcdPrice !== null) {
    candidateRentals.push({
      key: 'bcd',
      label: `Rental BCD (${bcdSize})`,
      price: bcdPrice,
    });
  }

  const finsBootsPrice = offeredPrice(items.fins_boots);
  if (finSize && finSize !== 'None' && finsBootsPrice !== null) {
    candidateRentals.push({
      key: 'fins_boots',
      label: `Rental Fins (${finSize})`,
      price: finsBootsPrice,
    });
  } else if (bootSize && bootSize !== 'None' && finsBootsPrice !== null) {
    candidateRentals.push({
      key: 'fins_boots',
      label: `Rental Booties (EU ${bootSize})`,
      price: finsBootsPrice,
    });
  }

  const regulatorPrice = offeredPrice(items.regulator);
  if (rentalRegulator && regulatorPrice !== null) {
    candidateRentals.push({
      key: 'regulator',
      label: `Rental Regulator Set (${regulatorFitting || 'DIN'})`,
      price: regulatorPrice,
    });
  }

  const maskPrice = offeredPrice(items.mask_snorkel ?? items.mask);
  if (rentalMask && maskPrice !== null) {
    candidateRentals.push({
      key: 'mask_snorkel',
      label: 'Rental Diving Mask & Snorkel',
      price: maskPrice,
    });
  }

  const computerPrice = offeredPrice(items.dive_computer);
  if (rentalComputer && computerPrice !== null) {
    candidateRentals.push({
      key: 'dive_computer',
      label: 'Rental Dive Computer',
      price: computerPrice,
    });
  }

  const torchPrice = offeredPrice(items.dive_torch);
  if (torchOption === 'RENT' && torchPrice !== null) {
    candidateRentals.push({
      key: 'dive_torch',
      label: 'Rental Primary Dive Torch',
      price: torchPrice,
    });
  }

  const hoodPrice = offeredPrice(items.hood);
  if (hoodOption === 'RENT' && hoodSize && hoodSize !== 'None' && hoodPrice !== null) {
    candidateRentals.push({
      key: 'hood',
      label: `Rental Thermal Hood (${hoodSize})`,
      price: hoodPrice,
    });
  }

  const glovesPrice = offeredPrice(items.gloves);
  if (glovesOption === 'RENT' && glovesSize && glovesSize !== 'None' && glovesPrice !== null) {
    candidateRentals.push({
      key: 'gloves',
      label: `Rental Dive Gloves (${glovesSize})`,
      price: glovesPrice,
    });
  }

  const smbPrice = offeredPrice(items.smb);
  if (smbOption === 'RENT' && smbPrice !== null) {
    candidateRentals.push({
      key: 'smb',
      label: 'Rental Surface Marker Buoy (SMB)',
      price: smbPrice,
    });
  }

  const coreItems = [];
  const auxItems = [];
  candidateRentals.forEach(item => {
    if (packageItems.includes(item.key)) {
      if (!isFullRentalUnit) coreItems.push(item);
    } else {
      auxItems.push(item);
    }
  });

  const upgradeItems = [];
  const tankSurcharges = rentalPricing.tank_surcharges || {};
  const tankFee = Number(tankSurcharges[selectedTankId] || 0);
  if (tankFee > 0) {
    const tankLabel = selectedTankId === '15' ? '15L Steel' : `${selectedTankId}L Cylinder`;
    upgradeItems.push({
      label: `Cylinder Upgrade: ${tankLabel}`,
      price: tankFee,
    });
  }

  const gasSurcharges = rentalPricing.gas_surcharges || {};
  const gasFee = Number(gasSurcharges[selectedGasMixId] || 0);
  if (gasFee > 0) {
    const gasLabel =
      selectedGasMixId.toUpperCase() === 'EAN32'
        ? 'Enriched Air (EAN32)'
        : selectedGasMixId.toUpperCase() === 'EAN36'
          ? 'Enriched Air (EAN36)'
          : 'Custom Gas Blend';
    upgradeItems.push({
      label: `Breathing Gas: ${gasLabel}`,
      price: gasFee,
    });
  }

  const dailyInsFee = hasInsurance === 'CENTER' ? Number(dailyInsurancePrice || 0) : 0;
  if (dailyInsFee > 0) {
    upgradeItems.push({
      label: 'Center Daily Dive Insurance',
      price: dailyInsFee,
    });
  }

  const coreSum = coreItems.reduce((sum, item) => sum + item.price, 0);
  let totalCoreSurcharge = coreSum;
  let isPackageApplied = isFullRentalUnit;

  if (!isFullRentalUnit && coreSum >= fullKitPackage && fullKitPackage > 0) {
    totalCoreSurcharge = fullKitPackage;
    isPackageApplied = true;
  }

  const allDisplayItems = [...(isFullRentalUnit ? [] : coreItems), ...auxItems, ...upgradeItems];
  const totalSurcharge =
    (isFullRentalUnit ? 0 : totalCoreSurcharge) +
    auxItems.reduce((sum, item) => sum + item.price, 0) +
    upgradeItems.reduce((sum, item) => sum + item.price, 0);

  return {
    basePrice,
    rentalItems: allDisplayItems,
    totalRentalSurcharge: totalSurcharge,
    totalDue: basePrice + totalSurcharge,
    isPackageApplied,
    coreSum,
    fullKitPackage,
    packageItems,
  };
}
