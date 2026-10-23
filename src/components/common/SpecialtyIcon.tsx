import React from 'react';
import {
  Stethoscope,
  Baby,
  HeartPulse,
  Smile,
  Sparkles,
  Users,
  Activity,
  Eye,
  Brain,
  Bone,
  Pill,
  Syringe,
  Cross,
} from 'lucide-react';

interface SpecialtyIconProps {
  name: string;
  className?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope,
  Baby,
  HeartPulse,
  Smile,
  Sparkles,
  Users,
  Activity,
  Eye,
  Brain,
  Bone,
  Pill,
  Syringe,
  Cross,
};

export const SpecialtyIcon: React.FC<SpecialtyIconProps> = ({ name, className = 'w-5 h-5' }) => {
  const IconComponent = iconMap[name] || Stethoscope;
  return <IconComponent className={className} />;
};
