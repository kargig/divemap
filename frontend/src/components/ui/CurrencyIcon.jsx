import { DollarSign, Euro, PoundSterling, JapaneseYen, Banknote } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

const CurrencyIcon = ({ currencyCode, ...props }) => {
  const code = currencyCode?.toUpperCase() || 'EUR';

  if (code === 'EUR') {
    return <Euro {...props} />;
  }
  if (['USD', 'CAD', 'AUD', 'HKD', 'NZD'].includes(code)) {
    return <DollarSign {...props} />;
  }
  if (code === 'GBP') {
    return <PoundSterling {...props} />;
  }
  if (['JPY', 'CNY'].includes(code)) {
    return <JapaneseYen {...props} />;
  }

  return <Banknote {...props} />;
};

CurrencyIcon.propTypes = {
  currencyCode: PropTypes.string,
};

export default CurrencyIcon;
