import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  FileText,
  AlertTriangle,
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  Layers,
  Ship,
  HeartPulse,
  Compass,
  Flame,
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

  // Wizard Step: 1 = Credentials, 2 = Equipment, 3 = Emergency & Insurance, 4 = Medical, 5 = Waiver & Review
  const [currentStep, setCurrentStep] = useState(1);

  // Slot context data
  const [loading, setLoading] = useState(true);
  const [contextData, setContextData] = useState(null);
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [availableLevels, setAvailableLevels] = useState([]);

  // Unit / Gear Selection
  const [selectedUnitId, setSelectedUnitId] = useState('certified-diver-own-gear');

  // Step 1: Diver Identity & Qualifications
  const [diverName, setDiverName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [diverNationality, setDiverNationality] = useState('');
  const [diverEmail, setDiverEmail] = useState('');
  const [diverPhone, setDiverPhone] = useState('');
  const [passportNumber, setPassportNumber] = useState('');

  const [certAgency, setCertAgency] = useState('');
  const [certLevel, setCertLevel] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [isCustomLevel, setIsCustomLevel] = useState(false);

  // Step 2: Equipment Needed for Rent & Sizing
  const [selectedTankId, setSelectedTankId] = useState('12');
  const [selectedGasMixId, setSelectedGasMixId] = useState('air');
  const [regulatorFitting, setRegulatorFitting] = useState('DIN');
  const [wetsuitGender, setWetsuitGender] = useState('MEN');
  const [wetsuitSize, setWetsuitSize] = useState('L');
  const [wetsuitThickness, setWetsuitThickness] = useState('5mm');
  const [bcdGender, setBcdGender] = useState('MEN');
  const [bcdSize, setBcdSize] = useState('M');
  const [finType, setFinType] = useState('OPEN_HEEL');
  const [shoeSizeEu, setShoeSizeEu] = useState('43');
  const [rentalTorch, setRentalTorch] = useState(false);
  const [rentalComputer, setRentalComputer] = useState(false);
  const [leadKg, setLeadKg] = useState('4.0');
  const [weightSystem, setWeightSystem] = useState('INTEGRATED');

  // Step 3: Emergency Contact & Insurance
  const [hasInsurance, setHasInsurance] = useState('OWN'); // 'OWN' | 'CENTER'
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('Spouse / Family');

  // Step 4 & 5: Medical & Waiver
  const [medicalModalOpen, setMedicalModalOpen] = useState(false);
  const [dmscAnswers, setDmscAnswers] = useState(null);
  const [medicalStatus, setMedicalStatus] = useState('PENDING'); // PENDING | CLEARED | FLAGGED_CONTACT_CENTER

  const [waiverModalOpen, setWaiverModalOpen] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState(null);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

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
        if (data.units && data.units.length > 0) {
          setSelectedUnitId(data.units[0].id);
        }
        setSavedProfiles(profilesRes.data || []);
        setOrganizations(orgsRes.data || []);

        // Auto-fill from authenticated user
        if (data.user) {
          if (data.user.full_name) setDiverName(data.user.full_name);
          if (data.user.email) setDiverEmail(data.user.email);
          if (data.user.phone) setDiverPhone(data.user.phone);
          if (data.user.nationality) setDiverNationality(data.user.nationality);
          if (data.user.passport_number) setPassportNumber(data.user.passport_number);
          if (data.user.date_of_birth) setDateOfBirth(data.user.date_of_birth);
        }

        // Auto-fill from gear profile
        if (data.prefill_gear) {
          const pg = data.prefill_gear;
          if (pg.preferred_tank_id) setSelectedTankId(pg.preferred_tank_id);
          if (pg.preferred_gas_mix_id) setSelectedGasMixId(pg.preferred_gas_mix_id);
          if (pg.regulator_fitting) setRegulatorFitting(pg.regulator_fitting);
          if (pg.weight_system) setWeightSystem(pg.weight_system);
          if (pg.wetsuit_gender) setWetsuitGender(pg.wetsuit_gender);
          if (pg.wetsuit_size) setWetsuitSize(pg.wetsuit_size);
          if (pg.wetsuit_thickness) setWetsuitThickness(pg.wetsuit_thickness);
          if (pg.bcd_gender) setBcdGender(pg.bcd_gender);
          else if (pg.wetsuit_gender) setBcdGender(pg.wetsuit_gender);
          if (pg.bcd_size) setBcdSize(pg.bcd_size);
          if (pg.fin_type) setFinType(pg.fin_type);
          if (pg.shoe_size_eu) setShoeSizeEu(pg.shoe_size_eu.toString());
          if (pg.rental_torch) setRentalTorch(pg.rental_torch);
          if (pg.rental_dive_computer) setRentalComputer(pg.rental_dive_computer);
          if (pg.estimated_lead_kg) setLeadKg(pg.estimated_lead_kg.toString());
          if (pg.emergency_contact_name) setEmergencyContactName(pg.emergency_contact_name);
          if (pg.emergency_contact_phone) setEmergencyContactPhone(pg.emergency_contact_phone);
          if (pg.emergency_contact_relation)
            setEmergencyContactRelation(pg.emergency_contact_relation);
          if (pg.insurance_provider) {
            setInsuranceProvider(pg.insurance_provider);
            setHasInsurance('OWN');
          }
          if (pg.insurance_policy_number) setInsurancePolicyNumber(pg.insurance_policy_number);
          if (pg.insurance_expiry_date) setInsuranceExpiryDate(pg.insurance_expiry_date);
        }

        // Auto-fill from certifications
        if (data.user_certifications && data.user_certifications.length > 0) {
          const primaryCert = data.user_certifications[0];
          setCertAgency(primaryCert.agency || '');
          setCertLevel('');
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
        .get(`/api/v1/diving-organizations/${matchedOrg.id}/levels?main_only=true`)
        .then(res => {
          const rawLevels = res.data || [];
          const levels = rawLevels.filter(lvl => {
            const cat = (lvl.category || '').toLowerCase();
            const name = (lvl.name || '').toLowerCase();
            if (
              cat.includes('specialt') ||
              cat.includes('primer') ||
              cat.includes('skill dev') ||
              cat.includes('sdc')
            ) {
              return false;
            }
            if (
              name.includes('discover scuba') ||
              name.includes('try scuba') ||
              name.includes('bubblemaker') ||
              name.includes('seal team') ||
              name.includes('snorkel') ||
              name.includes('skin diver')
            ) {
              return false;
            }
            return true;
          });

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
  }, [certAgency, organizations, certLevel]);

  // Handle switching gear profiles
  const handleSelectProfilePreset = profId => {
    const prof = savedProfiles.find(p => p.id === parseInt(profId, 10));
    if (!prof) return;

    if (prof.preferred_tank_id) setSelectedTankId(prof.preferred_tank_id);
    if (prof.preferred_gas_mix_id) setSelectedGasMixId(prof.preferred_gas_mix_id);
    if (prof.regulator_fitting) setRegulatorFitting(prof.regulator_fitting);
    if (prof.weight_system) setWeightSystem(prof.weight_system);
    if (prof.wetsuit_gender) setWetsuitGender(prof.wetsuit_gender);
    if (prof.wetsuit_size) setWetsuitSize(prof.wetsuit_size);
    if (prof.wetsuit_thickness) setWetsuitThickness(prof.wetsuit_thickness);
    if (prof.bcd_gender) setBcdGender(prof.bcd_gender);
    else if (prof.wetsuit_gender) setBcdGender(prof.wetsuit_gender);
    if (prof.bcd_size) setBcdSize(prof.bcd_size);
    if (prof.fin_type) setFinType(prof.fin_type);
    if (prof.shoe_size_eu) setShoeSizeEu(prof.shoe_size_eu.toString());
    if (prof.rental_torch) setRentalTorch(prof.rental_torch);
    if (prof.rental_dive_computer) setRentalComputer(prof.rental_dive_computer);
    if (prof.estimated_lead_kg) setLeadKg(prof.estimated_lead_kg.toString());
    if (prof.emergency_contact_name) setEmergencyContactName(prof.emergency_contact_name);
    if (prof.emergency_contact_phone) setEmergencyContactPhone(prof.emergency_contact_phone);
    if (prof.insurance_provider) {
      setInsuranceProvider(prof.insurance_provider);
      setHasInsurance('OWN');
    }
    if (prof.insurance_policy_number) setInsurancePolicyNumber(prof.insurance_policy_number);
    if (prof.insurance_expiry_date) setInsuranceExpiryDate(prof.insurance_expiry_date);

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

  const hasContactOrId = Boolean(diverEmail.trim() || diverPhone.trim() || passportNumber.trim());

  // Nitrox eligibility
  const isNitroxEligible = (() => {
    if (!certLevel) return false;
    const l = certLevel.toLowerCase();
    return (
      l.includes('nitrox') ||
      l.includes('ean') ||
      l.includes('enriched air') ||
      l.includes('advanced') ||
      l.includes('rescue') ||
      l.includes('master') ||
      l.includes('divemaster') ||
      l.includes('instructor') ||
      l.includes('tec') ||
      l.includes('trimix')
    );
  })();

  // Step Validation Handlers
  const validateStep1 = () => {
    if (!diverName.trim()) {
      toast.error('Please enter diver legal full name.');
      return false;
    }
    if (!dateOfBirth) {
      toast.error('Date of Birth is required for maritime manifest compliance.');
      return false;
    }
    if (!hasContactOrId) {
      toast.error('Please provide at least one contact method (Email, Phone, or Passport/ID).');
      return false;
    }
    if (!certAgency || !certLevel || !certNumber.trim()) {
      toast.error('Please provide your diving certification agency, level, and C-Card number.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (selectedGasMixId.toLowerCase() !== 'air' && !isNitroxEligible) {
      toast.error(
        'Enriched Air Nitrox requires an Enriched Air (Nitrox) or qualifying certification. Please select Air (21%) or update your certification.'
      );
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      toast.error('Please provide an emergency contact name and phone number for maritime safety.');
      return false;
    }
    if (hasInsurance === 'OWN' && !insuranceProvider.trim()) {
      toast.error(
        'Please provide your dive insurance provider name (or select center daily insurance).'
      );
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (!dmscAnswers) {
      toast.error('Please complete the medical questionnaire before proceeding.');
      return false;
    }
    return true;
  };

  const goToNextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    if (currentStep === 4 && !validateStep4()) return;
    setCurrentStep(prev => Math.min(5, prev + 1));
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const goToPrevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  // Submit Booking
  const handleConfirmBooking = async () => {
    if (!validateStep1() || !validateStep2() || !validateStep3() || !validateStep4()) {
      return;
    }
    if (!waiverSignature) {
      toast.error('Please sign the liability waiver.');
      return;
    }

    try {
      setSubmitting(true);

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
            dateOfBirth: dateOfBirth || undefined,
            certificationAgency: certAgency,
            certificationLevel: certLevel,
            certificationNumber: certNumber.trim() || undefined,
            selectedTankId: selectedTankId,
            selectedGasMixId: selectedGasMixId,
            equipmentSizing: {
              wetsuit_gender: wetsuitGender,
              wetsuit_size: wetsuitSize === 'None' ? null : wetsuitSize,
              wetsuit_thickness: wetsuitThickness,
              bcd_gender: bcdGender,
              bcd_size: bcdSize === 'None' ? null : bcdSize,
              fin_type: finType,
              shoe_size_eu: parseFloat(shoeSizeEu) || 43.0,
              rental_torch: rentalTorch,
              rental_dive_computer: rentalComputer,
              has_own_dive_computer: !rentalComputer,
              regulator_fitting: regulatorFitting,
              weight_system: weightSystem,
              estimated_lead_kg: parseFloat(leadKg) || 4.0,
              lead_kg: parseFloat(leadKg) || 4.0,
              insurance_type: hasInsurance,
              insurance_provider:
                hasInsurance === 'OWN'
                  ? insuranceProvider.trim() || undefined
                  : 'Center Daily Coverage',
              insurance_policy_number:
                hasInsurance === 'OWN' ? insurancePolicyNumber.trim() || undefined : undefined,
              insurance_expiry_date:
                hasInsurance === 'OWN' ? insuranceExpiryDate.trim() || undefined : undefined,
              emergency_contact_name: emergencyContactName.trim() || undefined,
              emergency_contact_phone: emergencyContactPhone.trim() || undefined,
              emergency_contact_relation: emergencyContactRelation.trim() || undefined,
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

      const paperworkPayload = {
        unitItemId: unitItemId,
        dmscAnswers: dmscAnswers,
        signatureName: waiverSignature.signatureName,
        selectedTankId: selectedTankId,
        selectedGasMixId: selectedGasMixId,
        equipmentSizing: {
          wetsuit_gender: wetsuitGender,
          wetsuit_size: wetsuitSize === 'None' ? null : wetsuitSize,
          wetsuit_thickness: wetsuitThickness,
          bcd_gender: bcdGender,
          bcd_size: bcdSize === 'None' ? null : bcdSize,
          fin_type: finType,
          shoe_size_eu: parseFloat(shoeSizeEu) || 43.0,
          rental_torch: rentalTorch,
          rental_dive_computer: rentalComputer,
          has_own_dive_computer: !rentalComputer,
          regulator_fitting: regulatorFitting,
          weight_system: weightSystem,
          estimated_lead_kg: parseFloat(leadKg) || 4.0,
          lead_kg: parseFloat(leadKg) || 4.0,
          insurance_type: hasInsurance,
          insurance_provider:
            hasInsurance === 'OWN'
              ? insuranceProvider.trim() || undefined
              : 'Center Daily Coverage',
          insurance_policy_number:
            hasInsurance === 'OWN' ? insurancePolicyNumber.trim() || undefined : undefined,
          insurance_expiry_date:
            hasInsurance === 'OWN' ? insuranceExpiryDate.trim() || undefined : undefined,
          emergency_contact_name: emergencyContactName.trim() || undefined,
          emergency_contact_phone: emergencyContactPhone.trim() || undefined,
          emergency_contact_relation: emergencyContactRelation.trim() || undefined,
        },
      };

      await api.post(`/api/v1/bookings/${bookingUuid}/submit-paperwork`, paperworkPayload);

      toast.success('Booking confirmed! Payment will be collected on arrival.');
      navigate(`/bookings/${bookingUuid}/voucher`);
    } catch (err) {
      console.error('Booking confirmation failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to complete booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center p-6 text-center'>
        <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3'></div>
        <p className='text-sm text-gray-500 font-medium'>Loading trip checkout details...</p>
      </div>
    );
  }

  if (!contextData) {
    return (
      <div className='max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border text-center'>
        <h2 className='text-lg font-bold text-gray-900 dark:text-white mb-2'>Trip Unavailable</h2>
        <p className='text-sm text-gray-500 mb-4'>
          The requested dive trip slot could not be found or has expired.
        </p>
        <Link to='/dives' className='px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold'>
          Explore Dives
        </Link>
      </div>
    );
  }

  const selectedUnit = contextData.units.find(u => u.id === selectedUnitId);
  const hasCertDetails = Boolean(certAgency && certLevel && certNumber.trim());

  return (
    <div className='min-h-screen bg-gray-50/50 dark:bg-gray-900/50'>
      <SEO
        title={`Book ${contextData.product.title} - Divemap`}
        description='Book your scuba dive trip, configure rental equipment, and submit encrypted medical clearance.'
      />

      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-6'>
        {/* Back Link */}
        <button
          onClick={() => navigate(-1)}
          className='inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4'
        >
          <ChevronLeft size={18} className='mr-1' />
          Back
        </button>

        {/* Trip Summary Header Card */}
        <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6'>
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

        {/* Stepper Progress Bar (5 Steps) */}
        <div className='bg-white dark:bg-gray-800 p-3.5 sm:p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6'>
          <div className='grid grid-cols-5 gap-2'>
            {[
              { num: 1, label: '1. Credentials', icon: User },
              { num: 2, label: '2. Equipment', icon: Compass },
              { num: 3, label: '3. Insurance', icon: HeartPulse },
              { num: 4, label: '4. Medical', icon: Shield },
              { num: 5, label: '5. Waiver', icon: CheckCircle2 },
            ].map(step => {
              const isPast = currentStep > step.num;
              const isCurrent = currentStep === step.num;

              return (
                <button
                  key={step.num}
                  type='button'
                  onClick={() => {
                    if (step.num < currentStep) {
                      setCurrentStep(step.num);
                    }
                  }}
                  disabled={step.num > currentStep}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-bold ring-1 ring-blue-500'
                      : isPast
                        ? 'text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-gray-50'
                        : 'text-gray-400 font-medium cursor-not-allowed opacity-60'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isPast
                          ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {isPast ? <Check size={13} /> : step.num}
                  </div>
                  <span className='text-[10px] sm:text-xs truncate text-center sm:text-left'>
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
          {/* Main Form: Active Step */}
          <div className='lg:col-span-8 space-y-6'>
            {/* ================= STEP 1: DIVER CREDENTIALS ================= */}
            {currentStep === 1 && (
              <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5'>
                <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
                  <div>
                    <h2 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                      <User className='h-5 w-5 text-blue-600' />
                      Step 1: Diver Credentials & Identification
                    </h2>
                    <p className='text-xs text-gray-500 mt-0.5'>
                      Required for official maritime harbor registry and certification
                      qualification.
                    </p>
                  </div>
                  <span className='text-xs font-bold text-blue-600 font-mono'>1 of 5</span>
                </div>

                {/* Unit Selection (Own Gear vs Rental) */}
                <div>
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

                {/* Personal Identification */}
                <div className='pt-2'>
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

                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
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
                        Date of Birth *
                      </label>
                      <input
                        type='date'
                        required
                        value={dateOfBirth}
                        onChange={e => setDateOfBirth(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          !dateOfBirth ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Nationality
                      </label>
                      <input
                        type='text'
                        value={diverNationality}
                        onChange={e => setDiverNationality(e.target.value)}
                        placeholder='e.g. French / Greek'
                        className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm'
                      />
                    </div>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3'>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Email Address *
                      </label>
                      <input
                        type='email'
                        value={diverEmail}
                        onChange={e => setDiverEmail(e.target.value)}
                        placeholder='diver@example.com'
                        className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm'
                      />
                    </div>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Phone / WhatsApp *
                      </label>
                      <input
                        type='tel'
                        value={diverPhone}
                        onChange={e => setDiverPhone(e.target.value)}
                        placeholder='+30 ...'
                        className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm'
                      />
                    </div>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Passport / National ID # *
                      </label>
                      <input
                        type='text'
                        value={passportNumber}
                        onChange={e => setPassportNumber(e.target.value)}
                        placeholder='For Port Authority manifest'
                        className='w-full px-3 py-2 border border-gray-300 rounded-lg text-sm'
                      />
                    </div>
                  </div>
                </div>

                {/* Certification Details */}
                <div className='pt-2 border-t border-gray-100 dark:border-gray-700'>
                  <span className='text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2'>
                    Certification Credentials *
                  </span>

                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Agency *
                      </label>
                      <select
                        value={certAgency}
                        onChange={e => {
                          setCertAgency(e.target.value);
                          setCertLevel('');
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
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Certification Level *
                      </label>
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
                            !certLevel.trim()
                              ? 'border-amber-300 bg-amber-50/20'
                              : 'border-gray-300'
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
                            !certLevel.trim()
                              ? 'border-amber-300 bg-amber-50/20'
                              : 'border-gray-300'
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
                </div>

                {/* Step 1 Navigation Buttons */}
                <div className='flex items-center justify-end pt-4 border-t border-gray-100 dark:border-gray-700'>
                  <button
                    type='button'
                    onClick={goToNextStep}
                    className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all'
                  >
                    <span>Next: Equipment & Sizing</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP 2: EQUIPMENT NEEDED FOR RENT & SIZING ================= */}
            {currentStep === 2 && (
              <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5'>
                <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
                  <div>
                    <h2 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                      <Compass className='h-5 w-5 text-blue-600' />
                      Step 2: Equipment Needed for Rent & Sizing
                    </h2>
                    <p className='text-xs text-gray-500 mt-0.5'>
                      Specify cylinders, gas mixes, ballast requirements, and anatomical rental
                      sizing.
                    </p>
                  </div>
                  <span className='text-xs font-bold text-blue-600 font-mono'>2 of 5</span>
                </div>

                {/* Profile Preset Switcher */}
                {savedProfiles.length > 0 && (
                  <div className='p-3.5 bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
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

                {/* Cylinder, Gas Mix & Ballast */}
                <div>
                  <span className='text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2'>
                    Cylinder & Ballast Loadout
                  </span>

                  <div className='grid grid-cols-2 sm:grid-cols-5 gap-3'>
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
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-mono font-bold'
                      />
                    </div>

                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Weight System *
                      </label>
                      <select
                        value={weightSystem}
                        onChange={e => setWeightSystem(e.target.value)}
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium'
                      >
                        <option value='INTEGRATED'>Integrated BCD Pockets</option>
                        <option value='BELT'>Traditional Weight Belt</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Nitrox Eligibility Warning */}
                {selectedGasMixId.toLowerCase() !== 'air' && !isNitroxEligible && (
                  <div className='p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2'>
                    <AlertTriangle size={15} className='text-amber-600 shrink-0 mt-0.5' />
                    <div>
                      <strong>Nitrox Certification Required:</strong> Breathing Enriched Air (EANx)
                      requires an <em>Enriched Air Diver (Nitrox)</em> specialty or qualifying
                      certification.
                    </div>
                  </div>
                )}

                {/* Thermal Protection, BCD & Fins */}
                <div className='pt-3 border-t border-gray-100 dark:border-gray-700'>
                  <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2'>
                    <span className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                      Thermal Suit, BCD & Fin Sizing
                    </span>
                    <span className='text-[11px] text-gray-400'>
                      * Men's vs Women's cut ensures correct anatomical chest, waist & torso fit
                    </span>
                  </div>

                  <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Wetsuit Cut *
                      </label>
                      <select
                        value={wetsuitGender}
                        onChange={e => {
                          setWetsuitGender(e.target.value);
                          if (e.target.value === 'WOMEN') setBcdGender('WOMEN');
                          else if (e.target.value === 'MEN') setBcdGender('MEN');
                        }}
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium'
                      >
                        <option value='MEN'>Men's / Unisex</option>
                        <option value='WOMEN'>Women's</option>
                        <option value='OTHER'>Other / Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Wetsuit Size
                      </label>
                      <select
                        value={wetsuitSize}
                        onChange={e => setWetsuitSize(e.target.value)}
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white'
                      >
                        <option value='None'>None (Own Suit)</option>
                        <option value='XS'>XS</option>
                        <option value='S'>S</option>
                        <option value='M'>M</option>
                        <option value='L'>L</option>
                        <option value='XL'>XL</option>
                        <option value='XXL'>XXL</option>
                      </select>
                    </div>

                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Suit Thickness
                      </label>
                      <select
                        value={wetsuitThickness}
                        onChange={e => setWetsuitThickness(e.target.value)}
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white'
                      >
                        <option value='3mm-shorty'>3mm Shorty</option>
                        <option value='3mm'>3mm Full</option>
                        <option value='5mm'>5mm Full</option>
                        <option value='7mm'>7mm Semi-Dry</option>
                      </select>
                    </div>

                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        BCD Cut *
                      </label>
                      <select
                        value={bcdGender}
                        onChange={e => setBcdGender(e.target.value)}
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium'
                      >
                        <option value='MEN'>Men's / Unisex</option>
                        <option value='WOMEN'>Women's</option>
                      </select>
                    </div>

                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        BCD Size
                      </label>
                      <select
                        value={bcdSize}
                        onChange={e => setBcdSize(e.target.value)}
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white'
                      >
                        <option value='None'>None (Own BCD)</option>
                        <option value='XXS'>XXS</option>
                        <option value='XS'>XS</option>
                        <option value='S'>S</option>
                        <option value='M'>M</option>
                        <option value='L'>L</option>
                        <option value='XL'>XL</option>
                      </select>
                    </div>

                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Shoe / Fins (EU)
                      </label>
                      <input
                        type='number'
                        step='0.5'
                        value={shoeSizeEu}
                        onChange={e => setShoeSizeEu(e.target.value)}
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs'
                        placeholder='e.g. 42'
                      />
                    </div>
                  </div>

                  {/* Auxiliary Rental Items: Computer & Torch */}
                  <div className='mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2'>
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-1'>
                      <label className='flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
                        <input
                          type='checkbox'
                          checked={rentalComputer}
                          onChange={e => setRentalComputer(e.target.checked)}
                          className='rounded text-blue-600'
                        />
                        <span className='font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                          Rent Dive Computer (Must - Wrist Unit)
                        </span>
                      </label>
                      <span className='text-[11px] text-gray-400'>
                        * Mandatory Safety: Every diver must carry an individual computer (no
                        sharing)
                      </span>
                    </div>

                    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t border-gray-100 dark:border-gray-700/60'>
                      <label className='flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
                        <input
                          type='checkbox'
                          checked={rentalTorch}
                          onChange={e => setRentalTorch(e.target.checked)}
                          className='rounded text-blue-600'
                        />
                        <span className='font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1'>
                          <Flame size={13} className='text-amber-600' />
                          Rent Primary Dive Torch / Light (Opt)
                        </span>
                      </label>
                      <span className='text-[11px] text-gray-400'>
                        Recommended for caverns, swim-throughs & twilight dives
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 2 Navigation Buttons */}
                <div className='flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700'>
                  <button
                    type='button'
                    onClick={goToPrevStep}
                    className='px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-all'
                  >
                    <ChevronLeft size={15} />
                    <span>Back: Credentials</span>
                  </button>

                  <button
                    type='button'
                    onClick={goToNextStep}
                    className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all'
                  >
                    <span>Next: Emergency & Insurance</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP 3: EMERGENCY CONTACT & DIVE INSURANCE ================= */}
            {currentStep === 3 && (
              <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5'>
                <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
                  <div>
                    <h2 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                      <HeartPulse className='h-5 w-5 text-red-500' />
                      Step 3: Emergency Contact & Dive Insurance
                    </h2>
                    <p className='text-xs text-gray-500 mt-0.5'>
                      Required by maritime safety laws and hyperbaric evacuation protocol.
                    </p>
                  </div>
                  <span className='text-xs font-bold text-blue-600 font-mono'>3 of 5</span>
                </div>

                {/* Next of Kin */}
                <div className='p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3'>
                  <span className='text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider block'>
                    Emergency Contact (Next of Kin) *
                  </span>
                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Full Legal Name *
                      </label>
                      <input
                        type='text'
                        value={emergencyContactName}
                        onChange={e => setEmergencyContactName(e.target.value)}
                        placeholder='Next of kin full name'
                        className='w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white dark:bg-gray-800'
                        required
                      />
                    </div>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Phone / WhatsApp *
                      </label>
                      <input
                        type='tel'
                        value={emergencyContactPhone}
                        onChange={e => setEmergencyContactPhone(e.target.value)}
                        placeholder='+30 ... or international'
                        className='w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white dark:bg-gray-800'
                        required
                      />
                    </div>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Relationship
                      </label>
                      <input
                        type='text'
                        value={emergencyContactRelation}
                        onChange={e => setEmergencyContactRelation(e.target.value)}
                        placeholder='e.g. Spouse / Parent / Friend'
                        className='w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white dark:bg-gray-800'
                      />
                    </div>
                  </div>
                </div>

                {/* Dive Accident Insurance */}
                <div className='p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3'>
                  <span className='text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider block'>
                    Dive Accident & Evacuation Insurance *
                  </span>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <label
                      className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                        hasInsurance === 'OWN'
                          ? 'border-blue-600 bg-white dark:bg-gray-800 ring-1 ring-blue-600 shadow-xs'
                          : 'border-gray-200 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type='radio'
                        name='insurance_type'
                        checked={hasInsurance === 'OWN'}
                        onChange={() => setHasInsurance('OWN')}
                        className='h-4 w-4 text-blue-600 mt-0.5'
                      />
                      <div>
                        <span className='text-xs font-bold text-gray-900 dark:text-white block'>
                          I have my own active dive insurance
                        </span>
                        <span className='text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5'>
                          e.g. DAN Europe, DiveAssure, or equivalent dive accident policy.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                        hasInsurance === 'CENTER'
                          ? 'border-blue-600 bg-white dark:bg-gray-800 ring-1 ring-blue-600 shadow-xs'
                          : 'border-gray-200 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type='radio'
                        name='insurance_type'
                        checked={hasInsurance === 'CENTER'}
                        onChange={() => setHasInsurance('CENTER')}
                        className='h-4 w-4 text-blue-600 mt-0.5'
                      />
                      <div>
                        <span className='text-xs font-bold text-gray-900 dark:text-white block'>
                          I need daily insurance from the dive center
                        </span>
                        <span className='text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5'>
                          Short-term accident & chamber cover arranged at counter on arrival.
                        </span>
                      </div>
                    </label>
                  </div>

                  {hasInsurance === 'OWN' ? (
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-200 dark:border-gray-600'>
                      <div>
                        <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                          Insurance Provider *
                        </label>
                        <input
                          type='text'
                          value={insuranceProvider}
                          onChange={e => setInsuranceProvider(e.target.value)}
                          placeholder='e.g. DAN Europe'
                          className='w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white dark:bg-gray-800'
                        />
                      </div>
                      <div>
                        <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                          Policy / Member Number
                        </label>
                        <input
                          type='text'
                          value={insurancePolicyNumber}
                          onChange={e => setInsurancePolicyNumber(e.target.value)}
                          placeholder='e.g. 12345678'
                          className='w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white dark:bg-gray-800'
                        />
                      </div>
                      <div>
                        <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                          Expiration Date
                        </label>
                        <input
                          type='date'
                          value={insuranceExpiryDate}
                          onChange={e => setInsuranceExpiryDate(e.target.value)}
                          className='w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white dark:bg-gray-800'
                        />
                      </div>
                    </div>
                  ) : (
                    <div className='p-2.5 bg-blue-50/60 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300 flex items-center gap-2'>
                      <Check size={14} className='text-blue-600 shrink-0' />
                      <span>
                        The dive center will provide and register daily dive accident & hyperbaric
                        evacuation coverage for your trip date during morning counter check-in.
                      </span>
                    </div>
                  )}
                </div>

                {/* Step 3 Navigation Buttons */}
                <div className='flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700'>
                  <button
                    type='button'
                    onClick={goToPrevStep}
                    className='px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-all'
                  >
                    <ChevronLeft size={15} />
                    <span>Back: Equipment</span>
                  </button>

                  <button
                    type='button'
                    onClick={goToNextStep}
                    className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all'
                  >
                    <span>Next: Medical Screening</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP 4: DIVER MEDICAL SCREENING ================= */}
            {currentStep === 4 && (
              <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5'>
                <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
                  <div>
                    <h2 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                      <Shield className='h-5 w-5 text-blue-600' />
                      Step 4: Diver Medical Screening (DMSC 2020)
                    </h2>
                    <p className='text-xs text-gray-500 mt-0.5'>
                      Encrypted international standard medical self-declaration.
                    </p>
                  </div>
                  <span className='text-xs font-bold text-blue-600 font-mono'>4 of 5</span>
                </div>

                <div className='p-5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                  <div>
                    <h4 className='font-bold text-sm text-gray-900 dark:text-white'>
                      WRSTC / UHMS / EUBS Medical Self-Declaration
                    </h4>
                    <p className='text-xs text-gray-500 mt-1 max-w-lg'>
                      Your answers are protected with envelope encryption (GDPR Article 9). If any
                      condition is flagged, our team will assist with physician clearance protocol.
                    </p>
                    <div className='mt-3 flex items-center gap-2'>
                      <span className='text-xs text-gray-500'>Screening Status:</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          medicalStatus === 'CLEARED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                            : medicalStatus === 'FLAGGED_CONTACT_CENTER'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {medicalStatus === 'CLEARED'
                          ? '✓ CLEARED'
                          : medicalStatus === 'FLAGGED_CONTACT_CENTER'
                            ? '⚠️ FLAGGED FOR REVIEW'
                            : 'PENDING SCREENING'}
                      </span>
                    </div>
                  </div>

                  <button
                    type='button'
                    onClick={() => setMedicalModalOpen(true)}
                    className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 ${
                      medicalStatus === 'CLEARED'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : medicalStatus === 'FLAGGED_CONTACT_CENTER'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {medicalStatus === 'CLEARED'
                      ? '✓ Review / Edit Answers'
                      : medicalStatus === 'FLAGGED_CONTACT_CENTER'
                        ? '⚠️ Review Medical Answers'
                        : 'Complete Medical Questionnaire'}
                  </button>
                </div>

                {/* Step 4 Navigation Buttons */}
                <div className='flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700'>
                  <button
                    type='button'
                    onClick={goToPrevStep}
                    className='px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-all'
                  >
                    <ChevronLeft size={15} />
                    <span>Back: Insurance</span>
                  </button>

                  <button
                    type='button'
                    onClick={goToNextStep}
                    className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all'
                  >
                    <span>Next: Liability Waiver</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP 5: LIABILITY WAIVER & REVIEW ================= */}
            {currentStep === 5 && (
              <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5'>
                <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
                  <div>
                    <h2 className='text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                      <FileText className='h-5 w-5 text-blue-600' />
                      Step 5: Liability Waiver & Final Review
                    </h2>
                    <p className='text-xs text-gray-500 mt-0.5'>
                      Digital signature, assumption of hyperbaric scuba risks, and confirmation.
                    </p>
                  </div>
                  <span className='text-xs font-bold text-blue-600 font-mono'>5 of 5</span>
                </div>

                {/* Waiver Card */}
                <div className='p-5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                  <div>
                    <h4 className='font-bold text-sm text-gray-900 dark:text-white'>
                      Express Assumption of Risk & Liability Release
                    </h4>
                    <p className='text-xs text-gray-500 mt-1 max-w-lg'>
                      Legally binding digital release for boat dive operations and hyperbaric scuba
                      activities.
                    </p>
                    <div className='mt-3 flex items-center gap-2'>
                      <span className='text-xs text-gray-500'>Waiver Status:</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          waiverSignature
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                        }`}
                      >
                        {waiverSignature ? '✓ SIGNED' : 'PENDING SIGNATURE'}
                      </span>
                      {waiverSignature && (
                        <span className='text-xs text-gray-400 font-mono'>
                          ({waiverSignature.signatureName})
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type='button'
                    onClick={() => setWaiverModalOpen(true)}
                    className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 ${
                      waiverSignature
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {waiverSignature ? '✓ Review Signed Waiver' : 'Review & Sign Waiver'}
                  </button>
                </div>

                {/* Final Pre-flight Review Recap */}
                <div className='p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40 text-xs space-y-2'>
                  <span className='font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wider block text-[11px]'>
                    Pre-Flight Reservation Summary:
                  </span>
                  <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 text-gray-700 dark:text-gray-300'>
                    <div>
                      <span className='text-gray-400 block text-[10px]'>Diver:</span>
                      <strong>{diverName}</strong>
                    </div>
                    <div>
                      <span className='text-gray-400 block text-[10px]'>Credential:</span>
                      <strong>
                        {certAgency} {certLevel}
                      </strong>
                    </div>
                    <div>
                      <span className='text-gray-400 block text-[10px]'>Tank & Gas:</span>
                      <strong>
                        {selectedTankId}L • {selectedGasMixId.toUpperCase()}
                      </strong>
                    </div>
                    <div>
                      <span className='text-gray-400 block text-[10px]'>Suit & BCD:</span>
                      <strong>
                        {wetsuitSize === 'None' ? 'Own' : `${wetsuitGender} ${wetsuitSize}`} /{' '}
                        {bcdSize === 'None' ? 'Own' : `BCD ${bcdSize}`}
                      </strong>
                    </div>
                    <div>
                      <span className='text-gray-400 block text-[10px]'>Emergency Contact:</span>
                      <strong>{emergencyContactName}</strong>
                    </div>
                    <div>
                      <span className='text-gray-400 block text-[10px]'>Insurance:</span>
                      <strong>
                        {hasInsurance === 'CENTER' ? 'Center Daily' : insuranceProvider}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Pay on Arrival Notice */}
                <div className='p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2'>
                  <CreditCard className='h-4 w-4 shrink-0 mt-0.5 text-blue-600' />
                  <span>
                    <strong>Pay on Arrival:</strong> Zero charges online today. Pay directly at the
                    dive center counter on the day of the dive.
                  </span>
                </div>

                {/* Step 5 Navigation Buttons */}
                <div className='flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700'>
                  <button
                    type='button'
                    onClick={goToPrevStep}
                    className='px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-gray-50 transition-all'
                  >
                    <ChevronLeft size={15} />
                    <span>Back: Medical</span>
                  </button>

                  <button
                    type='button'
                    onClick={handleConfirmBooking}
                    disabled={submitting || !waiverSignature || !dmscAnswers}
                    className='px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {submitting ? (
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    <span>Confirm Reservation</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Booking Summary */}
          <div className='lg:col-span-4 space-y-6'>
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
                  <span className='font-semibold text-gray-900 dark:text-white'>
                    {leadKg} kg ({weightSystem === 'BELT' ? 'Belt' : 'Pockets'})
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Wetsuit & BCD:</span>
                  <span className='font-semibold text-gray-900 dark:text-white text-right'>
                    {wetsuitSize === 'None'
                      ? 'Own Suit'
                      : `${wetsuitGender === 'WOMEN' ? "Women's" : "Men's"} ${wetsuitSize}`}
                    {' • '}
                    {bcdSize === 'None'
                      ? 'Own BCD'
                      : `${bcdGender === 'WOMEN' ? "Women's" : "Men's"} BCD ${bcdSize}`}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Dive Computer:</span>
                  <span
                    className={`font-semibold text-right ${
                      rentalComputer
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {rentalComputer ? 'Rental Wrist Unit' : 'Own Computer'}
                  </span>
                </div>
                {rentalTorch && (
                  <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                    <span>Rental Light:</span>
                    <span className='font-semibold text-amber-600 dark:text-amber-400'>
                      Primary Dive Torch Included
                    </span>
                  </div>
                )}
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Date of Birth:</span>
                  <span
                    className={`font-semibold ${dateOfBirth ? 'text-gray-900 dark:text-white' : 'text-amber-600'}`}
                  >
                    {dateOfBirth || 'Required'}
                  </span>
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
                  <span>Emergency Contact:</span>
                  <span
                    className={`font-semibold text-right max-w-[150px] truncate ${
                      emergencyContactName && emergencyContactPhone
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                    title={
                      emergencyContactName
                        ? `${emergencyContactName} (${emergencyContactPhone})`
                        : 'Required'
                    }
                  >
                    {emergencyContactName || 'Required'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Dive Insurance:</span>
                  <span className='font-semibold text-gray-900 dark:text-white text-right max-w-[150px] truncate'>
                    {hasInsurance === 'CENTER'
                      ? 'Center Daily'
                      : insuranceProvider
                        ? insuranceProvider
                        : 'Own Policy'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Certification:</span>
                  <span
                    className={`font-semibold ${
                      hasCertDetails ? 'text-emerald-600 truncate max-w-[140px]' : 'text-amber-600'
                    }`}
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

              {/* Total Due */}
              <div className='pt-4 pb-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-baseline'>
                <span className='text-sm font-bold text-gray-900 dark:text-white uppercase'>
                  Total Due
                </span>
                <span className='text-2xl font-bold font-mono text-blue-600 dark:text-blue-400'>
                  €{selectedUnit?.retail_price}
                </span>
              </div>

              <div className='pt-4 space-y-3'>
                {currentStep < 5 ? (
                  <button
                    type='button'
                    onClick={goToNextStep}
                    className='w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all'
                  >
                    <span>Continue to Step {currentStep + 1}</span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type='button'
                    onClick={handleConfirmBooking}
                    disabled={submitting || !waiverSignature || !dmscAnswers}
                    className='w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {submitting ? (
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    <span>Confirm Reservation</span>
                  </button>
                )}

                <div className='flex items-center justify-center gap-1.5 text-[11px] text-gray-400'>
                  <span>Step {currentStep} of 5</span>
                  <span>•</span>
                  <span>Pay on arrival at dive center</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MedicalQuestionnaireModal
        isOpen={medicalModalOpen}
        onClose={() => setMedicalModalOpen(false)}
        initialAnswers={dmscAnswers}
        onComplete={handleMedicalComplete}
      />

      <WaiverSigningModal
        isOpen={waiverModalOpen}
        onClose={() => setWaiverModalOpen(false)}
        diverName={diverName}
        productTitle={contextData.product.title}
        centerName={contextData.center.name}
        onSigned={handleWaiverSigned}
      />
    </div>
  );
};

export default BookingWizard;
