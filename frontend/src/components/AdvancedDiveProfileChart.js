import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Thermometer,
  Clock,
  Activity,
  AlertTriangle,
  Download,
  Maximize,
  X,
  Contrast,
  Upload,
  TrendingUp,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { useResponsive } from '../hooks/useResponsive';

/**
 * Custom Tooltip component for the chart
 */
/* eslint-disable complexity */
const CustomTooltip = ({
  active,
  payload,
  label,
  showCNS,
  showCeiling,
  showStoptime,
  showTemperature,
  formatStoptime,
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className='bg-white p-4 border border-gray-200 rounded-lg shadow-lg min-w-[200px]'>
        <div className='font-semibold text-gray-900 mb-2'>Dive Profile</div>
        <div className='space-y-1 text-sm'>
          <div className='flex justify-between'>
            <span className='text-gray-600'>Time:</span>
            <span className='font-medium'>{label?.toFixed(1)} min</span>
          </div>
          <div className='flex justify-between'>
            <span style={{ color: '#0072B2' }}>Depth:</span>
            <span className='font-medium'>{data.depth?.toFixed(1)}m</span>
          </div>
          <div className='flex justify-between'>
            <span style={{ color: '#E69F00' }}>Avg Depth:</span>
            <span className='font-medium'>{data.averageDepth?.toFixed(1)}m</span>
          </div>
          {data.temperature && showTemperature && (
            <div className='flex justify-between'>
              <span style={{ color: '#009E73' }}>Temperature:</span>
              <span className='font-medium'>{data.temperature?.toFixed(1)}°C</span>
            </div>
          )}
          <div className='flex justify-between'>
            <span style={{ color: '#D55E00' }}>NDL:</span>
            <span className='font-medium'>
              {data.in_deco ? (
                <span style={{ color: '#D55E00' }}>In deco</span>
              ) : data.ndl === 0 ? (
                'NDL 0 mins/deco'
              ) : data.ndl ? (
                `${data.ndl?.toFixed(0)} min`
              ) : (
                'N/A'
              )}
            </span>
          </div>
          {data.cns && showCNS && (
            <div className='flex justify-between'>
              <span style={{ color: '#CC79A7' }}>CNS:</span>
              <span className='font-medium'>{data.cns?.toFixed(1)}%</span>
            </div>
          )}
          {data.stopdepth > 0 && showCeiling && (
            <div className='flex justify-between'>
              <span style={{ color: '#56B4E9' }}>Ceiling:</span>
              <span className='font-medium'>{data.stopdepth?.toFixed(1)}m</span>
            </div>
          )}
          {data.stoptime > 0 && data.in_deco && showStoptime && (
            <div className='flex justify-between'>
              <span style={{ color: '#F0E442' }}>Stop Time:</span>
              <span className='font-medium'>{formatStoptime(data.stoptime)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};
/* eslint-enable complexity */

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      payload: PropTypes.shape({
        depth: PropTypes.number,
        averageDepth: PropTypes.number,
        temperature: PropTypes.number,
        ndl: PropTypes.number,
        cns: PropTypes.number,
        in_deco: PropTypes.bool,
        stopdepth: PropTypes.number,
        stoptime: PropTypes.number,
      }),
    })
  ),
  label: PropTypes.number,
  showCNS: PropTypes.bool,
  showCeiling: PropTypes.bool,
  showStoptime: PropTypes.bool,
  showTemperature: PropTypes.bool,
  formatStoptime: PropTypes.func.isRequired,
};

/**
 * Smart sampling logic extracted to a pure function to reduce component complexity
 */
/* eslint-disable complexity, max-depth */
const performSmartSampling = (samples, showAllSamples) => {
  if (!samples || samples.length <= 1000 || showAllSamples) {
    return samples || [];
  }

  const duration = samples[samples.length - 1]?.time_minutes || 0;
  const eventFrequency = samples.length / (duration * 60); // events per second
  const canSample = eventFrequency < 0.1; // less than 1 per 10 seconds

  if (canSample) {
    const sampledSamples = [];
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const isFirstOrLast = i === 0 || i === samples.length - 1;
      const hasImportantMetadata =
        sample.in_deco !== undefined ||
        sample.ndl_minutes !== undefined ||
        sample.cns_percent !== undefined ||
        sample.temperature !== undefined ||
        sample.stopdepth !== undefined ||
        sample.stoptime_minutes !== undefined;

      if (isFirstOrLast || hasImportantMetadata) {
        sampledSamples.push(sample);
      } else if (i % 10 === 0) {
        // Check if the next few samples have important metadata
        let hasNearbyImportantMetadata = false;
        for (let j = i + 1; j <= Math.min(i + 9, samples.length - 1); j++) {
          const nearbySample = samples[j];
          if (
            nearbySample.in_deco !== undefined ||
            nearbySample.ndl_minutes !== undefined ||
            nearbySample.cns_percent !== undefined ||
            nearbySample.temperature !== undefined ||
            nearbySample.stopdepth !== undefined ||
            nearbySample.stoptime_minutes !== undefined
          ) {
            hasNearbyImportantMetadata = true;
            break;
          }
        }

        if (!hasNearbyImportantMetadata) {
          sampledSamples.push(sample);
        } else {
          // Find nearest sample without important metadata
          let nearestIndex = -1;
          for (let j = i + 1; j <= Math.min(i + 9, samples.length - 1); j++) {
            const nearbySample = samples[j];
            if (
              nearbySample.in_deco === undefined &&
              nearbySample.ndl_minutes === undefined &&
              nearbySample.cns_percent === undefined &&
              nearbySample.temperature === undefined &&
              nearbySample.stopdepth === undefined &&
              nearbySample.stoptime_minutes === undefined
            ) {
              nearestIndex = j;
              break;
            }
          }
          if (nearestIndex !== -1) {
            sampledSamples.push(samples[nearestIndex]);
            i = nearestIndex;
          } else {
            sampledSamples.push(sample);
          }
        }
      }
    }
    return sampledSamples;
  }

  const sampleRate = Math.ceil(samples.length / 100);
  return samples.filter((sample, index) => {
    if (index === 0 || index === samples.length - 1) return true;
    return (
      sample.in_deco !== undefined ||
      sample.ndl_minutes !== undefined ||
      sample.cns_percent !== undefined ||
      sample.temperature !== undefined ||
      sample.stopdepth !== undefined ||
      sample.stoptime_minutes !== undefined ||
      index % sampleRate === 0
    );
  });
};
/* eslint-enable complexity, max-depth */

/* eslint-disable max-lines-per-function, complexity */
const AdvancedDiveProfileChart = ({
  profileData,
  isLoading = false,
  error = null,
  showTemperature: initialShowTemperature = true,
  screenSize = 'desktop',
  onDecoStatusChange,
  onMaximize,
  onClose,
  onUpload,
}) => {
  const [, setHoveredPoint] = useState(null);
  const [showTemperature, setShowTemperature] = useState(initialShowTemperature);
  const [showCNS, setShowCNS] = useState(true);
  const [showCeiling, setShowCeiling] = useState(true);
  const [showStoptime, setShowStoptime] = useState(true);
  const chartRef = useRef(null);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [showAllSamples, setShowAllSamples] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [chartScale, setChartScale] = useState(1);
  const [chartOffset, setChartOffset] = useState({ x: 0, y: 0 });
  const [showLandscapeTip, setShowLandscapeTip] = useState(true);
  const { isMobile: isMobileViewport } = useResponsive();

  // Check if dive goes into deco
  const hasDeco = useMemo(() => {
    if (!profileData?.samples) return false;
    return profileData.samples.some(sample => sample.in_deco === true);
  }, [profileData]);

  // Check if dive has any stopdepth data
  const hasStopdepth = useMemo(() => {
    if (!profileData?.samples) return false;
    return profileData.samples.some(
      sample => sample.stopdepth !== null && sample.stopdepth !== undefined && sample.stopdepth > 0
    );
  }, [profileData]);

  // Process gas change events
  const gasChangeEvents = useMemo(() => {
    if (!profileData?.events) return [];
    return profileData.events.filter(
      event => event.name === 'gaschange' && event.type === '25' && event.time_minutes > 1.0
    );
  }, [profileData]);

  // Notify parent component of deco status change
  useEffect(() => {
    if (onDecoStatusChange) {
      onDecoStatusChange(hasDeco);
    }
  }, [hasDeco, onDecoStatusChange]);

  // Process the data for the chart with smart sampling
  const chartData = useMemo(() => {
    if (!profileData?.samples) return [];

    const samplesToProcess = performSmartSampling(profileData.samples, showAllSamples);

    let runningDepthSum = 0;
    let lastKnownTemperature = null;
    let lastKnownNDL = null;
    let lastKnownInDeco = false;
    let lastKnownCNS = null;
    let lastKnownStopdepth = 0;
    let lastKnownStoptime = null;

    return samplesToProcess.map((sample, index) => {
      const depth = sample.depth || 0;
      runningDepthSum += depth;
      const averageDepth = runningDepthSum / (index + 1);

      if (sample.temperature !== null && sample.temperature !== undefined) {
        lastKnownTemperature = sample.temperature;
      }
      if (sample.ndl_minutes !== null && sample.ndl_minutes !== undefined) {
        lastKnownNDL = sample.ndl_minutes;
        // If we have a positive NDL, we are likely not in deco anymore
        if (lastKnownNDL > 0) {
          lastKnownInDeco = false;
        }
      }
      if (sample.in_deco !== null && sample.in_deco !== undefined) {
        lastKnownInDeco = sample.in_deco;
      }
      if (sample.cns_percent !== null && sample.cns_percent !== undefined) {
        lastKnownCNS = sample.cns_percent;
      }

      if (lastKnownInDeco) {
        if (sample.stopdepth !== null && sample.stopdepth !== undefined) {
          lastKnownStopdepth = sample.stopdepth;
        }
        if (sample.stoptime_minutes !== null && sample.stoptime_minutes !== undefined) {
          lastKnownStoptime = sample.stoptime_minutes;
        }
      } else {
        lastKnownStopdepth = 0;
        lastKnownStoptime = null;
      }

      return {
        time: sample.time_minutes || 0,
        depth: depth,
        averageDepth: Math.round(averageDepth * 100) / 100,
        temperature: lastKnownTemperature,
        ndl: lastKnownNDL,
        cns: lastKnownCNS,
        in_deco: lastKnownInDeco,
        stopdepth: lastKnownStopdepth,
        stoptime: lastKnownStoptime,
      };
    });
  }, [profileData, showAllSamples]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (chartData.length === 0)
      return {
        maxDepth: 0,
        averageDepth: 0,
        duration: 0,
        minTemp: null,
        maxTemp: null,
      };

    const depths = chartData.map(d => d.depth);
    const temperatures = chartData.map(d => d.temperature).filter(t => t !== null && !isNaN(t));

    return {
      maxDepth: Math.max(...depths),
      averageDepth: chartData[chartData.length - 1]?.averageDepth || 0,
      duration: Math.max(...chartData.map(d => d.time)),
      minTemp: temperatures.length > 0 ? Math.min(...temperatures) : null,
      maxTemp: temperatures.length > 0 ? Math.max(...temperatures) : null,
    };
  }, [chartData]);

  // Format stoptime for display
  const formatStoptime = useCallback(stoptime => {
    if (!stoptime || stoptime <= 0) return '0:00';
    const minutes = Math.floor(stoptime);
    const seconds = Math.round((stoptime - minutes) * 60);
    if (seconds === 60) return `${minutes + 1}:00`;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, []);

  // Handle chart interactions
  const handleMouseMove = useCallback(data => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      setHoveredPoint(data.activePayload[0].payload);
    } else {
      setHoveredPoint(null);
    }
  }, []);

  const handleExportPNG = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current);
      const link = document.createElement('a');
      link.download = `dive-profile-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch {
      /* error */
    }
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`dive-profile-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch {
      /* error */
    }
  }, []);

  const handleTouchStart = useCallback(e => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() });
      setIsPanning(false);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      setTouchStart({
        distance: Math.sqrt(
          Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2)
        ),
        centerX: (t1.clientX + t2.clientX) / 2,
        centerY: (t1.clientY + t2.clientY) / 2,
        time: Date.now(),
      });
    }
  }, []);

  const handleTouchMove = useCallback(
    e => {
      if (!touchStart) return;
      e.preventDefault();
      if (e.touches.length === 1 && !isPanning) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10 || Date.now() - touchStart.time > 100) {
          setIsPanning(true);
          setChartOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
          setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
        }
      } else if (e.touches.length === 2 && touchStart.distance) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2)
        );
        const scale = distance / touchStart.distance;
        setChartScale(Math.max(0.5, Math.min(3, chartScale * scale)));
        setTouchStart({
          ...touchStart,
          distance,
          centerX: (t1.clientX + t2.clientX) / 2,
          centerY: (t1.clientY + t2.clientY) / 2,
          time: Date.now(),
        });
      }
    },
    [touchStart, isPanning, chartScale]
  );

  const handleTouchEnd = useCallback(e => {
    if (e.touches.length === 0) {
      setTouchStart(null);
      setIsPanning(false);
    }
  }, []);

  const resetChartView = useCallback(() => {
    setChartScale(1);
    setChartOffset({ x: 0, y: 0 });
  }, []);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-96 bg-gray-50 rounded-lg'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading dive profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-center py-8 text-red-600 bg-red-50 rounded-lg'>
        <AlertTriangle className='h-12 w-12 mx-auto mb-4 text-red-500' />
        <p className='font-semibold'>Error loading dive profile</p>
        <p className='text-sm'>
          {typeof error === 'string' ? error : error?.message || 'Unknown error'}
        </p>
        {onUpload && (
          <button
            onClick={onUpload}
            className='mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
          >
            <Upload className='mr-2 h-4 w-4' />
            Upload New Profile
          </button>
        )}
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className='text-center py-8 text-gray-600 bg-gray-50 rounded-lg'>
        <Activity className='h-12 w-12 mx-auto mb-4 text-gray-400' />
        <p className='font-semibold'>No dive profile data available</p>
        <p className='text-sm mb-4'>Upload a dive profile to see the visualization</p>
        {onUpload && (
          <button
            onClick={onUpload}
            className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            <Upload className='mr-2 h-4 w-4' />
            Upload Profile (XML/UDDF)
          </button>
        )}
      </div>
    );
  }

  const isMobileLandscape =
    screenSize === 'mobile' && window.innerWidth > window.innerHeight && window.innerWidth <= 1024;
  const chartHeight = screenSize === 'mobile' ? (isMobileLandscape ? 200 : 300) : 400;

  return (
    <>
      {highContrastMode && (
        <style>
          {`
            .high-contrast {
              --tw-bg-opacity: 1;
              background-color: rgb(0 0 0 / var(--tw-bg-opacity)) !important;
              color: rgb(255 255 255 / var(--tw-text-opacity)) !important;
            }
            .high-contrast .bg-white {
              background-color: rgb(0 0 0) !important;
              color: rgb(255 255 255) !important;
            }
            .high-contrast .text-gray-600,
            .high-contrast .text-gray-700 {
              color: rgb(255 255 255) !important;
            }
            .high-contrast .border-gray-200 {
              border-color: rgb(255 255 255) !important;
            }
            .high-contrast .bg-gray-50 {
              background-color: rgb(0 0 0) !important;
            }
            .high-contrast .hover:bg-gray-100:hover {
              background-color: rgb(64 64 64) !important;
            }
          `}
        </style>
      )}
      <div
        className={`${isMobileLandscape ? 'space-y-0.5' : 'space-y-4'} ${highContrastMode ? 'high-contrast' : ''}`}
        role='region'
        aria-label='Dive profile chart with interactive controls'
      >
        <div className={`flex flex-col ${isMobileLandscape ? 'gap-0.5' : 'gap-4'}`}>
          {isMobileLandscape && onClose && (
            <div className='flex justify-end'>
              <button
                onClick={onClose}
                className='text-gray-500 hover:text-gray-700 hover:font-bold transition-all p-0.5'
                aria-label='Close dive profile modal'
              >
                <X className='h-3 w-3' />
              </button>
            </div>
          )}

          <div className={`flex flex-wrap items-center ${isMobileLandscape ? 'gap-2' : 'gap-6'}`}>
            <div className='flex items-center gap-2'>
              <Clock className={`${isMobileLandscape ? 'h-3 w-3' : 'h-5 w-5'} text-gray-500`} />
              <span
                className={`${isMobileLandscape ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}
              >
                {metrics.duration.toFixed(0)}m
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <TrendingUp
                className={`${isMobileLandscape ? 'h-3 w-3' : 'h-5 w-5'} text-blue-500`}
              />
              <span
                className={`${isMobileLandscape ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}
              >
                Max: {metrics.maxDepth.toFixed(1)}m
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <TrendingUp className={`${isMobileLandscape ? 'h-3 w-3' : 'h-5 w-5'} text-red-500`} />
              <span
                className={`${isMobileLandscape ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}
              >
                Avg: {metrics.averageDepth.toFixed(1)}m
              </span>
            </div>
            {metrics.minTemp !== null && metrics.maxTemp !== null && (
              <div className='flex items-center gap-2'>
                <Thermometer
                  className={`${isMobileLandscape ? 'h-3 w-3' : 'h-5 w-5'} text-green-500`}
                />
                <span
                  className={`${isMobileLandscape ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}
                >
                  {metrics.minTemp.toFixed(0)}°C - {metrics.maxTemp.toFixed(0)}°C
                </span>
              </div>
            )}
          </div>

          <div className='mb-3'>
            <div className='mb-2'>
              <div className='text-xs text-gray-500 mb-1.5 font-medium'>Chart Display:</div>
              <div
                className={`${isMobileViewport && !isMobileLandscape ? 'grid grid-cols-2 gap-x-2 gap-y-1.5' : `flex items-center ${isMobileLandscape ? 'space-x-2' : 'space-x-4'}`}`}
              >
                <label className='flex items-center min-h-[34px] cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={showTemperature}
                    onChange={e => setShowTemperature(e.target.checked)}
                    className='w-4 h-4 mr-2 cursor-pointer flex-shrink-0'
                  />
                  <span className={`${isMobileLandscape ? 'text-xs' : 'text-sm'} text-gray-600`}>
                    Temperature
                  </span>
                </label>
                {hasDeco && hasStopdepth && (
                  <label className='flex items-center min-h-[34px] cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={showCeiling}
                      onChange={e => setShowCeiling(e.target.checked)}
                      className='w-4 h-4 mr-2 cursor-pointer flex-shrink-0'
                    />
                    <span className={`${isMobileLandscape ? 'text-xs' : 'text-sm'} text-gray-600`}>
                      Ceiling
                    </span>
                  </label>
                )}
              </div>
            </div>

            {(chartData.some(s => s.cns !== null && s.cns !== undefined) ||
              (hasDeco && chartData.some(s => s.stoptime > 0))) && (
              <div>
                <div className='text-xs text-gray-500 mb-1.5 font-medium'>Tooltip Display:</div>
                <div
                  className={`${isMobileViewport && !isMobileLandscape ? 'grid grid-cols-2 gap-x-2 gap-y-1.5' : `flex items-center ${isMobileLandscape ? 'space-x-2' : 'space-x-4'}`}`}
                >
                  {chartData.some(s => s.cns !== null && s.cns !== undefined) && (
                    <label className='flex items-center min-h-[34px] cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={showCNS}
                        onChange={e => setShowCNS(e.target.checked)}
                        className='w-4 h-4 mr-2 cursor-pointer flex-shrink-0'
                      />
                      <span
                        className={`${isMobileLandscape ? 'text-xs' : 'text-sm'} text-gray-600`}
                      >
                        CNS
                      </span>
                    </label>
                  )}
                  {hasDeco && chartData.some(s => s.stoptime > 0) && (
                    <label className='flex items-center min-h-[34px] cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={showStoptime}
                        onChange={e => setShowStoptime(e.target.checked)}
                        className='w-4 h-4 mr-2 cursor-pointer flex-shrink-0'
                      />
                      <span
                        className={`${isMobileLandscape ? 'text-xs' : 'text-sm'} text-gray-600`}
                      >
                        Stop Time
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className='flex items-center gap-2'>
            {profileData?.samples && profileData.samples.length > 1000 && !isMobileLandscape && (
              <button
                onClick={() => setShowAllSamples(!showAllSamples)}
                className={`px-3 py-1 text-xs rounded border ${showAllSamples ? 'bg-green-600 text-white border-green-600' : 'text-blue-600 border-blue-300'}`}
              >
                {showAllSamples ? 'Sampled View' : 'All Samples'}
              </button>
            )}
            <button
              onClick={() => setHighContrastMode(!highContrastMode)}
              className='p-2 rounded-md border-2 border-gray-400'
            >
              <Contrast className={`${isMobileLandscape ? 'h-4 w-4' : 'h-5 w-5'}`} />
            </button>
            {onMaximize && (
              <button
                onClick={onMaximize}
                className='p-2 rounded border border-blue-300 text-blue-600'
              >
                <Maximize className={`${isMobileLandscape ? 'h-4 w-4' : 'h-5 w-5'}`} />
              </button>
            )}
            {!isMobileLandscape && (
              <div className='relative group'>
                <button className='p-2 text-gray-500 rounded border border-gray-300'>
                  <Download className='h-5 w-5' />
                </button>
                <div className='absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible z-10'>
                  <button
                    onClick={handleExportPNG}
                    className='w-full px-3 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg'
                  >
                    Export PNG
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className='w-full px-3 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg'
                  >
                    Export PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          ref={chartRef}
          className={`bg-white rounded-lg border border-gray-200 ${isMobileLandscape ? 'p-1' : 'p-4'} relative`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `scale(${chartScale}) translate(${chartOffset.x}px, ${chartOffset.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          {showLandscapeTip && isMobileViewport && !isMobileLandscape && (
            <div className='absolute top-2 left-2 right-2 z-20 bg-blue-600 text-white rounded-md shadow-lg px-3 py-2 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <span className='text-xs'>
                  Tip: Rotate your phone to landscape for a better view
                </span>
              </div>
              <button onClick={() => setShowLandscapeTip(false)}>
                <X className='h-4 w-4' />
              </button>
            </div>
          )}
          {screenSize === 'mobile' &&
            (chartScale !== 1 || chartOffset.x !== 0 || chartOffset.y !== 0) && (
              <div className='absolute top-2 right-2 z-10'>
                <button
                  onClick={resetChartView}
                  className='px-3 py-1 text-xs bg-blue-600 text-white rounded shadow-lg'
                >
                  Reset View
                </button>
              </div>
            )}
          <ResponsiveContainer width='100%' height={chartHeight}>
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              onMouseMove={handleMouseMove}
            >
              <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
              <XAxis
                dataKey='time'
                type='number'
                domain={[0, metrics.duration]}
                tickFormatter={v => `${v.toFixed(0)}m`}
              />
              <YAxis
                domain={[0, metrics.maxDepth + 2]}
                reversed
                tickFormatter={v => `${v.toFixed(0)}m`}
              />
              {showTemperature && metrics.minTemp !== null && (
                <YAxis
                  yAxisId='temperature'
                  orientation='right'
                  domain={[metrics.minTemp - 2, metrics.maxTemp + 2]}
                  tickFormatter={v => `${v.toFixed(0)}°C`}
                />
              )}
              <Tooltip
                content={
                  <CustomTooltip
                    showCNS={showCNS}
                    showCeiling={showCeiling}
                    showStoptime={showStoptime}
                    showTemperature={showTemperature}
                    formatStoptime={formatStoptime}
                  />
                }
              />
              <Area
                type='monotone'
                dataKey='stopdepth'
                fill='#56B4E9'
                fillOpacity={hasDeco && hasStopdepth && showCeiling ? 0.2 : 0}
                stroke='#E69F00'
                hide={!hasDeco || !hasStopdepth || !showCeiling}
              />
              <Line type='monotone' dataKey='depth' stroke='#0072B2' strokeWidth={3} dot={false} />
              <Line
                type='monotone'
                dataKey='averageDepth'
                stroke='#E69F00'
                strokeDasharray='5 5'
                strokeWidth={2}
                dot={false}
              />
              {showTemperature && (
                <Line
                  yAxisId='temperature'
                  type='stepAfter'
                  dataKey='temperature'
                  stroke='#009E73'
                  strokeWidth={2}
                  strokeDasharray='5 5'
                  dot={false}
                />
              )}
              {gasChangeEvents.map(event => (
                <ReferenceLine
                  key={`gc-${event.time_minutes}`}
                  x={event.time_minutes}
                  stroke='#F0E442'
                  strokeWidth={2}
                  strokeDasharray='8 4'
                  label={{
                    value: `Gas ${event.cylinder || ''}`,
                    position: 'top',
                    fontSize: 10,
                    fill: '#F0E442',
                  }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div
          className={`bg-gray-50 rounded-lg border border-gray-200 ${isMobileLandscape ? 'p-1' : 'p-3'}`}
        >
          <div className='flex items-center justify-center space-x-6 text-sm'>
            <div className='flex items-center space-x-1'>
              <div className='w-4 h-0.5' style={{ backgroundColor: '#0072B2' }}></div>
              <span>Depth</span>
            </div>
            <div className='flex items-center space-x-1'>
              <div
                className='w-4 h-0.5 border-dashed border-t-2'
                style={{ borderColor: '#E69F00' }}
              ></div>
              <span>Avg Depth</span>
            </div>
            <div className='flex items-center space-x-1'>
              <div
                className='w-4 h-0.5 border-dashed border-t-2'
                style={{ borderColor: '#009E73' }}
              ></div>
              <span>Temp</span>
            </div>
            {hasDeco && hasStopdepth && (
              <div className='flex items-center space-x-1'>
                <div
                  className='w-4 h-0.5 border-dashed border-t-2'
                  style={{ borderColor: '#56B4E9' }}
                ></div>
                <span>Ceiling</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
/* eslint-enable max-lines-per-function, complexity */

AdvancedDiveProfileChart.propTypes = {
  profileData: PropTypes.shape({
    samples: PropTypes.arrayOf(
      PropTypes.shape({
        time_minutes: PropTypes.number,
        depth: PropTypes.number,
        temperature: PropTypes.number,
        ndl_minutes: PropTypes.number,
        cns_percent: PropTypes.number,
        in_deco: PropTypes.bool,
        stopdepth: PropTypes.number,
        stoptime_minutes: PropTypes.number,
      })
    ),
    events: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        type: PropTypes.string,
        time_minutes: PropTypes.number,
        cylinder: PropTypes.string,
        o2: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      })
    ),
  }),
  isLoading: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  showTemperature: PropTypes.bool,
  screenSize: PropTypes.string,
  onDecoStatusChange: PropTypes.func,
  onMaximize: PropTypes.func,
  onClose: PropTypes.func,
  onUpload: PropTypes.func,
};

export default AdvancedDiveProfileChart;
