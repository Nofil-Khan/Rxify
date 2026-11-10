import * as React from 'react';
import { motion } from 'motion/react';

interface OtpInputBoxesProps {
  value: string;
  onChange: (val: string) => void;
  isError: boolean;
  onEnter?: () => void;
}

export const OtpInputBoxes: React.FC<OtpInputBoxesProps> = ({ value, onChange, isError, onEnter }) => {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.slice(-1);
    const newArr = [...digits];
    newArr[index] = char;
    const newVal = newArr.join('').slice(0, 6);
    onChange(newVal);
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      onEnter?.();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      inputRefs.current[Math.min(5, pasted.length)]?.focus();
    }
  };

  return (
    <motion.div
      animate={isError ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="flex items-center gap-2 justify-center"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${i + 1} of 6-digit verification code`}
          className="h-11 w-11 rounded-xl text-center font-mono text-lg font-bold transition-all focus-visible:outline-none focus-visible:ring-2"
          style={isError
            ? { border: '1px solid rgba(192,57,43,0.6)', background: 'rgba(192,57,43,0.15)', color: '#ff9080', '--tw-ring-color': 'rgba(192,57,43,0.5)' } as React.CSSProperties
            : { border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'var(--ti-island-text)', '--tw-ring-color': 'rgba(255,255,255,0.3)' } as React.CSSProperties
          }
        />
      ))}
    </motion.div>
  );
};

export default OtpInputBoxes;
