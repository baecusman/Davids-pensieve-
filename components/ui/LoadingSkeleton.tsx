"use client";

import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
  count?: number; // Number of skeleton lines/blocks
  height?: string | number;
  width?: string | number;
  circle?: boolean;
}

const SkeletonElement: React.FC<LoadingSkeletonProps> = ({
  className = '',
  height = '1rem', // Default height
  width = '100%',   // Default width
  circle = false,
}) => {
  const style: React.CSSProperties = {
    height,
    width,
    backgroundColor: '#e0e0e0', // Tailwind gray-300
    borderRadius: circle ? '50%' : '0.25rem', // Tailwind rounded-md
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  };

  return <div style={style} className={`opacity-75 ${className}`} />;
};

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 1,
  className = '',
  height,
  width,
  circle,
}) => {
  const skeletons = [];
  for (let i = 0; i < count; i++) {
    skeletons.push(
      <SkeletonElement
        key={i}
        className={`mb-2 ${className}`} // Add margin between skeleton elements if count > 1
        height={height}
        width={width}
        circle={circle}
      />
    );
  }

  // Add a keyframe animation for pulse, typically in a global CSS file or styled-components
  // For simplicity here, it's assumed a global CSS like this exists:
  // @keyframes pulse {
  //   0%, 100% { opacity: 1; }
  //   50% { opacity: .5; }
  // }
  // Or, if using Tailwind, ensure the `animate-pulse` class is configured correctly.
  // The inline style animation is basic.

  return <>{skeletons}</>;
};

export default LoadingSkeleton;
