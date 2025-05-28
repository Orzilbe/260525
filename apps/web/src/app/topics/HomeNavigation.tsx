'use client';

import React from 'react';
import Link from 'next/link';

interface HomeNavigationProps {
  href?: string;
}

const HomeNavigation: React.FC<HomeNavigationProps> = ({ 
  href = '/topics' 
}) => {
  return (
    <div className="absolute top-4 left-4">
      <Link 
        href={href} 
        className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transform hover:scale-105 transition-all duration-300"
      >
        <span className="text-2xl">🏠</span>
      </Link>
    </div>
  );
};

export default HomeNavigation;