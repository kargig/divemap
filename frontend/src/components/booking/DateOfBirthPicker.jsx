import React, { useMemo } from 'react';

const MONTHS = [
  { val: '01', name: 'Jan' },
  { val: '02', name: 'Feb' },
  { val: '03', name: 'Mar' },
  { val: '04', name: 'Apr' },
  { val: '05', name: 'May' },
  { val: '06', name: 'Jun' },
  { val: '07', name: 'Jul' },
  { val: '08', name: 'Aug' },
  { val: '09', name: 'Sep' },
  { val: '10', name: 'Oct' },
  { val: '11', name: 'Nov' },
  { val: '12', name: 'Dec' },
];

const DateOfBirthPicker = ({
  value = '',
  onChange,
  required = false,
  label = 'Date of Birth *',
  minAge = 10,
  maxAge = 100,
}) => {
  // Parse incoming YYYY-MM-DD
  const { currentYear, currentMonth, currentDay } = useMemo(() => {
    if (!value || typeof value !== 'string') {
      return { currentYear: '', currentMonth: '', currentDay: '' };
    }
    const parts = value.split('-');
    if (parts.length === 3) {
      return {
        currentYear: parts[0] || '',
        currentMonth: parts[1] || '',
        currentDay: parts[2] || '',
      };
    }
    return { currentYear: '', currentMonth: '', currentDay: '' };
  }, [value]);

  const yearsList = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const list = [];
    for (let y = thisYear - minAge; y >= thisYear - maxAge; y--) {
      list.push(y);
    }
    return list;
  }, [minAge, maxAge]);

  const daysList = useMemo(() => {
    // Basic day count (defaults to 31)
    return Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  }, []);

  const handlePartChange = (part, partVal) => {
    const y = part === 'year' ? partVal : currentYear;
    const m = part === 'month' ? partVal : currentMonth;
    const d = part === 'day' ? partVal : currentDay;

    if (y && m && d) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange('');
    }
  };

  const isComplete = Boolean(currentYear && currentMonth && currentDay);

  return (
    <div>
      {label && (
        <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
          {label}
        </label>
      )}

      <div className='grid grid-cols-3 gap-1.5'>
        {/* Day */}
        <select
          value={currentDay}
          onChange={e => handlePartChange('day', e.target.value)}
          required={required}
          className={`w-full px-2 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 dark:text-gray-200 font-medium ${
            !currentDay && required
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value=''>Day</option>
          {daysList.map(d => (
            <option key={d} value={d}>
              {parseInt(d, 10)}
            </option>
          ))}
        </select>

        {/* Month */}
        <select
          value={currentMonth}
          onChange={e => handlePartChange('month', e.target.value)}
          required={required}
          className={`w-full px-2 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 dark:text-gray-200 font-medium ${
            !currentMonth && required
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value=''>Month</option>
          {MONTHS.map(m => (
            <option key={m.val} value={m.val}>
              {m.val} - {m.name}
            </option>
          ))}
        </select>

        {/* Year */}
        <select
          value={currentYear}
          onChange={e => handlePartChange('year', e.target.value)}
          required={required}
          className={`w-full px-2 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 dark:text-gray-200 font-medium ${
            !currentYear && required
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <option value=''>Year</option>
          {yearsList.map(y => (
            <option key={y} value={y.toString()}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {!isComplete && required && (
        <span className='text-[10px] text-amber-600 mt-1 block font-medium'>
          * Required for maritime harbor compliance
        </span>
      )}
    </div>
  );
};

export default DateOfBirthPicker;
