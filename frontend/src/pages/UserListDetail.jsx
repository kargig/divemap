import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bookmark,
  Eye,
  Globe,
  Lock,
  Trash2,
  Calendar,
  MessageSquare,
  ChevronLeft,
  Loader2,
  MapPin,
  FileText,
  GripVertical,
  Pencil,
  Fish,
  ChevronDown,
  Users,
  Plus,
  LogOut,
  X,
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
  addListCollaborator,
  removeListCollaborator,
  getUserFriendships,
} from '../api';
import Avatar from '../components/Avatar';
import ShareButton from '../components/ShareButton';
import Button from '../components/ui/Button';
import DifficultyBadge from '../components/ui/DifficultyBadge';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateHelpers';
import { getTagColor } from '../utils/tagHelpers';

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

const SortableListItem = ({
  item,
  index,
  isOwner,
  activeSiteId,
  setActiveSiteId,
  handleRemoveItem,
  handleItemNoteUpdate,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const notesRef = useRef(null);

  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = `${notesRef.current.scrollHeight}px`;
    }
  }, [item.notes]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    position: 'relative',
  };

  const site = item.dive_site;
  const isActive = activeSiteId === site.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`list-item-${site.id}`}
      className={`bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl py-3 px-3 sm:p-5 shadow-sm border-y sm:border transition-all duration-300 relative ${
        isActive
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-gray-200/50 dark:border-gray-700 hover:border-blue-100/50 dark:hover:border-blue-900/30'
      } ${isDragging ? 'shadow-lg ring-2 ring-blue-400/50 border-blue-400' : ''}`}
    >
      {/* Card Header Bar */}
      <div className='flex items-center justify-between gap-1.5 border-b border-gray-100/80 dark:border-gray-700/30 pb-1 mb-3'>
        <div className='flex items-center gap-1.5 sm:gap-2.5 min-w-0'>
          <div
            {...attributes}
            {...listeners}
            className='!-ml-2 sm:-ml-4 h-10 flex items-center !px-2 sm:!px-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-grab active:cursor-grabbing transition-colors touch-none select-none shrink-0'
            title='Drag to reorder'
          >
            <GripVertical className='h-4 w-4' />
          </div>
          <span className='shrink-0 min-w-[24px] h-10 flex items-center justify-center select-none'>
            <span className='w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 text-[10px] font-extrabold font-display flex items-center justify-center transition-colors'>
              {index + 1}
            </span>
          </span>
          <Link
            to={`/dive-sites/${site.id}/${site.slug || ''}`}
            className='text-base sm:text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors h-10 flex items-center'
          >
            {site.name}
          </Link>
        </div>

        <button
          onClick={() => handleRemoveItem(item.id)}
          className='text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors shrink-0'
          title='Remove from list'
        >
          <Trash2 className='h-4.5 w-4.5' />
        </button>
      </div>

      <div className='space-y-3 pl-0 sm:pl-7'>
        <p className='text-xs text-gray-400 dark:text-gray-500 font-semibold capitalize flex items-center gap-1'>
          <span>📍</span> {site.region ? `${site.region}, ` : ''}
          {site.country}
        </p>

        {/* Badges block */}
        <div className='flex flex-wrap gap-2 items-center'>
          <DifficultyBadge code={site.difficulty_code} label={site.difficulty_label} />
          {site.max_depth && (
            <span className='inline-flex items-center text-[10px] font-bold bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 border border-blue-100/50 dark:border-blue-900/30 px-2 py-0.5 rounded'>
              Max Depth: {site.max_depth}m
            </span>
          )}
          {site.tags?.map((tag, idx) => (
            <span
              key={idx}
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${getTagColor(tag.name || tag)}`}
            >
              {tag.name || tag}
            </span>
          ))}
        </div>

        {/* Marine Life */}
        {site.marine_life && (
          <div className='flex items-start gap-1.5 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-400 p-2 px-3 rounded-xl border border-emerald-100/50 dark:border-emerald-900/10 text-xs mt-1.5'>
            <Fish className='h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400' />
            <div>
              <span className='font-bold uppercase text-[9px] tracking-wider block mb-0.5 text-emerald-700 dark:text-emerald-300'>
                Marine Life
              </span>
              <p className='leading-normal font-normal'>{site.marine_life}</p>
            </div>
          </div>
        )}

        {/* Notes segment */}
        <div className='mt-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-2 px-3 border border-gray-100 dark:border-gray-800 relative group/notes hover:border-blue-200 dark:hover:border-blue-900/30 transition-colors duration-200'>
          <div className='hidden sm:flex items-center justify-between text-gray-400 group-hover/notes:text-blue-500 dark:group-hover/notes:text-blue-400 font-bold text-[10px] uppercase tracking-wider mb-1'>
            <div className='flex items-center gap-1'>
              <FileText className='h-3 w-3' />
              Notes
            </div>
            <span className='hidden sm:inline-block text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 px-1.5 py-0.5 rounded opacity-80 font-semibold uppercase tracking-normal normal-case'>
              Click to edit
            </span>
          </div>
          <textarea
            ref={notesRef}
            defaultValue={item.notes || ''}
            placeholder='Add notes, tips or landmarks...'
            onBlur={e => {
              const val = e.target.value.trim();
              if (val !== (item.notes || '')) {
                handleItemNoteUpdate(item.id, val || null);
              }
            }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            className='w-full text-xs text-gray-700 dark:text-gray-300 bg-transparent focus:outline-none py-0.5 resize-none overflow-hidden min-h-[24px]'
            rows={1}
          />
        </div>
      </div>
    </div>
  );
};

const UserListDetail = () => {
  const { username, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingMeta, setUpdatingMeta] = useState(false);
  const [activeSiteId, setActiveSiteId] = useState(null);
  const [showAddInstructions, setShowAddInstructions] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [buddies, setBuddies] = useState([]);
  const [buddiesLoading, setBuddiesLoading] = useState(false);

  const isOwner = user && list && user.id === list.user_id;
  const canEdit = isOwner || (list && list.is_collaborator);

  // Load buddies for adding collaborators (only list owner needs this)
  useEffect(() => {
    if (isOwner && showCollabModal) {
      const fetchBuddies = async () => {
        try {
          setBuddiesLoading(true);
          const data = await getUserFriendships('ACCEPTED');
          setBuddies(data);
        } catch (err) {
          console.error('Failed to load buddies:', err);
        } finally {
          setBuddiesLoading(false);
        }
      };
      fetchBuddies();
    }
  }, [isOwner, showCollabModal]);

  const filterAddableBuddies = () => {
    if (!list) return [];
    const collabUserIds = new Set(list.collaborators?.map(c => c.user_id) || []);
    collabUserIds.add(list.user_id); // Include owner

    return buddies
      .map(friendship => {
        if (!friendship.user || !friendship.friend) return null;
        return friendship.user.id === user.id ? friendship.friend : friendship.user;
      })
      .filter(buddyUser => buddyUser && !collabUserIds.has(buddyUser.id));
  };

  const handleAddCollab = async targetUsername => {
    try {
      const collab = await addListCollaborator(id, targetUsername);
      setList(prev => ({
        ...prev,
        collaborators: [...(prev.collaborators || []), collab],
      }));
      toast.success(`@${targetUsername} added as editor!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add buddy');
    }
  };

  const handleRemoveCollab = async collabUserId => {
    try {
      await removeListCollaborator(id, collabUserId);
      setList(prev => ({
        ...prev,
        collaborators: prev.collaborators.filter(c => c.user_id !== collabUserId),
      }));
      toast.success('Editor removed');
    } catch (err) {
      toast.error('Failed to remove buddy');
    }
  };

  const handleLeaveList = async () => {
    if (
      window.confirm(
        'Are you sure you want to leave this collaborative list? You will lose edit access.'
      )
    ) {
      try {
        await removeListCollaborator(id, user.id);
        toast.success('You have left the list');
        navigate('/profile');
      } catch (err) {
        toast.error('Failed to leave list');
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setShowAddInstructions(true);
    }
  }, []);

  // References for in-place edit input blurs
  const titleInputRef = useRef(null);
  const descInputRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    if (!canEdit) return;
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
    if (!canEdit) return;
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

  const handleDragEnd = async event => {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = list.items.findIndex(item => item.id === active.id);
    const newIndex = list.items.findIndex(item => item.id === over.id);

    const reorderedItems = arrayMove(list.items, oldIndex, newIndex);

    // Adjust orders locally
    reorderedItems.forEach((item, idx) => {
      item.display_order = idx;
    });

    setList(prev => ({ ...prev, items: reorderedItems }));

    try {
      await reorderListItems(
        id,
        reorderedItems.map(it => it.id)
      );
      toast.success('Collection order updated!');
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
      <div className='bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-0 sm:px-4 lg:px-6 xl:px-8 shadow-sm'>
        <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4 px-4 sm:px-0'>
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

              {/* Collaborator Roster */}
              {list.collaborators && list.collaborators.length > 0 && (
                <div className='flex items-center -space-x-1 ml-2 border-l border-gray-200 dark:border-gray-700 pl-2'>
                  {list.collaborators.map(c => (
                    <div key={c.id} className='relative group' title={`Editor: @${c.username}`}>
                      <Avatar
                        username={c.username}
                        size='xs'
                        className='ring-2 ring-white dark:ring-gray-800'
                      />
                      {isOwner && (
                        <button
                          onClick={() => handleRemoveCollab(c.user_id)}
                          className='absolute -top-1 -right-1 hidden group-hover:flex bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm'
                          title='Remove editor'
                        >
                          <X className='h-2.5 w-2.5' />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
              <Button variant='primary' size='sm' onClick={() => setShowCollabModal(true)}>
                <Plus className='h-4 w-4 mr-1' /> Collaborators
              </Button>
            )}
            {isOwner && !list.system_type && (
              <Button variant='danger' size='sm' onClick={handleDeleteList}>
                <Trash2 className='h-4 w-4 mr-1' /> Delete List
              </Button>
            )}
            {list.is_collaborator && (
              <Button variant='danger-outline' size='sm' onClick={handleLeaveList}>
                <LogOut className='h-4 w-4 mr-1' /> Leave List
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto mt-6 px-0 sm:px-4 lg:px-6 xl:px-8'>
        {/* Detail Header Block */}
        <div className='bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl p-4 sm:p-6 shadow-sm border-y sm:border border-gray-200/50 dark:border-gray-700 space-y-4 mb-6'>
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
            </div>

            {/* List Properties & Privacy Switches */}
            <div className='flex flex-wrap items-center gap-3 shrink-0'>
              {isOwner ? (
                <div className='flex flex-row flex-wrap items-center gap-4 p-2 px-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700/50'>
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

          {/* Description Block */}
          {isOwner ? (
            <div className='relative group/desc w-full mt-2'>
              <textarea
                ref={descInputRef}
                defaultValue={list.description || ''}
                placeholder='Write a description for this collection...'
                onBlur={e => {
                  const val = e.target.value.trim();
                  if (val !== (list.description || '')) {
                    handleMetaUpdate('description', val || null);
                  }
                }}
                className='text-sm text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50 focus:bg-white dark:focus:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700/80 hover:border-blue-300 dark:hover:border-blue-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10 focus:outline-none w-full p-3 pr-3 sm:pr-24 rounded-xl resize-y transition-all min-h-[64px]'
                rows={2}
              />
              <div className='absolute right-2.5 bottom-3.5 hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 pointer-events-none opacity-80 group-hover/desc:text-blue-500 dark:group-hover/desc:text-blue-400 transition-colors'>
                <Pencil className='h-3 w-3' />
                <span>Edit description</span>
              </div>
            </div>
          ) : (
            list.description && (
              <p className='text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-normal whitespace-pre-wrap mt-2'>
                {list.description}
              </p>
            )
          )}
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
            {canEdit && (
              <div className='bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl border border-blue-100/50 dark:border-blue-900/30 shadow-sm mb-4 overflow-hidden transition-all duration-300'>
                <button
                  onClick={() => setShowAddInstructions(!showAddInstructions)}
                  className='w-full p-4 flex items-center justify-between text-left gap-3 focus:outline-none group/accordion'
                >
                  <div className='flex items-center gap-2.5 min-w-0'>
                    <div className='p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 transition-colors group-hover/accordion:bg-blue-200 dark:group-hover/accordion:bg-blue-900/60'>
                      <Bookmark className='h-4 w-4' />
                    </div>
                    <h4 className='font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate group-hover/accordion:text-blue-600 dark:group-hover/accordion:text-blue-400 transition-colors'>
                      How to add more dive sites to this list
                    </h4>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform duration-300 shrink-0 group-hover/accordion:text-blue-500 ${
                      showAddInstructions ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  className={`transition-all duration-300 ease-in-out ${
                    showAddInstructions
                      ? 'max-h-[200px] border-t border-blue-100/30 dark:border-blue-900/10 opacity-100'
                      : 'max-h-0 opacity-0 pointer-events-none'
                  } overflow-hidden`}
                >
                  {showAddInstructions && (
                    <div className='p-4 pt-3 bg-white/40 dark:bg-gray-900/20'>
                      <p className='text-xs text-gray-600 dark:text-gray-400 leading-relaxed'>
                        Browse our global{' '}
                        <Link
                          to='/dive-sites'
                          className='text-blue-600 dark:text-blue-400 hover:underline font-semibold'
                        >
                          Dive Sites directory
                        </Link>{' '}
                        or{' '}
                        <Link
                          to='/map'
                          className='text-blue-600 dark:text-blue-400 hover:underline font-semibold'
                        >
                          Interactive Map
                        </Link>
                        . On any site's details page, click the{' '}
                        <span className='font-semibold'>Save to List</span> button to add it to{' '}
                        <span className='italic font-medium'>"{list.title}"</span> instantly.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
            ) : canEdit ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={list.items.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className='space-y-4'>
                    {list.items.map((item, index) => (
                      <SortableListItem
                        key={item.id}
                        item={item}
                        index={index}
                        isOwner={isOwner}
                        activeSiteId={activeSiteId}
                        setActiveSiteId={setActiveSiteId}
                        handleRemoveItem={handleRemoveItem}
                        handleItemNoteUpdate={handleItemNoteUpdate}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className='space-y-4'>
                {list.items.map((item, index) => {
                  const site = item.dive_site;
                  const isActive = activeSiteId === site.id;

                  return (
                    <div
                      key={item.id}
                      id={`list-item-${site.id}`}
                      className={`bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl py-3 px-3 sm:p-5 shadow-sm border-y sm:border transition-all duration-300 relative ${
                        isActive
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : 'border-gray-200/50 dark:border-gray-700 hover:border-blue-100/50 dark:hover:border-blue-900/30'
                      }`}
                    >
                      {/* Card Header Bar */}
                      <div className='flex items-center justify-between gap-1.5 border-b border-gray-100/80 dark:border-gray-700/30 pb-1 mb-3'>
                        <div className='flex items-center gap-1.5 sm:gap-2.5 min-w-0'>
                          <span className='shrink-0 min-w-[24px] h-10 flex items-center justify-center select-none'>
                            <span className='w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 text-[10px] font-extrabold font-display flex items-center justify-center transition-colors'>
                              {index + 1}
                            </span>
                          </span>
                          <Link
                            to={`/dive-sites/${site.id}/${site.slug || ''}`}
                            className='text-base sm:text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors h-10 flex items-center'
                          >
                            {site.name}
                          </Link>
                        </div>
                      </div>

                      <div className='space-y-3 pl-0 sm:pl-7'>
                        <p className='text-xs text-gray-400 dark:text-gray-500 font-semibold capitalize flex items-center gap-1'>
                          <span>📍</span> {site.region ? `${site.region}, ` : ''}
                          {site.country}
                        </p>

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
                          {site.tags?.map((tag, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${getTagColor(tag.name || tag)}`}
                            >
                              {tag.name || tag}
                            </span>
                          ))}
                        </div>

                        {/* Marine Life */}
                        {site.marine_life && (
                          <div className='flex items-start gap-1.5 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-400 p-2 px-3 rounded-xl border border-emerald-100/50 dark:border-emerald-900/10 text-xs mt-1.5'>
                            <Fish className='h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400' />
                            <div>
                              <span className='font-bold uppercase text-[9px] tracking-wider block mb-0.5 text-emerald-700 dark:text-emerald-300'>
                                Marine Life
                              </span>
                              <p className='leading-normal font-normal'>{site.marine_life}</p>
                            </div>
                          </div>
                        )}

                        {/* Notes segment */}
                        <div className='mt-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-2 px-3 border border-gray-100 dark:border-gray-800 relative'>
                          <div className='hidden sm:flex items-center gap-1 text-gray-400 font-bold text-[10px] uppercase tracking-wider mb-1'>
                            <FileText className='h-3 w-3' />
                            Notes
                          </div>
                          <p className='text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic'>
                            {item.notes || 'No notes written yet.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collaborator Modal / Dialog */}
      {showCollabModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] animate-fade-in'>
          <div className='bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl border border-gray-100 dark:border-gray-700 space-y-4'>
            <div className='flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3'>
              <h3 className='text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2'>
                <Users className='h-5 w-5 text-blue-600' />
                Manage Editors
              </h3>
              <button
                onClick={() => setShowCollabModal(false)}
                className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='space-y-4'>
              {/* Current Collaborators */}
              <div>
                <h4 className='text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2'>
                  Current Editors
                </h4>
                {list.collaborators && list.collaborators.length > 0 ? (
                  <div className='divide-y divide-gray-100 dark:divide-gray-700/50 max-h-40 overflow-y-auto pr-1'>
                    {list.collaborators.map(c => (
                      <div key={c.id} className='flex items-center justify-between py-2'>
                        <div className='flex items-center gap-2'>
                          <Avatar username={c.username} size='xs' />
                          <span className='text-sm font-semibold text-gray-800 dark:text-gray-200'>
                            @{c.username}
                          </span>
                        </div>
                        {isOwner && (
                          <button
                            onClick={() => handleRemoveCollab(c.user_id)}
                            className='text-xs font-bold text-red-500 hover:text-red-700'
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-xs text-gray-500 dark:text-gray-400 italic'>
                    No collaborators added yet.
                  </p>
                )}
              </div>

              {/* Add Collaborator */}
              {isOwner && (
                <div>
                  <h4 className='text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2'>
                    Add Editor
                  </h4>
                  {buddiesLoading ? (
                    <div className='flex justify-center py-2'>
                      <Loader2 className='animate-spin h-5 w-5 text-blue-600' />
                    </div>
                  ) : filterAddableBuddies().length > 0 ? (
                    <div className='divide-y divide-gray-100 dark:divide-gray-700/50 max-h-40 overflow-y-auto pr-1'>
                      {filterAddableBuddies().map(buddyUser => (
                        <div
                          key={buddyUser.id}
                          className='flex items-center justify-between py-2 hover:bg-blue-100/50 dark:hover:bg-blue-900/40 px-2 rounded-lg transition-colors'
                        >
                          <div className='flex items-center gap-2'>
                            <Avatar username={buddyUser.username} size='xs' />
                            <span className='text-sm font-semibold text-gray-800 dark:text-gray-200'>
                              @{buddyUser.username}
                            </span>
                          </div>
                          <button
                            onClick={() => handleAddCollab(buddyUser.username)}
                            className='inline-flex items-center gap-1 text-xs font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 px-2 py-1 rounded-md'
                          >
                            <Plus className='h-3 w-3' /> Add
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className='text-xs text-gray-500 dark:text-gray-400 italic'>
                      No addable buddies. Only accepted buddies can be added.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserListDetail;
