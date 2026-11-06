import * as React from 'react';
import { Search, User, FileText, Pill } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Command } from 'cmdk';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import KeyCap from './KeyCap';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import { MOCK_PRESCRIPTIONS } from '../mocks/dispensaryMockData';

export const SearchCommandPalette: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const { selectPrescription, selectMedicine } = useDispensaryWorkspace();

  useHotkeys(['ctrl+k', 'meta+k'], (e) => {
    e.preventDefault();
    setOpen((prev) => !prev);
  });

  const handleSelectPrescription = (rxId: string) => {
    selectPrescription(rxId);
    setOpen(false);
  };

  const handleSelectMedicine = (rxId: string, medId: string) => {
    selectPrescription(rxId);
    selectMedicine(medId);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex h-10 w-[320px] items-center justify-between rounded-full border border-mint-400/20 bg-bg-0/50 px-4 text-left backdrop-blur-md transition-all hover:border-mint-400/40 hover:bg-bg-0/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
        aria-label="Search prescriptions, patients, and medicines (Ctrl+K)"
      >
        <div className="flex items-center gap-2.5 text-xs text-cream-to/50 group-hover:text-cream-to/80">
          <Search size={18} strokeWidth={1.75} className="text-mint-400/60" />
          <span>Search anything...</span>
        </div>
        <KeyCap>Ctrl K</KeyCap>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl border-mint-400/30 bg-bg-1/95 p-0 backdrop-blur-2xl shadow-2xl overflow-hidden">
          <DialogTitle className="sr-only">Quick Search Command Palette</DialogTitle>
          <Command className="flex flex-col bg-transparent text-white">
            <div className="flex items-center border-b border-mint-400/15 px-4 py-3">
              <Search size={18} strokeWidth={1.75} className="mr-3 text-mint-300" />
              <Command.Input
                placeholder="Search patients, Rx IDs, or medicines..."
                className="w-full bg-transparent text-sm text-white placeholder-cream-to/40 focus:outline-none"
              />
            </div>

            <Command.List className="max-h-[340px] overflow-y-auto p-2">
              <Command.Empty className="p-4 text-center text-xs text-cream-to/50">
                No matching records found.
              </Command.Empty>

              <Command.Group heading="Patients" className="text-[11px] font-semibold text-mint-300 px-2 py-1.5 uppercase tracking-wider">
                {MOCK_PRESCRIPTIONS.map((rx) => (
                  <Command.Item
                    key={rx.id}
                    onSelect={() => handleSelectPrescription(rx.id)}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs text-cream-from hover:bg-mint-400/15 aria-selected:bg-mint-400/20"
                  >
                    <span className="flex items-center gap-2.5">
                      <User size={18} strokeWidth={1.75} className="text-emerald-300" />
                      <span className="font-semibold">{rx.patientName}</span>
                    </span>
                    <span className="text-[11px] text-cream-to/50">{rx.rxNumber}</span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group heading="Medicines" className="text-[11px] font-semibold text-mint-300 px-2 py-1.5 uppercase tracking-wider mt-2">
                {MOCK_PRESCRIPTIONS.flatMap((rx) =>
                  rx.medicines.map((med) => (
                    <Command.Item
                      key={`${rx.id}-${med.id}`}
                      onSelect={() => handleSelectMedicine(rx.id, med.id)}
                      className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs text-cream-from hover:bg-mint-400/15 aria-selected:bg-mint-400/20"
                    >
                      <span className="flex items-center gap-2.5">
                        <Pill size={18} strokeWidth={1.75} className="text-mint-400" />
                        <span>{med.name} <span className="text-cream-to/50">({med.strength})</span></span>
                      </span>
                      <span className="text-[11px] text-cream-to/50">{rx.patientName}</span>
                    </Command.Item>
                  ))
                )}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SearchCommandPalette;

