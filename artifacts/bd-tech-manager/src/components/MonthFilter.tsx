import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMonthLabel } from "@/lib/commission";

interface MonthFilterProps {
  value: string;
  onChange: (v: string) => void;
  availableMonths: string[];
}

export function MonthFilter({ value, onChange, availableMonths }: MonthFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Selecionar mês" />
      </SelectTrigger>
      <SelectContent>
        {availableMonths.map((m) => (
          <SelectItem key={m} value={m}>
            {formatMonthLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
