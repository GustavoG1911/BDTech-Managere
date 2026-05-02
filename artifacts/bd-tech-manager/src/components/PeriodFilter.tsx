import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatMonthLabel } from "@/lib/commission";
import { CalendarIcon } from "lucide-react";
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

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth();

const monthOptions = (() => {
  const opts: { value: string; label: string; range: DateRange }[] = [];
  // 24 meses atrás até 12 meses à frente (dinâmico, nunca hardcoded)
  for (let i = 24; i >= -12; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({
      value: key,
      label: formatMonthLabel(key),
      range: getMonthRange(d.getFullYear(), d.getMonth()),
    });
  }
  return opts;
})();

const quarterOptions = [1, 2, 3, 4].map((q) => ({
  value: `Q${q}-${currentYear}`,
  label: `${q}º Trimestre ${currentYear}`,
  range: getQuarterRange(currentYear, q),
}));

const yearOptions = [currentYear - 1, currentYear].map((y) => ({
  value: `Y-${y}`,
  label: `Ano ${y}`,
  range: getYearRange(y),
}));

export function PeriodFilter({ onPeriodChange, availableYears = [] }: PeriodFilterProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  // Gera opções de ano dinâmicas
  const dynamicYearOptions = useMemo(() => {
    const years = availableYears.length > 0 ? availableYears : [currentYear - 1, currentYear];
    return years.map((y) => ({
      value: `Y-${y}`,
      label: `Ano ${y}`,
      range: getYearRange(y),
    }));
  }, [availableYears]);

  const handlePresetChange = (value: string) => {
    const allOptions = [...monthOptions, ...quarterOptions, ...dynamicYearOptions];
    const opt = allOptions.find((o) => o.value === value);
    if (opt) onPeriodChange(opt.range, opt.label, periodType);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      const label = `${format(customFrom, "dd/MM/yy")} — ${format(customTo, "dd/MM/yy")}`;
      onPeriodChange({ from: customFrom, to: new Date(customTo.getFullYear(), customTo.getMonth(), customTo.getDate(), 23, 59, 59) }, label, "custom");
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select 
        value={periodType} 
        onValueChange={(v) => {
          const newType = v as PeriodType;
          setPeriodType(newType);
          
          // Auto-trigger update when type changes to provide immediate feedback
          let defaultValue = "";
          if (newType === "month") defaultValue = currentKey;
          else if (newType === "quarter") defaultValue = `Q${Math.floor(currentMonth / 3) + 1}-${currentYear}`;
          else if (newType === "year") defaultValue = `Y-${currentYear}`;
          
          if (defaultValue) {
            const allOptions = [...monthOptions, ...quarterOptions, ...dynamicYearOptions];
            const opt = allOptions.find((o) => o.value === defaultValue);
            if (opt) onPeriodChange(opt.range, opt.label, newType);
          }
        }}
      >
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

      {periodType === "month" && (
        <Select defaultValue={currentKey} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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

      {periodType === "year" && (
        <Select 
          defaultValue={dynamicYearOptions.some(o => o.value === `Y-${currentYear}`) ? `Y-${currentYear}` : dynamicYearOptions[0]?.value} 
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

      {periodType === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal text-sm", !customFrom && "text-muted-foreground")}>
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
              <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal text-sm", !customTo && "text-muted-foreground")}>
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
