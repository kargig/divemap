import DOMPurify from 'dompurify';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { decodeHtmlEntities } from '../../utils/htmlDecode';
import './RichText.css';

const RichText = ({ content, className = '' }) => {
  if (!content) return null;

  // 1. Decode entities (legacy data might be double encoded or contain &nbsp; etc)
  const decoded = decodeHtmlEntities(content);

  // 2. Sanitize with strict settings
  const sanitized = DOMPurify.sanitize(decoded, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'a',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'hr',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target'], // NO 'style' or 'class'
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i, // Prevent javascript: URIs
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'class', 'onerror', 'onload', 'onmouseover'],
  });

  return (
    <div className={`rich-text prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{sanitized}</ReactMarkdown>
    </div>
  );
};

export default RichText;
