import {
  Shield,
  Calendar,
  Clock,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  User,
  Check,
  CreditCard,
  MapPin,
  Layers,
  Ship,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, Link } from 'react-router-dom';

import api from '../../api';
import SEO from '../SEO';

import MedicalQuestionnaireModal from './MedicalQuestionnaireModal';
import WaiverSigningModal from './WaiverSigningModal';

const BookingWizard = () => {
  const { slotId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contextData, setContextData] = useState(null);
  const [savedProfiles, setSavedProfiles] = useState([]);

  // Form State: Step 1 Diver & Gear
  const [diverName, setDiverName] = useState('');
  const [diverEmail, setDiverEmail] = useState('');
  const [diverPhone, setDiverPhone] = useState('');
  const [diverNationality, setDiverNationality] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [certAgency, setCertAgency] = useState('');
  const [certLevel, setCertLevel] = useState('');
  const [certNumber, setCertNumber] = useState('');

  // Authoritative Diving Organizations & Levels from Divemap
  const [organizations, setOrganizations] = useState([]);
  const [availableLevels, setAvailableLevels] = useState([]);
  const [isCustomLevel, setIsCustomLevel] = useState(false);

  // Unit / Gear Selection
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedTankId, setSelectedTankId] = useState('12');
  const [selectedGasMixId, setSelectedGasMixId] = useState('air');
  const [regulatorFitting, setRegulatorFitting] = useState('DIN');
  const [wetsuitSize, setWetsuitSize] = useState('L');
  const [wetsuitThickness, setWetsuitThickness] = useState('5mm');
  const [bcdSize, setBcdSize] = useState('M');
  const [finType, setFinType] = useState('OPEN_HEEL');
  const [shoeSizeEu, setShoeSizeEu] = useState('43');
  const [leadKg, setLeadKg] = useState('4.0');

  // Step 2 & 3: Medical & Waiver
  const [medicalModalOpen, setMedicalModalOpen] = useState(false);
  const [dmscAnswers, setDmscAnswers] = useState(null);
  const [medicalStatus, setMedicalStatus] = useState('PENDING'); // PENDING | CLEARED | FLAGGED_CONTACT_CENTER

  const [waiverModalOpen, setWaiverModalOpen] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState(null);

  // Load Checkout Context
  useEffect(() => {
    const fetchContext = async () => {
      try {
        setLoading(true);
        const [contextRes, profilesRes, orgsRes] = await Promise.all([
          api.get(`/api/v1/bookings/checkout-context/${slotId}`),
          api.get('/api/v1/bookings/gear-profiles').catch(() => ({ data: [] })),
          api.get('/api/v1/diving-organizations/?limit=100').catch(() => ({ data: [] })),
        ]);

        const data = contextRes.data;
        setContextData(data);
        setSavedProfiles(profilesRes.data || []);
        setOrganizations(orgsRes.data || []);

        // Default Unit Selection
        if (data.units && data.units.length > 0) {
          setSelectedUnitId(data.units[0].id);
        }

        // Auto-fill from gear profile
        if (data.prefill_gear) {
          const pg = data.prefill_gear;
          if (pg.preferred_tank_id) setSelectedTankId(pg.preferred_tank_id);
          if (pg.preferred_gas_mix_id) setSelectedGasMixId(pg.preferred_gas_mix_id);
          if (pg.regulator_fitting) setRegulatorFitting(pg.regulator_fitting);
          if (pg.wetsuit_size) setWetsuitSize(pg.wetsuit_size);
          if (pg.wetsuit_thickness) setWetsuitThickness(pg.wetsuit_thickness);
          if (pg.bcd_size) setBcdSize(pg.bcd_size);
          if (pg.fin_type) setFinType(pg.fin_type);
          if (pg.shoe_size_eu) setShoeSizeEu(pg.shoe_size_eu.toString());
          if (pg.estimated_lead_kg) setLeadKg(pg.estimated_lead_kg.toString());
        }

        // Auto-fill from certifications
        if (data.user_certifications && data.user_certifications.length > 0) {
          const primaryCert = data.user_certifications[0];
          setCertAgency(primaryCert.agency || '');
          setCertLevel(primaryCert.level || '');
          setCertNumber(primaryCert.number || '');
        }
      } catch (err) {
        console.error('Failed to load checkout context:', err);
        toast.error('Failed to load trip booking details.');
      } finally {
        setLoading(false);
      }
    };

    if (slotId) {
      fetchContext();
    }
  }, [slotId]);

  // Load official certification levels when agency changes
  useEffect(() => {
    if (!certAgency || organizations.length === 0) {
      setAvailableLevels([]);
      return;
    }

    const matchedOrg = organizations.find(
      o =>
        o.acronym?.toLowerCase() === certAgency.toLowerCase() ||
        o.name?.toLowerCase() === certAgency.toLowerCase()
    );

    if (matchedOrg) {
      api
        .get(`/api/v1/diving-organizations/${matchedOrg.id}/levels`)
        .then(res => {
          const levels = res.data || [];
          setAvailableLevels(levels);
          if (certLevel && !levels.some(l => l.name.toLowerCase() === certLevel.toLowerCase())) {
            setIsCustomLevel(true);
          } else {
            setIsCustomLevel(false);
          }
        })
        .catch(err => {
          console.error('Failed to load certification levels:', err);
          setAvailableLevels([]);
        });
    } else {
      setAvailableLevels([]);
      setIsCustomLevel(true);
    }
  }, [certAgency, organizations]);

  // Handle switching gear profiles
  const handleSelectProfilePreset = profId => {
    const prof = savedProfiles.find(p => p.id === parseInt(profId, 10));
    if (!prof) return;

    if (prof.preferred_tank_id) setSelectedTankId(prof.preferred_tank_id);
    if (prof.preferred_gas_mix_id) setSelectedGasMixId(prof.preferred_gas_mix_id);
    if (prof.regulator_fitting) setRegulatorFitting(prof.regulator_fitting);
    if (prof.wetsuit_size) setWetsuitSize(prof.wetsuit_size);
    if (prof.wetsuit_thickness) setWetsuitThickness(prof.wetsuit_thickness);
    if (prof.bcd_size) setBcdSize(prof.bcd_size);
    if (prof.fin_type) setFinType(prof.fin_type);
    if (prof.shoe_size_eu) setShoeSizeEu(prof.shoe_size_eu.toString());
    if (prof.estimated_lead_kg) setLeadKg(prof.estimated_lead_kg.toString());

    toast.success(`Applied '${prof.name}' gear configuration!`);
  };

  const handleMedicalComplete = (answers, status) => {
    setDmscAnswers(answers);
    setMedicalStatus(status);
    if (status === 'CLEARED') {
      toast.success('Medical screening cleared!');
    } else {
      toast('Medical screening flagged for review. Seat will be held.', { icon: '⚠️' });
    }
  };

  const handleWaiverSigned = sig => {
    setWaiverSignature(sig);
    toast.success('Liability waiver signed electronically!');
  };

  // Final Confirmation
  const hasContactOrId = Boolean(diverEmail.trim() || diverPhone.trim() || passportNumber.trim());
  const hasCertDetails = Boolean(certAgency && certLevel.trim() && certNumber.trim());

  const isNitroxEligible = Boolean(
    !selectedGasMixId ||
      selectedGasMixId.toLowerCase() === 'air' ||
      (certLevel &&
        [
          'nitrox',
          'ean',
          'enriched air',
          'tec',
          'trimix',
          'advanced open water',
          'aowd',
          'rescue',
          'divemaster',
          'instructor',
          'owsi',
          'msdt',
          'fundies',
          'fundamentals',
          'extended range',
          'xr',
        ].some(k => certLevel.toLowerCase().includes(k)))
  );

  const handleConfirmBooking = async () => {
    if (!diverName.trim()) {
      toast.error('Please enter diver full legal name.');
      return;
    }
    if (!hasContactOrId) {
      toast.error(
        'Please provide at least one of: Email, Phone/WhatsApp, or Passport/National ID.'
      );
      return;
    }
    if (!hasCertDetails) {
      toast.error('Please provide your Certification Agency, Level, and C-Card Number.');
      return;
    }
    if (selectedGasMixId.toLowerCase() !== 'air' && !isNitroxEligible) {
      toast.error(
        'Enriched Air Nitrox requires an Enriched Air (Nitrox) or qualifying certification. Please select Air (21%) or update your certification.'
      );
      return;
    }
    if (!dmscAnswers) {
      toast.error('Please complete the medical questionnaire.');
      return;
    }
    if (!waiverSignature) {
      toast.error('Please sign the liability waiver.');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Hold seat via OCTO API
      const holdPayload = {
        productId: contextData.product.id,
        optionId: contextData.option.id,
        availabilityId: contextData.slot.id,
        unitItems: [
          {
            unitId: selectedUnitId,
            diverFullName: diverName.trim(),
            diverEmail: diverEmail.trim() || undefined,
            diverPhone: diverPhone.trim() || undefined,
            diverNationality: diverNationality.trim() || undefined,
            passportNumber: passportNumber.trim() || undefined,
            certificationAgency: certAgency,
            certificationLevel: certLevel,
            certificationNumber: certNumber.trim() || undefined,
            selectedTankId: selectedTankId,
            selectedGasMixId: selectedGasMixId,
            equipmentSizing: {
              wetsuit_size: wetsuitSize,
              wetsuit_thickness: wetsuitThickness,
              bcd_size: bcdSize,
              fin_type: finType,
              shoe_size_eu: parseFloat(shoeSizeEu) || 43.0,
              regulator_fitting: regulatorFitting,
              lead_kg: parseFloat(leadKg) || 4.0,
            },
          },
        ],
        contact: {
          fullName: diverName.trim(),
          email: diverEmail.trim() || undefined,
          phone: diverPhone.trim() || undefined,
        },
      };

      const holdRes = await api.post('/api/v1/octo/bookings', holdPayload);
      const bookingUuid = holdRes.data.uuid;
      const unitItemId = holdRes.data.unitItems[0].id;

      // 2. Submit paperwork
      const paperworkPayload = {
        unitItemId: unitItemId,
        dmscAnswers: dmscAnswers,
        signatureName: waiverSignature.signatureName,
        selectedTankId: selectedTankId,
        selectedGasMixId: selectedGasMixId,
        equipmentSizing: {
          wetsuit_size: wetsuitSize,
          wetsuit_thickness: wetsuitThickness,
          bcd_size: bcdSize,
          fin_type: finType,
          shoe_size_eu: parseFloat(shoeSizeEu) || 43.0,
          regulator_fitting: regulatorFitting,
          lead_kg: parseFloat(leadKg) || 4.0,
        },
      };

      await api.post(`/api/v1/bookings/${bookingUuid}/submit-paperwork`, paperworkPayload);

      toast.success('Booking confirmed successfully!');
      navigate(`/bookings/${bookingUuid}/voucher`);
    } catch (err) {
      console.error('Booking failed:', err);
      const msg = err.response?.data?.detail || 'Failed to complete booking.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex justify-center items-center py-24'>
        <Loader2 className='w-8 h-8 animate-spin text-blue-600' />
        <span className='ml-3 text-gray-600 font-medium'>Loading trip booking details...</span>
      </div>
    );
  }

  if (!contextData) {
    return (
      <div className='min-h-screen bg-gray-50 py-16 text-center'>
        <p className='text-gray-600'>Trip slot not found.</p>
        <Link to='/' className='mt-4 inline-block text-blue-600 underline font-semibold'>
          Back to Home
        </Link>
      </div>
    );
  }

  const selectedUnit = contextData.units.find(u => u.id === selectedUnitId) || contextData.units[0];
  const totalPrice = selectedUnit ? selectedUnit.retail_price : 0;

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors duration-200'>
      <SEO
        title={`Book ${contextData.product.title} - Divemap`}
        description='Reserve your dive trip slot with automated paperwork and sizing.'
      />

      <div className='max-w-[95vw] xl:max-w-[1200px] mx-auto px-0 sm:px-4 lg:px-6 py-6'>
        {/* Back Link */}
        <button
          onClick={() => navigate(-1)}
          className='inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-6'
        >
          <ChevronLeft size={18} className='mr-1' />
          Back
        </button>

        {/* Trip Summary Header Card */}
        <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
            <div>
              <span className='px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 uppercase'>
                {contextData.product.product_type?.replace(/_/g, ' ')}
              </span>
              <h1 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1'>
                {contextData.product.title}
              </h1>
              <p className='text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1'>
                <MapPin size={15} className='text-blue-600 shrink-0' />
                <span>Hosted by {contextData.center.name}</span>
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-200 dark:border-gray-600'>
              <div className='flex items-center gap-1.5'>
                <Calendar size={16} className='text-blue-600' />
                <span>
                  {new Date(contextData.slot.start_datetime).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className='flex items-center gap-1.5'>
                <Clock size={16} className='text-blue-600' />
                <span>
                  Meeting: {contextData.option.meeting_time} (Dep:{' '}
                  {contextData.option.departure_time})
                </span>
              </div>
              {contextData.vessel && (
                <div className='flex items-center gap-1.5'>
                  <Ship size={16} className='text-blue-600' />
                  <span>
                    Boat: <strong>{contextData.vessel.name}</strong>
                    {contextData.vessel.licensed_capacity && (
                      <span className='text-gray-400 font-normal'>
                        {' '}
                        ({contextData.vessel.licensed_capacity} max)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Main Form: Steps 1 to 3 */}
          <div className='lg:col-span-2 space-y-6'>
            {/* Step 1: Diver Identity & Equipment */}
            <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700'>
              <h2 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-4'>
                <User className='h-5 w-5 text-blue-600' />
                1. Diver Credentials & Equipment Sizing
              </h2>

              {/* Profile Preset Switcher */}
              {savedProfiles.length > 0 && (
                <div className='mb-5 p-3.5 bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                  <div className='flex items-center gap-2 text-xs text-blue-900 dark:text-blue-300 font-medium'>
                    <Layers size={16} className='text-blue-600 shrink-0' />
                    <span>Apply Saved Gear Setup:</span>
                  </div>
                  <select
                    onChange={e => handleSelectProfilePreset(e.target.value)}
                    defaultValue=''
                    className='px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-300 bg-white text-gray-800'
                  >
                    <option value='' disabled>
                      Select Configuration...
                    </option>
                    {savedProfiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.is_default ? '(Primary)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Unit Selection (Own Gear vs Rental) */}
              <div className='mb-5'>
                <label className='block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2'>
                  Select Equipment Tier
                </label>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {contextData.units.map(u => (
                    <label
                      key={u.id}
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        selectedUnitId === u.id
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-600'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className='flex items-center gap-2.5'>
                        <input
                          type='radio'
                          name='unit_selection'
                          checked={selectedUnitId === u.id}
                          onChange={() => setSelectedUnitId(u.id)}
                          className='h-4 w-4 text-blue-600'
                        />
                        <span className='text-xs sm:text-sm font-bold text-gray-900 dark:text-white'>
                          {u.title}
                        </span>
                      </div>
                      <span className='text-xs font-semibold text-blue-600 font-mono'>
                        €{u.retail_price}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Personal Details */}
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2'>
                <span className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                  Contact & Identification
                </span>
                <span
                  className={`text-[11px] font-medium ${
                    !hasContactOrId ? 'text-amber-600 font-semibold' : 'text-emerald-600'
                  }`}
                >
                  * At least one of Email, Phone, or Passport/National ID is required
                </span>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
                <div>
                  <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                    Full Legal Name *
                  </label>
                  <input
                    type='text'
                    value={diverName}
                    onChange={e => setDiverName(e.target.value)}
                    placeholder='As shown on passport'
                    required
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                    Email Address {!hasContactOrId && <span className='text-amber-600'>*</span>}
                  </label>
                  <input
                    type='email'
                    value={diverEmail}
                    onChange={e => setDiverEmail(e.target.value)}
                    placeholder='diver@example.com'
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      !hasContactOrId ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                    Phone / WhatsApp {!hasContactOrId && <span className='text-amber-600'>*</span>}
                  </label>
                  <input
                    type='tel'
                    value={diverPhone}
                    onChange={e => setDiverPhone(e.target.value)}
                    placeholder='+30 ...'
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      !hasContactOrId ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                    }`}
                  />
                </div>
                <div>
                  <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                    Passport / National ID #{' '}
                    {!hasContactOrId && <span className='text-amber-600'>*</span>}
                  </label>
                  <input
                    type='text'
                    value={passportNumber}
                    onChange={e => setPassportNumber(e.target.value)}
                    placeholder='For Port Authority manifest'
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      !hasContactOrId ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>

              {/* Certification Details */}
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2 pt-3 border-t'>
                <span className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                  Certification Credentials *
                </span>
                <span
                  className={`text-[11px] font-medium ${
                    !hasCertDetails ? 'text-amber-600 font-semibold' : 'text-emerald-600'
                  }`}
                >
                  * Agency, Level, and C-Card # are required to verify diver qualification
                </span>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4'>
                <div>
                  <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                    Agency *
                  </label>
                  <select
                    value={certAgency}
                    onChange={e => {
                      setCertAgency(e.target.value);
                      setCertLevel('');
                      setIsCustomLevel(false);
                    }}
                    required
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-white ${
                      !certAgency ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                    }`}
                  >
                    <option value=''>Select Agency...</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.acronym || org.name}>
                        {org.acronym} — {org.name}
                      </option>
                    ))}
                    <option value='Other'>Other / Non-Listed Agency</option>
                  </select>
                </div>
                <div>
                  <div className='flex items-center justify-between mb-1'>
                    <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300'>
                      Certification Level *
                    </label>
                    {isCustomLevel && availableLevels.length > 0 && (
                      <button
                        type='button'
                        onClick={() => {
                          setIsCustomLevel(false);
                          setCertLevel('');
                        }}
                        className='text-[10px] text-blue-600 hover:underline font-medium'
                      >
                        Pick from list
                      </button>
                    )}
                  </div>
                  {!isCustomLevel && availableLevels.length > 0 ? (
                    <select
                      value={certLevel}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setIsCustomLevel(true);
                          setCertLevel('');
                        } else {
                          setCertLevel(e.target.value);
                        }
                      }}
                      required
                      className={`w-full px-3 py-2 border rounded-lg text-sm bg-white ${
                        !certLevel.trim() ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                      }`}
                    >
                      <option value=''>Select Level...</option>
                      {availableLevels.map(lvl => (
                        <option key={lvl.id} value={lvl.name}>
                          {lvl.name}
                        </option>
                      ))}
                      <option value='__custom__'>Other / Custom Level...</option>
                    </select>
                  ) : (
                    <input
                      type='text'
                      value={certLevel}
                      onChange={e => setCertLevel(e.target.value)}
                      placeholder='e.g. Advanced Open Water'
                      required
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        !certLevel.trim() ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                      }`}
                    />
                  )}
                </div>
                <div>
                  <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                    C-Card # *
                  </label>
                  <input
                    type='text'
                    value={certNumber}
                    onChange={e => setCertNumber(e.target.value)}
                    placeholder='Certificate number'
                    required
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      !certNumber.trim() ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                    }`}
                  />
                </div>
              </div>

              {/* Equipment Specifications (Cylinder & Ballast) */}
              <div className='pt-3 border-t'>
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                  <div>
                    <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                      Cylinder *
                    </label>
                    <select
                      value={selectedTankId}
                      onChange={e => setSelectedTankId(e.target.value)}
                      className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white'
                    >
                      <option value='12'>12L Steel</option>
                      <option value='15'>15L Steel</option>
                      <option value='al80'>AL80 (11L) Alu</option>
                      <option value='10'>10L Steel</option>
                    </select>
                  </div>
                  <div>
                    <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                      Gas Mix *
                    </label>
                    <select
                      value={selectedGasMixId}
                      onChange={e => setSelectedGasMixId(e.target.value)}
                      className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white'
                    >
                      <option value='air'>Air (21%)</option>
                      <option value='ean32'>EAN32 (Nitrox)</option>
                    </select>
                  </div>
                  <div>
                    <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                      Regulator Valve *
                    </label>
                    <select
                      value={regulatorFitting}
                      onChange={e => setRegulatorFitting(e.target.value)}
                      className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium'
                    >
                      <option value='DIN'>DIN (G 5/8" Threaded)</option>
                      <option value='YOKE'>Yoke (INT / A-clamp)</option>
                    </select>
                  </div>
                  <div>
                    <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                      Lead Ballast (kg)
                    </label>
                    <input
                      type='number'
                      step='0.5'
                      value={leadKg}
                      onChange={e => setLeadKg(e.target.value)}
                      className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs'
                    />
                  </div>
                </div>

                {/* Valve Explanation Note */}
                <div className='mt-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-750 px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700'>
                  {regulatorFitting === 'DIN' ? (
                    <span>
                      ✓ <strong>DIN Tank Valve:</strong> Your cylinder will be configured with a
                      native 5/8" DIN valve (yoke insert removed) to connect your DIN regulator.
                    </span>
                  ) : (
                    <span>
                      ✓ <strong>Yoke / INT Tank Valve:</strong> Your cylinder will be fitted with a
                      standard international Yoke insert to clamp your A-clamp regulator.
                    </span>
                  )}
                </div>

                {/* Nitrox Eligibility Warning */}
                {selectedGasMixId.toLowerCase() !== 'air' && !isNitroxEligible && (
                  <div className='mt-2.5 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2'>
                    <AlertTriangle size={15} className='text-amber-600 shrink-0 mt-0.5' />
                    <div>
                      <strong>Nitrox Certification Required:</strong> Breathing Enriched Air (EANx)
                      requires an <em>Enriched Air Diver (Nitrox)</em> specialty or qualifying
                      Advanced/Technical certification. Your selected credential (
                      {certLevel || 'Entry level'}) only permits Air (21%). Please select Air or
                      update your certification.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Medical Questionnaire */}
            <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700'>
              <div className='flex items-center justify-between gap-4'>
                <div>
                  <h2 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                    <Shield className='h-5 w-5 text-blue-600' />
                    2. Diver Medical Screening (DMSC 2020)
                  </h2>
                  <p className='text-xs text-gray-500 mt-0.5'>
                    Encrypted international standard medical self-declaration.
                  </p>
                </div>

                <button
                  type='button'
                  onClick={() => setMedicalModalOpen(true)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    medicalStatus === 'CLEARED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                      : medicalStatus === 'FLAGGED_CONTACT_CENTER'
                        ? 'bg-amber-50 text-amber-700 border border-amber-300'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  }`}
                >
                  {medicalStatus === 'CLEARED'
                    ? '✓ Cleared (Edit)'
                    : medicalStatus === 'FLAGGED_CONTACT_CENTER'
                      ? '⚠️ Flagged (Edit)'
                      : 'Complete Screening'}
                </button>
              </div>
            </div>

            {/* Step 3: Liability Waiver */}
            <div
              className={`p-5 sm:p-6 rounded-2xl shadow-sm border transition-all ${
                !dmscAnswers
                  ? 'bg-gray-50/60 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-75'
                  : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
              }`}
            >
              <div className='flex items-center justify-between gap-4'>
                <div>
                  <div className='flex items-center gap-2'>
                    <h2 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                      <FileText className='h-5 w-5 text-blue-600' />
                      3. Liability Waiver & Risk Release
                    </h2>
                    {!dmscAnswers && (
                      <span className='text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold'>
                        Complete Medical First
                      </span>
                    )}
                  </div>
                  <p className='text-xs text-gray-500 mt-0.5'>
                    Digital signature and assumption of hyperbaric scuba risks.
                  </p>
                </div>

                <button
                  type='button'
                  onClick={() => {
                    if (!dmscAnswers) {
                      toast('Please complete the medical questionnaire first.', { icon: 'ℹ️' });
                      return;
                    }
                    setWaiverModalOpen(true);
                  }}
                  disabled={!dmscAnswers}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    waiverSignature
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                      : !dmscAnswers
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-600'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  }`}
                >
                  {waiverSignature ? '✓ Signed (Edit)' : 'Review & Sign'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Summary & Pay on Arrival Notice */}
          <div className='space-y-6'>
            <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-6'>
              <h3 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-4'>
                Booking Summary
              </h3>

              <div className='space-y-3 text-sm pb-4 border-b border-gray-100 dark:border-gray-700'>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Tier:</span>
                  <span className='font-semibold text-gray-900 dark:text-white'>
                    {selectedUnit?.title}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Tank / Gas:</span>
                  <span className='font-semibold text-gray-900 dark:text-white'>
                    {selectedTankId}L • {selectedGasMixId.toUpperCase()} ({regulatorFitting})
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Lead Ballast:</span>
                  <span className='font-semibold text-gray-900 dark:text-white'>{leadKg} kg</span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Contact / ID:</span>
                  <span
                    className={`font-semibold ${hasContactOrId ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {hasContactOrId ? 'Provided' : '1 Required'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Certification:</span>
                  <span
                    className={`font-semibold ${
                      hasCertDetails ? 'text-emerald-600 truncate max-w-[140px]' : 'text-amber-600'
                    }`}
                    title={
                      hasCertDetails
                        ? `${certAgency} ${certLevel} (#${certNumber})`
                        : 'Missing details'
                    }
                  >
                    {hasCertDetails ? `${certAgency} ${certLevel}` : 'Required'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Medical:</span>
                  <span
                    className={`font-semibold ${medicalStatus === 'CLEARED' ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {medicalStatus === 'CLEARED'
                      ? 'Cleared'
                      : medicalStatus === 'FLAGGED_CONTACT_CENTER'
                        ? 'Flagged'
                        : 'Pending'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Waiver:</span>
                  <span
                    className={`font-semibold ${waiverSignature ? 'text-emerald-600' : 'text-gray-400'}`}
                  >
                    {waiverSignature ? 'Signed' : 'Pending'}
                  </span>
                </div>
              </div>

              {/* Price & Offline Payment Notice */}
              <div className='pt-4 pb-5'>
                <div className='flex items-baseline justify-between mb-2'>
                  <span className='text-xs font-bold text-gray-400 uppercase'>Total Due</span>
                  <span className='text-2xl font-bold text-gray-900 dark:text-white font-mono'>
                    €{totalPrice}
                  </span>
                </div>

                <div className='p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2'>
                  <CreditCard className='h-4 w-4 shrink-0 mt-0.5 text-blue-600' />
                  <span>
                    <strong>Pay on Arrival:</strong> Zero charges online today. Pay directly at the
                    dive center counter on the day of the dive.
                  </span>
                </div>
              </div>

              {/* Confirm Action Button */}
              <button
                type='button'
                onClick={handleConfirmBooking}
                disabled={
                  submitting ||
                  !diverName.trim() ||
                  !hasContactOrId ||
                  !hasCertDetails ||
                  !isNitroxEligible ||
                  !dmscAnswers ||
                  !waiverSignature
                }
                className='w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm'
              >
                {submitting ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    Confirming Reservation...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Confirm Reservation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MedicalQuestionnaireModal
        isOpen={medicalModalOpen}
        onClose={() => setMedicalModalOpen(false)}
        onCompleted={handleMedicalComplete}
        initialAnswers={dmscAnswers}
      />

      <WaiverSigningModal
        isOpen={waiverModalOpen}
        onClose={() => setWaiverModalOpen(false)}
        onSigned={handleWaiverSigned}
        diverName={diverName}
        bundleId={contextData.product.waiver_bundle_id}
      />
    </div>
  );
};

export default BookingWizard;
