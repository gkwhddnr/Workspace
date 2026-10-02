import React from 'react';
import { FileText, Globe, Keyboard, Puzzle } from 'lucide-react';
import { ActiveTab } from '../store/useAppStore';

export const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pdf', label: 'PDF 편집', icon: <FileText size={14} /> },
    { id: 'web', label: '웹 서퍼', icon: <Globe size={14} /> },
    { id: 'shortcuts', label: '단축키', icon: <Keyboard size={14} /> },
    { id: 'plugins', label: '플러그인', icon: <Puzzle size={14} /> },
];
