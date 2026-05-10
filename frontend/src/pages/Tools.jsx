import { Calculator, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';

import SEO from '../components/SEO';
import BestMixCalculator from '../components/calculators/BestMixCalculator';
import GasFillPriceCalculator from '../components/calculators/GasFillPriceCalculator';
import GasPlanningCalculator from '../components/calculators/GasPlanningCalculator';
import ICDCalculator from '../components/calculators/ICDCalculator';
import MinGasCalculator from '../components/calculators/MinGasCalculator';
import ModCalculator from '../components/calculators/ModCalculator';
import SacRateCalculator from '../components/calculators/SacRateCalculator';
import WeightCalculator from '../components/calculators/WeightCalculator';
import Select from '../components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import TankBuoyancy from '../utils/TankBuoyancy';

const TOOL_TABS = [
  { value: 'mod', label: 'MOD' },
  { value: 'best-mix', label: 'Best Mix' },
  { value: 'sac', label: 'SAC Rate' },
  { value: 'gas-planning', label: 'Gas Consumption' },
  { value: 'min-gas', label: 'Min Gas' },
  { value: 'icd', label: 'ICD Check' },
  { value: 'gas-fill', label: 'Fill Price' },
  { value: 'buoyancy', label: 'Tank Buoyancy' },
  { value: 'weight', label: 'Weight' },
];

const Tools = () => {
  const { toolId } = useParams();
  const navigate = useNavigate();

  // Validate toolId, default to 'mod' if invalid
  const isValidTool = TOOL_TABS.some(t => t.value === toolId);
  
  if (!isValidTool) {
    return <Navigate to="/resources/tools/mod" replace />;
  }

  const [activeTab, setActiveTab] = useState(toolId);

  // Sync state when URL changes (e.g. back button)
  useEffect(() => {
    if (isValidTool) {
      setActiveTab(toolId);
    }
  }, [toolId, isValidTool]);

  const handleTabChange = value => {
    setActiveTab(value);
    navigate(`/resources/tools/${value}`);
  };

  const activeToolLabel = TOOL_TABS.find(t => t.value === activeTab)?.label || 'Calculator';

  return (
    <div className='w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <SEO 
        title={`${activeToolLabel} | Divemap Diving Tools`}
        description={`Use our ${activeToolLabel} to plan your scuba dives safely. Divemap offers a suite of advanced diving calculators for gas planning, MOD, best mix, and tank buoyancy.`}
      />
      <div className='bg-white shadow-sm rounded-lg overflow-hidden mb-8 min-h-[80vh] flex flex-col'>
        <div className='p-6 border-b border-gray-200'>
          <h1 className='text-3xl font-bold text-gray-900 flex items-center'>
            <Calculator className='h-8 w-8 mr-3 text-blue-600' />
            Diving Tools
          </h1>
          <p className='mt-1 text-gray-600'>
            Useful calculators for dive planning. Remember to always double-check your calculations.
          </p>
        </div>

        <div className='flex-grow bg-gray-50 p-4 sm:p-6'>
          <Tabs value={activeTab} onValueChange={handleTabChange} className='w-full'>
            {/* Mobile View: Select Dropdown */}
            <div className='mb-6 sm:hidden'>
              <Select
                value={activeTab}
                onValueChange={handleTabChange}
                options={TOOL_TABS}
                placeholder='Select a tool...'
              />
            </div>

            {/* Desktop View: Tabs List */}
            <div className='hidden sm:flex justify-center mb-6 overflow-x-auto pb-2'>
              <TabsList className='w-full sm:w-auto justify-center inline-flex min-w-max'>
                {TOOL_TABS.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className='max-w-4xl mx-auto'>
              <TabsContent value='mod'>
                <ModCalculator />
              </TabsContent>

              <TabsContent value='best-mix'>
                <BestMixCalculator />
              </TabsContent>

              <TabsContent value='sac'>
                <SacRateCalculator />
              </TabsContent>

              <TabsContent value='gas-planning'>
                <GasPlanningCalculator />
              </TabsContent>

              <TabsContent value='min-gas'>
                <MinGasCalculator />
              </TabsContent>

              <TabsContent value='icd'>
                <ICDCalculator />
              </TabsContent>

              <TabsContent value='gas-fill'>
                <GasFillPriceCalculator />
              </TabsContent>

              <TabsContent value='buoyancy'>
                <TankBuoyancy />
              </TabsContent>

              <TabsContent value='weight'>
                <WeightCalculator />
              </TabsContent>
            </div>
          </Tabs>
        </div>
        <div className='p-6 bg-amber-50 border-t border-amber-100 mt-auto'>
          <div className='flex items-start'>
            <AlertTriangle className='h-6 w-6 text-amber-600 mr-3 mt-0.5' />
            <div>
              <h3 className='text-sm font-bold text-amber-800'>SAFETY WARNING</h3>
              <p className='mt-1 text-sm text-amber-700'>
                These tools are for educational purposes only. Diving involves inherent risks. Never
                dive beyond your certification level or physical capabilities. Always use a
                calibrated dive computer and have your dive plan verified by your buddy or dive
                supervisor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tools;
