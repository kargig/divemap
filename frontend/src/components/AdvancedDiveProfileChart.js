import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Thermometer, Clock, Activity, AlertTriangle, Download, Maximize } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useMemo, useState, useCallback, useRef } from 'react';
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

const AdvancedDiveProfileChart = ({
  profileData,
  isLoading = false,
  error = null,
  showTemperature: initialShowTemperature = true,
  screenSize = 'desktop',
  onDecoStatusChange,
  onMaximize,
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

  // Check if dive goes into deco
  const hasDeco = useMemo(() => {
    if (!profileData?.samples) return false;
    return profileData.samples.some(sample => sample.in_deco === true);
  }, [profileData]);

  // Check if dive has any stopdepth data (for conditional ceiling display)
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
      event => event.name === 'gaschange' && event.type === '25' && event.time_minutes > 1.0 // Ignore gas change events in the first minute of the dive
    );
  }, [profileData]);

  // Notify parent component of deco status change
  React.useEffect(() => {
    if (onDecoStatusChange) {
      onDecoStatusChange(hasDeco);
    }
  }, [hasDeco, onDecoStatusChange]);

  // Process the data for the chart with smart sampling
  const chartData = useMemo(() => {
    if (!profileData || !profileData.samples) return [];

    let runningDepthSum = 0;
    const samples = profileData.samples;

    // Smart sampling logic - only sample if more than 1000 data points
    const shouldSample = !showAllSamples && samples.length > 1000;
    let samplesToProcess = samples;

    if (shouldSample) {
      // Calculate sampling rate - if less than 1 event per 10 seconds, we can sample
      const duration = samples[samples.length - 1]?.time_minutes || 0;
      const eventFrequency = samples.length / (duration * 60); // events per second
      const canSample = eventFrequency < 0.1; // less than 1 per 10 seconds

      if (canSample) {
        // Smart sampling: preserve important metadata and sample regular data
        const sampledSamples = [];

        for (let i = 0; i < samples.length; i++) {
          const sample = samples[i];
          const isFirstOrLast = i === 0 || i === samples.length - 1;
          const hasImportantMetadata =
            sample.in_deco !== undefined ||
            sample.ndl !== undefined ||
            sample.cns !== undefined ||
            sample.temp !== undefined ||
            sample.stopdepth !== undefined ||
            sample.tts !== undefined;

          // Always include first, last, and samples with important metadata
          if (isFirstOrLast || hasImportantMetadata) {
            sampledSamples.push(sample);
          } else {
            // For regular samples, check if we should include this one
            // Sample every 10th point, but ensure we don't skip important metadata
            if (i % 10 === 0) {
              // Check if the next few samples have important metadata
              let hasNearbyImportantMetadata = false;
              for (let j = i + 1; j <= Math.min(i + 9, samples.length - 1); j++) {
                const nearbySample = samples[j];
                if (
                  nearbySample.in_deco !== undefined ||
                  nearbySample.ndl !== undefined ||
                  nearbySample.cns !== undefined ||
                  nearbySample.temp !== undefined ||
                  nearbySample.stopdepth !== undefined ||
                  nearbySample.tts !== undefined
                ) {
                  hasNearbyImportantMetadata = true;
                  break;
                }
              }

              // If no important metadata nearby, include this sample
              if (!hasNearbyImportantMetadata) {
                sampledSamples.push(sample);
              } else {
                // Find the nearest sample without important metadata
                let nearestIndex = -1;
                for (let j = i + 1; j <= Math.min(i + 9, samples.length - 1); j++) {
                  const nearbySample = samples[j];
                  if (
                    nearbySample.in_deco === undefined &&
                    nearbySample.ndl === undefined &&
                    nearbySample.cns === undefined &&
                    nearbySample.temp === undefined &&
                    nearbySample.stopdepth === undefined &&
                    nearbySample.tts === undefined
                  ) {
                    nearestIndex = j;
                    break;
                  }
                }
                if (nearestIndex !== -1) {
                  sampledSamples.push(samples[nearestIndex]);
                  i = nearestIndex; // Skip ahead to avoid duplicate processing
                } else {
                  // If no suitable nearby sample, include current one
                  sampledSamples.push(sample);
                }
              }
            }
          }
        }

        samplesToProcess = sampledSamples;
      } else {
        // For high-frequency data, use sampling but still cover full duration
        const sampleRate = Math.ceil(samples.length / 100); // Aim for ~100 samples
        samplesToProcess = samples.filter((sample, index) => {
          // Always include first and last samples
          if (index === 0 || index === samples.length - 1) return true;

          // Always include samples with important metadata
          if (
            sample.in_deco !== undefined ||
            sample.ndl !== undefined ||
            sample.cns !== undefined ||
            sample.temp !== undefined ||
            sample.stopdepth !== undefined ||
            sample.tts !== undefined
          ) {
            return true;
          }

          // Sample at regular intervals
          return index % sampleRate === 0;
        });
      }
    }

    // First pass: collect all temperature readings from loaded samples
    samplesToProcess
      .map((sample, index) => ({
        time: sample.time_minutes || 0,
        temperature: sample.temperature,
        index,
      }))
      .filter(item => item.temperature !== null && item.temperature !== undefined);

    // Create stepped temperature, NDL, CNS, and stopdepth data - hold last known values
    let lastKnownTemperature = null;
    let lastKnownNDL = null;
    let lastKnownInDeco = false;
    let lastKnownCNS = null;
    let lastKnownStopdepth = 0; // Initialize stopdepth to 0 (surface)
    let lastKnownStoptime = null; // Initialize stoptime to null (no stop time at surface)
    const steppedSamples = samplesToProcess.map((sample, index) => {
      const depth = sample.depth || 0;
      runningDepthSum += depth;
      const averageDepth = runningDepthSum / (index + 1);

      // For stepped line: use actual temperature if available, otherwise hold last known value
      if (sample.temperature !== null && sample.temperature !== undefined) {
        lastKnownTemperature = sample.temperature;
      }

      // For stepped line: use actual NDL if available, otherwise hold last known value
      if (sample.ndl_minutes !== null && sample.ndl_minutes !== undefined) {
        lastKnownNDL = sample.ndl_minutes;
      }

      // For stepped line: use actual in_deco status if available, otherwise hold last known value
      if (sample.in_deco !== null && sample.in_deco !== undefined) {
        lastKnownInDeco = sample.in_deco;
      }

      // For stepped line: use actual CNS if available, otherwise hold last known value
      if (sample.cns_percent !== null && sample.cns_percent !== undefined) {
        lastKnownCNS = sample.cns_percent;
      }

      // Handle stopdepth persistence logic
      if (lastKnownInDeco) {
        // When in decompression, use stopdepth if present, otherwise maintain previous value
        if (sample.stopdepth !== null && sample.stopdepth !== undefined) {
          lastKnownStopdepth = sample.stopdepth;
        }
      } else {
        // When not in decompression, reset stopdepth to 0 (surface)
        lastKnownStopdepth = 0;
      }

            // Handle stoptime persistence logic
            if (lastKnownInDeco) {
              // When in decompression, use stoptime_minutes if present, otherwise maintain previous value
              if (sample.stoptime_minutes !== null && sample.stoptime_minutes !== undefined) {
                lastKnownStoptime = sample.stoptime_minutes;
              }
            } else {
              // When not in decompression, reset stoptime to null (no stop time)
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
        stopdepth: lastKnownStopdepth, // Add stopdepth with persistence logic
        stoptime: lastKnownStoptime, // Add stoptime with persistence logic
      };
    });

    return steppedSamples;
  }, [profileData, showAllSamples]);

  // Use chart data directly (no pagination needed without zoom)
  const paginatedChartData = chartData;

  // Calculate metrics
  const metrics = useMemo(() => {
    if (chartData.length === 0)
      return {
        maxDepth: 0,
        averageDepth: 0,
        duration: 0,
        minTemp: null,
        maxTemp: null,
        minNDL: null,
        maxNDL: null,
      };

    const depths = chartData.map(d => d.depth);
    const temperatures = chartData.map(d => d.temperature).filter(t => t !== null && !isNaN(t));
    const ndls = chartData.map(d => d.ndl).filter(n => n !== null && !isNaN(n));

    return {
      maxDepth: Math.max(...depths),
      averageDepth: chartData[chartData.length - 1]?.averageDepth || 0,
      duration: Math.max(...chartData.map(d => d.time)),
      minTemp: temperatures.length > 0 ? Math.min(...temperatures) : null,
      maxTemp: temperatures.length > 0 ? Math.max(...temperatures) : null,
      minNDL: ndls.length > 0 ? Math.min(...ndls) : null,
      maxNDL: ndls.length > 0 ? Math.max(...ndls) : null,
    };
  }, [chartData]);

  // Format stoptime for display
  const formatStoptime = (stoptime) => {
    if (!stoptime || stoptime <= 0) return '0:00';
    
    const minutes = Math.floor(stoptime);
    const seconds = Math.round((stoptime - minutes) * 60);
    
    if (seconds === 60) {
      return `${minutes + 1}:00`;
    } else if (seconds < 10) {
      return `${minutes}:0${seconds}`;
    } else {
      return `${minutes}:${seconds}`;
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label, showCNS, showCeiling, showStoptime }) => {
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
              <span className='text-blue-600'>Depth:</span>
              <span className='font-medium'>{data.depth?.toFixed(1)}m</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-red-600'>Avg Depth:</span>
              <span className='font-medium'>{data.averageDepth?.toFixed(1)}m</span>
            </div>
            {data.temperature && showTemperature && (
              <div className='flex justify-between'>
                <span className='text-green-600'>Temperature:</span>
                <span className='font-medium'>{data.temperature?.toFixed(1)}°C</span>
              </div>
            )}
            <div className='flex justify-between'>
              <span className='text-amber-600'>NDL:</span>
              <span className='font-medium'>
                {data.in_deco ? (
                  <span className='text-red-600'>In deco</span>
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
                <span className='text-purple-600'>CNS:</span>
                <span className='font-medium'>{data.cns?.toFixed(1)}%</span>
              </div>
            )}
            {data.stopdepth > 0 && showCeiling && (
              <div className='flex justify-between'>
                <span className='text-red-600'>Ceiling:</span>
                <span className='font-medium'>{data.stopdepth?.toFixed(1)}m</span>
              </div>
            )}
            {data.stoptime > 0 && data.in_deco && showStoptime && (
              <div className='flex justify-between'>
                <span className='text-orange-600'>Stop Time:</span>
                <span className='font-medium'>{formatStoptime(data.stoptime)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

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
      // Error exporting PNG
    }
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current);
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF();
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
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
      // Error exporting PDF
    }
  }, []);

  // Mobile touch interactions
  const handleTouchStart = useCallback(e => {
    if (e.touches.length === 1) {
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      });
      setIsPanning(false);
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      setTouchStart({
        distance,
        centerX: (touch1.clientX + touch2.clientX) / 2,
        centerY: (touch1.clientY + touch2.clientY) / 2,
        time: Date.now(),
      });
    }
  }, []);

  const handleTouchMove = useCallback(
    e => {
      e.preventDefault();

      if (e.touches.length === 1 && touchStart && !isPanning) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;
        const deltaTime = Date.now() - touchStart.time;

        // Start panning if moved more than 10px or 100ms
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10 || deltaTime > 100) {
          setIsPanning(true);
          setChartOffset(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY,
          }));
          setTouchStart({
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
          });
        }
      } else if (e.touches.length === 2 && touchStart && touchStart.distance) {
        // Pinch to zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );

        const scale = distance / touchStart.distance;
        const newScale = Math.max(0.5, Math.min(3, chartScale * scale));
        setChartScale(newScale);

        setTouchStart({
          distance,
          centerX: (touch1.clientX + touch2.clientX) / 2,
          centerY: (touch1.clientY + touch2.clientY) / 2,
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
        <p className='text-sm'>{error}</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className='text-center py-8 text-gray-600 bg-gray-50 rounded-lg'>
        <Activity className='h-12 w-12 mx-auto mb-4 text-gray-400' />
        <p className='font-semibold'>No dive profile data available</p>
        <p className='text-sm'>Upload a dive profile to see the visualization</p>
      </div>
    );
  }

  const chartHeight = screenSize === 'mobile' ? 300 : 400;

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
            .high-contrast .hover\\:bg-gray-100:hover {
              background-color: rgb(64 64 64) !important;
            }
          `}
        </style>
      )}
      <div
        className={`space-y-4 ${highContrastMode ? 'high-contrast' : ''}`}
        role='region'
        aria-label='Dive profile chart with interactive controls'
      >
        {/* Header with metrics and controls */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <div className='flex flex-wrap items-center gap-6'>
            <div className='flex items-center gap-2'>
              <Clock className='h-5 w-5 text-gray-500' />
              <span className='text-sm font-medium text-gray-700'>
                {metrics.duration.toFixed(0)}m
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <Activity className='h-5 w-5 text-blue-500' />
              <span className='text-sm font-medium text-gray-700'>
                Max: {metrics.maxDepth.toFixed(1)}m
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <Activity className='h-5 w-5 text-red-500' />
              <span className='text-sm font-medium text-gray-700'>
                Avg: {metrics.averageDepth.toFixed(1)}m
              </span>
            </div>
            {metrics.minTemp !== null && metrics.maxTemp !== null && (
              <div className='flex items-center gap-2'>
                <Thermometer className='h-5 w-5 text-green-500' />
                <span className='text-sm font-medium text-gray-700'>
                  {metrics.minTemp.toFixed(0)}°C - {metrics.maxTemp.toFixed(0)}°C
                </span>
              </div>
            )}
          </div>

          {/* Data Toggles */}
          <div className='flex items-center space-x-4'>
            <label className='flex items-center'>
              <input
                type='checkbox'
                checked={showTemperature}
                onChange={e => setShowTemperature(e.target.checked)}
                className='mr-2'
              />
              <span className='text-sm text-gray-600'>Temperature</span>
            </label>
            {chartData.some(sample => sample.cns !== null && sample.cns !== undefined) && (
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={showCNS}
                  onChange={e => setShowCNS(e.target.checked)}
                  className='mr-2'
                />
                <span className='text-sm text-gray-600'>CNS</span>
              </label>
            )}
            {hasDeco && hasStopdepth && (
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={showCeiling}
                  onChange={e => setShowCeiling(e.target.checked)}
                  className='mr-2'
                />
                <span className='text-sm text-gray-600'>Ceiling</span>
              </label>
            )}
            {hasDeco && chartData.some(sample => sample.stoptime !== null && sample.stoptime !== undefined && sample.stoptime > 0) && (
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={showStoptime}
                  onChange={e => setShowStoptime(e.target.checked)}
                  className='mr-2'
                />
                <span className='text-sm text-gray-600'>Stop Time</span>
              </label>
            )}
          </div>

          <div className='flex items-center gap-2'>
            {profileData?.samples && profileData.samples.length > 1000 && (
              <button
                onClick={() => setShowAllSamples(!showAllSamples)}
                className={`px-3 py-1 text-xs rounded border ${
                  showAllSamples
                    ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                    : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-300'
                }`}
                title={showAllSamples ? 'Switch to sampled view' : 'Switch to all samples view'}
                aria-label={
                  showAllSamples ? 'Switch to sampled view' : 'Switch to all samples view'
                }
              >
                {showAllSamples ? 'Sampled View' : 'All Samples'}
              </button>
            )}
            <button
              onClick={() => setHighContrastMode(!highContrastMode)}
              className={`px-4 py-2 text-sm font-medium rounded-md border-2 transition-all duration-200 ${
                highContrastMode
                  ? 'bg-gray-900 text-white border-gray-900 shadow-lg'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50 border-gray-400 hover:border-gray-500 shadow-sm hover:shadow-md'
              }`}
              title='Toggle High Contrast Mode'
              aria-label={`${highContrastMode ? 'Disable' : 'Enable'} high contrast mode`}
            >
              {highContrastMode ? 'High Contrast On' : 'High Contrast Off'}
            </button>
            {onMaximize && (
              <button
                onClick={onMaximize}
                className='px-3 py-1 text-xs rounded border text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-300'
                title='Maximize chart view'
                aria-label='Open chart in full-screen modal'
              >
                <Maximize className='h-4 w-4 inline mr-1' />
                Maximize
              </button>
            )}
            <div className='relative group'>
              <button
                className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded'
                title='Download Chart'
                aria-label='Download chart options'
              >
                <Download className='h-4 w-4' />
              </button>
              <div className='absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10'>
                <button
                  onClick={handleExportPNG}
                  className='w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg'
                  aria-label='Export chart as PNG image'
                >
                  Export PNG
                </button>
                <button
                  onClick={handleExportPDF}
                  className='w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg'
                  aria-label='Export chart as PDF document'
                >
                  Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile landscape suggestion - only show on mobile devices in portrait mode */}
        <div className='sm:hidden bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2'>
          <div className='flex items-center justify-center space-x-2 text-sm text-blue-700'>
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' />
            </svg>
            <span className='font-medium'>Tip: Rotate your phone to landscape for a better view of the dive profile</span>
          </div>
        </div>

        {/* Chart Legend */}
        <div className='bg-gray-50 rounded-lg border border-gray-200 p-3 mb-2'>
          <div className='flex items-center justify-center space-x-6 text-sm'>
            <div className='flex items-center space-x-2'>
              <div className='w-4 h-0.5 bg-blue-500'></div>
              <span className='text-gray-700'>Depth</span>
            </div>
            <div className='flex items-center space-x-2'>
              <div className='w-4 h-0.5 bg-red-500 border-dashed border-t-2'></div>
              <span className='text-gray-700'>Average Depth</span>
            </div>
            <div className='flex items-center space-x-2'>
              <div className='w-4 h-0.5 bg-green-500 border-dashed border-t-2'></div>
              <span className='text-gray-700'>Temperature</span>
            </div>
            {hasDeco && hasStopdepth && (
              <div className='flex items-center space-x-2'>
                <div className='w-4 h-0.5 bg-red-500 border-dashed border-t-2'></div>
                <span className='text-gray-700'>Decompression Ceiling</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div
          ref={chartRef}
          className='bg-white rounded-lg border border-gray-200 p-4 relative'
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `scale(${chartScale}) translate(${chartOffset.x}px, ${chartOffset.y}px)`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Mobile Controls */}
          {screenSize === 'mobile' &&
            (chartScale !== 1 || chartOffset.x !== 0 || chartOffset.y !== 0) && (
              <div className='absolute top-2 right-2 z-10'>
                <button
                  onClick={resetChartView}
                  className='px-3 py-1 text-xs bg-blue-600 text-white rounded shadow-lg'
                  title='Reset chart view'
                >
                  Reset View
                </button>
              </div>
            )}
          <ResponsiveContainer width='100%' height={chartHeight}>
            <ComposedChart
              data={paginatedChartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              onMouseMove={handleMouseMove}
            >
              <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />

              {/* X Axis - Time */}
              <XAxis
                dataKey='time'
                type='number'
                domain={[0, metrics.duration]}
                tickFormatter={value => `${value.toFixed(0)}m`}
                tick={{ fontSize: 12, fill: '#666' }}
                label={{
                  value: 'Time (minutes)',
                  position: 'insideBottom',
                  offset: -10,
                  style: { textAnchor: 'middle', fontSize: 12, fill: '#666' },
                }}
              />

              {/* Y Axis - Depth */}
              <YAxis
                domain={[0, metrics.maxDepth + 2]}
                scale='linear'
                orientation='left'
                reversed
                tickFormatter={value => `${value.toFixed(0)}m`}
                tick={{ fontSize: 12, fill: '#666' }}
                label={{
                  value: 'Depth (m)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: 12, fill: '#666' },
                }}
              />

              {/* Secondary Y Axis - Temperature */}
              {showTemperature && metrics.minTemp !== null && (
                <YAxis
                  yAxisId='temperature'
                  orientation='right'
                  domain={[metrics.minTemp - 2, metrics.maxTemp + 2]}
                  tickFormatter={value => `${value.toFixed(0)}°C`}
                  tick={{ fontSize: 12, fill: '#10b981' }}
                  label={{
                    value: 'Temperature (°C)',
                    angle: 90,
                    position: 'insideRight',
                    style: { textAnchor: 'middle', fontSize: 12, fill: '#10b981' },
                  }}
                />
              )}

              <Tooltip content={<CustomTooltip showCNS={showCNS} showCeiling={showCeiling} showStoptime={showStoptime} />} />

              {/* Stopdepth ceiling area - only show if dive has decompression stops */}
              <Area
                type='monotone'
                dataKey='stopdepth'
                fill='#ef4444'
                fillOpacity={hasDeco && hasStopdepth ? 0.2 : 0}
                stroke='#dc2626'
                strokeWidth={hasDeco && hasStopdepth ? 1 : 0}
                strokeDasharray='3 3'
                name='Decompression Ceiling'
                hide={!hasDeco || !hasStopdepth}
              />

              {/* Main depth line */}
              <Line
                type='monotone'
                dataKey='depth'
                stroke='#2563eb'
                strokeWidth={3}
                dot={false}
                name='Depth'
              />

              {/* Average depth line */}
              <Line
                type='monotone'
                dataKey='averageDepth'
                stroke='#dc2626'
                strokeDasharray='5 5'
                strokeWidth={2}
                dot={false}
                name='Average Depth'
              />

              {/* Temperature line */}
              {showTemperature && (
                <Line
                  yAxisId='temperature'
                  type='stepAfter'
                  dataKey='temperature'
                  stroke='#10b981'
                  strokeWidth={2}
                  strokeDasharray='5 5'
                  dot={false}
                  name='Temperature'
                />
              )}

              {/* Gas change event markers */}
              {gasChangeEvents.map(event => (
                <ReferenceLine
                  key={`gas-change-${event.time_minutes}-${event.cylinder || 'unknown'}`}
                  x={event.time_minutes}
                  stroke='#f59e0b'
                  strokeWidth={2}
                  strokeDasharray='8 4'
                  label={{
                    value: `Gas Change ${event.cylinder || ''}${event.o2 ? ` (${event.o2} O2)` : ''}`,
                    position: 'top',
                    style: {
                      textAnchor: 'middle',
                      fontSize: 10,
                      fill: '#f59e0b',
                      fontWeight: 'bold',
                    },
                  }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Sampling Information */}
        {profileData?.samples && profileData.samples.length > 1000 && (
          <div className='mt-4 text-center'>
            {!showAllSamples && chartData.length < profileData.samples.length && (
              <div className='text-sm text-gray-600 mb-2'>
                <span className='font-medium'>Sampled View:</span> Showing {chartData.length} of{' '}
                {profileData.samples.length} samples
                <br />
                <span className='text-xs text-gray-500'>
                  Full dive duration displayed with smart sampling for performance
                </span>
              </div>
            )}
            {showAllSamples && (
              <div className='text-sm text-green-600 mb-2'>
                <span className='font-medium'>All Samples View:</span> Showing all{' '}
                {profileData.samples.length} samples
                <br />
                <span className='text-xs text-gray-500'>
                  Complete dataset - may impact performance on very large dives
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

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
      })
    ),
    events: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        type: PropTypes.string,
        time_minutes: PropTypes.number,
        cylinder: PropTypes.string,
        o2: PropTypes.number,
      })
    ),
  }),
  isLoading: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  showTemperature: PropTypes.bool,
  screenSize: PropTypes.string,
  onDecoStatusChange: PropTypes.func,
  onMaximize: PropTypes.func,
};

export default AdvancedDiveProfileChart;
