import { CheckCircle, Search, Sparkles } from 'lucide-react';
import React from 'react';

const MatchTypeBadge = ({ matchType, score, className = '' }) => {
  if (!matchType) return null;

  const getBadgeConfig = (type, score) => {
    const percentage = score ? Math.round(score * 100) : 0;
    
    switch (type) {
      case 'exact':
      case 'exact_phrase':
        return {
          icon: CheckCircle,
          text: `Match: ${percentage}%`,
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          iconColor: 'text-green-600',
        };
      case 'exact_words':
        return {
          icon: CheckCircle,
          text: `Match: ${percentage}%`,
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          iconColor: 'text-green-600',
        };
      case 'partial':
      case 'partial_words':
        return {
          icon: Search,
          text: `Match: ${percentage}%`,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-600',
        };
      case 'close':
      case 'similar':
        return {
          icon: Sparkles,
          text: `Match: ${percentage}%`,
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-600',
        };
      case 'fuzzy':
        return {
          icon: Sparkles,
          text: `Match: ${percentage}%`,
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          borderColor: 'border-orange-200',
          iconColor: 'text-orange-600',
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig(matchType, score);
  if (!config) return null;

  const IconComponent = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
      title={`Match type: ${matchType}${score ? ` (Score: ${Math.round(score * 100)}%)` : ''}`}
    >
      <IconComponent className={`w-2.5 h-2.5 ${config.iconColor}`} />
      <span>{config.text}</span>
    </div>
  );
};

export default MatchTypeBadge;
