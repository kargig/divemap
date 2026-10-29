import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const TabsContext = createContext();

export const Tabs = ({ defaultValue, value, onValueChange, children, className = '' }) => {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultValue);

  const isControlled = value !== undefined;
  const activeTab = isControlled ? value : internalActiveTab;

  const handleTabChange = useCallback(
    newValue => {
      if (!isControlled) {
        setInternalActiveTab(newValue);
      }
      if (onValueChange) {
        onValueChange(newValue);
      }
    },
    [isControlled, onValueChange]
  );

  const contextValue = useMemo(
    () => ({
      activeTab,
      setActiveTab: handleTabChange,
    }),
    [activeTab, handleTabChange]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = '' }) => {
  return (
    <div
      className={`inline-flex h-auto items-center justify-start rounded-lg bg-gray-100 dark:bg-slate-800 p-1 text-gray-500 dark:text-slate-400 overflow-x-auto max-w-full ${className}`}
    >
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, className = '' }) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      type='button'
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white dark:ring-offset-slate-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 dark:focus-visible:ring-slate-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-white dark:bg-slate-700 text-gray-950 dark:text-slate-100 shadow-sm'
          : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-700/50 hover:text-gray-700 dark:hover:text-slate-200'
      } ${className}`}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = '' }) => {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== value) return null;
  return (
    <div
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  );
};
