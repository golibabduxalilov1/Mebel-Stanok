import React from 'react';
import { Role } from '../types';

interface OverviewTabProps {
  role: Role | null | undefined;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ role }) => {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <p className="text-slate-400 text-sm">Раздел «Обзор» в разработке</p>
    </div>
  );
};
