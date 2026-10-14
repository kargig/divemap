import React, { useState, useEffect, useMemo } from 'react';

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
  // Local state so selecting one part immediately reflects in the UI
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Sync from incoming prop if initialized or changed externally
  useEffect(() => {
    if (value && typeof value === 'string') {
      const parts = value.split('-');
      if (parts.length === 3) {
        setSelectedYear(parts[0] || '');
        setSelectedMonth(parts[1] || '');
        setSelectedDay(parts[2] || '');
      }
    } else if (!value) {
      // Only clear if all were set to prevent wiping partial selections
      setSelectedYear(prev => (prev ? prev : ''));
    }
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
    return Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  }, []);

  const handlePartChange = (part, val) => {
    let nextYear = selectedYear;
    let nextMonth = selectedMonth;
    let nextDay = selectedDay;

    if (part === 'year') {
      setSelectedYear(val);
      nextYear = val;
    } else if (part === 'month') {
      setSelectedMonth(val);
      nextMonth = val;
    } else if (part === 'day') {
      setSelectedDay(val);
      nextDay = val;
    }

    if (nextYear && nextMonth && nextDay) {
      onChange(`${nextYear}-${nextMonth}-${nextDay}`);
    } else {
      onChange('');
    }
  };

  const isComplete = Boolean(selectedYear && selectedMonth && selectedDay);

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
          value={selectedDay}
          onChange={e => handlePartChange('day', e.target.value)}
          required={required}
          className={`w-full px-2 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 dark:text-gray-200 font-medium ${
            !selectedDay && required
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
          value={selectedMonth}
          onChange={e => handlePartChange('month', e.target.value)}
          required={required}
          className={`w-full px-2 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 dark:text-gray-200 font-medium ${
            !selectedMonth && required
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
          value={selectedYear}
          onChange={e => handlePartChange('year', e.target.value)}
          required={required}
          className={`w-full px-2 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 dark:text-gray-200 font-medium ${
            !selectedYear && required
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
