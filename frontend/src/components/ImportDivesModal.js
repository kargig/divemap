import {
  Upload,
  FileText,
  Calendar,
  Clock,
  MapPin,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from 'react-query';

import { importSubsurfaceXML, confirmImportDives, extractErrorMessage } from '../api';

import GasTanksDisplay from './GasTanksDisplay';
import Modal from './ui/Modal';

const ImportDivesModal = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [parsedDives, setParsedDives] = useState([]);
  const [availableDiveSites, setAvailableDiveSites] = useState([]);
  const [currentStep, setCurrentStep] = useState('upload'); // 'upload', 'review', 'importing'
  const [isProcessing, setIsProcessing] = useState(false);

  // Import mutation
  const importMutation = useMutation(importSubsurfaceXML, {
    onSuccess: data => {
      setParsedDives(data.dives.map(dive => ({ ...dive, is_private: false })));
      setAvailableDiveSites(data.available_dive_sites || []);
      setCurrentStep('review');
      setIsProcessing(false);
      toast.success(data.message);
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to parse XML file');
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
    const xmlFiles = files.filter(file => file.name.toLowerCase().endsWith('.xml'));

    if (xmlFiles.length !== files.length) {
      toast.error('Only XML files are supported');
    }

    setSelectedFiles(xmlFiles);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one XML file');
      return;
    }

    setIsProcessing(true);

    try {
      // Process each file
      for (const file of selectedFiles) {
        await importMutation.mutateAsync(file);
      }
    } catch (error) {
      // Error is handled by mutation
      setIsProcessing(false);
    }
  };

  const handlePrivacyChange = (index, isPrivate) => {
    setParsedDives(prev =>
      prev.map((dive, i) => (i === index ? { ...dive, is_private: isPrivate } : dive))
    );
  };

  const handleDiveSiteChange = (index, diveSiteId) => {
    setParsedDives(prev =>
      prev.map((dive, i) =>
        i === index
          ? {
              ...dive,
              dive_site_id: diveSiteId === '' ? null : parseInt(diveSiteId),
              unmatched_dive_site: diveSiteId === '' ? dive.unmatched_dive_site : null,
            }
          : dive
      )
    );
  };

  const handleSkipDive = index => {
    setParsedDives(prev =>
      prev.map((dive, i) => (i === index ? { ...dive, skip: !dive.skip } : dive))
    );
  };

  const handleConfirmImport = async () => {
    if (parsedDives.length === 0) {
      toast.error('No dives to import');
      return;
    }

    // Filter out dives with unresolved unmatched dive sites (excluding skipped dives)
    const unresolvedDives = parsedDives.filter(
      dive => !dive.skip && dive.unmatched_dive_site && !dive.dive_site_id
    );
    if (unresolvedDives.length > 0) {
      toast.error(
        `${unresolvedDives.length} dive(s) have unmatched dive sites. Please select dive sites or create new ones before importing.`
      );
      return;
    }

    // Filter out dives with proposed dive sites but no selection (excluding skipped dives)
    const unresolvedProposedDives = parsedDives.filter(
      dive => !dive.skip && dive.proposed_dive_sites && !dive.dive_site_id
    );
    if (unresolvedProposedDives.length > 0) {
      toast.error(
        `${unresolvedProposedDives.length} dive(s) have proposed dive sites but no selection. Please select one of the proposed sites or choose a different one.`
      );
      return;
    }

    // Filter out dives with unmatched dive sites, proposed dive sites without selection, and skipped dives
    const filteredDives = parsedDives.filter(
      dive =>
        !dive.skip && !dive.unmatched_dive_site && !(dive.proposed_dive_sites && !dive.dive_site_id)
    );

    if (filteredDives.length === 0) {
      toast.error('No dives to import after filtering out unmatched dive sites and skipped dives');
      return;
    }

    // Clean up dive data - remove UI-only fields before sending to backend
    const divesToImport = filteredDives.map(dive => {
      const { skip, unmatched_dive_site, proposed_dive_sites, available_dive_sites, ...cleanDive } =
        dive;
      return cleanDive;
    });

    setIsProcessing(true);
    setCurrentStep('importing');

    try {
      await confirmMutation.mutateAsync(divesToImport);
    } catch (error) {
      // Error is handled by mutation
      setIsProcessing(false);
      setCurrentStep('review');
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setParsedDives([]);
    setCurrentStep('upload');
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const formatDate = dateStr => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatTime = timeStr => {
    if (!timeStr) return '';
    try {
      return timeStr.substring(0, 5); // Show only HH:MM
    } catch {
      return timeStr;
    }
  };

  const formatDuration = minutes => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title='Import Subsurface XML Dives'
      className='max-w-4xl w-full max-h-[90vh] flex flex-col'
    >
      <div className='overflow-y-auto min-h-0 flex-1'>
        {currentStep === 'upload' && (
          <div className='space-y-6'>
            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>
                Upload Subsurface XML Files
              </h3>
              <p className='text-gray-600 mb-4'>
                Select one or more Subsurface XML files to import your dives. You&apos;ll be able to
                review and adjust privacy settings before importing.
              </p>
            </div>

            {/* File Upload */}
            <div className='border-2 border-dashed border-gray-300 rounded-lg p-8 text-center'>
              <Upload className='mx-auto h-12 w-12 text-gray-400 mb-4' />
              <div className='space-y-2'>
                <p className='text-sm text-gray-600'>
                  Drag and drop XML files here, or click to browse
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
                multiple
                accept='.xml'
                onChange={handleFileSelect}
                className='hidden'
              />
            </div>

            {/* Selected Files */}
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

            {/* Upload Button */}
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

        {currentStep === 'review' && (
          <div className='space-y-6'>
            <div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>Review Dives to Import</h3>
              <p className='text-gray-600 mb-4'>
                Review the parsed dives and adjust privacy settings before importing.
              </p>
            </div>

            {/* Dives List */}
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
                      <h4 className='font-medium text-gray-900'>
                        {dive.name || `Dive ${index + 1}`}
                      </h4>
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

                    {/* Privacy Toggle and Skip Button */}
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => handleSkipDive(index)}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          dive.skip
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {dive.skip ? 'Skipped' : 'Skip'}
                      </button>
                      <button
                        onClick={() => handlePrivacyChange(index, !dive.is_private)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          dive.is_private
                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {dive.is_private ? (
                          <>
                            <EyeOff size={14} />
                            Private
                          </>
                        ) : (
                          <>
                            <Eye size={14} />
                            Public
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Dive Details */}
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
                        <span className='font-medium text-gray-700'>Gas Bottles:</span>
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

                    {/* Dive Site Selection */}
                    <div className='md:col-span-2'>
                      <span className='font-medium text-gray-700'>Dive Site:</span>
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
                            <div className='flex items-center gap-2'>
                              <select
                                value={dive.dive_site_id || ''}
                                onChange={e => handleDiveSiteChange(index, e.target.value)}
                                className='flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                              >
                                <option value=''>Select a dive site...</option>
                                {availableDiveSites
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(site => (
                                    <option key={site.id} value={site.id}>
                                      {site.name}{' '}
                                      {site.country
                                        ? `(${site.country}${site.region ? `, ${site.region}` : ''})`
                                        : ''}
                                    </option>
                                  ))}
                              </select>
                              <button
                                onClick={() => window.open('/dive-sites/create', '_blank')}
                                className='px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                              >
                                Create New
                              </button>
                            </div>
                            <p className='text-xs text-gray-500'>
                              Please select an existing dive site or create a new one, then
                              re-import this dive.
                            </p>
                          </div>
                        ) : dive.proposed_dive_sites ? (
                          <div className='space-y-2'>
                            <div className='flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md'>
                              <AlertCircle size={16} className='text-blue-600' />
                              <span className='text-sm text-blue-800'>
                                <strong>Proposed dive site match</strong> - Please confirm if this
                                is the correct site
                              </span>
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
                                          ({(proposedSite.similarity * 100).toFixed(0)}% match)
                                        </span>
                                      </div>
                                    </div>
                                  </label>
                                </div>
                              ))}
                            </div>
                            <div className='flex items-center gap-2'>
                              <select
                                value={dive.dive_site_id || ''}
                                onChange={e => handleDiveSiteChange(index, e.target.value)}
                                className='flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                              >
                                <option value=''>Or select a different dive site...</option>
                                {availableDiveSites
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(site => (
                                    <option key={site.id} value={site.id}>
                                      {site.name}{' '}
                                      {site.country
                                        ? `(${site.country}${site.region ? `, ${site.region}` : ''})`
                                        : ''}
                                    </option>
                                  ))}
                              </select>
                              <button
                                onClick={() => window.open('/dive-sites/create', '_blank')}
                                className='px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                              >
                                Create New
                              </button>
                            </div>
                            <p className='text-xs text-gray-500'>
                              Compare the original dive site name from your XML file with the
                              proposed match. If the proposed site is correct, select it. Otherwise,
                              choose a different site or create a new one. If you don&apos;t select
                              any, this dive will be skipped.
                            </p>
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
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
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
