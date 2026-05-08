import {
  Upload,
  FileText,
  Calendar,
  Clock,
  MapPin,
  Anchor,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from 'react-query';

import {
  importSubsurfaceXML,
  confirmImportDives,
  getCSVHeaders,
  processCSVImport,
  importGarminFIT,
  importSuuntoJSON,
} from '../services/dives';
import { extractErrorMessage } from '../utils/apiErrors';
import { formatDate, formatTime } from '../utils/dateHelpers';
import { TANK_SIZES } from '../utils/diveConstants';

import FuzzySearchInput from './FuzzySearchInput';
import GasTanksDisplay from './GasTanksDisplay';
import Modal from './ui/Modal';

const ImportDivesModal = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [parsedDives, setParsedDives] = useState([]);
  const [availableDiveSites, setAvailableDiveSites] = useState([]);
  const [availableDivingCenters, setAvailableDivingCenters] = useState([]);
  const [currentStep, setCurrentStep] = useState('upload'); // 'upload', 'mapping', 'review', 'importing'
  const [isProcessing, setIsProcessing] = useState(false);
  const [diveSiteSearchStrings, setDiveSiteSearchStrings] = useState({});
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvSampleData, setCsvSampleData] = useState([]);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [fieldMapping, setFieldMapping] = useState({});

  // Import mutation
  const importMutation = useMutation(importSubsurfaceXML, {
    onSuccess: data => {
      const dives = data.dives.map(dive => ({ ...dive, is_private: false }));
      setParsedDives(dives);
      const sites = data.available_dive_sites || [];
      setAvailableDiveSites(sites);

      // Pre-fill search strings for dives that already have a site selected
      const initialSearchStrings = {};
      dives.forEach((dive, index) => {
        if (dive.dive_site_id) {
          const site = sites.find(s => s.id === dive.dive_site_id);
          if (site) {
            initialSearchStrings[index] = site.name;
          }
        }
      });
      setDiveSiteSearchStrings(initialSearchStrings);

      setCurrentStep('review');
      setIsProcessing(false);
      toast.success(data.message);
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to parse XML file');
      setIsProcessing(false);
    },
  });

  // CSV Header fetch mutation
  const csvHeadersMutation = useMutation(getCSVHeaders, {
    onSuccess: data => {
      setCsvHeaders(data.headers);
      setCsvSampleData(data.sample_data);
      setCsvTotalRows(data.total_rows);

      // Try to auto-map headers
      const initialMapping = {};
      const mappingHeuristics = {
        dive_site_name: ['site', 'location', 'place', 'dive site'],
        dive_date: ['date', 'time', 'when', 'day'],
        max_depth: ['depth', 'max depth', 'deepest'],
        average_depth: ['avg depth', 'mean depth'],
        duration: ['duration', 'time', 'min'],
        mixed_entity: ['buddy', 'instructor', 'center', 'guide'],
        notes: ['note', 'comment', 'description', 'info'],
        auto_tag: ['activity', 'specialty', 'type', 'tags'],
      };

      // Check localStorage for previous mapping for these specific headers
      const headerSignature = data.headers.slice().sort().join('|');
      const savedMapping = localStorage.getItem(`csv_mapping_${headerSignature}`);

      if (savedMapping) {
        try {
          setFieldMapping(JSON.parse(savedMapping));
        } catch (e) {
          console.error('Failed to parse saved mapping', e);
        }
      } else {
        data.headers.forEach(header => {
          const lowerHeader = header.toLowerCase();
          for (const [field, keywords] of Object.entries(mappingHeuristics)) {
            if (keywords.some(k => lowerHeader.includes(k))) {
              initialMapping[header] = field;
              break;
            }
          }
        });
        setFieldMapping(initialMapping);
      }

      setCurrentStep('mapping');
      setIsProcessing(false);
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to parse CSV headers');
      setIsProcessing(false);
    },
  });

  // CSV Process mutation
  const csvProcessMutation = useMutation(processCSVImport, {
    onSuccess: data => {
      const dives = data.dives.map(dive => ({ ...dive, is_private: false }));
      setParsedDives(dives);
      const sites = data.available_dive_sites || [];
      setAvailableDiveSites(sites);
      const centers = data.available_diving_centers || [];
      setAvailableDivingCenters(centers);

      // Pre-fill search strings
      const initialSearchStrings = {};
      dives.forEach((dive, index) => {
        if (dive.dive_site_id) {
          const site = sites.find(s => s.id === dive.dive_site_id);
          if (site) {
            initialSearchStrings[index] = site.name;
          }
        }
      });
      setDiveSiteSearchStrings(initialSearchStrings);

      setCurrentStep('review');
      setIsProcessing(false);
      toast.success(data.message);

      // Save mapping to localStorage
      const headerSignature = csvHeaders.slice().sort().join('|');
      localStorage.setItem(`csv_mapping_${headerSignature}`, JSON.stringify(fieldMapping));
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to process CSV file');
      setIsProcessing(false);
    },
  });

  // Garmin FIT Import mutation
  const garminMutation = useMutation(importGarminFIT, {
    onSuccess: data => {
      const dives = data.dives.map(dive => ({ ...dive, is_private: false }));
      setParsedDives(dives);
      const sites = data.available_dive_sites || [];
      setAvailableDiveSites(sites);
      const centers = data.available_diving_centers || [];
      setAvailableDivingCenters(centers);

      // Pre-fill search strings
      const initialSearchStrings = {};
      dives.forEach((dive, index) => {
        if (dive.dive_site_id) {
          const site = sites.find(s => s.id === dive.dive_site_id);
          if (site) {
            initialSearchStrings[index] = site.name;
          }
        }
      });
      setDiveSiteSearchStrings(initialSearchStrings);

      setCurrentStep('review');
      setIsProcessing(false);
      toast.success(data.message);
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to process Garmin FIT file');
      setIsProcessing(false);
    },
  });

  // Suunto JSON Import mutation
  const suuntoMutation = useMutation(importSuuntoJSON, {
    onSuccess: data => {
      const dives = data.dives.map(dive => ({ ...dive, is_private: false }));
      setParsedDives(dives);
      const sites = data.available_dive_sites || [];
      setAvailableDiveSites(sites);
      const centers = data.available_diving_centers || [];
      setAvailableDivingCenters(centers);

      // Pre-fill search strings
      const initialSearchStrings = {};
      dives.forEach((dive, index) => {
        if (dive.dive_site_id) {
          const site = sites.find(s => s.id === dive.dive_site_id);
          if (site) {
            initialSearchStrings[index] = site.name;
          }
        }
      });
      setDiveSiteSearchStrings(initialSearchStrings);

      setCurrentStep('review');
      setIsProcessing(false);
      toast.success(data.message);
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to process Suunto JSON file');
      setIsProcessing(false);
    },
  });

  // Confirm import mutation
  const confirmMutation = useMutation(confirmImportDives, {
    onSuccess: data => {
      try {
        const message = data?.message || `Successfully imported ${data?.total_imported || 0} dives`;
        toast.success(message);
        queryClient.invalidateQueries(['dives']);
        setIsProcessing(false);
        setCurrentStep('upload');
        onSuccess?.();
        handleClose();
      } catch (error) {
        console.error('Error in onSuccess handler:', error);
        toast.error('Import completed but encountered an error');
        setIsProcessing(false);
        setCurrentStep('review');
      }
    },
    onError: error => {
      console.error('Import error:', error);
      toast.error(extractErrorMessage(error) || 'Failed to import dives');
      setIsProcessing(false);
      setCurrentStep('review');
    },
  });

  const handleFileSelect = event => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const name = file.name.toLowerCase();
      return (
        name.endsWith('.xml') ||
        name.endsWith('.csv') ||
        name.endsWith('.fit') ||
        name.endsWith('.json')
      );
    });

    if (validFiles.length !== files.length) {
      toast.error('Only XML, CSV, Garmin FIT and Suunto JSON files are supported');
    }

    setSelectedFiles(validFiles);
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select a file to import');
      return;
    }

    setIsProcessing(true);
    const file = selectedFiles[0];
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
      csvHeadersMutation.mutate(file);
    } else if (name.endsWith('.fit')) {
      garminMutation.mutate(file);
    } else if (name.endsWith('.json')) {
      suuntoMutation.mutate(file);
    } else {
      importMutation.mutate(file);
    }
  };

  const handlePrivacyChange = (index, isPrivate) => {
    setParsedDives(prev =>
      prev.map((dive, i) => (i === index ? { ...dive, is_private: isPrivate } : dive))
    );
  };

  const handleDiveSiteChange = (index, diveSiteId) => {
    const siteId = diveSiteId === '' ? null : parseInt(diveSiteId);
    setParsedDives(prev =>
      prev.map((dive, i) =>
        i === index
          ? {
              ...dive,
              dive_site_id: siteId,
              unmatched_dive_site: siteId === null ? dive.unmatched_dive_site : null,
            }
          : dive
      )
    );

    // Update search string to match selected site name
    if (siteId) {
      const site = availableDiveSites.find(s => s.id === siteId);
      if (site) {
        setDiveSiteSearchStrings(prev => ({
          ...prev,
          [index]: site.name,
        }));
      }
    } else {
      setDiveSiteSearchStrings(prev => ({
        ...prev,
        [index]: '',
      }));
    }
  };

  const handleDiveSiteSearchChange = (index, value) => {
    setDiveSiteSearchStrings(prev => ({
      ...prev,
      [index]: value,
    }));
  };

  const handleDiveSiteSelect = (index, site) => {
    handleDiveSiteChange(index, site.id);
    handleDiveSiteSearchChange(index, site.name);
  };

  const handleSkipDive = index => {
    setParsedDives(prev =>
      prev.map((dive, i) => (i === index ? { ...dive, skip: !dive.skip } : dive))
    );
  };

  const handleMappingChange = (header, field) => {
    setFieldMapping(prev => ({
      ...prev,
      [header]: field,
    }));
  };

  const handleProcessCSV = () => {
    if (!selectedFiles.length) return;
    setIsProcessing(true);
    csvProcessMutation.mutate({
      file: selectedFiles[0],
      mapping: fieldMapping,
    });
  };

  const handleBackGasChange = (diveIndex, selectedIndex) => {
    setParsedDives(prev => {
      const newDives = [...prev];
      const dive = { ...newDives[diveIndex] };

      try {
        const data = JSON.parse(dive.gas_bottles_used);
        const allTanks = [data.back_gas, ...(data.stages || [])];
        const newBackGasIndex = parseInt(selectedIndex);
        const newBackGas = allTanks.find(t => t.index === newBackGasIndex);

        if (newBackGas) {
          const newStages = allTanks
            .filter(t => t.index !== newBackGasIndex)
            .sort((a, b) => (a.index || 0) - (b.index || 0));

          const newData = {
            mode: 'structured',
            back_gas: newBackGas,
            stages: newStages,
          };

          dive.gas_bottles_used = JSON.stringify(newData);
          newDives[diveIndex] = dive;
        }
      } catch (e) {
        console.error('Failed to update back gas', e);
      }
      return newDives;
    });
  };

  const renderBackGasSelector = (dive, index) => {
    try {
      if (!dive.gas_bottles_used || !dive.gas_bottles_used.trim().startsWith('{')) return null;

      const data = JSON.parse(dive.gas_bottles_used);
      if (!data.stages || data.stages.length === 0) return null;

      const allTanks = [data.back_gas, ...data.stages].sort(
        (a, b) => (a.index || 0) - (b.index || 0)
      );

      return (
        <div className='flex items-center gap-2 mb-2'>
          <span className='text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded'>
            Select Back Gas:
          </span>
          <select
            className='border-gray-300 rounded-md text-xs py-1 pl-2 pr-8 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white'
            value={data.back_gas.index !== undefined ? data.back_gas.index : 0}
            onChange={e => handleBackGasChange(index, e.target.value)}
            onClick={e => e.stopPropagation()}
          >
            {allTanks.map(tank => {
              const tankDef = TANK_SIZES.find(t => t.id === tank.tank);
              const name = tankDef ? tankDef.name : tank.tank;
              const gas = tank.gas
                ? tank.gas.o2 === 21 && tank.gas.he === 0
                  ? 'Air'
                  : `EAN${tank.gas.o2}`
                : 'Air';
              const val = tank.index !== undefined ? tank.index : 0;
              return (
                <option key={val} value={val}>
                  {name} ({gas})
                </option>
              );
            })}
          </select>
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  const handleConfirmImport = async () => {
    if (parsedDives.length === 0) {
      toast.error('No dives to import');
      return;
    }

    const unresolvedDives = parsedDives.filter(
      dive => !dive.skip && dive.unmatched_dive_site && !dive.dive_site_id
    );
    if (unresolvedDives.length > 0) {
      toast.error(
        `${unresolvedDives.length} dive(s) have unmatched dive sites. Please select dive sites or create new ones before importing.`
      );
      return;
    }

    const unresolvedProposedDives = parsedDives.filter(
      dive => !dive.skip && dive.proposed_dive_sites && !dive.dive_site_id
    );
    if (unresolvedProposedDives.length > 0) {
      toast.error(
        `${unresolvedProposedDives.length} dive(s) have proposed dive sites but no selection. Please select one of the proposed sites or choose a different one.`
      );
      return;
    }

    const filteredDives = parsedDives.filter(
      dive =>
        !dive.skip && !dive.unmatched_dive_site && !(dive.proposed_dive_sites && !dive.dive_site_id)
    );

    if (filteredDives.length === 0) {
      toast.error('No dives to import after filtering out unmatched dive sites and skipped dives');
      return;
    }

    const divesToImport = filteredDives.map(dive => {
      const {
        skip,
        unmatched_dive_site,
        proposed_dive_sites,
        available_dive_sites,
        diving_center_name,
        existing_dive_id,
        ...cleanDive
      } = dive;

      // Keep profile_data for the backend to save/update
      if (dive.profile_data) {
        cleanDive.profile_data = dive.profile_data;
      }

      // Map existing_dive_id to 'id' for the backend to recognize it as an update
      if (existing_dive_id) {
        cleanDive.id = existing_dive_id;
      }
      return cleanDive;
    });

    setIsProcessing(true);
    setCurrentStep('importing');

    try {
      await confirmMutation.mutateAsync(divesToImport);
    } catch (error) {
      setIsProcessing(false);
      setCurrentStep('review');
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setParsedDives([]);
    setDiveSiteSearchStrings({});
    setCurrentStep('upload');
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const formatDuration = minutes => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const renderMappingStep = () => {
    const fields = [
      { id: 'dive_site_name', label: 'Dive Site Name' },
      { id: 'dive_date', label: 'Date / Time' },
      { id: 'max_depth', label: 'Max Depth' },
      { id: 'average_depth', label: 'Average Depth' },
      { id: 'duration', label: 'Duration (min)' },
      { id: 'mixed_entity', label: 'Buddy / Center' },
      { id: 'auto_tag', label: 'Auto-Tag (Activity/Specialty)' },
      { id: 'notes', label: 'Notes / Information' },
      { id: 'ignore', label: 'Ignore Column' },
    ];

    return (
      <div className='space-y-6'>
        <div className='bg-blue-50 p-4 rounded-lg flex items-start gap-3 border border-blue-100'>
          <AlertCircle className='text-blue-500 mt-0.5' size={18} />
          <div>
            <p className='text-sm text-blue-800 font-medium'>Map your CSV columns</p>
            <p className='text-xs text-blue-600 mt-1'>
              We detected {csvHeaders.length} columns and {csvTotalRows} rows. Match the columns
              below to our database fields.
            </p>
          </div>
        </div>

        <div className='overflow-x-auto border border-gray-200 rounded-lg'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-gray-50 border-bottom border-gray-200'>
              <tr>
                <th className='px-4 py-3 font-semibold text-gray-700'>CSV Header</th>
                <th className='px-4 py-3 font-semibold text-gray-700'>Sample Value</th>
                <th className='px-4 py-3 font-semibold text-gray-700'>Map to Field</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-200'>
              {csvHeaders.map(header => (
                <tr key={header} className='hover:bg-gray-50 transition-colors'>
                  <td className='px-4 py-3 font-medium text-gray-900'>{header}</td>
                  <td className='px-4 py-3 text-gray-500 italic truncate max-w-[200px]'>
                    {csvSampleData[0]?.[header] || '-'}
                  </td>
                  <td className='px-4 py-3'>
                    <select
                      value={fieldMapping[header] || 'ignore'}
                      onChange={e => handleMappingChange(header, e.target.value)}
                      className={`w-full p-1.5 border rounded text-sm outline-none transition-colors ${
                        fieldMapping[header] && fieldMapping[header] !== 'ignore'
                          ? 'border-blue-300 bg-blue-50 text-blue-800'
                          : 'border-gray-300 bg-white text-gray-600'
                      }`}
                    >
                      {fields.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className='flex justify-between items-center pt-4'>
          <button
            onClick={() => setCurrentStep('upload')}
            className='px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium'
          >
            Back
          </button>
          <button
            onClick={handleProcessCSV}
            disabled={isProcessing}
            className='px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all'
          >
            {isProcessing ? 'Processing...' : `Process ${csvTotalRows} Dives`}
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title='Import Dives'
      className='max-w-4xl w-full max-h-[90vh] flex flex-col'
    >
      <div className='overflow-y-auto min-h-0 flex-1 p-1'>
        {currentStep === 'upload' && (
          <div className='space-y-6'>
            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Upload Dive Log Files</h3>
              <p className='text-gray-600 mb-4'>
                Select Subsurface XML, CSV (e.g. MySSI), Garmin FIT or Suunto JSON files to import
                your dives.
              </p>
            </div>

            <div className='border-2 border-dashed border-gray-300 rounded-lg p-8 text-center'>
              <Upload className='mx-auto h-12 w-12 text-gray-400 mb-4' />
              <div className='space-y-2'>
                <p className='text-sm text-gray-600'>
                  Drag and drop XML, CSV, FIT or JSON files here, or click to browse
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors'
                >
                  Select Files
                </button>
              </div>
              <input
                ref={fileInputRef}
                type='file'
                accept='.xml,.csv,.fit,.json'
                onChange={handleFileSelect}
                className='hidden'
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className='space-y-2'>
                <h4 className='font-medium text-gray-900'>Selected Files:</h4>
                <div className='space-y-2'>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className='flex items-center gap-3 p-3 bg-gray-50 rounded-md'>
                      <FileText className='h-5 w-5 text-gray-500' />
                      <span className='text-sm text-gray-700'>{file.name}</span>
                      <span className='text-xs text-gray-500'>
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className='flex justify-end gap-3'>
              <button
                onClick={handleClose}
                className='px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isProcessing}
                className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
              >
                {isProcessing ? (
                  <>
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Process Files
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'mapping' && renderMappingStep()}

        {currentStep === 'review' && (
          <div className='space-y-6'>
            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Review Dives to Import</h3>
              <p className='text-gray-600 mb-4'>
                Review the parsed dives and adjust privacy settings before importing.
              </p>
            </div>

            <div className='space-y-4'>
              {parsedDives.map((dive, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    dive.skip ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className='flex items-start justify-between mb-3'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2'>
                        <h4 className='font-medium text-gray-900'>
                          {dive.name || `Dive ${index + 1}`}
                        </h4>
                        {dive.existing_dive_id && (
                          <span className='px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 rounded-full border border-orange-200'>
                            Existing
                          </span>
                        )}
                        {(dive.latitude || dive.unmatched_dive_site?.latitude) && (
                          <span className='px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-full border border-blue-200'>
                            GPS Included
                          </span>
                        )}
                      </div>
                      <div className='flex items-center gap-4 mt-1 text-sm text-gray-600'>
                        <div className='flex items-center gap-1'>
                          <Calendar size={14} />
                          {formatDate(dive.dive_date)}
                        </div>
                        {dive.dive_time && (
                          <div className='flex items-center gap-1'>
                            <Clock size={14} />
                            {formatTime(dive.dive_time)}
                          </div>
                        )}
                        {dive.duration && (
                          <div className='flex items-center gap-1'>
                            <Clock size={14} />
                            {formatDuration(dive.duration)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className='flex flex-col items-end gap-2'>
                      {/* Action Segmented Control */}
                      <div className='flex bg-gray-100 p-0.5 rounded-lg border border-gray-200'>
                        <button
                          onClick={() => dive.skip && handleSkipDive(index)}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            !dive.skip
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {dive.existing_dive_id ? 'Update' : 'Import'}
                        </button>
                        <button
                          onClick={() => !dive.skip && handleSkipDive(index)}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            dive.skip
                              ? 'bg-white text-amber-600 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Skip
                        </button>
                      </div>

                      {/* Privacy Segmented Control */}
                      <div className='flex bg-gray-100 p-0.5 rounded-lg border border-gray-200'>
                        <button
                          onClick={() => dive.is_private && handlePrivacyChange(index, false)}
                          className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            !dive.is_private
                              ? 'bg-white text-green-600 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Eye size={12} /> Public
                        </button>
                        <button
                          onClick={() => !dive.is_private && handlePrivacyChange(index, true)}
                          className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            dive.is_private
                              ? 'bg-white text-purple-600 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <EyeOff size={12} /> Private
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                    {dive.max_depth && (
                      <div>
                        <span className='font-medium text-gray-700'>Max Depth:</span>
                        <span className='ml-2 text-gray-600'>{dive.max_depth} m</span>
                      </div>
                    )}
                    {dive.average_depth && (
                      <div>
                        <span className='font-medium text-gray-700'>Avg Depth:</span>
                        <span className='ml-2 text-gray-600'>{dive.average_depth} m</span>
                      </div>
                    )}
                    {dive.visibility_rating && (
                      <div>
                        <span className='font-medium text-gray-700'>Visibility:</span>
                        <span className='ml-2 text-gray-600'>{dive.visibility_rating}/10</span>
                      </div>
                    )}
                    {dive.user_rating && (
                      <div>
                        <span className='font-medium text-gray-700'>Rating:</span>
                        <span className='ml-2 text-gray-600'>{dive.user_rating}/10</span>
                      </div>
                    )}
                    {dive.suit_type && (
                      <div>
                        <span className='font-medium text-gray-700'>Suit Type:</span>
                        <span className='ml-2 text-gray-600 capitalize'>
                          {dive.suit_type.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    {dive.gas_bottles_used && (
                      <div className='md:col-span-2'>
                        <div className='flex justify-between items-center'>
                          <span className='font-medium text-gray-700'>Gas Bottles:</span>
                          {renderBackGasSelector(dive, index)}
                        </div>
                        <div className='mt-1'>
                          <GasTanksDisplay
                            gasData={dive.gas_bottles_used}
                            averageDepth={dive.average_depth}
                            duration={dive.duration}
                            profileData={dive.profile_data}
                          />
                        </div>
                      </div>
                    )}
                    {dive.dive_information && (
                      <div className='md:col-span-2'>
                        <span className='font-medium text-gray-700'>Dive Info:</span>
                        <div className='mt-1 text-gray-600 whitespace-pre-line'>
                          {dive.dive_information}
                        </div>
                      </div>
                    )}

                    <div className='md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-3 mt-1'>
                      <div>
                        <span className='font-medium text-gray-700 flex items-center gap-1 mb-1'>
                          <MapPin size={14} className='text-blue-500' /> Dive Site:
                        </span>
                        <div className='mt-1'>
                          {dive.unmatched_dive_site ? (
                            <div className='space-y-2'>
                              <div className='flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md'>
                                <AlertCircle size={16} className='text-yellow-600' />
                                <span className='text-sm text-yellow-800'>
                                  <strong>{dive.unmatched_dive_site.name}</strong> not found in
                                  database
                                </span>
                              </div>
                              <div className='flex flex-col gap-2'>
                                <div className='flex items-center gap-2'>
                                  <div className='flex-1'>
                                    <FuzzySearchInput
                                      data={availableDiveSites}
                                      searchValue={diveSiteSearchStrings[index] || ''}
                                      onSearchChange={val => handleDiveSiteSearchChange(index, val)}
                                      onSearchSelect={site => handleDiveSiteSelect(index, site)}
                                      placeholder='Search for a dive site...'
                                      minQueryLength={3}
                                      configType='diveSites'
                                    />
                                  </div>
                                  <button
                                    onClick={() => {
                                      const site = dive.unmatched_dive_site;
                                      const url = site?.latitude
                                        ? `/dive-sites/create?lat=${site.latitude}&lng=${site.longitude}`
                                        : '/dive-sites/create';
                                      window.open(url, '_blank');
                                    }}
                                    className='px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors h-10'
                                    title={
                                      dive.unmatched_dive_site?.latitude
                                        ? 'Create new site with GPS coordinates from file'
                                        : 'Create new site'
                                    }
                                  >
                                    Create New
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : dive.proposed_dive_sites ? (
                            <div className='space-y-2'>
                              <div className='flex flex-col gap-1 p-2 bg-blue-50 border border-blue-200 rounded-md'>
                                <div className='flex items-center gap-2'>
                                  <AlertCircle size={16} className='text-blue-600' />
                                  <span className='text-sm text-blue-800'>
                                    <strong>Proposed dive site match</strong>
                                  </span>
                                </div>
                                <div className='text-xs text-blue-700 ml-6'>
                                  Original name in file:{' '}
                                  <span className='font-mono font-semibold'>
                                    "{dive.proposed_dive_sites[0]?.original_name || 'Unknown'}"
                                  </span>
                                </div>
                              </div>
                              <div className='space-y-2'>
                                {dive.proposed_dive_sites.map((proposedSite, siteIndex) => (
                                  <div
                                    key={siteIndex}
                                    className='flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md'
                                  >
                                    <input
                                      type='radio'
                                      id={`proposed-${index}-${siteIndex}`}
                                      name={`proposed-site-${index}`}
                                      value={proposedSite.id}
                                      checked={dive.dive_site_id === proposedSite.id}
                                      onChange={e => handleDiveSiteChange(index, e.target.value)}
                                      className='text-blue-600 focus:ring-blue-500'
                                    />
                                    <label
                                      htmlFor={`proposed-${index}-${siteIndex}`}
                                      className='flex-1 text-sm text-blue-800'
                                    >
                                      <div className='flex flex-col'>
                                        <div>
                                          <span className='text-gray-600 text-xs'>Original: </span>
                                          <span className='text-gray-800'>
                                            {proposedSite.original_name}
                                          </span>
                                        </div>
                                        <div>
                                          <span className='text-blue-600 text-xs'>Proposed: </span>
                                          <strong className='text-blue-800'>
                                            {proposedSite.name}
                                          </strong>
                                          <span className='text-blue-600 ml-2'>
                                            {proposedSite.distance !== undefined
                                              ? `(${Math.round(proposedSite.distance)}m away)`
                                              : `(${(proposedSite.similarity * 100).toFixed(0)}% match)`}
                                          </span>
                                        </div>
                                      </div>
                                    </label>
                                  </div>
                                ))}
                              </div>
                              <div className='flex flex-col gap-2'>
                                <div className='flex items-center gap-2'>
                                  <div className='flex-1'>
                                    <FuzzySearchInput
                                      data={availableDiveSites}
                                      searchValue={diveSiteSearchStrings[index] || ''}
                                      onSearchChange={val => handleDiveSiteSearchChange(index, val)}
                                      onSearchSelect={site => handleDiveSiteSelect(index, site)}
                                      placeholder='Or search for a different site...'
                                      minQueryLength={3}
                                      configType='diveSites'
                                    />
                                  </div>
                                  <button
                                    onClick={() => {
                                      const url = dive.latitude
                                        ? `/dive-sites/create?lat=${dive.latitude}&lng=${dive.longitude}`
                                        : '/dive-sites/create';
                                      window.open(url, '_blank');
                                    }}
                                    className='px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors h-10'
                                    title={
                                      dive.latitude
                                        ? 'Create new site with GPS coordinates from file'
                                        : 'Create new site'
                                    }
                                  >
                                    Create New
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : dive.dive_site_id ? (
                            <div className='flex items-center gap-2'>
                              <MapPin size={14} className='text-green-600' />
                              <span className='text-sm text-gray-600'>
                                {availableDiveSites.find(site => site.id === dive.dive_site_id)
                                  ?.name || 'Unknown site'}
                              </span>
                            </div>
                          ) : (
                            <span className='text-sm text-gray-500'>No dive site specified</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className='font-medium text-gray-700 flex items-center gap-1 mb-1'>
                          <Anchor size={14} className='text-blue-500' /> Diving Center:
                        </span>
                        <div className='mt-1'>
                          {dive.diving_center_id ? (
                            <div className='flex items-center gap-2'>
                              <Anchor size={14} className='text-green-600' />
                              <span className='text-sm text-gray-600 font-medium'>
                                {dive.diving_center_name ||
                                  availableDivingCenters.find(c => c.id === dive.diving_center_id)
                                    ?.name ||
                                  'Matched Center'}
                              </span>
                            </div>
                          ) : (
                            <div className='text-xs text-gray-500 italic p-1 bg-gray-50 rounded border border-gray-100'>
                              No matched center
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className='flex justify-end gap-3 pt-4 border-t border-gray-200'>
              <button
                onClick={() => setCurrentStep('upload')}
                className='px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors'
              >
                Back
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
              >
                {isProcessing ? (
                  <>
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Import{' '}
                    {
                      parsedDives.filter(
                        dive =>
                          !dive.unmatched_dive_site &&
                          !(dive.proposed_dive_sites && !dive.dive_site_id) &&
                          !dive.skip
                      ).length
                    }{' '}
                    Dives
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'importing' && (
          <div className='text-center py-8'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>Importing Dives</h3>
            <p className='text-gray-600'>Please wait while we import your dives...</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

ImportDivesModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default ImportDivesModal;
