import React from 'react';
import { 
  Shield, 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  Plus, 
  Search, 
  Settings, 
  CheckCircle, 
  User, 
  Phone, 
  LogOut, 
  Sun, 
  Moon, 
  Lock, 
  ThumbsUp, 
  ChevronRight, 
  X, 
  Compass, 
  Info,
  Radio,
  Clock,
  ChevronUp,
  ChevronDown,
  Menu,
  Bell,
  Sliders,
  Gauge,
  Target
} from 'lucide-react';

export {
  Shield,
  MapPin,
  Navigation,
  AlertTriangle,
  Plus,
  Search,
  Settings,
  CheckCircle,
  User,
  Phone,
  LogOut,
  Sun,
  Moon,
  Lock,
  ThumbsUp,
  ChevronRight,
  X,
  Compass,
  Info,
  Radio,
  Clock,
  ChevronUp,
  ChevronDown,
  Menu,
  Bell,
  Sliders,
  Gauge,
  Target
};

// Custom Guardian Shield SVG Logo Icon
export const GuardianShieldIcon = ({ className = "w-6 h-6", color = "currentColor" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
    <path d="M12 6l2.5 4h-5L12 6z" fill={color} opacity="0.3" />
    <circle cx="12" cy="14" r="2" fill={color} />
  </svg>
);

// Custom Diamond Risk Marker Icon
export const DiamondRiskIcon = ({ className = "w-4 h-4", color = "currentColor" }) => (
  <svg className={className} viewBox="0 0 24 24" fill={color}>
    <rect x="5" y="5" width="14" height="14" rx="2" transform="rotate(45 12 12)" />
  </svg>
);
