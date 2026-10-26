import { describe, expect, it } from 'vitest';

import { computeWizardRentalEstimate } from './bookingRentalEstimate';

const pricing = {
  full_kit_package: 30,
  package_items: ['regulator', 'bcd', 'wetsuit', 'fins_boots', 'mask_snorkel'],
  items: {
    regulator: 10,
    bcd: 10,
    wetsuit: 10,
    fins_boots: 8,
    mask_snorkel: 5,
    dive_computer: 10,
    dive_torch: 8,
    hood: 5,
    gloves: 5,
    smb: 5,
  },
  tank_surcharges: { 12: 0, 15: 5 },
  gas_surcharges: { air: 0, ean32: 8 },
};

const ownUnit = {
  id: 'unit-own',
  retail_price: 85,
  unit_type: 'DIVER_OWN_GEAR',
  title: 'Certified Diver (Own Gear)',
};

describe('computeWizardRentalEstimate', () => {
  it('adds tank and gas upgrade fees', () => {
    const result = computeWizardRentalEstimate({
      rentalPricing: pricing,
      selectedUnit: ownUnit,
      selectedUnitId: ownUnit.id,
      selectedTankId: '15',
      selectedGasMixId: 'ean32',
    });
    expect(result.totalDue).toBe(85 + 5 + 8);
  });

  it('does not charge accessories on NONE/OWN', () => {
    const result = computeWizardRentalEstimate({
      rentalPricing: pricing,
      selectedUnit: ownUnit,
      selectedUnitId: ownUnit.id,
      torchOption: 'OWN',
      smbOption: 'NONE',
      hoodOption: 'OWN',
      hoodSize: 'M',
      glovesOption: 'NONE',
      glovesSize: 'L',
    });
    expect(result.totalDue).toBe(85);
  });

  it('charges RENT accessories', () => {
    const result = computeWizardRentalEstimate({
      rentalPricing: pricing,
      selectedUnit: ownUnit,
      selectedUnitId: ownUnit.id,
      torchOption: 'RENT',
      smbOption: 'RENT',
      hoodOption: 'RENT',
      hoodSize: 'M',
    });
    expect(result.totalDue).toBe(85 + 8 + 5 + 5);
  });

  it('ignores negative (not offered) item prices', () => {
    const result = computeWizardRentalEstimate({
      rentalPricing: {
        ...pricing,
        items: { ...pricing.items, dive_torch: -1, smb: -1 },
      },
      selectedUnit: ownUnit,
      selectedUnitId: ownUnit.id,
      torchOption: 'RENT',
      smbOption: 'RENT',
    });
    expect(result.totalDue).toBe(85);
  });

  it('treats empty package_items as defaults (no aux double-charge of core)', () => {
    const fullUnit = {
      id: 'certified-diver-full-rental',
      retail_price: 115,
      unit_type: 'DIVER_RENTAL_GEAR',
      title: 'Full Equipment Rental',
    };
    const result = computeWizardRentalEstimate({
      rentalPricing: { ...pricing, package_items: [] },
      selectedUnit: fullUnit,
      selectedUnitId: fullUnit.id,
      wetsuitSize: 'L',
      bcdSize: 'M',
      finSize: 'L',
      rentalRegulator: true,
      rentalMask: true,
    });
    expect(result.totalDue).toBe(115);
    expect(result.packageItems).toEqual([
      'regulator',
      'bcd',
      'wetsuit',
      'fins_boots',
      'mask_snorkel',
    ]);
  });

  it('prices booties from fins_boots when fins not rented', () => {
    const result = computeWizardRentalEstimate({
      rentalPricing: pricing,
      selectedUnit: ownUnit,
      selectedUnitId: ownUnit.id,
      bootSize: '43',
    });
    expect(result.totalDue).toBe(85 + 8);
    expect(result.rentalItems.some(i => i.label.includes('Booties'))).toBe(true);
  });
});
