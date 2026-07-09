import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bookmark,
  Eye,
  Globe,
  Lock,
  ArrowUp,
  ArrowDown,
  Trash2,
  Calendar,
  MessageSquare,
  ChevronLeft,
  Loader2,
  MapPin,
  FileText,
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useParams, Link, useNavigate } from 'react-router-dom';

import {
  getListById,
  updateList,
  deleteList,
  updateListItem,
  deleteListItem,
  reorderListItems,
} from '../api';
import Avatar from '../components/Avatar';
import ShareButton from '../components/ShareButton';
import Button from '../components/ui/Button';
import DifficultyBadge from '../components/ui/DifficultyBadge';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateHelpers';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to adjust bounds of Leaflet map dynamically
const SetMapBounds = ({ items }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || items.length === 0) return;
    const points = items
      .filter(item => item.dive_site?.latitude && item.dive_site?.longitude)
      .map(item => [Number(item.dive_site.latitude), Number(item.dive_site.longitude)]);
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [map, items]);
  return null;
};

const UserListDetail = () => {
  const { username, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingMeta, setUpdatingMeta] = useState(false);
  const [activeSiteId, setActiveSiteId] = useState(null);

  // References for in-place edit input blurs
  const titleInputRef = useRef(null);
  const descInputRef = useRef(null);

  const isOwner = user && list && user.id === list.user_id;

  const fetchListDetails = async () => {
    try {
      setLoading(true);
      const data = await getListById(id);
      setList(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load list details. It may be private or deleted.');
      navigate('/profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListDetails();
  }, [id]);

  const handleMetaUpdate = async (field, value) => {
    if (!isOwner) return;
    try {
      setUpdatingMeta(true);
      const updated = await updateList(id, { [field]: value });
      setList(prev => ({
        ...prev,
        title: updated.title,
        description: updated.description,
        is_public: updated.is_public,
        show_on_profile: updated.show_on_profile,
        slug: updated.slug,
      }));
    } catch (err) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setUpdatingMeta(false);
    }
  };

  const handleItemNoteUpdate = async (itemId, notes) => {
    if (!isOwner) return;
    try {
      await updateListItem(id, itemId, { notes });
      setList(prev => ({
        ...prev,
        items: prev.items.map(item => (item.id === itemId ? { ...item, notes } : item)),
      }));
      toast.success('Note updated!');
    } catch (err) {
      toast.error('Failed to save note');
    }
  };

  const handleRemoveItem = async itemId => {
    if (!isOwner) return;
    if (window.confirm('Are you sure you want to remove this dive site from your collection?')) {
      try {
        await deleteListItem(id, itemId);
        setList(prev => ({
          ...prev,
          items: prev.items.filter(item => item.id !== itemId),
        }));
        toast.success('Site removed successfully!');
      } catch (err) {
        toast.error('Failed to remove site');
      }
    }
  };

  const handleMoveItem = async (index, direction) => {
    if (!isOwner) return;
    const newItems = [...list.items];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    // Swap elements
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Adjust orders locally
    newItems.forEach((item, idx) => {
      item.display_order = idx;
    });

    setList(prev => ({ ...prev, items: newItems }));

    try {
      await reorderListItems(
        id,
        newItems.map(it => it.id)
      );
    } catch (err) {
      toast.error('Failed to save collection order');
    }
  };

  const handleDeleteList = async () => {
    if (!isOwner) return;
    if (list.system_type) {
      toast.error('System lists cannot be deleted');
      return;
    }
    if (
      window.confirm(
        `Are you absolutely sure you want to delete the list "${list.title}"? This cannot be undone.`
      )
    ) {
      try {
        await deleteList(id);
        toast.success('Collection deleted successfully!');
        navigate('/profile');
      } catch (err) {
        toast.error('Failed to delete list');
      }
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <Loader2 className='animate-spin text-blue-600 dark:text-blue-400 h-10 w-10' />
      </div>
    );
  }

  if (!list) return null;

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 pb-12'>
      {/* Top Banner/Navigation */}
      <div className='bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-4 sm:px-6 lg:px-8 shadow-sm'>
        <div className='max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4'>
          <div className='flex items-center gap-2'>
            <button
              onClick={() => navigate(-1)}
              className='flex items-center text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 gap-1'
            >
              <ChevronLeft className='h-4 w-4' /> Back
            </button>
            <span className='text-gray-300 dark:text-gray-600'>|</span>
            <div className='flex items-center gap-2'>
              <Avatar username={username} size='xs' />
              <Link
                to={`/users/${username}`}
                className='text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline'
              >
                @{username}
              </Link>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            {list.is_public && (
              <ShareButton
                entityType='list'
                entityData={list}
                className='inline-flex items-center text-xs font-semibold px-3 py-2 border rounded-md shadow-sm border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              />
            )}
            {isOwner && !list.system_type && (
              <Button
                variant='outline'
                size='sm'
                onClick={handleDeleteList}
                className='text-red-500 hover:text-red-700 dark:text-red-400 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20'
              >
                <Trash2 className='h-4 w-4 mr-1' /> Delete List
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto mt-6 px-4 sm:px-6 lg:px-8'>
        {/* Detail Header Block */}
        <div className='bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700 space-y-4 mb-6'>
          <div className='flex flex-col md:flex-row md:items-start justify-between gap-4'>
            <div className='space-y-2 flex-1 min-w-0'>
              {isOwner && !list.system_type ? (
                <input
                  ref={titleInputRef}
                  type='text'
                  defaultValue={list.title}
                  onBlur={e => {
                    const val = e.target.value.trim();
                    if (val && val !== list.title) {
                      handleMetaUpdate('title', val);
                    }
                  }}
                  className='text-2xl sm:text-3xl font-display font-extrabold text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full pb-1'
                  title='Click to edit title'
                />
              ) : (
                <h1 className='text-2xl sm:text-3xl font-display font-extrabold text-gray-900 dark:text-white break-words leading-tight flex items-center gap-2'>
                  <Bookmark className='h-7 w-7 text-blue-600 dark:text-blue-400 shrink-0' />
                  {list.title}
                </h1>
              )}

              {isOwner ? (
                <textarea
                  ref={descInputRef}
                  defaultValue={list.description || ''}
                  placeholder='Write an optional description for this collection...'
                  onBlur={e => {
                    const val = e.target.value.trim();
                    if (val !== (list.description || '')) {
                      handleMetaUpdate('description', val || null);
                    }
                  }}
                  className='text-sm text-gray-500 dark:text-gray-400 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none w-full p-1 rounded-md resize-y'
                  rows={2}
                />
              ) : (
                list.description && (
                  <p className='text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-normal whitespace-pre-wrap'>
                    {list.description}
                  </p>
                )
              )}
            </div>

            {/* List Properties & Privacy Switches */}
            <div className='flex flex-wrap items-center gap-3 shrink-0'>
              {isOwner ? (
                <div className='flex flex-col sm:flex-row gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700/50'>
                  <label className='flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={list.is_public}
                      onChange={e => handleMetaUpdate('is_public', e.target.checked)}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
                    />
                    <span className='flex items-center gap-1 uppercase tracking-wider'>
                      {list.is_public ? (
                        <Globe size={13} className='text-green-500' />
                      ) : (
                        <Lock size={13} className='text-amber-500' />
                      )}
                      Public
                    </span>
                  </label>

                  <label
                    className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                      !list.is_public
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type='checkbox'
                      checked={list.is_public && list.show_on_profile}
                      onChange={e => handleMetaUpdate('show_on_profile', e.target.checked)}
                      disabled={!list.is_public}
                      className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 ${
                        !list.is_public ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <span>On Profile</span>
                  </label>
                </div>
              ) : (
                <div className='flex items-center gap-2'>
                  <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border gap-1 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-500'>
                    {list.is_public ? (
                      <>
                        <Globe size={12} className='text-green-500' /> Public Collection
                      </>
                    ) : (
                      <>
                        <Lock size={12} className='text-amber-500' /> Private Collection
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Views & Metrics */}
              <div className='flex gap-2 text-xs font-bold text-gray-400 bg-gray-50 dark:bg-gray-900 border px-3 py-1.5 rounded-lg border-gray-100 dark:border-gray-700'>
                <span className='flex items-center gap-1'>
                  <Calendar className='h-3.5 w-3.5' /> Created {formatDate(list.created_at)}
                </span>
                <span className='text-gray-200 dark:text-gray-700'>|</span>
                <span className='flex items-center gap-1'>
                  <Eye className='h-3.5 w-3.5' /> {list.view_count || 0} views
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Double Splitscreen Column Layout (Map + Cards List) */}
        <div className='grid grid-cols-1 lg:grid-cols-5 gap-6 items-start'>
          {/* Map Column (Lg: spans 2/5) */}
          <div className='lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700 overflow-hidden h-[300px] lg:h-[650px] lg:sticky lg:top-6 z-10'>
            <MapContainer
              center={[37.9838, 23.7275]} // Athens backup center
              zoom={6}
              className='w-full h-full'
              style={{ zIndex: 1 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
              />
              <SetMapBounds items={list.items} />
              {list.items
                .filter(item => item.dive_site?.latitude && item.dive_site?.longitude)
                .map(item => (
                  <Marker
                    key={item.id}
                    position={[Number(item.dive_site.latitude), Number(item.dive_site.longitude)]}
                    eventHandlers={{
                      click: () => setActiveSiteId(item.dive_site.id),
                    }}
                  >
                    <Popup>
                      <div className='p-1'>
                        <h4 className='font-bold text-sm leading-snug'>{item.dive_site.name}</h4>
                        <p className='text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize'>
                          📍 {item.dive_site.region}, {item.dive_site.country}
                        </p>
                        <Link
                          to={`/dive-sites/${item.dive_site.id}/${item.dive_site.slug || ''}`}
                          className='text-xs text-blue-600 hover:underline font-bold block mt-2'
                        >
                          View Details
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>

          {/* Cards Column (Lg: spans 3/5) */}
          <div className='lg:col-span-3 space-y-4'>
            {list.items.length === 0 ? (
              <div className='bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-sm border border-gray-200/50 dark:border-gray-700 text-center space-y-2'>
                <MapPin className='h-12 w-12 text-gray-300 mx-auto' />
                <h3 className='text-lg font-bold text-gray-800 dark:text-gray-200'>
                  Empty Collection
                </h3>
                <p className='text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto'>
                  No dive sites have been added to this list yet. Discover top dive sites on Divemap
                  and save them to list!
                </p>
                <div className='pt-2'>
                  <Link to='/dive-sites'>
                    <Button size='sm'>Browse Dive Sites</Button>
                  </Link>
                </div>
              </div>
            ) : (
              list.items.map((item, index) => {
                const site = item.dive_site;
                const isActive = activeSiteId === site.id;

                return (
                  <div
                    key={item.id}
                    id={`list-item-${site.id}`}
                    className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border transition-all duration-300 relative ${
                      isActive
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-gray-200/50 dark:border-gray-700 hover:border-blue-100/50 dark:hover:border-blue-900/30'
                    }`}
                  >
                    <div className='flex gap-4 items-start'>
                      {/* Ranking Index / Reordering Controls */}
                      <div className='flex flex-col items-center gap-1 shrink-0 p-1 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700/50 w-10 sm:w-12'>
                        {isOwner && (
                          <button
                            onClick={() => handleMoveItem(index, -1)}
                            disabled={index === 0}
                            className='p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30'
                            title='Move Up'
                          >
                            <ArrowUp className='h-4 w-4' />
                          </button>
                        )}
                        <span className='font-display font-extrabold text-lg text-gray-900 dark:text-white'>
                          {index + 1}
                        </span>
                        {isOwner && (
                          <button
                            onClick={() => handleMoveItem(index, 1)}
                            disabled={index === list.items.length - 1}
                            className='p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30'
                            title='Move Down'
                          >
                            <ArrowDown className='h-4 w-4' />
                          </button>
                        )}
                      </div>

                      {/* Item Meta & Actions */}
                      <div className='flex-1 min-w-0 space-y-3'>
                        <div className='flex justify-between items-start gap-2'>
                          <div className='min-w-0'>
                            <Link
                              to={`/dive-sites/${site.id}/${site.slug || ''}`}
                              className='text-base sm:text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors block truncate'
                            >
                              {site.name}
                            </Link>
                            <p className='text-xs text-gray-400 dark:text-gray-500 font-medium truncate mt-0.5 capitalize'>
                              📍 {site.region ? `${site.region}, ` : ''}
                              {site.country}
                            </p>
                          </div>
                          {isOwner && (
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className='text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors'
                              title='Remove from list'
                            >
                              <Trash2 className='h-4.5 w-4.5' />
                            </button>
                          )}
                        </div>

                        {/* Badges block */}
                        <div className='flex flex-wrap gap-2 items-center'>
                          <DifficultyBadge
                            code={site.difficulty_code}
                            label={site.difficulty_label}
                          />
                          {site.max_depth && (
                            <span className='inline-flex items-center text-[10px] font-bold bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded'>
                              Max Depth: {site.max_depth}m
                            </span>
                          )}
                        </div>

                        {/* Custom notes segment */}
                        <div className='mt-3 bg-blue-50/20 dark:bg-blue-950/10 rounded-xl p-4 border border-blue-100/30 dark:border-blue-900/10 relative'>
                          <div className='flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider mb-1.5'>
                            <FileText className='h-3.5 w-3.5' />
                            {isOwner ? 'Custom Annotations (Editable)' : 'Curator Annotations'}
                          </div>
                          {isOwner ? (
                            <textarea
                              defaultValue={item.notes || ''}
                              placeholder='Add some personal tips, landmarks or directions for this dive site...'
                              onBlur={e => {
                                const val = e.target.value.trim();
                                if (val !== (item.notes || '')) {
                                  handleItemNoteUpdate(item.id, val || null);
                                }
                              }}
                              className='w-full text-sm text-gray-700 dark:text-gray-300 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none py-1 resize-y min-h-[48px]'
                            />
                          ) : (
                            <p className='text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic'>
                              {item.notes || 'No annotations written yet.'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserListDetail;
