import { useState, useEffect } from "react";
import { OperationPresentations, AppSettings } from "@/lib/types";
import { getCommissionTier } from "@/lib/commission";
import { Plus, Minus, HelpCircle, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PresentationsCardProps {
  presentations: OperationPresentations;
  onUpdate: (operation: "bluepex" | "opus", count: number) => void;
  settings: AppSettings;
}

function ProgressBar({ count, meta, superMeta }: { count: number; meta: number; superMeta: number }) {
  const pct = Math.min((count / superMeta) * 100, 100);
  const metaPct = (meta / superMeta) * 100;

  const color =
    count >= superMeta ? "bg-warning" :
    count >= meta      ? "bg-success" :
                         "bg-primary/70";

  return (
    <div className="relative mt-2">
      {/* Track */}
      <div className="h-2 rounded-full bg-border/50 overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Meta marker */}
      <div
        className="absolute top-0 h-2 w-0.5 bg-foreground/20 rounded"
        style={{ left: `${metaPct}%` }}
        title={`Meta: ${meta}`}
      />
      {/* Labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground/60">0</span>
        <span className="text-[9px] text-muted-foreground/60" style={{ position: "absolute", left: `${metaPct}%`, transform: "translateX(-50%)" }}>
          {meta}
        </span>
        <span className="text-[9px] text-muted-foreground/60">{superMeta}</span>
      </div>
    </div>
  );
}

function CounterInput({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/80 hover:border-border transition-all duration-150 cursor-pointer"
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <Minus className="h-3 w-3 text-muted-foreground" />
      </button>
      <input
        type="number"
        min={0}
        value={value ?? 0}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          onChange(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
        }}
        className="flex h-8 w-14 rounded-lg bg-muted/30 border border-border/40 px-1 text-center text-lg font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/80 hover:border-border transition-all duration-150 cursor-pointer"
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

function TierBadge({ count, meta, superMeta }: { count: number; meta: number; superMeta: number }) {
  const tier = getCommissionTier(count, meta, superMeta);
  if (tier.rate >= 2.0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
      <Zap className="h-2.5 w-2.5" /> Super Meta
    </span>
  );
  if (tier.rate >= 1.0) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
      Meta Atingida
    </span>
  );
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
      {meta - count} p/ Meta
    </span>
  );
}

export function PresentationsCard({ presentations, onUpdate, settings }: PresentationsCardProps) {
  const meta = 15;
  const superMeta = settings?.superMetaThreshold ?? 30;

  const [bluepexCount, setBluepexCount] = useState(presentations?.bluepex ?? 0);
  const [opusCount, setOpusCount] = useState(presentations?.opus ?? 0);

  useEffect(() => {
    setBluepexCount(presentations?.bluepex ?? 0);
    setOpusCount(presentations?.opus ?? 0);
  }, [presentations]);

  const handleBluepexChange = (val: number) => {
    setBluepexCount(val);
    onUpdate("bluepex", val);
  };
  const handleOpusChange = (val: number) => {
    setOpusCount(val);
    onUpdate("opus", val);
  };

  return (
    <div className="bg-card rounded-xl border border-border/60 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
          Apresentações por Operação
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              Meta: {meta} apresentações ativa o acelerador de comissão.<br />
              Super Meta: {superMeta} apresentações dobra a comissão mensal.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* BluePex */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#4F8EF7]">BluePex</span>
            <TierBadge count={bluepexCount} meta={meta} superMeta={superMeta} />
          </div>
          <CounterInput value={bluepexCount} onChange={handleBluepexChange} />
          <ProgressBar count={bluepexCount} meta={meta} superMeta={superMeta} />
        </div>

        {/* Opus Tech */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#00D084]">Opus Tech</span>
            <TierBadge count={opusCount} meta={meta} superMeta={superMeta} />
          </div>
          <CounterInput value={opusCount} onChange={handleOpusChange} />
          <ProgressBar count={opusCount} meta={meta} superMeta={superMeta} />
        </div>
      </div>
    </div>
  );
}
