import { Modal } from 'antd';
import { Shield, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useState } from 'react';

const QUESTIONS = [
  {
    id: 'q1',
    text: 'I have had problems with my lungs/breathing, heart, or blood affecting my normal physical or mental performance.',
    box: 'box_a',
  },
  {
    id: 'q2',
    text: 'I am over 45 years of age and smoke, have high cholesterol, high blood pressure, or a family history of heart disease.',
    box: 'box_b',
  },
  {
    id: 'q3',
    text: 'I struggle to perform moderate exercise (e.g. walking 1 mile in 14 minutes or swimming 200m without resting).',
    directFlag: true,
  },
  {
    id: 'q4',
    text: 'I have had problems with my eyes, ears, or nasal passages/sinuses.',
    box: 'box_f',
  },
  {
    id: 'q5',
    text: 'I have had surgery within the last 12 months, or have ongoing problems related to past surgery.',
    directFlag: true,
  },
  {
    id: 'q6',
    text: 'I have lost consciousness, had migraines, seizures, stroke, significant head injury, or neurological disease.',
    box: 'box_d',
  },
  {
    id: 'q7',
    text: 'I am currently undergoing treatment for psychological problems, panic attacks, anxiety, or addiction.',
    box: 'box_e',
  },
  { id: 'q8', text: 'I have had back problems, hernia, ulcers, or diabetes.', box: 'box_c' },
  {
    id: 'q9',
    text: 'I have had stomach or intestine problems, including recent diarrhea.',
    box: 'box_g',
  },
  {
    id: 'q10',
    text: 'I am taking prescription medications (excluding standard birth control or non-mefloquine malaria prophylaxis).',
    directFlag: true,
  },
];

const MedicalQuestionnaireModal = ({ isOpen, onClose, onCompleted, initialAnswers }) => {
  const [answers, setAnswers] = useState(() => initialAnswers || {});
  const [boxAnswers, setBoxAnswers] = useState({});

  const handleToggle = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const hasAnyYes = Object.values(answers).some(v => v === true);
  const isComplete = QUESTIONS.every(q => answers[q.id] !== undefined);

  const handleSubmit = e => {
    e.preventDefault();
    if (!isComplete) return;

    // Combine primary and box answers
    const fullAnswers = { ...answers, boxes: boxAnswers };
    onCompleted(fullAnswers, hasAnyYes ? 'FLAGGED_CONTACT_CENTER' : 'CLEARED');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div className='flex items-center gap-2.5 pb-2 border-b'>
          <Shield className='h-5 w-5 text-blue-600' />
          <div>
            <h3 className='text-base font-bold text-gray-900'>
              Diver Medical Screening (DMSC 2020)
            </h3>
            <p className='text-xs text-gray-500 font-normal'>
              Standardized international diver screening (UHMS / DAN / WRSTC). Encrypted under GDPR
              Article 9.
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className='pt-3 space-y-4 max-h-[72vh] overflow-y-auto pr-1'>
        {/* Privacy & Encryption Notice */}
        <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2'>
          <Lock className='h-4 w-4 shrink-0 mt-0.5 text-blue-600' />
          <span>
            Your medical responses are protected by zero-knowledge envelope encryption
            (AES-256-GCM). Dive center staff will only see your overall clearance status badge.
          </span>
        </div>

        {/* Questions List */}
        <div className='space-y-3'>
          {QUESTIONS.map((q, idx) => {
            const val = answers[q.id];
            return (
              <div
                key={q.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  val === true
                    ? 'border-amber-300 bg-amber-50/50'
                    : val === false
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex items-start gap-2.5'>
                    <span className='font-bold text-xs text-gray-400 font-mono mt-0.5'>
                      {idx + 1}.
                    </span>
                    <p className='text-xs sm:text-sm text-gray-800 font-medium leading-relaxed'>
                      {q.text}
                    </p>
                  </div>
                  <div className='flex items-center gap-1.5 shrink-0'>
                    <button
                      type='button'
                      onClick={() => handleToggle(q.id, false)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        val === false
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      NO
                    </button>
                    <button
                      type='button'
                      onClick={() => handleToggle(q.id, true)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        val === true
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      YES
                    </button>
                  </div>
                </div>

                {val === true && (
                  <div className='mt-2.5 pt-2 border-t border-amber-200 text-xs text-amber-800 flex items-center gap-1.5'>
                    <AlertTriangle size={13} className='shrink-0 text-amber-600' />
                    <span>
                      {q.directFlag
                        ? 'Requires written physician evaluation before participating in scuba diving.'
                        : 'Diagnostic screening flagged. Your seat will be held while you contact the dive center.'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Screening Result Banner */}
        {isComplete && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-3 ${
              hasAnyYes
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            {hasAnyYes ? (
              <>
                <AlertTriangle className='h-5 w-5 text-amber-600 shrink-0' />
                <div className='text-xs'>
                  <strong className='block font-bold text-sm'>
                    Physician / Center Review Required
                  </strong>
                  Your answers indicate a medical flag. Your reservation will be placed on hold, and
                  you will be asked to contact the dive center or upload a physician approval form.
                </div>
              </>
            ) : (
              <>
                <CheckCircle className='h-5 w-5 text-emerald-600 shrink-0' />
                <div className='text-xs'>
                  <strong className='block font-bold text-sm'>
                    Instant Digital Clearance (Clean)
                  </strong>
                  All 10 screening questions answered negatively. You are clinically cleared for
                  immediate participation.
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className='flex items-center justify-end gap-3 pt-3 border-t'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={!isComplete}
            className='px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed'
          >
            Confirm & Proceed to Waiver
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MedicalQuestionnaireModal;
