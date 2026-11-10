import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { SaveState } from './SettingsView';

interface Props {
  state: SaveState;
  onClick: () => void;
  label?: string;
}

const CONFIG: Record<SaveState, { text: string; icon: React.ElementType; bg: string; color: string }> = {
  idle: { text: 'Save Changes', icon: Save, bg: 'var(--ti-sage)', color: 'white' },
  saving: { text: 'Saving…', icon: Loader2, bg: 'var(--ti-sage)', color: 'white' },
  saved: { text: 'Saved', icon: CheckCircle2, bg: '#2D7A5F', color: 'white' },
  error: { text: 'Failed — Retry', icon: AlertCircle, bg: 'var(--ti-ruby)', color: 'white' },
};

/** Animated save button with state feedback. */
const SaveButton: React.FC<Props> = ({ state, onClick, label = 'Save Changes' }) => {
  const cfg = CONFIG[state];
  const Icon = cfg.icon;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={state === 'saving'}
      whileTap={{ scale: 0.97 }}
      aria-label={label}
      aria-busy={state === 'saving'}
      className="self-start flex items-center gap-2 h-9 px-5 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ti-sage disabled:cursor-not-allowed"
      style={{
        background: cfg.bg,
        color: cfg.color,
        boxShadow: '0 4px 14px rgba(74,124,111,0.22)',
      }}
    >
      <Icon
        size={14}
        strokeWidth={2}
        className={state === 'saving' ? 'animate-spin' : ''}
      />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14 }}
        >
          {state === 'idle' ? label : cfg.text}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
};

export default SaveButton;

