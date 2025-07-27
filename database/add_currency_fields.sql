-- Add currency fields to cost-related tables
-- This migration adds currency support to dive costs and gear rental costs

-- Add currency field to center_dive_sites table
ALTER TABLE center_dive_sites 
ADD COLUMN currency VARCHAR(3) DEFAULT 'EUR' AFTER dive_cost;

-- Add currency field to gear_rental_costs table  
ALTER TABLE gear_rental_costs 
ADD COLUMN currency VARCHAR(3) DEFAULT 'EUR' AFTER cost;

-- Add indexes for better performance
CREATE INDEX idx_center_dive_sites_currency ON center_dive_sites(currency);
CREATE INDEX idx_gear_rental_costs_currency ON gear_rental_costs(currency);

-- Update existing records to have EUR as default currency
UPDATE center_dive_sites SET currency = 'EUR' WHERE currency IS NULL;
UPDATE gear_rental_costs SET currency = 'EUR' WHERE currency IS NULL; 