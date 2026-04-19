import { useState, useEffect, useRef } from 'react';
import { dbService, FeeRecord, MOCK_STUDENT_ID } from '../../lib/db';
import { CreditCard, CheckCircle, Shield, Loader2, Printer, X } from 'lucide-react';
import { cn } from '../../lib/utils';

// ── Receipt component (rendered into a hidden div for printing) ─────────────
function FeeReceipt({ fee, onClose }: { fee: FeeRecord; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const receiptEl = printRef.current;
    if (!receiptEl) return;

    const originalBody = document.body.innerHTML;
    document.body.innerHTML = receiptEl.innerHTML;
    window.print();
    document.body.innerHTML = originalBody;
    window.location.reload();
  };

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Fee Receipt Preview</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Receipt body — this is what gets printed */}
        <div ref={printRef} className="p-8 space-y-6 font-sans">
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-slate-200 pb-6 space-y-1">
            <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-black text-sm mx-auto mb-3">
              CM
            </div>
            <h1 className="text-xl font-black tracking-tighter text-slate-900">CAMPUS MATE</h1>
            <p className="text-xs text-slate-500 font-medium">Fee Payment Receipt</p>
          </div>

          {/* Receipt meta */}
          <div className="grid grid-cols-2 gap-y-3 text-xs">
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider">Receipt No.</p>
              <p className="font-black text-slate-900 mt-0.5">#{fee.id.toUpperCase().slice(-8)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-bold uppercase tracking-wider">Date Issued</p>
              <p className="font-black text-slate-900 mt-0.5">{today}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider">Student ID</p>
              <p className="font-black text-slate-900 mt-0.5">{fee.studentId}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 font-bold uppercase tracking-wider">Due Date</p>
              <p className="font-black text-slate-900 mt-0.5">{fee.dueDate}</p>
            </div>
          </div>

          {/* Line items */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 flex justify-between px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span>Description</span>
              <span>Amount</span>
            </div>
            <div className="px-5 py-4 flex justify-between text-sm font-bold text-slate-800 border-t border-slate-100">
              <span>{fee.description}</span>
              <span>₹{fee.amount.toLocaleString('en-IN')}</span>
            </div>
            <div className="px-5 py-4 flex justify-between bg-slate-900 text-white">
              <span className="text-[11px] font-black uppercase tracking-wider">Total Paid</span>
              <span className="text-lg font-black">₹{fee.amount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* PAID stamp */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2.5 px-6 py-3 border-2 border-accent-green rounded-2xl bg-green-50">
              <CheckCircle className="w-5 h-5 text-accent-green" />
              <span className="text-accent-green font-black uppercase tracking-[0.3em] text-sm">PAID</span>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200 pt-5">
            This is a computer-generated receipt and does not require a physical signature.<br />
            Powered by <strong>Campus Mate</strong> • campus-mate-f3b99
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main FeesView ─────────────────────────────────────────────────────────────
export default function FeesView() {
  const [fees, setFees]           = useState<FeeRecord[]>([]);
  const [isPaying, setIsPaying]   = useState<string | null>(null);
  const [receiptFee, setReceiptFee] = useState<FeeRecord | null>(null);
  const [messMonth, setMessMonth] = useState<string>('');

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => { fetchFees(); }, []);

  const fetchFees = async () => {
    const data = await dbService.getFees(MOCK_STUDENT_ID);
    if (data.length === 0) {
      setFees([
        { id: 'f1', studentId: MOCK_STUDENT_ID, amount: 85000, description: 'Semester VI Tuition', dueDate: '2026-05-30', status: 'pending' },
        { id: 'f2', studentId: MOCK_STUDENT_ID, amount: 3500,  description: 'Library Late Return',  dueDate: '2026-04-20', status: 'pending' },
        { id: 'f3', studentId: MOCK_STUDENT_ID, amount: 18000, description: 'Hostel Maintenance',   dueDate: '2026-06-15', status: 'pending' },
      ]);
    } else {
      setFees(data);
    }
  };

  const handlePay = async (fee: FeeRecord) => {
    setIsPaying(fee.id);
    await new Promise(r => setTimeout(r, 1500));
    await dbService.payFee(fee);
    await fetchFees();
    setIsPaying(null);
  };

  const handlePayMess = async () => {
    if (!messMonth) return;
    const feeId = `mess_${messMonth.toLowerCase()}_${Date.now()}`;
    const fee: FeeRecord = {
      id: feeId,
      studentId: MOCK_STUDENT_ID,
      amount: 4500,
      description: `${messMonth} Mess Fee`,
      dueDate: 'End of Month',
      status: 'pending' // will be paid immediately
    };
    setIsPaying(feeId);
    await new Promise(r => setTimeout(r, 1500));
    await dbService.payFee(fee);
    await fetchFees();
    setIsPaying(null);
    setMessMonth('');
  };

  const totalPending = fees.filter(f => f.status === 'pending').reduce((acc, cur) => acc + cur.amount, 0);

  return (
    <>
      {receiptFee && (
        <FeeReceipt fee={receiptFee} onClose={() => setReceiptFee(null)} />
      )}

      <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-brand-text-main">Fee Management</h2>
            <p className="text-brand-text-muted text-sm mt-1">Manage your academic and institutional dues.</p>
          </div>
          <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-2xl px-6 py-4 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-brand-text-muted tracking-widest">Total Outstanding</p>
              <p className="text-2xl font-bold text-brand-text-main">₹{totalPending.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          {fees.sort((a, b) => a.status === 'pending' ? -1 : 1).map(fee => (
            <div
              key={fee.id}
              className="bg-white border border-brand-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6 group hover:border-slate-300 transition-all"
            >
              <div className="flex-1 flex items-center gap-4">
                <div className="hidden sm:flex w-12 h-12 rounded-xl bg-slate-50 items-center justify-center text-brand-text-muted flex-shrink-0 group-hover:bg-blue-50 group-hover:text-brand-primary transition-colors">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 leading-tight">{fee.description}</h4>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-brand-text-muted">Due: {fee.dueDate}</span>
                    <span className="text-xs font-bold text-brand-text-main">ID: #{fee.id}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-10">
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-text-main">₹{fee.amount.toLocaleString('en-IN')}</p>
                  <div className={cn(
                    'flex items-center gap-1.5 text-[10px] font-bold uppercase',
                    fee.status === 'paid' ? 'text-accent-green' : 'text-amber-500'
                  )}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', fee.status === 'paid' ? 'bg-accent-green' : 'bg-amber-500')} />
                    {fee.status}
                  </div>
                </div>

                {fee.status === 'pending' ? (
                  <button
                    onClick={() => handlePay(fee)}
                    disabled={!!isPaying}
                    className="px-6 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-900/10 active:scale-[0.98] transition-all flex items-center gap-2 min-w-[120px] justify-center"
                  >
                    {isPaying === fee.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pay Now'}
                  </button>
                ) : (
                  <button
                    onClick={() => setReceiptFee(fee)}
                    className="px-6 py-2.5 bg-green-50 text-accent-green text-xs font-bold rounded-xl border border-green-200 flex items-center gap-2 min-w-[120px] justify-center hover:bg-green-100 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Monthly Mess Fee Section */}
          <div className="bg-white border border-brand-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6 group hover:border-slate-300 transition-all mt-4">
            <div className="flex-1 flex items-center gap-4">
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-orange-50 items-center justify-center text-orange-500 flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                <span className="font-bold text-xl">🍽️</span>
              </div>
              <div className="w-full max-w-xs">
                <h4 className="font-bold text-slate-900 leading-tight">Monthly Mess Fees</h4>
                <div className="mt-2">
                  <select 
                    value={messMonth} 
                    onChange={e => setMessMonth(e.target.value)}
                    className="w-full bg-slate-50 border border-brand-border rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all appearance-none"
                  >
                    <option value="" disabled>Select Month</option>
                    {MONTHS.map(m => (
                      <option key={m} value={m}>{m} (₹4,500)</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-10">
              <div className="text-right">
                <p className="text-sm font-bold text-brand-text-main">₹4,500</p>
                <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                  Per Month
                </div>
              </div>
              <button
                onClick={handlePayMess}
                disabled={!messMonth || !!isPaying}
                className={cn(
                  "px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center gap-2 min-w-[120px] justify-center",
                  messMonth && !isPaying ? "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20" : "bg-slate-300 cursor-not-allowed shadow-none"
                )}
              >
                {isPaying && isPaying.startsWith('mess_') ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pay Mess Fee'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border border-brand-border rounded-2xl flex items-start gap-4">
          <Shield className="w-5 h-5 text-slate-400 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-brand-text-main uppercase tracking-tight">Secure Payment Integration</p>
            <p className="text-[11px] text-brand-text-muted leading-relaxed">
              All payments are processed through a 256-bit encrypted gateway. Your banking data is never stored on our campus servers.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
