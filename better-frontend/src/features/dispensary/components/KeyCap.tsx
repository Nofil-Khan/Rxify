import * as React from 'react';

interface KeyCapProps {
  children: React.ReactNode;
}

export const KeyCap: React.FC<KeyCapProps> = ({ children }) => {
  return (
    <kbd className="inline-flex items-center justify-center rounded-lg border border-mint-400/25 bg-bg-2/70 px-2 py-0.5 font-mono text-[10px] font-semibold text-cream-from/80 shadow-sm backdrop-blur-sm select-none">
      {children}
    </kbd>
  );
};

export default KeyCap;

