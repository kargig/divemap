import {
  NavBar,
  SearchBar,
  Card,
  SwipeAction,
  Button,
  Popup,
  Tag,
  Space,
  Form,
  Selector,
  Stepper,
} from 'antd-mobile';
import { FilterOutline } from 'antd-mobile-icons';
import { useState } from 'react';

import { useAdminDives } from '../hooks/useAdminDives';
import usePageTitle from '../hooks/usePageTitle';
import { getDifficultyOptions } from '../utils/difficultyHelpers';

const AdminDivesMobile = () => {
  usePageTitle('Divemap - Admin - Dives');
  const [filterVisible, setFilterVisible] = useState(false);

  const {
    // State
    searchInput,
    setSearchInput,
    filters,

    // Data
    dives,
    isLoading,
    totalCount,
    pagination,
    setPagination,

    // Handlers
    handleEditDive,
    handleDeleteDive,
    handleFilterChange,
    clearFilters,
    debouncedSearch,
  } = useAdminDives();

  const difficultyOptions = getDifficultyOptions()
    .filter(o => o.value !== null)
    .map(o => ({ label: o.label, value: o.value }));

  const suitOptions = [
    { label: 'Wet Suit', value: 'wet_suit' },
    { label: 'Dry Suit', value: 'dry_suit' },
    { label: 'Shortie', value: 'shortie' },
  ];

  const rightActions = dive => [
    {
      key: 'edit',
      text: 'Edit',
      color: 'primary',
      onClick: () => handleEditDive(dive),
    },
    {
      key: 'delete',
      text: 'Delete',
      color: 'danger',
      onClick: () => handleDeleteDive(dive),
    },
  ];

  const handlePageChange = newPage => {
    setPagination(prev => ({ ...prev, pageIndex: newPage }));
  };

  const hasNextPage = (pagination.pageIndex + 1) * pagination.pageSize < (totalCount || 0);
  const hasPrevPage = pagination.pageIndex > 0;

  return (
    <div style={{ paddingBottom: '20px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff' }}>
        <NavBar
          back={null} // No back button on root admin page typically, or add explicit home link
          right={
            <div style={{ fontSize: 24, display: 'flex', gap: '12px' }}>
              <FilterOutline onClick={() => setFilterVisible(true)} />
            </div>
          }
        >
          Dive Management
        </NavBar>
        <div style={{ padding: '10px' }}>
          <SearchBar
            placeholder='Search dives...'
            value={searchInput}
            onChange={val => {
              setSearchInput(val);
              debouncedSearch(val);
            }}
          />
        </div>
      </div>

      <div style={{ padding: '10px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          <Space direction='vertical' block>
            {dives?.map(dive => (
              <SwipeAction
                key={dive.id}
                rightActions={rightActions(dive)}
                style={{ borderRadius: '8px', overflow: 'hidden' }}
              >
                <Card
                  title={dive.name}
                  extra={
                    <Tag color={dive.is_private ? 'danger' : 'success'}>
                      {dive.is_private ? 'Private' : 'Public'}
                    </Tag>
                  }
                  style={{ borderRadius: 0 }} // Reset border radius since container handles it
                >
                  <Space
                    direction='vertical'
                    style={{ '--gap': '4px', fontSize: '14px', color: '#666' }}
                  >
                    <div>User: {dive.user_username}</div>
                    <div>Site: {dive.dive_site?.name || 'No Site'}</div>
                    <div>Date: {dive.dive_date}</div>
                    <div>
                      Rating:{' '}
                      <span style={{ color: '#faad14', fontWeight: 'bold' }}>
                        {dive.user_rating ? dive.user_rating : '-'}
                      </span>
                      /10
                    </div>
                  </Space>
                </Card>
              </SwipeAction>
            ))}

            {(!dives || dives.length === 0) && (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                No dives found.
              </div>
            )}
          </Space>
        )}
      </div>

      {/* Mobile Pagination */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', padding: '20px' }}>
        <Button disabled={!hasPrevPage} onClick={() => handlePageChange(pagination.pageIndex - 1)}>
          Prev
        </Button>
        <Button disabled>Page {pagination.pageIndex + 1}</Button>
        <Button disabled={!hasNextPage} onClick={() => handlePageChange(pagination.pageIndex + 1)}>
          Next
        </Button>
      </div>

      {/* Filter Popup */}
      <Popup
        visible={filterVisible}
        onMaskClick={() => setFilterVisible(false)}
        position='right'
        bodyStyle={{ width: '85vw' }}
      >
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #eee',
              fontSize: '18px',
              fontWeight: 'bold',
            }}
          >
            Filters
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <Form layout='vertical'>
              <Form.Header>General</Form.Header>
              <Form.Item label='Difficulty'>
                <Selector
                  columns={1}
                  options={[{ label: 'Any', value: '' }, ...difficultyOptions]}
                  value={[filters.difficulty_code || '']}
                  onChange={v => handleFilterChange('difficulty_code', v[0])}
                />
              </Form.Item>

              <Form.Item label='Suit Type'>
                <Selector
                  columns={2}
                  options={[{ label: 'Any', value: '' }, ...suitOptions]}
                  value={[filters.suit_type || '']}
                  onChange={v => handleFilterChange('suit_type', v[0])}
                />
              </Form.Item>

              <Form.Item label='Min Rating'>
                <Stepper
                  min={0}
                  max={10}
                  value={filters.min_rating ? parseInt(filters.min_rating) : 0}
                  onChange={v => handleFilterChange('min_rating', v)}
                />
              </Form.Item>

              <Form.Item label='Max Rating'>
                <Stepper
                  min={0}
                  max={10}
                  value={filters.max_rating ? parseInt(filters.max_rating) : 10}
                  onChange={v => handleFilterChange('max_rating', v)}
                />
              </Form.Item>
            </Form>
          </div>
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid #eee',
              display: 'flex',
              gap: '10px',
            }}
          >
            <Button block onClick={clearFilters}>
              Reset
            </Button>
            <Button block color='primary' onClick={() => setFilterVisible(false)}>
              Done
            </Button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default AdminDivesMobile;
