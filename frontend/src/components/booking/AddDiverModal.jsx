import { Modal } from 'antd';
import { UserPlus, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import api from '../../api';

import DateOfBirthPicker from './DateOfBirthPicker';

const AddDiverModal = ({ isOpen, onClose, onDiverAdded, centerId, tripId }) => {
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [availableLevels, setAvailableLevels] = useState([]);

  // Form state
  const [diverName, setDiverName] = useState('');
  const [diverEmail, setDiverEmail] = useState('');
  const [diverPhone, setDiverPhone] = useState('');
  const [nationality, setNationality] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [dob, setDob] = useState('');

  const [agency, setAgency] = useState('PADI');
  const [certLevel, setCertLevel] = useState('Open Water');
  const [certNumber, setCertNumber] = useState('');

  const [tankId, setTankId] = useState('12');
  const [gasMixId, setGasMixId] = useState('air');
  const [regulatorFitting, setRegulatorFitting] = useState('DIN');
  const [leadKg, setLeadKg] = useState('4.0');
  const [weightSystem, setWeightSystem] = useState('INTEGRATED');

  const [wetsuitGender, setWetsuitGender] = useState('MEN');
  const [wetsuitSize, setWetsuitSize] = useState('None');
  const [wetsuitThickness, setWetsuitThickness] = useState('5mm');
  const [bcdGender, setBcdGender] = useState('MEN');
  const [bcdSize, setBcdSize] = useState('None');
  const [finSize, setFinSize] = useState('None');
  const [bootSize, setBootSize] = useState('None');
  const [shoeSizeEu, setShoeSizeEu] = useState('43');
  const [rentalComputer, setRentalComputer] = useState(false);
  const [rentalTorch, setRentalTorch] = useState(false);

  const [markPaid, setMarkPaid] = useState(true);
  const [boarded, setBoarded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api
        .get('/api/v1/diving-organizations/?limit=100')
        .then(res => setOrganizations(res.data || []))
        .catch(() => setOrganizations([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!agency || organizations.length === 0) {
      setAvailableLevels([]);
      return;
    }
    const matched = organizations.find(
      o =>
        o.acronym?.toLowerCase() === agency.toLowerCase() ||
        o.name?.toLowerCase() === agency.toLowerCase()
    );
    if (matched) {
      api
        .get(`/api/v1/diving-organizations/${matched.id}/levels?main_only=true`)
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
        })
        .catch(() => setAvailableLevels([]));
    } else {
      setAvailableLevels([]);
    }
  }, [agency, organizations]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!diverName.trim()) {
      toast.error('Please enter diver legal full name.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        diver_full_name: diverName.trim(),
        diver_email: diverEmail.trim() || undefined,
        diver_phone: diverPhone.trim() || undefined,
        diver_nationality: nationality.trim() || undefined,
        passport_number: passportNumber.trim() || undefined,
        date_of_birth: dob || undefined,
        certification_agency: agency,
        certification_level: certLevel,
        certification_number: certNumber.trim() || undefined,
        selected_tank_id: tankId,
        selected_gas_mix_id: gasMixId,
        equipment_sizing: {
          regulator_fitting: regulatorFitting,
          weight_system: weightSystem,
          wetsuit_gender: wetsuitGender,
          wetsuit_size: wetsuitSize === 'None' ? null : wetsuitSize,
          wetsuit_thickness: wetsuitThickness,
          bcd_gender: bcdGender,
          bcd_size: bcdSize === 'None' ? null : bcdSize,
          fin_size: finSize === 'None' ? null : finSize,
          boot_size: bootSize === 'None' ? null : bootSize,
          rental_fins: finSize !== 'None',
          has_own_fins: finSize === 'None',
          rental_boots: bootSize !== 'None',
          has_own_boots: bootSize === 'None',
          shoe_size_eu: parseFloat(shoeSizeEu) || 43,
          rental_dive_computer: rentalComputer,
          has_own_dive_computer: !rentalComputer,
          rental_torch: rentalTorch,
          estimated_lead_kg: parseFloat(leadKg) || 0,
        },
        mark_as_paid: markPaid,
        onboard_checkin_status: boarded,
      };

      const res = await api.post(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants`,
        payload
      );

      toast.success(`Registered ${res.data.diver_full_name} for this trip!`);
      onDiverAdded();
      onClose();
    } catch (err) {
      console.error('Failed to add walk-in diver:', err);
      toast.error(err.response?.data?.detail || 'Failed to register walk-in diver.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div className='flex items-center gap-2 pb-2 border-b'>
          <UserPlus className='h-5 w-5 text-blue-600' />
          <div>
            <h3 className='text-base font-bold text-gray-900 dark:text-white'>
              Register Walk-In Diver
            </h3>
            <p className='text-xs text-gray-500 font-normal'>
              Add a walk-in diver at the desk to reserve their seat and record equipment
              requirements.
            </p>
          </div>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        className='pt-3 space-y-4 max-h-[72vh] overflow-y-auto pr-1 text-xs'
      >
        {/* Contact & Personal Details */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <div>
            <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
              Full Legal Name *
            </label>
            <input
              type='text'
              value={diverName}
              onChange={e => setDiverName(e.target.value)}
              placeholder='As shown on passport'
              required
              className='w-full px-3 py-2 border rounded-lg text-xs'
            />
          </div>
          <div>
            <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
              Email Address
            </label>
            <input
              type='email'
              value={diverEmail}
              onChange={e => setDiverEmail(e.target.value)}
              placeholder='diver@example.com'
              className='w-full px-3 py-2 border rounded-lg text-xs'
            />
          </div>
          <div>
            <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
              Phone / WhatsApp
            </label>
            <input
              type='tel'
              value={diverPhone}
              onChange={e => setDiverPhone(e.target.value)}
              placeholder='+30 ...'
              className='w-full px-3 py-2 border rounded-lg text-xs'
            />
          </div>
          <div>
            <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
              Passport / National ID #
            </label>
            <input
              type='text'
              value={passportNumber}
              onChange={e => setPassportNumber(e.target.value)}
              placeholder='Port Authority Manifest ID'
              className='w-full px-3 py-2 border rounded-lg text-xs'
            />
          </div>
          <div>
            <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
              Nationality
            </label>
            <input
              type='text'
              value={nationality}
              onChange={e => setNationality(e.target.value)}
              placeholder='e.g. Greek, German, British'
              className='w-full px-3 py-2 border rounded-lg text-xs'
            />
          </div>
          <DateOfBirthPicker value={dob} onChange={setDob} label='Date of Birth' />
        </div>

        {/* Certification Details */}
        <div className='pt-3 border-t'>
          <h4 className='font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] mb-2'>
            Certification Credentials
          </h4>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
            <div>
              <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                Agency
              </label>
              <select
                value={agency}
                onChange={e => setAgency(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.acronym || org.name}>
                    {org.acronym} — {org.name}
                  </option>
                ))}
                <option value='Other'>Other</option>
              </select>
            </div>
            <div>
              <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                Certification Level
              </label>
              {availableLevels.length > 0 ? (
                <select
                  value={certLevel}
                  onChange={e => setCertLevel(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
                >
                  {availableLevels.map(lvl => (
                    <option key={lvl.id} value={lvl.name}>
                      {lvl.name}
                    </option>
                  ))}
                  <option value='Open Water'>Open Water (Generic)</option>
                </select>
              ) : (
                <input
                  type='text'
                  value={certLevel}
                  onChange={e => setCertLevel(e.target.value)}
                  placeholder='e.g. Advanced Open Water'
                  className='w-full px-2 py-1.5 border rounded-lg text-xs'
                />
              )}
            </div>
            <div>
              <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                Certification Card # (Physical or App)
              </label>
              <input
                type='text'
                value={certNumber}
                onChange={e => setCertNumber(e.target.value)}
                placeholder='Card or digital app ID number'
                className='w-full px-2 py-1.5 border rounded-lg text-xs'
              />
            </div>
          </div>
        </div>

        {/* Cylinder & Equipment Sizing */}
        <div className='pt-3 border-t'>
          <h4 className='font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] mb-2'>
            Cylinder & Gear Sizing
          </h4>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Cylinder</label>
              <select
                value={tankId}
                onChange={e => setTankId(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
              >
                <option value='12'>12L Steel</option>
                <option value='15'>15L Steel</option>
                <option value='al80'>AL80 (11L Alu)</option>
                <option value='10'>10L Steel</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Gas Mix</label>
              <select
                value={gasMixId}
                onChange={e => setGasMixId(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white font-medium'
              >
                <option value='air'>Air (21% O2) — Standard</option>
                <option value='ean32'>EAN32 (32% O2 Nitrox) — Requires Cert</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Valve Fitting</label>
              <select
                value={regulatorFitting}
                onChange={e => setRegulatorFitting(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white font-medium'
              >
                <option value='DIN'>DIN (5/8" Threaded)</option>
                <option value='YOKE'>Yoke (INT / A-clamp)</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Lead (kg)</label>
              <input
                type='number'
                step='0.5'
                value={leadKg}
                onChange={e => setLeadKg(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs'
              />
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Weight System</label>
              <select
                value={weightSystem}
                onChange={e => setWeightSystem(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white font-medium'
              >
                <option value='INTEGRATED'>Integrated Pockets</option>
                <option value='BELT'>Weight Belt</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Wetsuit Cut</label>
              <select
                value={wetsuitGender}
                onChange={e => setWetsuitGender(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white font-medium'
              >
                <option value='MEN'>Men's / Unisex</option>
                <option value='WOMEN'>Women's</option>
                <option value='OTHER'>Other / Custom</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Wetsuit Size</label>
              <select
                value={wetsuitSize}
                onChange={e => setWetsuitSize(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
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
              <label className='block font-medium text-gray-600 mb-1'>Wetsuit Thickness</label>
              <select
                value={wetsuitThickness}
                onChange={e => setWetsuitThickness(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
              >
                <option value='3mm'>3mm</option>
                <option value='5mm'>5mm</option>
                <option value='7mm'>7mm</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>BCD Cut</label>
              <select
                value={bcdGender}
                onChange={e => setBcdGender(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white font-medium'
              >
                <option value='MEN'>Men's / Unisex</option>
                <option value='WOMEN'>Women's</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>BCD Size</label>
              <select
                value={bcdSize}
                onChange={e => setBcdSize(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
              >
                <option value='None'>None (Own BCD)</option>
                <option value='XS'>XS</option>
                <option value='S'>S</option>
                <option value='M'>M</option>
                <option value='L'>L</option>
                <option value='XL'>XL</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Rental Fins</label>
              <select
                value={finSize}
                onChange={e => setFinSize(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white font-medium'
              >
                <option value='None'>None (Own Fins)</option>
                <option value='XS'>XS (EU 35-37)</option>
                <option value='S'>S (EU 38-40)</option>
                <option value='M'>M (EU 41-43)</option>
                <option value='L'>L (EU 44-46)</option>
                <option value='XL'>XL (EU 47+)</option>
              </select>
            </div>
            <div>
              <label className='block font-medium text-gray-600 mb-1'>Booties Size</label>
              <select
                value={bootSize}
                onChange={e => setBootSize(e.target.value)}
                className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
              >
                <option value='None'>None (Own Booties)</option>
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

          <div className='flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100 text-xs text-gray-700'>
            <label className='flex items-center gap-1.5 cursor-pointer font-medium text-blue-700'>
              <input
                type='checkbox'
                checked={rentalComputer}
                onChange={e => setRentalComputer(e.target.checked)}
                className='rounded text-blue-600'
              />
              <span>Rent Dive Computer (Wrist Unit)</span>
            </label>

            <label className='flex items-center gap-1.5 cursor-pointer font-medium text-amber-700'>
              <input
                type='checkbox'
                checked={rentalTorch}
                onChange={e => setRentalTorch(e.target.checked)}
                className='rounded text-blue-600'
              />
              <span>Rent Primary Dive Torch</span>
            </label>
          </div>
        </div>

        {/* Counter Check-in & Payment Checkboxes */}
        <div className='p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={markPaid}
              onChange={e => setMarkPaid(e.target.checked)}
              className='rounded text-blue-600 h-4 w-4'
            />
            <span className='font-semibold text-gray-800 dark:text-gray-200'>
              Mark Paid at Counter (Cash/Card Succeeded)
            </span>
          </label>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={boarded}
              onChange={e => setBoarded(e.target.checked)}
              className='rounded text-blue-600 h-4 w-4'
            />
            <span className='font-semibold text-gray-800 dark:text-gray-200'>
              Diver has Boarded Boat
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className='flex items-center justify-end gap-3 pt-3 border-t'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={loading}
            className='flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50'
          >
            {loading ? <Loader2 size={15} className='animate-spin' /> : <UserPlus size={15} />}
            Confirm Walk-In Diver
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddDiverModal;
