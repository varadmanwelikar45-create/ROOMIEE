import React from 'react';
import { IndianRupee, Receipt, ShieldCheck } from 'lucide-react';
import { CostBreakdown } from '../types';
import { computeCostTotals, formatINR } from '../utils/compatibility';

interface CostBreakdownCardProps {
  costBreakdown?: Partial<CostBreakdown>;
  fallbackBudget?: string;
  hasFlat?: 'has_flat' | 'needs_flat';
  compact?: boolean;
}

export const CostBreakdownCard: React.FC<CostBreakdownCardProps> = ({
  costBreakdown,
  fallbackBudget,
  hasFlat = 'has_flat',
  compact = false,
}) => {
  const totals = computeCostTotals(costBreakdown, fallbackBudget);

  if (compact) {
    return (
      <div className="bg-[#242424] border border-[#3d3d3d] rounded-xl p-2.5 text-[11px] space-y-1">
        <div className="flex items-center justify-between text-[#B8B8B8]">
          <span className="flex items-center gap-1 font-semibold text-[#FFD43B]">
            <Receipt className="w-3 h-3" />
            <span>Est. Monthly Total</span>
          </span>
          <span className="font-extrabold text-[#F5F5F5]">{formatINR(totals.totalMonthly)}/mo</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#8e8e8e]">
          <span>
            Rent {formatINR(totals.monthlyRent)} + Maint. {formatINR(totals.maintenanceFee)} + Util.{' '}
            {formatINR(totals.utilitiesEstimate)}
          </span>
          <span className={totals.brokerageFee === 0 ? 'text-emerald-400 font-bold' : ''}>
            {totals.brokerageFee === 0 ? 'Zero Brokerage' : `Brok. ${formatINR(totals.brokerageFee)}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#242424] border border-[#444444] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-[#383838] pb-2.5">
        <div className="flex items-center gap-1.5">
          <IndianRupee className="w-4 h-4 text-[#FFD43B]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B]">
            Complete Cost Breakdown
          </h4>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#303030] border border-[#484848] text-[#B8B8B8]">
          {totals.bhkType}
        </span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-[#B8B8B8]">
          <span>{hasFlat === 'has_flat' ? 'Per-Person Monthly Rent' : 'Target Rent Share'}</span>
          <span className="font-semibold text-[#F5F5F5]">{formatINR(totals.monthlyRent)}</span>
        </div>
        <div className="flex items-center justify-between text-[#B8B8B8]">
          <span>Society Maintenance Share</span>
          <span className="font-semibold text-[#F5F5F5]">{formatINR(totals.maintenanceFee)}</span>
        </div>
        <div className="flex items-center justify-between text-[#B8B8B8]">
          <span>Utilities (Wi-Fi, Power, Maid)</span>
          <span className="font-semibold text-[#F5F5F5]">{formatINR(totals.utilitiesEstimate)}</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-[#383838]">
          <span className="font-bold text-[#F5F5F5]">Total Monthly Outgo</span>
          <span className="font-extrabold text-[#FFD43B]">{formatINR(totals.totalMonthly)} / mo</span>
        </div>
      </div>

      <div className="bg-[#2c2c2c] rounded-xl p-3 border border-[#3d3d3d] space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-[#B8B8B8]">
          <span>Security Deposit (Refundable)</span>
          <span className="font-semibold text-[#F5F5F5]">{formatINR(totals.securityDeposit)}</span>
        </div>
        <div className="flex items-center justify-between text-[#B8B8B8]">
          <span>Brokerage</span>
          <span
            className={`font-bold inline-flex items-center gap-1 ${
              totals.brokerageFee === 0 ? 'text-emerald-400' : 'text-[#F5F5F5]'
            }`}
          >
            {totals.brokerageFee === 0 && <ShieldCheck className="w-3.5 h-3.5" />}
            <span>{totals.brokerageFee === 0 ? '₹0 (Direct · No Brokerage)' : formatINR(totals.brokerageFee)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-[#383838]">
          <span className="font-bold text-[#F5F5F5]">Upfront Move-In Estimate</span>
          <span className="font-extrabold text-emerald-300">{formatINR(totals.moveInUpfront)}</span>
        </div>
      </div>
    </div>
  );
};
