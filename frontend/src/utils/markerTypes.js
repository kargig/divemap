import {
  MapPin,
  Hexagon,
  Warehouse,
  Anchor,
  Fish,
  AlertTriangle,
  Flower2,
  Square,
  MoveHorizontal,
  Gem,
} from 'lucide-react';

export const MARKER_TYPES = {
  generic: { id: 'generic', name: 'Generic', icon: MapPin, color: '#3B82F6' }, // Blue
  rock: { id: 'rock', name: 'Rock', icon: Hexagon, color: '#4B5563' }, // Gray
  coral: { id: 'coral', name: 'Coral', icon: Flower2, color: '#EC4899' }, // Pink
  wall: { id: 'wall', name: 'Wall/Drop-off', icon: Square, color: '#78350F' }, // Brown
  cave: { id: 'cave', name: 'Cave/Cavern', icon: Warehouse, color: '#7C3AED' }, // Purple
  canyon: { id: 'canyon', name: 'Canyon/Swim Through', icon: MoveHorizontal, color: '#0D9488' }, // Teal
  wreck: { id: 'wreck', name: 'Wreck', icon: Anchor, color: '#EF4444' }, // Red
  life: { id: 'life', name: 'Marine Life', icon: Fish, color: '#10B981' }, // Green
  artifacts: { id: 'artifacts', name: 'Ancient Artifacts', icon: Gem, color: '#CA8A04' }, // Gold
  hazard: { id: 'hazard', name: 'Hazard', icon: AlertTriangle, color: '#F59E0B' }, // Orange
};
