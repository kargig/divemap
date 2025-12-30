import { Search, Map, Building, Anchor, Calendar, Route } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { searchGlobal } from '../api';

import Combobox from './ui/Combobox';

// Icon mapping for entity types
const ENTITY_ICONS = {
  Map: Map,
  Building: Building,
  Anchor: Anchor,
  Calendar: Calendar,
  Route: Route,
};

const GlobalSearchBar = ({
  className = '',
  inputClassName = '',
  placeholder = 'Search dives, sites, centers...',
  popoverClassName,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const performSearch = useCallback(async searchQuery => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await searchGlobal(searchQuery.trim(), 8);
      setResults(data);
    } catch (err) {
      console.error('Global search error:', err);
      setError(err.message || 'Search failed');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 3) {
        performSearch(query);
      } else {
        setResults(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const groups = useMemo(() => {
    if (!results || !results.results) return [];

    return results.results.map(group => {
      const IconComponent = ENTITY_ICONS[group.icon_name] || Search;
      return {
        label: group.entity_type.replace(/_/g, ' '),
        options: group.results.map(item => ({
          value: `${group.entity_type}-${item.id}`,
          label: item.name,
          item: item,
          icon: <IconComponent />,
        })),
      };
    });
  }, [results]);

  const handleValueChange = value => {
    // Find the item in groups
    for (const group of groups) {
      const option = group.options.find(opt => opt.value === value);
      if (option) {
        navigate(option.item.route_path);
        setQuery('');
        setResults(null);
        return;
      }
    }
  };

  const renderResultItem = option => {
    const { item, icon } = option;
    return (
      <div className='flex items-start space-x-3 w-full py-0.5'>
        <div className='mt-0.5 text-gray-400'>{icon}</div>
        <div className='flex-1 min-w-0'>
          <div className='font-medium text-gray-900 truncate'>{item.name}</div>
          {item.metadata && (
            <div className='text-xs text-gray-500 mt-0.5'>
              {item.metadata.country && <span>{item.metadata.country}</span>}
              {item.metadata.region && item.metadata.country && (
                <span>, {item.metadata.region}</span>
              )}
              {item.metadata.dive_date && <span className='ml-2'>{item.metadata.dive_date}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Combobox
      className={className}
      placeholder={placeholder}
      searchPlaceholder='Type to search everywhere...'
      groups={groups}
      value='' // Always clear on selection
      onValueChange={handleValueChange}
      onSearchChange={setQuery}
      searchTerm={query}
      isLoading={isLoading}
      renderItem={renderResultItem}
      emptyMessage={
        query.length >= 3 ? `No results found for "${query}"` : 'Type at least 3 characters...'
      }
      error={error}
      popoverClassName={popoverClassName}
    />
  );
};

GlobalSearchBar.propTypes = {
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  placeholder: PropTypes.string,
  popoverClassName: PropTypes.string,
};

export default GlobalSearchBar;
