import { Card, Popconfirm, Tag, Tooltip } from 'antd';
import {
  Gauge,
  Plus,
  Edit2,
  Trash2,
  Star,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Shield,
  Layers,
  Droplet,
  Compass,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import api from '../api';
import SEO from '../components/SEO';
import UserGearProfileModal from '../components/UserGearProfileModal';

const DiverGearProfilesPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [cylinders, setCylinders] = useState([]);
  const [gasMixes, setGasMixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unitSystem, setUnitSystem] = useState('METRIC');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const fetchProfilesAndCatalogs = async () => {
    try {
      setLoading(true);
      const [profilesRes, cylRes, gasRes] = await Promise.all([
        api.get('/api/v1/bookings/gear-profiles'),
        api.get('/api/v1/bookings/cylinders'),
        api.get('/api/v1/bookings/gas-mixes'),
      ]);

      const profs = profilesRes.data || [];
      setProfiles(profs);
      setCylinders(cylRes.data || []);
      setGasMixes(gasRes.data || []);

      const defaultProf = profs.find(p => p.is_default) || profs[0];
      if (defaultProf?.preferred_unit_system) {
        setUnitSystem(defaultProf.preferred_unit_system);
      }
    } catch (err) {
      console.error('Failed to load gear profiles:', err);
      toast.error('Failed to load gear configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfilesAndCatalogs();
  }, []);

  const handleSetDefault = async profileId => {
    try {
      await api.post(`/api/v1/bookings/gear-profiles/${profileId}/set-default`);
      toast.success('Primary gear configuration updated!');
      fetchProfilesAndCatalogs();
    } catch (err) {
      console.error('Failed to set default profile:', err);
      toast.error('Failed to update primary configuration.');
    }
  };

  const handleDelete = async profileId => {
    try {
      await api.delete(`/api/v1/bookings/gear-profiles/${profileId}`);
      toast.success('Gear profile deleted.');
      fetchProfilesAndCatalogs();
    } catch (err) {
      console.error('Failed to delete profile:', err);
      const msg = err.response?.data?.detail || 'Failed to delete gear profile.';
      toast.error(msg);
    }
  };

  const handleOpenCreate = () => {
    setSelectedProfile(null);
    setModalOpen(true);
  };

  const handleOpenEdit = prof => {
    setSelectedProfile(prof);
    setModalOpen(true);
  };

  // Helper formatting for cylinder & gas
  const getCylinderLabel = id => {
    const c = cylinders.find(item => item.id === id);
    return c ? `${c.name} (${c.material.toUpperCase()})` : id;
  };

  const getGasLabel = id => {
    const g = gasMixes.find(item => item.id === id);
    return g ? g.name : id;
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 pb-16 transition-colors duration-200'>
      <SEO
        title='Diving Gear & Sizing Configurations'
        description='Manage multiple equipment setups, cylinder preferences, and sizing profiles on Divemap.'
      />

      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-6'>
        {/* Navigation Breadcrumb */}
        <Link
          to='/profile'
          className='inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-6 transition-colors'
        >
          <ChevronLeft size={18} className='mr-1' />
          Back to Profile
        </Link>

        {/* Header Bar */}
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700'>
          <div>
            <h1 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2.5'>
              <Gauge className='h-6 w-6 text-blue-600' />
              Diving Gear & Equipment Configurations
            </h1>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl'>
              Create and switch between tailored equipment setups for tropical travel, cold water
              semi-dry, or technical twinset dives. Select your primary setup to auto-fill trip
              bookings.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            {/* Unit Toggle */}
            <div className='flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-lg border border-gray-200 dark:border-gray-600'>
              <button
                type='button'
                onClick={() => setUnitSystem('METRIC')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  unitSystem === 'METRIC'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                Metric (cm / kg / EU)
              </button>
              <button
                type='button'
                onClick={() => setUnitSystem('IMPERIAL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  unitSystem === 'IMPERIAL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                Imperial (ft / lbs / US)
              </button>
            </div>

            {/* Add Configuration Button */}
            <button
              onClick={handleOpenCreate}
              className='flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all'
            >
              <Plus size={16} className='mr-1.5' />
              New Configuration
            </button>
          </div>
        </div>

        {/* Content Loading State */}
        {loading ? (
          <div className='flex justify-center items-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm'>
            <Loader2 className='w-8 h-8 animate-spin text-blue-600' />
            <span className='ml-3 text-gray-600 dark:text-gray-300 font-medium'>
              Loading your gear configurations...
            </span>
          </div>
        ) : profiles.length === 0 ? (
          <div className='text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8'>
            <Layers className='mx-auto h-12 w-12 text-gray-400 mb-3' />
            <h3 className='text-lg font-bold text-gray-900 dark:text-white'>
              No Gear Configurations Found
            </h3>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4'>
              Get started by creating your default equipment setup or choosing a travel preset.
            </p>
            <button
              onClick={handleOpenCreate}
              className='px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm shadow-sm'
            >
              Create Default Profile
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {profiles.map(prof => {
              // Converted values for display
              let heightDisplay = 'Not set';
              if (prof.height_cm) {
                if (unitSystem === 'METRIC') {
                  heightDisplay = `${prof.height_cm} cm`;
                } else {
                  const totalInches = Math.round(prof.height_cm / 2.54);
                  heightDisplay = `${Math.floor(totalInches / 12)}' ${totalInches % 12}"`;
                }
              }

              let weightDisplay = 'Not set';
              if (prof.weight_kg) {
                if (unitSystem === 'METRIC') {
                  weightDisplay = `${prof.weight_kg} kg`;
                } else {
                  weightDisplay = `${Math.round(prof.weight_kg * 2.20462 * 10) / 10} lbs`;
                }
              }

              let shoeDisplay = 'Not set';
              if (prof.shoe_size_eu) {
                if (unitSystem === 'METRIC') {
                  shoeDisplay = `EU ${prof.shoe_size_eu}`;
                } else {
                  shoeDisplay = `US ${Math.round((prof.shoe_size_eu - 33.5) * 2) / 2}`;
                }
              }

              let leadDisplay = 'Not set';
              if (prof.estimated_lead_kg !== null && prof.estimated_lead_kg !== undefined) {
                if (unitSystem === 'METRIC') {
                  leadDisplay = `${prof.estimated_lead_kg} kg`;
                } else {
                  leadDisplay = `${Math.round(prof.estimated_lead_kg * 2.20462 * 10) / 10} lbs`;
                }
              }

              return (
                <div
                  key={prof.id}
                  className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border transition-all duration-200 flex flex-col justify-between ${
                    prof.is_default
                      ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className='p-5 sm:p-6'>
                    {/* Header Row */}
                    <div className='flex items-start justify-between gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3'>
                      <div>
                        <div className='flex items-center gap-2'>
                          <h3 className='text-base font-bold text-gray-900 dark:text-white'>
                            {prof.name}
                          </h3>
                          {prof.is_default && (
                            <span className='px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'>
                              Primary
                            </span>
                          )}
                        </div>
                        <span className='text-xs text-gray-400 font-mono'>
                          {prof.wetsuit_thickness} suit • {prof.regulator_fitting} valve
                        </span>
                      </div>

                      {/* Action Menu */}
                      <div className='flex items-center gap-1.5'>
                        <button
                          onClick={() => handleOpenEdit(prof)}
                          title='Edit Configuration'
                          className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors'
                        >
                          <Edit2 size={16} />
                        </button>
                        {profiles.length > 1 && (
                          <Popconfirm
                            title='Delete Gear Configuration'
                            description={`Are you sure you want to delete '${prof.name}'?`}
                            onConfirm={() => handleDelete(prof.id)}
                            okText='Yes, delete'
                            cancelText='Cancel'
                            okButtonProps={{ danger: true }}
                          >
                            <button
                              title='Delete Configuration'
                              className='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors'
                            >
                              <Trash2 size={16} />
                            </button>
                          </Popconfirm>
                        )}
                      </div>
                    </div>

                    {/* Sizing & Hardware Specs */}
                    <div className='space-y-3 text-xs'>
                      <div className='grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700'>
                        <div>
                          <span className='text-gray-400 block mb-0.5'>Wetsuit</span>
                          <span className='font-semibold text-gray-800 dark:text-gray-200'>
                            {prof.wetsuit_size} ({prof.wetsuit_thickness}) • {prof.wetsuit_gender}
                          </span>
                        </div>
                        <div>
                          <span className='text-gray-400 block mb-0.5'>BCD / Wing</span>
                          <span className='font-semibold text-gray-800 dark:text-gray-200'>
                            Size {prof.bcd_size || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className='text-gray-400 block mb-0.5'>Fins</span>
                          <span className='font-semibold text-gray-800 dark:text-gray-200'>
                            {prof.fin_type === 'OPEN_HEEL'
                              ? 'Open-Heel + Boots'
                              : 'Full-Foot Barefoot'}
                          </span>
                        </div>
                        <div>
                          <span className='text-gray-400 block mb-0.5'>Lead Ballast</span>
                          <span className='font-semibold text-gray-800 dark:text-gray-200'>
                            {leadDisplay}
                          </span>
                        </div>
                      </div>

                      {/* Gas & Cylinders */}
                      <div className='grid grid-cols-2 gap-2 p-2'>
                        <div>
                          <span className='text-gray-400 block mb-0.5'>Tank Preference</span>
                          <span className='font-semibold text-gray-800 dark:text-gray-200 truncate block'>
                            {getCylinderLabel(prof.preferred_tank_id)}
                          </span>
                        </div>
                        <div>
                          <span className='text-gray-400 block mb-0.5'>Breathing Gas</span>
                          <span className='font-semibold text-gray-800 dark:text-gray-200'>
                            {getGasLabel(prof.preferred_gas_mix_id)}
                          </span>
                        </div>
                      </div>

                      {/* Biometrics Summary */}
                      <div className='pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-gray-500 dark:text-gray-400'>
                        <span>
                          Height:{' '}
                          <strong className='text-gray-700 dark:text-gray-300'>
                            {heightDisplay}
                          </strong>
                        </span>
                        <span>
                          Weight:{' '}
                          <strong className='text-gray-700 dark:text-gray-300'>
                            {weightDisplay}
                          </strong>
                        </span>
                        <span>
                          Shoe:{' '}
                          <strong className='text-gray-700 dark:text-gray-300'>
                            {shoeDisplay}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom / Set Default */}
                  <div className='p-3 sm:px-6 sm:py-3.5 bg-gray-50 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700 rounded-b-2xl flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      {prof.has_own_dive_computer && (
                        <Tooltip title='Owns personal dive computer'>
                          <span className='px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200'>
                            Computer
                          </span>
                        </Tooltip>
                      )}
                      {prof.has_own_smb && (
                        <Tooltip title='Owns personal SMB'>
                          <span className='px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200'>
                            SMB
                          </span>
                        </Tooltip>
                      )}
                    </div>

                    {!prof.is_default && (
                      <button
                        onClick={() => handleSetDefault(prof.id)}
                        className='text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
                      >
                        Set as Primary
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <UserGearProfileModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        profile={selectedProfile}
        onSaved={fetchProfilesAndCatalogs}
        cylinders={cylinders}
        gasMixes={gasMixes}
        initialUnitSystem={unitSystem}
      />
    </div>
  );
};

export default DiverGearProfilesPage;
