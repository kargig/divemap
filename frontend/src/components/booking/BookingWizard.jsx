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
  AlertCircle,
  Sparkles,
  MessageSquare,
  Phone,
  Mail,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, Link } from 'react-router-dom';

import api, { createChatRoom } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import {
  getBookingPreferencesFromCookie,
  saveBookingPreferencesToCookie,
  clearBookingPreferencesCookie,
} from '../../utils/bookingCookies';
import { getConsentStatus, setConsent } from '../../utils/consent';
import { formatDate } from '../../utils/dateHelpers';
import { decodeHtmlEntities } from '../../utils/htmlDecode';
import SEO from '../SEO';
import { WhatsAppIcon } from '../SocialMediaIcons';

import DateOfBirthPicker from './DateOfBirthPicker';
import MedicalQuestionnaireModal from './MedicalQuestionnaireModal';
import WaiverSigningModal from './WaiverSigningModal';

const BookingWizard = () => {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || null;

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
  const [wetsuitSize, setWetsuitSize] = useState('None');
  const [wetsuitThickness, setWetsuitThickness] = useState('5mm');
  const [bcdGender, setBcdGender] = useState('MEN');
  const [bcdSize, setBcdSize] = useState('None');
  const [finType, setFinType] = useState('OPEN_HEEL');
  const [finSize, setFinSize] = useState('None');
  const [bootSize, setBootSize] = useState('None');
  const [shoeSizeEu, setShoeSizeEu] = useState('42');
  const [rentalRegulator, setRentalRegulator] = useState(false);
  const [rentalMask, setRentalMask] = useState(false);
  const [hasOwnLeadWeights, setHasOwnLeadWeights] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [rentalTorch, setRentalTorch] = useState(false);
  const [rentalComputer, setRentalComputer] = useState(false);
  const [leadKg, setLeadKg] = useState('5.0');
  const [secondaryNitroxCert, setSecondaryNitroxCert] = useState('');
  const [weightSystem, setWeightSystem] = useState('INTEGRATED');
  const [weightSystems, setWeightSystems] = useState(['INTEGRATED']);

  const applyWeightSystem = useCallback(sys => {
    if (!sys) return;
    if (sys === 'BOTH') {
      setWeightSystems(['INTEGRATED', 'BELT']);
      setWeightSystem('BOTH');
    } else if (Array.isArray(sys)) {
      setWeightSystems(sys);
      setWeightSystem(sys.length > 1 ? 'BOTH' : sys[0] || 'INTEGRATED');
    } else {
      setWeightSystems([sys]);
      setWeightSystem(sys);
    }
  }, []);

  const handleToggleWeightSystem = useCallback(system => {
    setWeightSystems(prev => {
      let updated;
      if (system === 'INTEGRATED') {
        if (prev.includes('INTEGRATED')) {
          updated = prev.filter(s => s !== 'INTEGRATED');
          if (updated.length === 0) updated = ['BELT'];
        } else {
          updated = [...prev, 'INTEGRATED'];
        }
      } else if (system === 'BELT') {
        if (prev.includes('BELT')) {
          updated = prev.filter(s => s !== 'BELT');
          if (updated.length === 0) updated = ['INTEGRATED'];
        } else {
          updated = [...prev.filter(s => s !== 'OWN_BELT'), 'BELT'];
        }
      } else if (system === 'OWN_BELT') {
        if (prev.includes('OWN_BELT')) {
          updated = prev.filter(s => s !== 'OWN_BELT');
          if (updated.length === 0) updated = ['INTEGRATED'];
        } else {
          updated = [...prev.filter(s => s !== 'BELT'), 'OWN_BELT'];
        }
      } else {
        updated = prev;
      }

      if (
        updated.includes('INTEGRATED') &&
        (updated.includes('BELT') || updated.includes('OWN_BELT'))
      ) {
        setWeightSystem('BOTH');
      } else if (updated.includes('OWN_BELT')) {
        setWeightSystem('OWN_BELT');
      } else if (updated.includes('BELT')) {
        setWeightSystem('BELT');
      } else {
        setWeightSystem('INTEGRATED');
      }

      return updated;
    });
  }, []);

  const activeProfile = useMemo(() => {
    return savedProfiles.find(p => p.id === parseInt(selectedProfileId, 10)) || null;
  }, [savedProfiles, selectedProfileId]);

  // Step 3: Emergency Contact & Insurance
  const [hasInsurance, setHasInsurance] = useState('OWN'); // 'OWN' | 'CENTER'
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const insuranceDateRef = useRef(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const isInsuranceExpired = Boolean(
    hasInsurance === 'OWN' && insuranceExpiryDate && insuranceExpiryDate < todayStr
  );
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('Spouse / Family');

  // Step 4 & 5: Medical & Waiver
  const [medicalModalOpen, setMedicalModalOpen] = useState(false);
  const [dmscAnswers, setDmscAnswers] = useState(null);
  const [medicalStatus, setMedicalStatus] = useState('PENDING'); // PENDING | CLEARED | FLAGGED_CONTACT_CENTER
  const [useAnnualMedical, setUseAnnualMedical] = useState(false);
  const [confirmNoMedicalChange, setConfirmNoMedicalChange] = useState(false);

  const [waiverModalOpen, setWaiverModalOpen] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState(null);

  // Cookie Fast Checkout preference (scoped to current authenticated user or guest)
  const [rememberOnThisDevice, setRememberOnThisDevice] = useState(() => {
    const consent = getConsentStatus();
    const saved = getBookingPreferencesFromCookie(userId);
    return Boolean(consent.preferences || saved);
  });
  const [hasLoadedDevicePrefs, setHasLoadedDevicePrefs] = useState(false);

  const handleToggleRemember = checked => {
    setRememberOnThisDevice(checked);
    if (!checked) {
      clearBookingPreferencesCookie(userId);
      setHasLoadedDevicePrefs(false);
      toast.success('Saved device booking preferences cleared.');
    } else {
      const consent = getConsentStatus();
      if (!consent.preferences) {
        setConsent({ analytics: consent.analytics, preferences: true });
      }
      saveBookingPreferencesToCookie(
        {
          diverName,
          diverEmail,
          diverPhone,
          diverNationality,
          passportNumber,
          dateOfBirth,
          certAgency,
          certLevel,
          certNumber,
          selectedTankId,
          selectedGasMixId,
          regulatorFitting,
          weightSystem,
          leadKg,
          wetsuitGender,
          wetsuitSize,
          wetsuitThickness,
          bcdGender,
          bcdSize,
          finType,
          finSize,
          bootSize,
          shoeSizeEu,
          rentalTorch,
          rentalComputer,
          emergencyContactName,
          emergencyContactPhone,
          emergencyContactRelation,
          hasInsurance,
          insuranceProvider,
          insurancePolicyNumber,
          insuranceExpiryDate:
            insuranceExpiryDate || (insuranceDateRef.current ? insuranceDateRef.current.value : ''),
        },
        true,
        userId
      );
      toast.success('Your details will be remembered on this device.');
    }
  };

  const syncDeviceCookiePreferences = () => {
    if (rememberOnThisDevice) {
      const consent = getConsentStatus();
      if (!consent.preferences) {
        setConsent({ analytics: consent.analytics, preferences: true });
      }
      saveBookingPreferencesToCookie(
        {
          diverName,
          diverEmail,
          diverPhone,
          diverNationality,
          passportNumber,
          dateOfBirth,
          certAgency,
          certLevel,
          certNumber,
          selectedTankId,
          selectedGasMixId,
          regulatorFitting,
          weightSystem,
          leadKg,
          wetsuitGender,
          wetsuitSize,
          wetsuitThickness,
          bcdGender,
          bcdSize,
          finType,
          finSize,
          bootSize,
          shoeSizeEu,
          rentalTorch,
          rentalComputer,
          emergencyContactName,
          emergencyContactPhone,
          emergencyContactRelation,
          hasInsurance,
          insuranceProvider,
          insurancePolicyNumber,
          insuranceExpiryDate:
            insuranceExpiryDate || (insuranceDateRef.current ? insuranceDateRef.current.value : ''),
        },
        true,
        userId
      );
    } else {
      clearBookingPreferencesCookie(userId);
    }
  };

  // Auto-sync cookie preferences as fields change when user opts in to remember on this device
  useEffect(() => {
    if (!rememberOnThisDevice || loading) return;
    const timer = setTimeout(() => {
      syncDeviceCookiePreferences();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    rememberOnThisDevice,
    loading,
    diverName,
    diverEmail,
    diverPhone,
    diverNationality,
    passportNumber,
    dateOfBirth,
    certAgency,
    certLevel,
    certNumber,
    selectedTankId,
    selectedGasMixId,
    regulatorFitting,
    weightSystem,
    leadKg,
    wetsuitGender,
    wetsuitSize,
    wetsuitThickness,
    bcdGender,
    bcdSize,
    finType,
    finSize,
    bootSize,
    shoeSizeEu,
    rentalTorch,
    rentalComputer,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
    hasInsurance,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceExpiryDate,
  ]);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

  // Apply sizing/ownership defaults for the selected equipment tier.
  // Full rental packages must default ALL soft/hard goods to center rental —
  // anonymous guests have no gear profile implying "own mask/computer/torch".
  const applyUnitGearDefaults = (unitId, unitsList = contextData?.units) => {
    const unit = unitsList?.find(u => u.id === unitId);
    const isRental =
      unitId === 'demo-unit-2' ||
      unitId === 'certified-diver-full-rental' ||
      unit?.unit_type === 'DIVER_RENTAL_GEAR' ||
      unit?.type === 'DIVER_RENTAL_GEAR' ||
      unit?.title?.toLowerCase().includes('rental');

    if (isRental) {
      setWetsuitSize(prev => (prev === 'None' ? 'M' : prev));
      setWetsuitThickness(prev => prev || '5mm');
      setBcdSize(prev => (prev === 'None' ? 'M' : prev));
      setFinSize(prev => (prev === 'None' ? '42' : prev));
      setBootSize(prev => (prev === 'None' ? '42' : prev));
      setShoeSizeEu('42');
      setLeadKg(prev => (!prev || prev === '0' || prev === '0.0' ? '5.0' : prev));
      setRentalMask(true);
      setRentalRegulator(true);
      setRentalComputer(true);
      setRentalTorch(true);
      setHasOwnLeadWeights(false);
    } else {
      setWetsuitSize('None');
      setBcdSize('None');
      setFinSize('None');
      setBootSize('None');
      setRentalMask(false);
      setRentalRegulator(false);
      setRentalComputer(false);
      setRentalTorch(false);
    }
  };

  const handleUnitSelection = unitId => {
    setSelectedUnitId(unitId);
    applyUnitGearDefaults(unitId);
  };

  // Load Checkout Context
  useEffect(() => {
    const fetchContext = async () => {
      try {
        setLoading(true);
        const authToken = localStorage.getItem('token');
        const profilesPromise = authToken
          ? api.get('/api/v1/bookings/gear-profiles').catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] });

        const [contextRes, profilesRes, orgsRes] = await Promise.all([
          api.get(`/api/v1/bookings/checkout-context/${slotId}`),
          profilesPromise,
          api.get('/api/v1/diving-organizations/?limit=100').catch(() => ({ data: [] })),
        ]);

        const data = contextRes.data;
        setContextData(data);
        if (data.units && data.units.length > 0) {
          const initialUnitId = data.units[0].id;
          setSelectedUnitId(initialUnitId);
          applyUnitGearDefaults(initialUnitId, data.units);
        }
        const profilesList =
          profilesRes.data && profilesRes.data.length > 0
            ? profilesRes.data
            : data.user_gear_profiles || [];
        setSavedProfiles(profilesList);
        setOrganizations(orgsRes.data || []);

        // Auto-fill from authenticated user
        if (data.user) {
          if (data.user.full_name) setDiverName(data.user.full_name);
          if (data.user.email && !data.user.email.endsWith('.invalid')) {
            setDiverEmail(data.user.email);
          }
          if (data.user.phone) setDiverPhone(data.user.phone);
          if (data.user.nationality) setDiverNationality(data.user.nationality);
          if (data.user.passport_number) setPassportNumber(data.user.passport_number);
          if (data.user.date_of_birth) setDateOfBirth(data.user.date_of_birth);
        }

        // Auto-fill from gear profile: check saved profiles first
        const primaryProf = profilesList.find(p => p.is_default) || profilesList[0];
        if (primaryProf) {
          setSelectedProfileId(primaryProf.id.toString());
          if (primaryProf.preferred_tank_id) setSelectedTankId(primaryProf.preferred_tank_id);
          if (primaryProf.preferred_gas_mix_id)
            setSelectedGasMixId(primaryProf.preferred_gas_mix_id);
          if (primaryProf.regulator_fitting) setRegulatorFitting(primaryProf.regulator_fitting);
          if (primaryProf.weight_system) applyWeightSystem(primaryProf.weight_system);
          if (primaryProf.wetsuit_gender) setWetsuitGender(primaryProf.wetsuit_gender);
          if (primaryProf.wetsuit_thickness) setWetsuitThickness(primaryProf.wetsuit_thickness);
          if (primaryProf.bcd_gender) setBcdGender(primaryProf.bcd_gender);
          else if (primaryProf.wetsuit_gender) setBcdGender(primaryProf.wetsuit_gender);
          if (primaryProf.fin_type) setFinType(primaryProf.fin_type);
          if (primaryProf.shoe_size_eu) setShoeSizeEu(primaryProf.shoe_size_eu.toString());

          // Resolve ownership flags
          const hasOwnBcd = Boolean(primaryProf.has_own_bcd);
          setBcdSize(hasOwnBcd ? 'None' : primaryProf.bcd_size || 'M');

          const hasOwnSuit = Boolean(primaryProf.has_own_wetsuit);
          setWetsuitSize(hasOwnSuit ? 'None' : primaryProf.wetsuit_size || 'M');

          const hasOwnReg = Boolean(primaryProf.has_own_regulator);
          setRentalRegulator(!hasOwnReg);

          const hasOwnMsk =
            primaryProf.has_own_mask !== undefined ? Boolean(primaryProf.has_own_mask) : true;
          setRentalMask(!hasOwnMsk);

          const hasOwnF = Boolean(primaryProf.has_own_fins);
          setFinSize(hasOwnF ? 'None' : 'Standard');

          const hasOwnB = Boolean(primaryProf.has_own_boots);
          setBootSize(
            hasOwnB ? 'None' : primaryProf.shoe_size_eu ? primaryProf.shoe_size_eu.toString() : '43'
          );

          setRentalComputer(!primaryProf.has_own_dive_computer);
          setRentalTorch(!primaryProf.has_own_torch);
          setHasOwnLeadWeights(Boolean(primaryProf.has_own_lead_weights));

          if (primaryProf.estimated_lead_kg) setLeadKg(primaryProf.estimated_lead_kg.toString());
          if (primaryProf.emergency_contact_name)
            setEmergencyContactName(primaryProf.emergency_contact_name);
          if (primaryProf.emergency_contact_phone)
            setEmergencyContactPhone(primaryProf.emergency_contact_phone);
          if (primaryProf.emergency_contact_relation)
            setEmergencyContactRelation(primaryProf.emergency_contact_relation);
          if (primaryProf.insurance_provider) {
            setInsuranceProvider(primaryProf.insurance_provider);
            setHasInsurance('OWN');
          }
          if (primaryProf.insurance_policy_number)
            setInsurancePolicyNumber(primaryProf.insurance_policy_number);
          if (primaryProf.insurance_expiry_date)
            setInsuranceExpiryDate(primaryProf.insurance_expiry_date);
        } else if (data.prefill_gear) {
          const pg = data.prefill_gear;
          // Default cylinder is strictly 12L Steel and default valve is DIN
          setSelectedTankId('12');
          setSelectedGasMixId('air');
          setRegulatorFitting('DIN');
          if (pg.weight_system) applyWeightSystem(pg.weight_system);
          if (pg.wetsuit_gender) setWetsuitGender(pg.wetsuit_gender);
          if (pg.wetsuit_thickness) setWetsuitThickness(pg.wetsuit_thickness);
          if (pg.bcd_gender) setBcdGender(pg.bcd_gender);
          else if (pg.wetsuit_gender) setBcdGender(pg.wetsuit_gender);
          if (pg.fin_type) setFinType(pg.fin_type);
          // Default rental equipment sizes to 'None' (Own Gear)
          setWetsuitSize('None');
          setBcdSize('None');
          setFinSize('None');
          setBootSize('None');
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

        // Auto-fill from annual medical declaration
        if (data.user_annual_medical?.has_record && !data.user_annual_medical.is_expired) {
          const uMed = data.user_annual_medical;
          if (uMed.status === 'CLEARED' || uMed.center_approved) {
            setUseAnnualMedical(true);
            setConfirmNoMedicalChange(true);
            setMedicalStatus(uMed.status === 'CLEARED' ? 'CLEARED' : 'PHYSICIAN_APPROVED');
          } else {
            setMedicalStatus('FLAGGED_CONTACT_CENTER');
          }
        }

        // Auto-fill from saved device cookies if opted in (certifications are still loaded from platform)
        const effectiveUserId = userId || data.user?.id || null;
        const cookiePrefs = getBookingPreferencesFromCookie(effectiveUserId);
        if (cookiePrefs) {
          setHasLoadedDevicePrefs(true);
          // Diver personal details fallback
          if (!data.user?.full_name && cookiePrefs.diverName) setDiverName(cookiePrefs.diverName);
          if (
            (!data.user?.email || data.user.email.endsWith('.invalid')) &&
            cookiePrefs.diverEmail
          ) {
            setDiverEmail(cookiePrefs.diverEmail);
          }
          if (!data.user?.phone && cookiePrefs.diverPhone) setDiverPhone(cookiePrefs.diverPhone);
          if (!data.user?.nationality && cookiePrefs.diverNationality)
            setDiverNationality(cookiePrefs.diverNationality);
          if (!data.user?.passport_number && cookiePrefs.passportNumber)
            setPassportNumber(cookiePrefs.passportNumber);
          if (!data.user?.date_of_birth && cookiePrefs.dateOfBirth)
            setDateOfBirth(cookiePrefs.dateOfBirth);

          // Equipment preferences from cookies
          if (cookiePrefs.selectedTankId) setSelectedTankId(cookiePrefs.selectedTankId);
          if (cookiePrefs.selectedGasMixId) setSelectedGasMixId(cookiePrefs.selectedGasMixId);
          if (cookiePrefs.regulatorFitting) setRegulatorFitting(cookiePrefs.regulatorFitting);
          if (cookiePrefs.weightSystem) applyWeightSystem(cookiePrefs.weightSystem);
          if (cookiePrefs.leadKg) setLeadKg(cookiePrefs.leadKg.toString());
          if (cookiePrefs.wetsuitGender) setWetsuitGender(cookiePrefs.wetsuitGender);
          if (cookiePrefs.wetsuitSize) setWetsuitSize(cookiePrefs.wetsuitSize);
          if (cookiePrefs.wetsuitThickness) setWetsuitThickness(cookiePrefs.wetsuitThickness);
          if (cookiePrefs.bcdGender) setBcdGender(cookiePrefs.bcdGender);
          if (cookiePrefs.bcdSize) setBcdSize(cookiePrefs.bcdSize);
          if (cookiePrefs.finType) setFinType(cookiePrefs.finType);
          if (cookiePrefs.finSize) setFinSize(cookiePrefs.finSize);
          if (cookiePrefs.bootSize) setBootSize(cookiePrefs.bootSize);
          if (cookiePrefs.shoeSizeEu) setShoeSizeEu(cookiePrefs.shoeSizeEu.toString());
          if (cookiePrefs.rentalTorch !== undefined)
            setRentalTorch(Boolean(cookiePrefs.rentalTorch));
          if (cookiePrefs.rentalComputer !== undefined)
            setRentalComputer(Boolean(cookiePrefs.rentalComputer));

          // Emergency Contact from cookies
          if (cookiePrefs.emergencyContactName) {
            setEmergencyContactName(cookiePrefs.emergencyContactName);
          }
          if (cookiePrefs.emergencyContactPhone) {
            setEmergencyContactPhone(cookiePrefs.emergencyContactPhone);
          }
          if (cookiePrefs.emergencyContactRelation) {
            setEmergencyContactRelation(cookiePrefs.emergencyContactRelation);
          }

          // Dive Accident Insurance preferences from cookies
          if (cookiePrefs.hasInsurance) {
            setHasInsurance(cookiePrefs.hasInsurance);
          }
          if (cookiePrefs.insuranceProvider) {
            setInsuranceProvider(cookiePrefs.insuranceProvider);
          }
          if (cookiePrefs.insurancePolicyNumber) {
            setInsurancePolicyNumber(cookiePrefs.insurancePolicyNumber);
          }
          if (cookiePrefs.insuranceExpiryDate) {
            setInsuranceExpiryDate(cookiePrefs.insuranceExpiryDate);
          }
        }

        // Auto-fill from certifications (most advanced qualification first from platform)
        if (data.user_certifications && data.user_certifications.length > 0) {
          const mostAdvancedCert = data.user_certifications[0];
          const matchedOrg = (orgsRes.data || []).find(
            o =>
              o.name?.toLowerCase() === mostAdvancedCert.agency?.toLowerCase() ||
              o.acronym?.toLowerCase() === mostAdvancedCert.agency?.toLowerCase()
          );
          setCertAgency(matchedOrg?.acronym || mostAdvancedCert.agency || '');
          if (mostAdvancedCert.level) setCertLevel(mostAdvancedCert.level);
          const platformCardId = mostAdvancedCert.card_id || mostAdvancedCert.number || '';
          if (platformCardId) {
            setCertNumber(platformCardId);
          } else if (cookiePrefs?.certNumber) {
            setCertNumber(cookiePrefs.certNumber);
          } else {
            setCertNumber('');
          }
        } else if (cookiePrefs) {
          if (cookiePrefs.certAgency) setCertAgency(cookiePrefs.certAgency);
          if (cookiePrefs.certLevel) setCertLevel(cookiePrefs.certLevel);
          if (cookiePrefs.certNumber) setCertNumber(cookiePrefs.certNumber);
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
    setSelectedProfileId(profId);
    const prof = savedProfiles.find(p => p.id === parseInt(profId, 10));
    if (!prof) return;

    if (prof.preferred_tank_id) setSelectedTankId(prof.preferred_tank_id);
    if (prof.preferred_gas_mix_id) setSelectedGasMixId(prof.preferred_gas_mix_id);
    if (prof.regulator_fitting) setRegulatorFitting(prof.regulator_fitting);
    if (prof.weight_system) applyWeightSystem(prof.weight_system);
    if (prof.wetsuit_gender) setWetsuitGender(prof.wetsuit_gender);
    if (prof.wetsuit_thickness) setWetsuitThickness(prof.wetsuit_thickness);
    if (prof.bcd_gender) setBcdGender(prof.bcd_gender);
    else if (prof.wetsuit_gender) setBcdGender(prof.wetsuit_gender);
    if (prof.fin_type) setFinType(prof.fin_type);
    if (prof.shoe_size_eu) setShoeSizeEu(prof.shoe_size_eu.toString());

    // Resolve gear gap based on ownership flags
    const hasOwnBcd = Boolean(prof.has_own_bcd);
    setBcdSize(hasOwnBcd ? 'None' : prof.bcd_size || 'M');

    const hasOwnSuit = Boolean(prof.has_own_wetsuit);
    setWetsuitSize(hasOwnSuit ? 'None' : prof.wetsuit_size || 'M');

    const hasOwnReg = Boolean(prof.has_own_regulator);
    setRentalRegulator(!hasOwnReg);

    const hasOwnMsk = prof.has_own_mask !== undefined ? Boolean(prof.has_own_mask) : true;
    setRentalMask(!hasOwnMsk);

    const hasOwnF = Boolean(prof.has_own_fins);
    setFinSize(hasOwnF ? 'None' : 'Standard');

    const hasOwnB = Boolean(prof.has_own_boots);
    setBootSize(hasOwnB ? 'None' : prof.shoe_size_eu ? prof.shoe_size_eu.toString() : '43');

    setRentalComputer(!prof.has_own_dive_computer);
    setRentalTorch(!prof.has_own_torch);
    setHasOwnLeadWeights(Boolean(prof.has_own_lead_weights));

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
    setUseAnnualMedical(false);
    setConfirmNoMedicalChange(false);
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

  const selectedUnit = contextData?.units?.find(u => u.id === selectedUnitId);

  // Dynamic Equipment Rental Calculation (Itemized vs Package)
  const rentalCalculation = useMemo(() => {
    const pricing = contextData?.rental_pricing;
    const basePrice = selectedUnit ? parseFloat(selectedUnit.retail_price) : 75;
    if (!pricing || !pricing.items) {
      return {
        basePrice,
        rentalItems: [],
        totalRentalSurcharge: 0,
        totalDue: basePrice,
        isPackageApplied: false,
      };
    }

    const items = pricing.items;
    const fullKitPackage = pricing.full_kit_package || 30.0;
    const isFullRentalUnit =
      selectedUnitId === 'demo-unit-2' ||
      selectedUnitId === 'certified-diver-full-rental' ||
      selectedUnit?.title?.toLowerCase().includes('full');

    const rentalItems = [];

    // 1. Auxiliary items
    if (rentalTorch && items.dive_torch) {
      rentalItems.push({ label: 'Rental Dive Torch', price: items.dive_torch });
    }

    const dailyInsFee =
      hasInsurance === 'CENTER'
        ? Number(contextData?.center_settings?.daily_insurance_price || 0)
        : 0;

    if (dailyInsFee > 0) {
      rentalItems.push({ label: 'Center Daily Dive Insurance', price: dailyInsFee });
    }

    // 2. Core equipment items
    if (isFullRentalUnit) {
      if (rentalComputer && items.dive_computer) {
        rentalItems.push({ label: 'Rental Dive Computer', price: items.dive_computer });
      }
      const surcharge = rentalItems.reduce((sum, item) => sum + item.price, 0);
      return {
        basePrice,
        rentalItems,
        totalRentalSurcharge: surcharge,
        totalDue: basePrice + surcharge,
        isPackageApplied: true,
      };
    }

    // Own Gear Diver selecting individual rental items à la carte
    const coreItems = [];
    if (wetsuitSize !== 'None' && items.wetsuit) {
      coreItems.push({ label: `Rental Wetsuit (${wetsuitSize})`, price: items.wetsuit });
    }
    if (bcdSize !== 'None' && items.bcd) {
      coreItems.push({ label: `Rental BCD (${bcdSize})`, price: items.bcd });
    }
    if (finSize !== 'None' && items.fins_boots) {
      coreItems.push({ label: `Rental Fins (${finSize})`, price: items.fins_boots });
    } else if (bootSize !== 'None') {
      coreItems.push({ label: `Rental Booties (EU ${bootSize})`, price: 5.0 });
    }
    if (rentalComputer && items.dive_computer) {
      coreItems.push({ label: 'Rental Dive Computer', price: items.dive_computer });
    }

    const coreSum = coreItems.reduce((sum, item) => sum + item.price, 0);
    let totalCoreSurcharge = coreSum;
    let isPackageApplied = false;

    // Smart package cap
    if (coreSum >= fullKitPackage && fullKitPackage > 0) {
      totalCoreSurcharge = fullKitPackage;
      isPackageApplied = true;
    }

    const allItems = [...coreItems, ...rentalItems];
    const totalSurcharge =
      totalCoreSurcharge + rentalItems.reduce((sum, item) => sum + item.price, 0);

    return {
      basePrice,
      rentalItems: allItems,
      totalRentalSurcharge: totalSurcharge,
      totalDue: basePrice + totalSurcharge,
      isPackageApplied,
      coreSum,
      fullKitPackage,
    };
  }, [
    contextData,
    selectedUnit,
    selectedUnitId,
    wetsuitSize,
    bcdSize,
    finSize,
    bootSize,
    rentalComputer,
    rentalTorch,
    hasInsurance,
  ]);

  // Specification-driven Nitrox eligibility
  const isNitroxEligible = useMemo(() => {
    // 1. Registered profile portfolio check (from calculate_certification_stats)
    if (contextData?.diver_capabilities?.allows_nitrox) {
      return true;
    }

    // 2. Check if user has an active Nitrox card in their profile certifications
    if (
      Array.isArray(contextData?.user_certifications) &&
      contextData.user_certifications.some(c => c.allows_nitrox)
    ) {
      return true;
    }

    // 3. Specification check from availableLevels database specifications
    if (certLevel) {
      const activeLevelObj = availableLevels.find(
        lvl => lvl.name?.toLowerCase() === certLevel.toLowerCase()
      );
      if (activeLevelObj && activeLevelObj.gases) {
        const gasesStr = activeLevelObj.gases.toLowerCase();
        if (
          gasesStr.includes('nitrox') ||
          gasesStr.includes('safeair') ||
          gasesStr.includes('trimix') ||
          gasesStr.includes('triox') ||
          gasesStr.includes('100% o2') ||
          gasesStr.includes('40% o2') ||
          gasesStr.includes('deco')
        ) {
          return true;
        }
      }

      // 5. Fallback check for technical or dedicated nitrox ratings
      const cl = certLevel.toLowerCase();
      const techOrNitroxKeywords = [
        'nitrox',
        'ean',
        'enriched air',
        'safeair',
        'extended range',
        'xr',
        'tec',
        'technical',
        'trimix',
        'helitrox',
        'triox',
        'rebreather',
        'ccr',
        'decompression',
        'fundamentals',
        'fundies',
      ];
      if (techOrNitroxKeywords.some(kw => cl.includes(kw))) {
        return true;
      }
    }

    return false;
  }, [contextData, availableLevels, certLevel, secondaryNitroxCert]);

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
      toast.error(
        'Please provide your scuba diving certification agency, level, and certification card number (either physical or via an app).'
      );
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    return true;
  };

  const validateStep3 = () => {
    if (!emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      toast.error('Please provide an emergency contact name and phone number for maritime safety.');
      return false;
    }
    if (hasInsurance === 'OWN') {
      if (!insuranceProvider.trim()) {
        toast.error(
          'Please provide your dive insurance provider name (or select center daily insurance).'
        );
        return false;
      }
      if (!insurancePolicyNumber.trim()) {
        toast.error('Please provide your active dive insurance policy or member number.');
        return false;
      }

      // Check both React state and native DOM element to eliminate date-typing race conditions
      const domDate = insuranceDateRef.current ? insuranceDateRef.current.value : '';
      const effectiveDate = (insuranceExpiryDate || domDate || '').trim();

      if (!effectiveDate) {
        toast.error('Please provide your dive insurance policy expiration date.');
        return false;
      }
      const todayStr = new Date().toISOString().split('T')[0];
      if (effectiveDate < todayStr) {
        toast.error(
          'Your dive insurance policy is expired. Please enter an active future expiration date, or choose "I need daily insurance from the dive center".'
        );
        return false;
      }

      if (effectiveDate !== insuranceExpiryDate) {
        setInsuranceExpiryDate(effectiveDate);
      }
    }
    return true;
  };

  const validateStep4 = () => {
    if (useAnnualMedical) {
      if (!confirmNoMedicalChange) {
        toast.error(
          'Please confirm that your health condition has not changed since your declaration.'
        );
        return false;
      }
      return true;
    }
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
    syncDeviceCookiePreferences();
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
      syncDeviceCookiePreferences();
      const finalExpiryDate = (
        insuranceExpiryDate || (insuranceDateRef.current ? insuranceDateRef.current.value : '')
      ).trim();

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
              fin_size: finSize === 'None' ? null : finSize,
              boot_size: bootSize === 'None' ? null : bootSize,
              rental_fins: finSize !== 'None',
              has_own_fins: finSize === 'None',
              rental_boots: bootSize !== 'None',
              has_own_boots: bootSize === 'None',
              shoe_size_eu: parseFloat(shoeSizeEu) || 43.0,
              rental_regulator: rentalRegulator,
              has_own_regulator: !rentalRegulator,
              rental_mask: rentalMask,
              has_own_mask: !rentalMask,
              has_own_lead_weights: hasOwnLeadWeights,
              selected_profile_id: selectedProfileId || undefined,
              rental_torch: rentalTorch,
              rental_dive_computer: rentalComputer,
              has_own_dive_computer: !rentalComputer,
              regulator_fitting: regulatorFitting,
              weight_system: weightSystem,
              weight_systems: weightSystems,
              secondary_nitrox_cert: secondaryNitroxCert.trim() || undefined,
              estimated_lead_kg: parseFloat(leadKg) || 5.0,
              lead_kg: parseFloat(leadKg) || 5.0,
              insurance_type: hasInsurance,
              insurance_provider:
                hasInsurance === 'OWN'
                  ? insuranceProvider.trim() || undefined
                  : 'Center Daily Coverage',
              insurance_policy_number:
                hasInsurance === 'OWN' ? insurancePolicyNumber.trim() || undefined : undefined,
              insurance_expiry_date:
                hasInsurance === 'OWN' ? finalExpiryDate || undefined : undefined,
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
      const accessToken = holdRes.data.accessToken;
      const unitItemId = holdRes.data.unitItems[0].id;

      if (accessToken && typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(`divemap_booking_access_${bookingUuid}`, accessToken);
        } catch (_e) {
          // Ignore storage quota / private mode errors
        }
      }

      const bookingAuthHeaders = accessToken ? { 'X-Booking-Access-Token': accessToken } : {};

      const paperworkPayload = {
        unitItemId: unitItemId,
        dmscAnswers: useAnnualMedical ? undefined : dmscAnswers,
        useAnnualMedical: Boolean(useAnnualMedical),
        confirmNoMedicalChange: Boolean(useAnnualMedical && confirmNoMedicalChange),
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
          fin_size: finSize === 'None' ? null : finSize,
          boot_size: bootSize === 'None' ? null : bootSize,
          rental_fins: finSize !== 'None',
          has_own_fins: finSize === 'None',
          rental_boots: bootSize !== 'None',
          has_own_boots: bootSize === 'None',
          shoe_size_eu: parseFloat(shoeSizeEu) || 43.0,
          rental_regulator: rentalRegulator,
          has_own_regulator: !rentalRegulator,
          rental_mask: rentalMask,
          has_own_mask: !rentalMask,
          has_own_lead_weights: hasOwnLeadWeights,
          selected_profile_id: selectedProfileId || undefined,
          rental_torch: rentalTorch,
          rental_dive_computer: rentalComputer,
          has_own_dive_computer: !rentalComputer,
          regulator_fitting: regulatorFitting,
          weight_system: weightSystem,
          weight_systems: weightSystems,
          secondary_nitrox_cert: secondaryNitroxCert.trim() || undefined,
          estimated_lead_kg: parseFloat(leadKg) || 5.0,
          lead_kg: parseFloat(leadKg) || 5.0,
          insurance_type: hasInsurance,
          insurance_provider:
            hasInsurance === 'OWN'
              ? insuranceProvider.trim() || undefined
              : 'Center Daily Coverage',
          insurance_policy_number:
            hasInsurance === 'OWN' ? insurancePolicyNumber.trim() || undefined : undefined,
          insurance_expiry_date: hasInsurance === 'OWN' ? finalExpiryDate || undefined : undefined,
          emergency_contact_name: emergencyContactName.trim() || undefined,
          emergency_contact_phone: emergencyContactPhone.trim() || undefined,
          emergency_contact_relation: emergencyContactRelation.trim() || undefined,
        },
      };

      if (!accessToken) {
        toast.error(
          'Booking hold was created but the access token was missing. Open My Bookings or contact the center — your seat may be held temporarily.'
        );
        navigate(`/bookings/${bookingUuid}/voucher`);
        return;
      }

      try {
        await api.post(`/api/v1/bookings/${bookingUuid}/submit-paperwork`, paperworkPayload, {
          headers: bookingAuthHeaders,
        });
      } catch (paperworkErr) {
        console.error('Paperwork submission failed after hold:', paperworkErr);
        const pDetail = paperworkErr.response?.data?.detail;
        const pStr = typeof pDetail === 'string' ? pDetail : '';
        if (paperworkErr.response?.status === 401) {
          toast.error(
            'Hold created but paperwork authentication failed. Retry from the voucher link or My Bookings.'
          );
        } else {
          toast.error(
            pStr ||
              'Hold created but paperwork failed. Complete medical/waiver from your voucher while the hold is active.'
          );
        }
        navigate(
          `/bookings/${bookingUuid}/voucher?access_token=${encodeURIComponent(accessToken)}`
        );
        return;
      }

      toast.success('Booking confirmed! Payment will be collected on arrival.');
      // Token is already in sessionStorage; avoid leaving it in the URL long-term
      navigate(`/bookings/${bookingUuid}/voucher?access_token=${encodeURIComponent(accessToken)}`);
    } catch (err) {
      console.error('Booking confirmation failed:', err);
      const detail = err.response?.data?.detail;
      const detailStr = typeof detail === 'string' ? detail : '';
      const isSoldOut =
        err.response?.status === 400 &&
        /fully booked online|not enough seats|seats available/i.test(detailStr);

      if (isSoldOut) {
        // Surface the existing contact-center sold-out screen instead of a raw capacity toast
        setContextData(prev =>
          prev?.slot ? { ...prev, slot: { ...prev.slot, seats_available: 0 } } : prev
        );
        toast.error(
          detailStr ||
            'This trip is fully booked online. Please contact the diving center directly.'
        );
        return;
      }

      if (err.response?.status === 401) {
        toast.error(detailStr || 'Authentication required to complete booking.');
        return;
      }

      toast.error(detailStr || 'Failed to complete booking.');
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

  if (
    contextData.slot &&
    contextData.slot.seats_available !== undefined &&
    contextData.slot.seats_available !== null &&
    contextData.slot.seats_available <= 0
  ) {
    const center = contextData.center || {};
    const centerName = decodeHtmlEntities(center.name || 'the diving center');
    const tripTitle = decodeHtmlEntities(contextData.product?.title || 'Dive Trip');
    const tripDateStr = contextData.slot.start_datetime
      ? formatDate(contextData.slot.start_datetime)
      : '';
    const cleanPhone = (center.phone || '').replace(/[^0-9]/g, '');
    const inquiryMessage = `Hi ${centerName}! I noticed online spots are full on Divemap for "${tripTitle}"${tripDateStr ? ` on ${tripDateStr}` : ''}. Do you have any reserved boat spots available or a cancellation waitlist I could join?`;
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(inquiryMessage)}`
      : null;
    const emailSubject = `Trip Spot Inquiry: ${tripTitle}${tripDateStr ? ` (${tripDateStr})` : ''}`;
    const emailUrl = center.email
      ? `mailto:${center.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(inquiryMessage)}`
      : null;

    const handleStartChat = async () => {
      if (!center.id) {
        toast.error('Diving center information not available');
        return;
      }
      if (!user) {
        toast.error('Please log in to chat with the diving center');
        return;
      }
      try {
        const room = await createChatRoom([], false, null, center.id);
        navigate('/messages', {
          state: {
            roomId: room.id,
            draftMessage: inquiryMessage.slice(0, 500),
          },
        });
      } catch (err) {
        console.error('Failed to start chat:', err);
        toast.error('Could not start conversation');
      }
    };

    return (
      <div className='min-h-[75vh] flex items-center justify-center p-4 sm:p-6 bg-gray-50/50 dark:bg-gray-900/50'>
        <div className='max-w-lg w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8 text-center space-y-6'>
          <div className='w-14 h-14 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto'>
            <AlertCircle className='w-7 h-7' />
          </div>

          <div className='space-y-2'>
            <h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
              Departure Currently Full Online
            </h2>
            <p className='text-sm text-gray-600 dark:text-gray-300 leading-relaxed'>
              Online slots for <strong>{tripTitle}</strong>
              {tripDateStr && <span> on {tripDateStr}</span>} are currently fully booked.
            </p>
          </div>

          <div className='p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-left text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed'>
            Diving centers regularly reserve offline spots on board for walk-ins, phone bookings, or
            experience last-minute cancellations. Contact {centerName} directly to check
            availability.
          </div>

          <div className='space-y-2 text-left pt-1'>
            {center.id && (
              <button
                type='button'
                onClick={handleStartChat}
                className='w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 transition-colors font-medium text-xs sm:text-sm cursor-pointer'
              >
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0'>
                    <MessageSquare className='w-4 h-4' />
                  </div>
                  <div>
                    <div className='font-bold text-gray-900 dark:text-white'>
                      Divemap Direct Chat
                    </div>
                    <div className='text-[11px] text-gray-500 dark:text-gray-400'>
                      {user ? 'Chat in-app with the center team' : 'Log in to chat in-app'}
                    </div>
                  </div>
                </div>
                <ExternalLink className='w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0' />
              </button>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 transition-colors font-medium text-xs sm:text-sm'
              >
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0'>
                    <WhatsAppIcon className='w-4 h-4' color='ffffff' />
                  </div>
                  <div>
                    <div className='font-bold text-gray-900 dark:text-white'>WhatsApp Message</div>
                    <div className='text-[11px] text-gray-500 dark:text-gray-400'>
                      Send inquiry to {center.phone}
                    </div>
                  </div>
                </div>
                <ExternalLink className='w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0' />
              </a>
            )}

            {emailUrl && (
              <a
                href={emailUrl}
                className='w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 transition-colors font-medium text-xs sm:text-sm'
              >
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0'>
                    <Mail className='w-4 h-4' />
                  </div>
                  <div>
                    <div className='font-bold text-gray-900 dark:text-white'>Email Center</div>
                    <div className='text-[11px] text-gray-500 dark:text-gray-400'>
                      {center.email}
                    </div>
                  </div>
                </div>
                <ExternalLink className='w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0' />
              </a>
            )}

            {center.phone && (
              <a
                href={`tel:${center.phone}`}
                className='w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-colors font-medium text-xs sm:text-sm'
              >
                <div className='flex items-center gap-2.5'>
                  <div className='w-8 h-8 rounded-lg bg-gray-700 text-white flex items-center justify-center shrink-0'>
                    <Phone className='w-4 h-4' />
                  </div>
                  <div>
                    <div className='font-bold text-gray-900 dark:text-white'>Call Center</div>
                    <div className='text-[11px] text-gray-500 dark:text-gray-400'>
                      {center.phone}
                    </div>
                  </div>
                </div>
                <ExternalLink className='w-4 h-4 text-gray-400 shrink-0' />
              </a>
            )}
          </div>

          <div className='pt-2'>
            <Link
              to='/dive-trips'
              className='inline-flex items-center justify-center w-full px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl text-sm font-semibold transition-colors'
            >
              Browse Other Dive Trips
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

                {hasLoadedDevicePrefs && (
                  <div className='p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs flex items-center justify-between text-blue-900 dark:text-blue-200'>
                    <span className='flex items-center gap-1.5 font-medium'>
                      <Sparkles size={14} className='text-blue-600 dark:text-blue-400 shrink-0' />
                      Prefilled from your saved device cookies (certifications loaded from your
                      Divemap profile).
                    </span>
                    <button
                      type='button'
                      onClick={() => handleToggleRemember(false)}
                      className='text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline shrink-0'
                    >
                      Clear device cookies
                    </button>
                  </div>
                )}

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
                            onChange={() => handleUnitSelection(u.id)}
                            className='h-4 w-4 text-blue-600'
                          />
                          <span className='text-xs sm:text-sm font-bold text-gray-900 dark:text-white'>
                            {u.title}
                          </span>
                        </div>
                        <span className='text-xs font-semibold text-blue-600 font-mono flex items-center gap-1'>
                          €{u.retail_price}
                          {u.unit_type === 'DIVER_RENTAL_GEAR' &&
                            contextData.units.find(o => o.unit_type === 'DIVER_OWN_GEAR')
                              ?.retail_price === u.retail_price && (
                              <span className='text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded font-bold'>
                                Included
                              </span>
                            )}
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
                    <DateOfBirthPicker
                      value={dateOfBirth}
                      onChange={setDateOfBirth}
                      required
                      label='Date of Birth *'
                    />
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

                  {contextData?.user_certifications?.length > 1 && (
                    <div className='mb-3 p-3 bg-blue-50/60 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/40'>
                      <span className='text-[11px] font-bold text-blue-700 dark:text-blue-300 block mb-1.5 uppercase tracking-wider'>
                        Your Registered Certifications (Auto-Selected Highest Qualification):
                      </span>
                      <div className='flex flex-wrap gap-2'>
                        {contextData.user_certifications.map((c, idx) => {
                          const matchedOrg = organizations.find(
                            o =>
                              o.name?.toLowerCase() === c.agency?.toLowerCase() ||
                              o.acronym?.toLowerCase() === c.agency?.toLowerCase()
                          );
                          const orgAcronym = matchedOrg?.acronym || c.agency;
                          const isSelected =
                            certAgency?.toLowerCase() === orgAcronym?.toLowerCase() &&
                            certLevel?.toLowerCase() === c.level?.toLowerCase();

                          return (
                            <button
                              key={idx}
                              type='button'
                              onClick={() => {
                                setCertAgency(orgAcronym || '');
                                setCertLevel(c.level || '');
                                setCertNumber(c.card_id || c.number || '');
                              }}
                              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400'
                              }`}
                            >
                              {orgAcronym} • {c.level} {c.is_most_advanced && '⭐ (Most Advanced)'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Agency *
                      </label>
                      <select
                        value={
                          organizations.find(
                            o =>
                              o.acronym?.toLowerCase() === certAgency?.toLowerCase() ||
                              o.name?.toLowerCase() === certAgency?.toLowerCase()
                          )?.acronym || certAgency
                        }
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
                        Scuba Diving Certification Card #
                      </label>
                      <input
                        type='text'
                        value={certNumber}
                        onChange={e => setCertNumber(e.target.value)}
                        placeholder='Card or digital app ID number'
                        required
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          !certNumber.trim() ? 'border-amber-300 bg-amber-50/20' : 'border-gray-300'
                        }`}
                      />
                      <span className='text-[11px] text-gray-400 mt-1 block'>
                        Physical plastic card or verified mobile app (PADI, SSI, etc.)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fast Checkout Device Option */}
                <div className='p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl flex items-start gap-3'>
                  <input
                    id='remember-device-toggle-step1'
                    type='checkbox'
                    checked={rememberOnThisDevice}
                    onChange={e => handleToggleRemember(e.target.checked)}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0 cursor-pointer'
                  />
                  <div className='text-xs'>
                    <label
                      htmlFor='remember-device-toggle-step1'
                      className='font-bold text-gray-900 dark:text-white cursor-pointer block'
                    >
                      Remember my details on this device for faster checkout
                    </label>
                    <span className='text-gray-500 dark:text-gray-400 block mt-0.5 leading-relaxed'>
                      Optionally saves your personal info, equipment sizing, emergency contacts, and
                      insurance in browser cookies so you don't have to re-enter them next time.
                    </span>
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
                      Specify cylinders, gas mixes, lead weight requirements, and anatomical rental
                      sizing.
                    </p>
                  </div>
                  <span className='text-xs font-bold text-blue-600 font-mono'>2 of 5</span>
                </div>

                {/* Active Gear Configuration Switcher */}
                {savedProfiles.length > 0 ? (
                  <div className='p-3.5 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <div>
                      <div className='flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200'>
                        <Layers size={16} className='text-blue-600 shrink-0' />
                        <span>Apply Saved Gear Profile:</span>
                      </div>
                      <p className='text-[11px] text-blue-700 dark:text-blue-300 mt-0.5'>
                        Equipment you own is automatically marked as brought by you below.
                      </p>
                    </div>
                    <div className='flex items-center gap-2 shrink-0'>
                      <select
                        value={selectedProfileId}
                        onChange={e => handleSelectProfilePreset(e.target.value)}
                        className='px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm'
                      >
                        {savedProfiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.is_default ? '(Primary)' : ''}
                          </option>
                        ))}
                      </select>
                      <Link
                        to='/profile/gear'
                        target='_blank'
                        className='p-1.5 text-blue-600 hover:text-blue-800 text-xs font-semibold rounded-lg hover:bg-blue-100/50 flex items-center gap-1 transition-colors'
                        title='Manage Gear Profiles in a new tab'
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className='p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between'>
                    <span>
                      No saved gear profiles found. Configure your rental requirements below.
                    </span>
                    <Link
                      to='/profile/gear'
                      target='_blank'
                      className='text-blue-600 hover:underline font-semibold flex items-center gap-1'
                    >
                      Create Gear Profile <ExternalLink size={12} />
                    </Link>
                  </div>
                )}

                {/* Cylinder & Breathing Gas Configuration */}
                <div>
                  <span className='text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2'>
                    Cylinder & Breathing Gas Configuration
                  </span>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div>
                      <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                        Cylinder *
                      </label>
                      <select
                        value={selectedTankId}
                        onChange={e => setSelectedTankId(e.target.value)}
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium'
                      >
                        <option value='12'>12L Steel (Standard)</option>
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
                        className='w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium'
                      >
                        <option value='air'>Air (21% O2) — Standard</option>
                        <option value='ean32'>EAN32 (32% O2 Nitrox) — Requires Cert Check</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Nitrox Eligibility Info */}
                {selectedGasMixId.toLowerCase() !== 'air' &&
                  (isNitroxEligible ? (
                    <div className='p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2'>
                      <Check size={15} className='text-emerald-600 shrink-0 mt-0.5' />
                      <div>
                        <strong>Verified Nitrox Diver:</strong> Your qualification permits Enriched
                        Air (EAN32).
                      </div>
                    </div>
                  ) : (
                    <div className='p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-2'>
                      <div className='flex items-start gap-2'>
                        <AlertTriangle size={15} className='text-amber-600 shrink-0 mt-0.5' />
                        <div>
                          <strong>EAN32 Requested (Pending Center Verification):</strong> Your
                          selected primary qualification ({certLevel || 'Unspecified'}) is an
                          Air-only certification.
                          <span className='block mt-0.5 text-[11px] text-amber-800 dark:text-amber-300'>
                            Enriched Air requires a separate Enriched Air Diver specialty or
                            qualifying technical certification.
                          </span>
                        </div>
                      </div>

                      <div className='pl-6 space-y-1'>
                        <label className='block text-[11px] font-semibold text-amber-950 dark:text-amber-100'>
                          Hold a separate Nitrox / Enriched Air Certification? (Optional)
                        </label>
                        <input
                          type='text'
                          value={secondaryNitroxCert}
                          onChange={e => setSecondaryNitroxCert(e.target.value)}
                          placeholder='e.g. PADI Enriched Air Diver # 12345678'
                          className='w-full px-2.5 py-1.5 border border-amber-300 dark:border-amber-700 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 font-medium'
                        />
                        <span className='text-[10px] text-amber-700 dark:text-amber-300/80 block'>
                          You can record your separate Nitrox card details above, or present your
                          physical/digital card to the dive center manager at check-in.
                        </span>
                        {secondaryNitroxCert.trim() && (
                          <div className='flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 pt-1'>
                            <Check size={13} className='text-emerald-600' />
                            <span>
                              Separate Nitrox credential recorded. The dive center team will verify
                              it on check-in.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                {/* Equipment Configuration Cards (Owned vs Rental) */}
                <div className='pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3'>
                  <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-1'>
                    <span className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                      Equipment Allocation & Sizing
                    </span>
                    <span className='text-[11px] text-gray-400'>
                      Items you own are grayed out. Click &quot;Need to rent&quot; on any item to
                      request center equipment.
                    </span>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {/* 1. Wetsuit Card */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        wetsuitSize === 'None'
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/30'
                      }`}
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-bold text-xs text-gray-900 dark:text-white'>
                          Wetsuit / Exposure Suit
                        </span>
                        {wetsuitSize === 'None' ? (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'>
                            ✓ Bringing Own
                          </span>
                        ) : (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'>
                            Rent from Center
                          </span>
                        )}
                      </div>

                      {wetsuitSize === 'None' ? (
                        <div className='flex items-center justify-between pt-1'>
                          <span className='text-xs text-gray-500 italic'>
                            No rental suit needed.
                          </span>
                          <button
                            type='button'
                            onClick={() => setWetsuitSize(activeProfile?.wetsuit_size || 'M')}
                            className='text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline'
                          >
                            + Need to rent suit
                          </button>
                        </div>
                      ) : (
                        <div className='space-y-2 pt-1'>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-0.5'>
                                Cut
                              </label>
                              <select
                                value={wetsuitGender}
                                onChange={e => {
                                  setWetsuitGender(e.target.value);
                                  if (e.target.value === 'WOMEN') setBcdGender('WOMEN');
                                  else if (e.target.value === 'MEN') setBcdGender('MEN');
                                }}
                                className='w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white'
                              >
                                <option value='MEN'>Men / Unisex</option>
                                <option value='WOMEN'>Women</option>
                              </select>
                            </div>
                            <div>
                              <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-0.5'>
                                Rental Size *
                              </label>
                              <select
                                value={wetsuitSize}
                                onChange={e => setWetsuitSize(e.target.value)}
                                className='w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white font-medium'
                              >
                                <option value='XS'>XS</option>
                                <option value='S'>S</option>
                                <option value='M'>M</option>
                                <option value='L'>L</option>
                                <option value='XL'>XL</option>
                                <option value='XXL'>XXL</option>
                              </select>
                            </div>
                          </div>
                          <div className='flex items-center justify-between pt-1'>
                            <span className='text-[10px] text-gray-400'>
                              Thickness: {wetsuitThickness}
                            </span>
                            <button
                              type='button'
                              onClick={() => setWetsuitSize('None')}
                              className='text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline'
                            >
                              I&apos;ll bring my own
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. BCD Card */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        bcdSize === 'None'
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/30'
                      }`}
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-bold text-xs text-gray-900 dark:text-white'>
                          BCD / Buoyancy Wing
                        </span>
                        {bcdSize === 'None' ? (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'>
                            ✓ Bringing Own
                          </span>
                        ) : (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'>
                            Rent from Center
                          </span>
                        )}
                      </div>

                      {bcdSize === 'None' ? (
                        <div className='flex items-center justify-between pt-1'>
                          <span className='text-xs text-gray-500 italic'>
                            No rental BCD needed.
                          </span>
                          <button
                            type='button'
                            onClick={() => setBcdSize(activeProfile?.bcd_size || 'M')}
                            className='text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline'
                          >
                            + Need to rent BCD
                          </button>
                        </div>
                      ) : (
                        <div className='space-y-2 pt-1'>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-0.5'>
                                Cut
                              </label>
                              <select
                                value={bcdGender}
                                onChange={e => setBcdGender(e.target.value)}
                                className='w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white'
                              >
                                <option value='MEN'>Men / Unisex</option>
                                <option value='WOMEN'>Women</option>
                              </select>
                            </div>
                            <div>
                              <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-0.5'>
                                Rental Size *
                              </label>
                              <select
                                value={bcdSize}
                                onChange={e => setBcdSize(e.target.value)}
                                className='w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white font-medium'
                              >
                                <option value='XS'>XS</option>
                                <option value='S'>S</option>
                                <option value='M'>M</option>
                                <option value='L'>L</option>
                                <option value='XL'>XL</option>
                              </select>
                            </div>
                          </div>
                          <div className='flex items-center justify-end pt-1'>
                            <button
                              type='button'
                              onClick={() => setBcdSize('None')}
                              className='text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline'
                            >
                              I&apos;ll bring my own
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Regulator Card */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        !rentalRegulator
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/30'
                      }`}
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-bold text-xs text-gray-900 dark:text-white'>
                          Regulator Set
                        </span>
                        {!rentalRegulator ? (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'>
                            ✓ Bringing Own
                          </span>
                        ) : (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'>
                            Rent from Center
                          </span>
                        )}
                      </div>

                      {!rentalRegulator ? (
                        <div className='space-y-2 pt-1'>
                          <div>
                            <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-0.5'>
                              Your Regulator First Stage Valve *
                            </label>
                            <select
                              value={regulatorFitting}
                              onChange={e => setRegulatorFitting(e.target.value)}
                              className='w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white font-medium'
                            >
                              <option value='DIN'>DIN (G 5/8&quot; Threaded) — Standard</option>
                              <option value='YOKE'>Yoke (INT / A-clamp)</option>
                            </select>
                            <span className='text-[10px] text-gray-400 mt-0.5 block'>
                              Center deck crew will configure your cylinder with matching valve
                              connection.
                            </span>
                          </div>
                          <div className='flex items-center justify-between pt-1'>
                            <span className='text-[10px] text-emerald-600 font-medium'>
                              ✓ Cylinder matched to {regulatorFitting}
                            </span>
                            <button
                              type='button'
                              onClick={() => {
                                setRentalRegulator(true);
                                setRegulatorFitting(
                                  contextData?.center_settings?.default_valve_fitting || 'DIN'
                                );
                              }}
                              className='text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline'
                            >
                              + Rent center regulator
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className='space-y-2 pt-1'>
                          <p className='text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed'>
                            Center provides rental regulator with matched{' '}
                            <strong>
                              {contextData?.center_settings?.default_valve_fitting || 'DIN'}
                            </strong>{' '}
                            valve.
                          </p>
                          <div className='flex items-center justify-end pt-1'>
                            <button
                              type='button'
                              onClick={() => setRentalRegulator(false)}
                              className='text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline'
                            >
                              I&apos;ll bring my own regulator
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Fins & Booties Card */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        finSize === 'None' && bootSize === 'None'
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/30'
                      }`}
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-bold text-xs text-gray-900 dark:text-white'>
                          Fins & Neoprene Boots
                        </span>
                        {finSize === 'None' && bootSize === 'None' ? (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'>
                            ✓ Bringing Own
                          </span>
                        ) : (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'>
                            Rent from Center
                          </span>
                        )}
                      </div>

                      {finSize === 'None' && bootSize === 'None' ? (
                        <div className='flex items-center justify-between pt-1'>
                          <span className='text-xs text-gray-500 italic'>
                            No rental fins needed.
                          </span>
                          <button
                            type='button'
                            onClick={() => {
                              setFinSize('M');
                              setBootSize(shoeSizeEu || '43');
                            }}
                            className='text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline'
                          >
                            + Need to rent fins/boots
                          </button>
                        </div>
                      ) : (
                        <div className='space-y-2 pt-1'>
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-0.5'>
                                Fin Size
                              </label>
                              <select
                                value={finSize}
                                onChange={e => setFinSize(e.target.value)}
                                className='w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white font-medium'
                              >
                                <option value='XS'>XS (EU 35-37)</option>
                                <option value='S'>S (EU 38-40)</option>
                                <option value='M'>M (EU 41-43)</option>
                                <option value='L'>L (EU 44-46)</option>
                                <option value='XL'>XL (EU 47+)</option>
                              </select>
                            </div>
                            <div>
                              <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-0.5'>
                                Booties Size
                              </label>
                              <select
                                value={bootSize}
                                onChange={e => setBootSize(e.target.value)}
                                className='w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white font-medium'
                              >
                                <option value='36'>EU 36</option>
                                <option value='37'>EU 37</option>
                                <option value='38'>EU 38</option>
                                <option value='39'>EU 39</option>
                                <option value='40'>EU 40</option>
                                <option value='41'>EU 41</option>
                                <option value='42'>EU 42</option>
                                <option value='43'>EU 43</option>
                                <option value='44'>EU 44</option>
                                <option value='45'>EU 45</option>
                                <option value='46'>EU 46</option>
                              </select>
                            </div>
                          </div>
                          <div className='flex items-center justify-end pt-1'>
                            <button
                              type='button'
                              onClick={() => {
                                setFinSize('None');
                                setBootSize('None');
                              }}
                              className='text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline'
                            >
                              I&apos;ll bring my own
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 5. Mask Card */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        !rentalMask
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/30'
                      }`}
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-bold text-xs text-gray-900 dark:text-white'>
                          Diving Mask
                        </span>
                        {!rentalMask ? (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'>
                            ✓ Bringing Own
                          </span>
                        ) : (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'>
                            Rent from Center
                          </span>
                        )}
                      </div>

                      {!rentalMask ? (
                        <div className='flex items-center justify-between pt-1'>
                          <span className='text-xs text-gray-500 italic'>
                            No rental mask needed.
                          </span>
                          <button
                            type='button'
                            onClick={() => setRentalMask(true)}
                            className='text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline'
                          >
                            + Need to rent mask
                          </button>
                        </div>
                      ) : (
                        <div className='flex items-center justify-between pt-1'>
                          <span className='text-[11px] text-blue-700 dark:text-blue-300 font-medium'>
                            Rental mask included in crate.
                          </span>
                          <button
                            type='button'
                            onClick={() => setRentalMask(false)}
                            className='text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline'
                          >
                            I&apos;ll bring my own
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 6. Lead Weights & System Card */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        hasOwnLeadWeights
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-100 dark:ring-blue-900/30'
                      }`}
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-bold text-xs text-gray-900 dark:text-white'>
                          Lead Weights & System
                        </span>
                        {hasOwnLeadWeights ? (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'>
                            ✓ Bringing Own
                          </span>
                        ) : (
                          <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'>
                            Rent from Center
                          </span>
                        )}
                      </div>

                      {hasOwnLeadWeights ? (
                        <div className='flex items-center justify-between pt-1'>
                          <span className='text-[11px] text-gray-500'>
                            0 kg lead packed by center.
                          </span>
                          <button
                            type='button'
                            onClick={() => setHasOwnLeadWeights(false)}
                            className='text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline'
                          >
                            + Need center lead
                          </button>
                        </div>
                      ) : (
                        <div className='space-y-2 pt-1'>
                          <div>
                            <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-0.5'>
                              Total Lead Weights (kg)
                            </label>
                            <input
                              type='number'
                              step='0.5'
                              value={leadKg}
                              onChange={e => setLeadKg(e.target.value)}
                              className='w-full px-2 py-1 border border-gray-300 rounded-md text-xs font-mono font-bold'
                            />
                          </div>
                          <div>
                            <label className='block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1'>
                              Weight System (Select one or both)
                            </label>
                            <div className='space-y-1 bg-gray-50 dark:bg-gray-750 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs'>
                              <label className='flex items-center gap-2 cursor-pointer'>
                                <input
                                  type='checkbox'
                                  checked={weightSystems.includes('INTEGRATED')}
                                  onChange={() => handleToggleWeightSystem('INTEGRATED')}
                                  className='rounded text-blue-600'
                                />
                                <span className='text-gray-800 dark:text-gray-200 text-xs'>
                                  Integrated BCD Pockets
                                </span>
                              </label>
                              <label className='flex items-center gap-2 cursor-pointer'>
                                <input
                                  type='checkbox'
                                  checked={weightSystems.includes('BELT')}
                                  onChange={() => handleToggleWeightSystem('BELT')}
                                  className='rounded text-blue-600'
                                />
                                <span className='text-gray-800 dark:text-gray-200 text-xs'>
                                  Weight Belt (Center Rental)
                                </span>
                              </label>
                              <label className='flex items-center gap-2 cursor-pointer'>
                                <input
                                  type='checkbox'
                                  checked={weightSystems.includes('OWN_BELT')}
                                  onChange={() => handleToggleWeightSystem('OWN_BELT')}
                                  className='rounded text-blue-600'
                                />
                                <span className='text-gray-800 dark:text-gray-200 text-xs'>
                                  Bringing Own Weight Belt
                                </span>
                              </label>
                            </div>
                            {weightSystems.includes('INTEGRATED') &&
                              (weightSystems.includes('BELT') ||
                                weightSystems.includes('OWN_BELT')) && (
                                <span className='text-[10px] text-blue-600 dark:text-blue-400 block pt-0.5 italic'>
                                  ✓ Weights split between BCD pockets and weight belt
                                </span>
                              )}
                          </div>
                          <div className='flex items-center justify-end pt-1'>
                            <button
                              type='button'
                              onClick={() => setHasOwnLeadWeights(true)}
                              className='text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline'
                            >
                              I&apos;ll bring my own lead
                            </button>
                          </div>
                        </div>
                      )}
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

                {/* Equipment Gap Breakdown & Valve Guidance */}
                <div className='p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-750 space-y-3.5'>
                  <div className='flex items-center justify-between'>
                    <span className='font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-1.5'>
                      <Sparkles size={14} className='text-blue-600' />
                      Equipment Gap Breakdown
                    </span>
                    <span className='text-[10px] text-gray-400'>
                      Live reconciliation of what you bring vs what the center packs
                    </span>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs'>
                    {/* 🟢 Diver Owned */}
                    <div className='p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-2'>
                      <div className='flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200 text-xs'>
                        <CheckCircle size={14} className='text-emerald-600' />
                        <span>Bringing Your Own Gear (Diver Provided)</span>
                      </div>
                      <ul className='space-y-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 pl-4 list-disc'>
                        {!rentalMask && <li>Own Mask</li>}
                        {wetsuitSize === 'None' ? (
                          <li>Own Wetsuit / Exposure Suit ({wetsuitThickness})</li>
                        ) : null}
                        {bcdSize === 'None' ? <li>Own BCD / Wing</li> : null}
                        {!rentalRegulator ? (
                          <li>
                            Own Regulator (<strong>{regulatorFitting}</strong> connection)
                          </li>
                        ) : null}
                        {finSize === 'None' ? (
                          <li>Own Fins ({finType === 'OPEN_HEEL' ? 'Open-Heel' : 'Full-Foot'})</li>
                        ) : null}
                        {bootSize === 'None' ? <li>Own Booties</li> : null}
                        {!rentalComputer ? <li>Own Personal Dive Computer</li> : null}
                        {!rentalTorch ? <li>Own Primary Dive Torch</li> : null}
                        {hasOwnLeadWeights ? (
                          <li>Own Lead Weights (0 kg needed from center)</li>
                        ) : null}
                      </ul>
                    </div>

                    {/* 🔵 Center Rental */}
                    <div className='p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 space-y-2'>
                      <div className='flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200 text-xs'>
                        <Compass size={14} className='text-blue-600' />
                        <span>Rental Gear Required (Center Provided)</span>
                      </div>
                      <ul className='space-y-1.5 text-[11px] text-blue-800 dark:text-blue-300 pl-4 list-disc'>
                        {rentalMask ? <li>Rental Mask</li> : null}
                        {wetsuitSize !== 'None' ? (
                          <li>
                            Rental Wetsuit (Size {wetsuitSize}, {wetsuitThickness})
                          </li>
                        ) : null}
                        {bcdSize !== 'None' ? <li>Rental BCD (Size {bcdSize})</li> : null}
                        {rentalRegulator ? (
                          <li>Rental Regulator Set (Fitted with {regulatorFitting})</li>
                        ) : null}
                        {finSize !== 'None' ? <li>Rental Fins ({finSize})</li> : null}
                        {bootSize !== 'None' ? <li>Rental Booties (EU {bootSize})</li> : null}
                        {rentalComputer ? <li>Rental Wrist Dive Computer</li> : null}
                        {rentalTorch ? <li>Rental Primary Dive Torch</li> : null}
                        {!hasOwnLeadWeights ? (
                          <li>
                            Center Lead Weights: {leadKg || '4.0'} kg (
                            {weightSystems.includes('INTEGRATED') &&
                            (weightSystems.includes('BELT') || weightSystems.includes('OWN_BELT'))
                              ? 'Split BCD Pockets & Belt'
                              : weightSystems.includes('OWN_BELT')
                                ? 'Loaded into Diver Belt'
                                : weightSystems.includes('BELT')
                                  ? 'Traditional Weight Belt'
                                  : 'BCD Pockets'}
                            )
                          </li>
                        ) : null}
                      </ul>
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
                        <div className='flex items-center gap-2'>
                          <span className='text-xs font-bold text-gray-900 dark:text-white block'>
                            I need daily insurance from the dive center
                          </span>
                          {Number(contextData?.center_settings?.daily_insurance_price || 0) > 0 ? (
                            <span className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'>
                              +€
                              {Number(contextData?.center_settings?.daily_insurance_price).toFixed(
                                2
                              )}
                              /day
                            </span>
                          ) : (
                            <span className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'>
                              Included
                            </span>
                          )}
                        </div>
                        <span className='text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5'>
                          Short-term accident & chamber cover arranged at counter on arrival.
                        </span>
                      </div>
                    </label>
                  </div>

                  {hasInsurance === 'OWN' ? (
                    <div className='space-y-3 pt-2 border-t border-gray-200 dark:border-gray-600'>
                      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                        <div>
                          <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                            Insurance Provider *
                          </label>
                          <input
                            type='text'
                            value={insuranceProvider}
                            onChange={e => setInsuranceProvider(e.target.value)}
                            placeholder='e.g. DAN Europe'
                            required
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-800 ${
                              !insuranceProvider.trim()
                                ? 'border-amber-300 bg-amber-50/20'
                                : 'border-gray-300'
                            }`}
                          />
                        </div>
                        <div>
                          <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                            Policy / Member Number *
                          </label>
                          <input
                            type='text'
                            value={insurancePolicyNumber}
                            onChange={e => setInsurancePolicyNumber(e.target.value)}
                            placeholder='e.g. 12345678'
                            required
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-800 ${
                              !insurancePolicyNumber.trim()
                                ? 'border-amber-300 bg-amber-50/20'
                                : 'border-gray-300'
                            }`}
                          />
                        </div>
                        <div>
                          <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                            Expiration Date *
                          </label>
                          <input
                            ref={insuranceDateRef}
                            type='date'
                            value={insuranceExpiryDate}
                            onChange={e => setInsuranceExpiryDate(e.target.value)}
                            onInput={e => setInsuranceExpiryDate(e.target.value)}
                            onBlur={e => setInsuranceExpiryDate(e.target.value)}
                            required
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-800 ${
                              !insuranceExpiryDate || isInsuranceExpired
                                ? 'border-rose-300 bg-rose-50/20'
                                : 'border-gray-300'
                            }`}
                          />
                        </div>
                      </div>

                      {isInsuranceExpired && (
                        <div className='p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5'>
                          <AlertCircle className='w-4 h-4 text-rose-600 shrink-0 mt-0.5' />
                          <div>
                            <strong className='font-bold block'>Insurance Policy Expired</strong>
                            <span>
                              Your insurance policy expired on{' '}
                              <strong>{insuranceExpiryDate}</strong>. You cannot proceed with an
                              expired policy. Please enter an active future expiration date, or
                              choose{' '}
                              <button
                                type='button'
                                onClick={() => setHasInsurance('CENTER')}
                                className='underline font-bold text-rose-900 dark:text-rose-100 hover:text-blue-600'
                              >
                                "I need daily insurance from the dive center"
                              </button>
                              .
                            </span>
                          </div>
                        </div>
                      )}
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

                {contextData?.user_annual_medical?.has_record &&
                  !contextData.user_annual_medical.is_expired && (
                    <div className='p-5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3.5'>
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <div className='flex items-center gap-2'>
                            <span className='font-bold text-sm text-blue-950 dark:text-blue-100 flex items-center gap-1.5'>
                              <CheckCircle size={16} className='text-emerald-600' />
                              Annual Medical Declaration on File (DMSC 2020)
                            </span>
                            <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'>
                              Valid for {contextData.user_annual_medical.days_remaining} days
                            </span>
                          </div>
                          <p className='text-xs text-blue-800 dark:text-blue-300 mt-1'>
                            Completed on {formatDate(contextData.user_annual_medical.completed_at)}.
                            Medical declarations are valid for 1 year across all dive centers on
                            Divemap, provided your health status has not changed.
                          </p>
                        </div>
                      </div>

                      {contextData.user_annual_medical.status === 'CLEARED' ||
                      contextData.user_annual_medical.center_approved ? (
                        <div className='space-y-2 pt-1 border-t border-blue-100 dark:border-blue-900/50'>
                          <label className='flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 cursor-pointer shadow-xs'>
                            <input
                              type='radio'
                              name='annualMedicalChoice'
                              checked={useAnnualMedical}
                              onChange={() => {
                                setUseAnnualMedical(true);
                                setConfirmNoMedicalChange(true);
                                setMedicalStatus(
                                  contextData.user_annual_medical.status === 'CLEARED'
                                    ? 'CLEARED'
                                    : 'PHYSICIAN_APPROVED'
                                );
                              }}
                              className='mt-1 text-blue-600'
                            />
                            <div>
                              <span className='font-bold text-xs text-gray-900 dark:text-white block'>
                                No Change in Medical Condition (Fast-Track)
                              </span>
                              <span className='text-[11px] text-gray-600 dark:text-gray-300 block leading-relaxed'>
                                I affirmatively certify that my physical health and medical
                                condition have not changed since my declaration on{' '}
                                {formatDate(contextData.user_annual_medical.completed_at)}.
                              </span>
                            </div>
                          </label>

                          <label className='flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 cursor-pointer'>
                            <input
                              type='radio'
                              name='annualMedicalChoice'
                              checked={!useAnnualMedical}
                              onChange={() => {
                                setUseAnnualMedical(false);
                                setConfirmNoMedicalChange(false);
                                setMedicalStatus('PENDING');
                                setMedicalModalOpen(true);
                              }}
                              className='mt-1 text-blue-600'
                            />
                            <div>
                              <span className='font-bold text-xs text-gray-900 dark:text-white block'>
                                My Health Status Has Changed
                              </span>
                              <span className='text-[11px] text-gray-500 dark:text-gray-400 block leading-relaxed'>
                                I have developed a new condition, had surgery, or started new
                                prescription medication. I need to re-answer the questionnaire.
                              </span>
                            </div>
                          </label>
                        </div>
                      ) : (
                        <div className='p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs space-y-1 text-amber-900 dark:text-amber-200'>
                          <span className='font-bold block'>
                            ⚠️ Screening Flagged — Center Manager Review Required
                          </span>
                          <span className='text-[11px] block text-amber-800 dark:text-amber-300 leading-relaxed'>
                            Your annual questionnaire noted conditions requiring physician
                            clearance. Each diving center independently reviews your physician
                            approval. Your reservation will be held on Medical Review status.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

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

                {/* Fast Checkout Option */}
                <div className='p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl flex items-start gap-3'>
                  <input
                    id='remember-device-toggle-step5'
                    type='checkbox'
                    checked={rememberOnThisDevice}
                    onChange={e => handleToggleRemember(e.target.checked)}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0 cursor-pointer'
                  />
                  <div className='text-xs'>
                    <label
                      htmlFor='remember-device-toggle-step5'
                      className='font-bold text-gray-900 dark:text-white cursor-pointer block'
                    >
                      Remember my details on this device for faster checkout
                    </label>
                    <span className='text-gray-500 dark:text-gray-400 block mt-0.5 leading-relaxed'>
                      Saves contact information, equipment sizing, emergency contacts, and insurance
                      locally in browser cookies for future bookings.
                    </span>
                  </div>
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
                    disabled={submitting || !waiverSignature || (!useAnnualMedical && !dmscAnswers)}
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
                {/* STEP 1 FIELDS: TIER, DIVER NAME, CONTACT, DOB, CERTIFICATION */}
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Tier:</span>
                  <span className='font-semibold text-gray-900 dark:text-white text-right max-w-[170px] truncate'>
                    {selectedUnit?.title}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Diver Name:</span>
                  <span
                    className={`font-semibold text-right max-w-[150px] truncate ${
                      diverName
                        ? 'text-gray-900 dark:text-white'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {diverName || 'Required'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Contact / ID:</span>
                  <span
                    className={`font-semibold ${
                      hasContactOrId
                        ? 'text-gray-900 dark:text-white'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {hasContactOrId ? 'Provided' : '1 Required'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Date of Birth:</span>
                  <span
                    className={`font-semibold ${
                      dateOfBirth
                        ? 'text-gray-900 dark:text-white'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {dateOfBirth || 'Required'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Certification:</span>
                  <span
                    className={`font-semibold text-right max-w-[160px] truncate ${
                      hasCertDetails
                        ? 'text-gray-900 dark:text-white'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                    title={hasCertDetails ? `${certAgency} ${certLevel}` : 'Required'}
                  >
                    {hasCertDetails ? `${certAgency} ${certLevel}` : 'Required'}
                  </span>
                </div>

                {/* STEP 2 FIELDS: EQUIPMENT ALLOCATION */}
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Tank / Gas:</span>
                  <span
                    className={`font-semibold text-right ${
                      currentStep > 1
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {currentStep > 1
                      ? `${selectedTankId}L • ${selectedGasMixId.toUpperCase()} (${regulatorFitting})`
                      : 'Configure in Step 2'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Lead Weights:</span>
                  <span
                    className={`font-semibold text-right ${
                      currentStep > 1
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {currentStep > 1
                      ? hasOwnLeadWeights
                        ? '0 kg (Own Lead)'
                        : `${leadKg} kg (${
                            weightSystems.includes('INTEGRATED') &&
                            (weightSystems.includes('BELT') || weightSystems.includes('OWN_BELT'))
                              ? 'Split Pockets & Belt'
                              : weightSystems.includes('OWN_BELT')
                                ? 'Own Belt'
                                : weightSystems.includes('BELT')
                                  ? 'Belt'
                                  : 'Pockets'
                          })`
                      : 'Configure in Step 2'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Wetsuit & BCD:</span>
                  <span
                    className={`font-semibold text-right ${
                      currentStep > 1
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {currentStep > 1
                      ? `${
                          wetsuitSize === 'None'
                            ? 'Own Suit'
                            : `${wetsuitGender === 'WOMEN' ? "Women's" : "Men's"} ${wetsuitSize}`
                        } • ${
                          bcdSize === 'None'
                            ? 'Own BCD'
                            : `${bcdGender === 'WOMEN' ? "Women's" : "Men's"} BCD ${bcdSize}`
                        }`
                      : 'Configure in Step 2'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Fins & Boots:</span>
                  <span
                    className={`font-semibold text-right ${
                      currentStep > 1
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {currentStep > 1
                      ? `${
                          finSize === 'None' && bootSize === 'None'
                            ? 'Own Fins & Boots'
                            : `${finSize === 'None' ? 'Own Fins' : `Fins ${finSize}`} • ${
                                bootSize === 'None' ? 'Own Boots' : `Boots EU ${bootSize}`
                              }`
                        }`
                      : 'Configure in Step 2'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Dive Computer:</span>
                  <span
                    className={`font-semibold text-right ${
                      currentStep > 1
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {currentStep > 1
                      ? rentalComputer
                        ? 'Rental Wrist Unit'
                        : 'Own Computer'
                      : 'Configure in Step 2'}
                  </span>
                </div>
                {rentalTorch && currentStep > 1 && (
                  <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                    <span>Rental Light:</span>
                    <span className='font-semibold text-gray-900 dark:text-white'>
                      Primary Dive Torch Included
                    </span>
                  </div>
                )}

                {/* STEP 3 FIELDS: EMERGENCY & INSURANCE */}
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Emergency Contact:</span>
                  <span
                    className={`font-semibold text-right max-w-[150px] truncate ${
                      emergencyContactName && emergencyContactPhone
                        ? 'text-gray-900 dark:text-white'
                        : currentStep >= 3
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}
                    title={
                      emergencyContactName
                        ? `${emergencyContactName} (${emergencyContactPhone})`
                        : currentStep >= 3
                          ? 'Required'
                          : 'Configure in Step 3'
                    }
                  >
                    {emergencyContactName && emergencyContactPhone
                      ? emergencyContactName
                      : currentStep >= 3
                        ? 'Required'
                        : 'Pending Step 3'}
                  </span>
                </div>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Dive Insurance:</span>
                  <span
                    className={`font-semibold text-right max-w-[150px] truncate ${
                      hasInsurance === 'CENTER' || insuranceProvider
                        ? 'text-gray-900 dark:text-white'
                        : currentStep >= 3
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {hasInsurance === 'CENTER'
                      ? 'Center Daily'
                      : insuranceProvider
                        ? insuranceProvider
                        : currentStep >= 3
                          ? 'Required'
                          : 'Pending Step 3'}
                  </span>
                </div>

                {/* STEP 4 FIELD: MEDICAL */}
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Medical:</span>
                  <span
                    className={`font-semibold ${
                      medicalStatus === 'CLEARED'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : currentStep >= 4
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {medicalStatus === 'CLEARED'
                      ? 'Cleared'
                      : medicalStatus === 'FLAGGED_CONTACT_CENTER'
                        ? 'Flagged'
                        : currentStep >= 4
                          ? 'Pending Action'
                          : 'Pending Step 4'}
                  </span>
                </div>

                {/* STEP 5 FIELD: WAIVER */}
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Waiver:</span>
                  <span
                    className={`font-semibold ${
                      waiverSignature
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : currentStep >= 5
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {waiverSignature
                      ? 'Signed'
                      : currentStep >= 5
                        ? 'Pending Signature'
                        : 'Pending Step 5'}
                  </span>
                </div>
              </div>

              {/* Itemized Price Breakdown */}
              <div className='pt-3 pb-3 border-b border-gray-100 dark:border-gray-700 text-xs space-y-2'>
                <div className='flex justify-between text-gray-600 dark:text-gray-400'>
                  <span>Base Dive Trip:</span>
                  <span className='font-mono font-semibold text-gray-900 dark:text-white'>
                    €{rentalCalculation.basePrice.toFixed(2)}
                  </span>
                </div>

                {rentalCalculation.rentalItems.length > 0 && (
                  <div className='space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-700/60'>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block'>
                      Equipment Rental Surcharges:
                    </span>
                    {rentalCalculation.rentalItems.map((item, idx) => (
                      <div
                        key={idx}
                        className='flex justify-between text-gray-600 dark:text-gray-400 pl-2'
                      >
                        <span className='truncate'>{item.label}:</span>
                        <span className='font-mono text-blue-600 dark:text-blue-400 shrink-0'>
                          +€{item.price.toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {rentalCalculation.isPackageApplied && (
                      <div className='p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded text-[10px] text-blue-800 dark:text-blue-300 font-medium'>
                        ✓ Full Equipment Rental Package rate applied
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Total Due */}
              <div className='pt-3 pb-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-baseline'>
                <div>
                  <span className='text-sm font-bold text-gray-900 dark:text-white uppercase block'>
                    Total Due
                  </span>
                  <span className='text-[10px] text-gray-400'>Pay on arrival at center</span>
                </div>
                <span className='text-2xl font-bold font-mono text-blue-600 dark:text-blue-400'>
                  €{rentalCalculation.totalDue.toFixed(2)}
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
                    disabled={submitting || !waiverSignature || (!useAnnualMedical && !dmscAnswers)}
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
        center={contextData?.center}
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
