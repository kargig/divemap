import React, { useMemo } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import './MarkdownEditor.css';

const MarkdownEditor = ({ value, onChange, label, error, placeholder, minHeight = '200px' }) => {
  const options = useMemo(
    () => ({
      spellChecker: false,
      status: false,
      minHeight,
      placeholder: placeholder || 'Write something amazing...',
      toolbar: [
        'bold',
        'italic',
        'heading',
        '|',
        'quote',
        'unordered-list',
        'ordered-list',
        '|',
        'link',
        'image',
        '|',
        'preview',
        'fullscreen',
        '|',
        'guide',
      ],
      // Force preview to use our styles if possible, but SimpleMDE's preview is usually a simple div
    }),
    [placeholder, minHeight]
  );

  return (
    <div className='markdown-editor-wrapper'>
      {label && (
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
          {label}
        </label>
      )}
      <div className={error ? 'border border-red-500 rounded-md' : ''}>
        <SimpleMDE value={value} onChange={onChange} options={options} />
      </div>
      {error && <p className='mt-1 text-sm text-red-600'>{error}</p>}
    </div>
  );
};

export default MarkdownEditor;
