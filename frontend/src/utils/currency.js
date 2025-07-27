// Currency utility functions
// Supports the top 10 currencies by market cap/trading volume

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' }
];

export const DEFAULT_CURRENCY = 'EUR';

/**
 * Get currency info by code
 * @param {string} code - Currency code (e.g., 'USD', 'EUR')
 * @returns {Object|null} Currency object or null if not found
 */
export const getCurrencyInfo = (code) => {
  return SUPPORTED_CURRENCIES.find(currency => currency.code === code) || null;
};

/**
 * Format cost with currency symbol
 * @param {number} cost - The cost amount
 * @param {string} currencyCode - Currency code (e.g., 'USD', 'EUR')
 * @param {Object} options - Formatting options
 * @returns {string} Formatted cost string
 */
export const formatCost = (cost, currencyCode = DEFAULT_CURRENCY, options = {}) => {
  if (cost === null || cost === undefined) return '';
  
  const currency = getCurrencyInfo(currencyCode);
  if (!currency) {
    // Fallback to currency code if not found
    return `${cost} ${currencyCode}`;
  }

  const {
    showSymbol = true,
    showCode = false,
    showFlag = false,
    decimalPlaces = 2
  } = options;

  const formattedCost = Number(cost).toFixed(decimalPlaces);
  
  let result = '';
  
  if (showFlag && currency.flag) {
    result += `${currency.flag} `;
  }
  
  if (showSymbol) {
    result += `${currency.symbol}${formattedCost}`;
  } else {
    result += formattedCost;
  }
  
  if (showCode) {
    result += ` ${currencyCode}`;
  }
  
  return result;
};

/**
 * Get currency options for select dropdowns
 * @returns {Array} Array of currency options for select elements
 */
export const getCurrencyOptions = () => {
  return SUPPORTED_CURRENCIES.map(currency => ({
    value: currency.code,
    label: `${currency.flag} ${currency.code} - ${currency.name}`
  }));
};

/**
 * Validate currency code
 * @param {string} code - Currency code to validate
 * @returns {boolean} True if valid, false otherwise
 */
export const isValidCurrency = (code) => {
  return SUPPORTED_CURRENCIES.some(currency => currency.code === code);
};

/**
 * Get default currency info
 * @returns {Object} Default currency object
 */
export const getDefaultCurrency = () => {
  return getCurrencyInfo(DEFAULT_CURRENCY);
}; 