import { useState, useMemo, useRef, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatMonthLabel } from "@/lib/commission";
import { CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type PeriodType = "month" | "quarter" | "year" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

interface PeriodFilterProps {
  onPeriodChange: (range: DateRange, label: string, periodType: PeriodType) => void;
  availableYears?: number[];
  monthOnly?: boolean;
  selectedMonthKey?: string;
}

function getMonthRange(year: number, month: number): DateRange {
  return {
    from: new Date(year, month, 1),
    to: new Date(year, month + 1, 0, 23, 59, 59),
  };
}

function getQuarterRange(year: number, quarter: number): DateRange {
  const startMonth = (quarter - 1) * 3;
  return {
    from: new Date(year, startMonth, 1),
    to: new Date(year, startMonth + 3, 0, 23, 59, 59),
  };
}

function getYearRange(year: number): DateRange {
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31, 23, 59, 59),
  };
}

const currentDate  = new Date();
const currentYear  = currentDate.getFullYear();
const currentMonth = currentDate.getMonth();

const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

/* ─── Build month list: 24 months back → 12 months ahead ─── */
const monthOptions = (() => {
  const opts: { value: string; label: string; range: DateRange; year: number }[] = [];
  for (let i = 24; i >= -12; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({
      value: key,
      label: formatMonthLabel(key),
      range: getMonthRange(d.getFullYear(), d.getMonth()),
      year:  d.getFullYear(),
    });
  }
  return opts;
})();

const currentMonthIdx = monthOptions.findIndex((o) => o.value === currentKey);

/* ─── Quarter / Year helpers ─── */
const quarterOptions = [1, 2, 3, 4].map((q) => ({
  value: `Q${q}-${currentYear}`,
  label: `${q}º Trimestre ${currentYear}`,
  range: getQuarterRange(currentYear, q),
}));

/* ─── Component ─── */
export function PeriodFilter({ onPeriodChange, availableYears = [], monthOnly = false, selectedMonthKey }: PeriodFilterProps) {
  const [periodType,      setPeriodType]      = useState<PeriodType>("month");
  const [selectedIdx,     setSelectedIdx]      = useState(currentMonthIdx >= 0 ? currentMonthIdx : 24);
  const [monthListOpen,   setMonthListOpen]    = useState(false);
  const [customFrom,      setCustomFrom]       = useState<Date | undefined>();
  const [customTo,        setCustomTo]         = useState<Date | undefined>();
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const dynamicYearOptions = useMemo(() => {
    const years = availableYears.length > 0 ? availableYears : [currentYear - 1, currentYear];
    return years.map((y) => ({
      value: `Y-${y}`,
      label: `Ano ${y}`,
      range: getYearRange(y),
    }));
  }, [availableYears]);

  /* Scroll the selected item into view when the popover opens */
  useEffect(() => {
    if (monthListOpen && selectedItemRef.current) {
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 30);
    }
  }, [monthListOpen]);

  useEffect(() => {
    if (!selectedMonthKey || periodType !== "month") return;
    const nextIdx = monthOptions.findIndex((o) => o.value === selectedMonthKey);
    if (nextIdx >= 0 && nextIdx !== selectedIdx) setSelectedIdx(nextIdx);
  }, [periodType, selectedIdx, selectedMonthKey]);

  /* ── Month navigation (arrows) ── */
  const navigateMonth = (dir: -1 | 1) => {
    const next = selectedIdx + dir;
    if (next < 0 || next >= monthOptions.length) return;
    setSelectedIdx(next);
    const opt = monthOptions[next];
    onPeriodChange(opt.range, opt.label, "month");
  };

  /* ── Month selected from list ── */
  const selectMonthByIdx = (idx: number) => {
    setSelectedIdx(idx);
    setMonthListOpen(false);
    const opt = monthOptions[idx];
    onPeriodChange(opt.range, opt.label, "month");
  };

  /* ── Period type change ── */
  const handleTypeChange = (v: string) => {
    const newType = v as PeriodType;
    setPeriodType(newType);

    if (newType === "month") {
      const opt = monthOptions[selectedIdx];
      if (opt) onPeriodChange(opt.range, opt.label, "month");
    } else if (newType === "quarter") {
      const q = Math.floor(currentMonth / 3) + 1;
      const opt = quarterOptions.find((o) => o.value === `Q${q}-${currentYear}`);
      if (opt) onPeriodChange(opt.range, opt.label, "quarter");
    } else if (newType === "year") {
      const opt = dynamicYearOptions.find((o) => o.value === `Y-${currentYear}`) ?? dynamicYearOptions[0];
      if (opt) onPeriodChange(opt.range, opt.label, "year");
    }
  };

  /* ── Quarter / Year dropdown change ── */
  const handlePresetChange = (value: string) => {
    const allOptions = [...quarterOptions, ...dynamicYearOptions];
    const opt = allOptions.find((o) => o.value === value);
    if (opt) onPeriodChange(opt.range, opt.label, periodType);
  };

  /* ── Custom date ── */
  const handleCustomApply = () => {
    if (customFrom && customTo) {
      const label = `${format(customFrom, "dd/MM/yy")} — ${format(customTo, "dd/MM/yy")}`;
      onPeriodChange(
        { from: customFrom, to: new Date(customTo.getFullYear(), customTo.getMonth(), customTo.getDate(), 23, 59, 59) },
        label,
        "custom",
      );
    }
  };

  /* ── Group months by year for the list ── */
  const monthsByYear = useMemo(() => {
    const groups: { year: number; items: { idx: number; opt: typeof monthOptions[0] }[] }[] = [];
    monthOptions.forEach((opt, idx) => {
      const last = groups[groups.length - 1];
      if (last && last.year === opt.year) {
        last.items.push({ idx, opt });
      } else {
        groups.push({ year: opt.year, items: [{ idx, opt }] });
      }
    });
    return groups;
  }, []);

  const selectedOpt = monthOptions[selectedIdx];
  const canGoBack    = selectedIdx > 0;
  const canGoForward = selectedIdx < monthOptions.length - 1;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ── Period type selector ── */}
      {!monthOnly && (
        <Select value={periodType} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mensal</SelectItem>
            <SelectItem value="quarter">Trimestral</SelectItem>
            <SelectItem value="year">Anual</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* ── Month navigator: [←] [Label ▼] [→] ── */}
      {periodType === "month" && (
        <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 overflow-hidden h-9">
          {/* Prev arrow */}
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            disabled={!canGoBack}
            className="flex items-center justify-center h-full px-2 text-muted-foreground
                       hover:bg-muted/60 hover:text-foreground
                       disabled:opacity-25 disabled:cursor-not-allowed
                       transition-colors border-r border-border/40"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {/* Month label — opens list on click */}
          <Popover open={monthListOpen} onOpenChange={setMonthListOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 h-full px-3
                           text-sm font-medium text-foreground
                           hover:bg-muted/60 transition-colors whitespace-nowrap"
              >
                {selectedOpt?.label ?? "—"}
                <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-52 p-0 bg-card border border-border/70 shadow-xl"
              align="center"
            >
              <div className="max-h-72 overflow-y-auto py-1">
                {monthsByYear.map(({ year, items }) => (
                  <div key={year}>
                    {/* Year group header */}
                    <p className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase
                                  text-muted-foreground/50 sticky top-0 bg-card/95 backdrop-blur-sm">
                      {year}
                    </p>
                    {items.map(({ idx, opt }) => {
                      const isSelected = idx === selectedIdx;
                      return (
                        <button
                          key={opt.value}
                          ref={isSelected ? selectedItemRef : undefined}
                          type="button"
                          onClick={() => selectMonthByIdx(idx)}
                          className={cn(
                            "w-full text-left px-4 py-1.5 text-sm transition-colors",
                            isSelected
                              ? "bg-primary/15 text-primary font-semibold"
                              : "text-foreground hover:bg-muted/40",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Next arrow */}
          <button
            type="button"
            onClick={() => navigateMonth(1)}
            disabled={!canGoForward}
            className="flex items-center justify-center h-full px-2 text-muted-foreground
                       hover:bg-muted/60 hover:text-foreground
                       disabled:opacity-25 disabled:cursor-not-allowed
                       transition-colors border-l border-border/40"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Quarter selector ── */}
      {periodType === "quarter" && (
        <Select onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[190px] h-9 text-sm">
            <SelectValue placeholder="Selecionar trimestre" />
          </SelectTrigger>
          <SelectContent>
            {quarterOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* ── Year selector ── */}
      {periodType === "year" && (
        <Select
          defaultValue={
            dynamicYearOptions.some((o) => o.value === `Y-${currentYear}`)
              ? `Y-${currentYear}`
              : dynamicYearOptions[0]?.value
          }
          onValueChange={handlePresetChange}
        >
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Selecionar ano" />
          </SelectTrigger>
          <SelectContent>
            {dynamicYearOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* ── Custom date range ── */}
      {periodType === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline" size="sm"
                className={cn("w-[130px] justify-start text-left font-normal text-sm", !customFrom && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {customFrom ? format(customFrom, "dd/MM/yyyy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline" size="sm"
                className={cn("w-[130px] justify-start text-left font-normal text-sm", !customTo && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {customTo ? format(customTo, "dd/MM/yyyy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Button size="sm" onClick={handleCustomApply} disabled={!customFrom || !customTo}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
