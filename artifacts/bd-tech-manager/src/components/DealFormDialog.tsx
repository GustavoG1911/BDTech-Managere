import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Deal, Operation, PaymentStatus } from "@/lib/types";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InfoHint } from "@/components/InfoHint";

interface DealFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (deal: Deal) => void;
  editDeal?: Deal | null;
  currentPosition?: string;
  currentUserId?: string;
  executivos?: { id: string; name: string }[];
  sdrs?: { id: string; name: string }[];
}

function genId() {
  return crypto.randomUUID();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function FieldLabel({ children, info }: { children: string; info: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{children}</Label>
      <InfoHint text={info} />
    </div>
  );
}

export function DealFormDialog({
  open,
  onOpenChange,
  onSave,
  editDeal,
  currentPosition,
  currentUserId,
  executivos,
  sdrs,
}: DealFormDialogProps) {
  const [closingDate, setClosingDate] = useState<Date | undefined>();
  const [selectedExecutivoId, setSelectedExecutivoId] = useState("");
  const [selectedSdrId, setSelectedSdrId] = useState("");
  const [operation, setOperation] = useState<Operation>("BluePex");
  const [clientName, setClientName] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [implantationValue, setImplantationValue] = useState("");
  const [firstPaymentDate, setFirstPaymentDate] = useState<Date | undefined>();
  const [implantationPaymentDate, setImplantationPaymentDate] = useState<Date | undefined>();
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("2");
  const [installmentDates, setInstallmentDates] = useState<(Date | undefined)[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("Pendente");

  useEffect(() => {
    if (editDeal) {
      setClosingDate(new Date(editDeal.closingDate));
      setOperation(editDeal.operation);
      setClientName(editDeal.clientName);
      setMonthlyValue(editDeal.monthlyValue.toString());
      setImplantationValue(editDeal.implantationValue.toString());
      setFirstPaymentDate(new Date(editDeal.firstPaymentDate));
      setImplantationPaymentDate(editDeal.implantationPaymentDate ? new Date(editDeal.implantationPaymentDate) : undefined);
      setIsInstallment(editDeal.isInstallment);
      setInstallmentCount(editDeal.installmentCount.toString());
      setInstallmentDates(editDeal.installmentDates.map((d) => new Date(d.date)));
      setPaymentStatus(editDeal.paymentStatus);
      setSelectedSdrId(editDeal.sdrUserId || "");
      if (currentPosition === "Diretor" && editDeal.userId) setSelectedExecutivoId(editDeal.userId);
    } else {
      const today = new Date();
      setClosingDate(today);
      setOperation("BluePex");
      setClientName("");
      setMonthlyValue("");
      setImplantationValue("");
      setFirstPaymentDate(addDays(today, 30));
      setImplantationPaymentDate(addDays(today, 10));
      setIsInstallment(false);
      setInstallmentCount("2");
      setInstallmentDates([]);
      setPaymentStatus("Pendente");
      setSelectedSdrId(sdrs?.[0]?.id || "");
      if (currentPosition === "Diretor" && executivos?.length) setSelectedExecutivoId(executivos[0].id);
    }
  }, [editDeal, open, currentPosition, executivos, sdrs]);

  useEffect(() => {
    const count = parseInt(installmentCount) || 2;
    setInstallmentDates((prev) => {
      const arr = [...prev];
      const base = implantationPaymentDate || closingDate || new Date();
      while (arr.length < count) arr.push(addMonths(base, arr.length));
      return arr.slice(0, count);
    });
  }, [installmentCount, implantationPaymentDate, closingDate]);

  const handleClosingDateSelect = (date: Date | undefined) => {
    setClosingDate(date);
    if (!editDeal && date) {
      setFirstPaymentDate(addDays(date, 30));
      setImplantationPaymentDate(addDays(date, 10));
    }
  };

  const handleInstallmentChange = (checked: boolean) => {
    setIsInstallment(checked);
    if (checked && installmentDates.every((date) => !date)) {
      const count = parseInt(installmentCount) || 2;
      const base = implantationPaymentDate || closingDate || new Date();
      setInstallmentDates(Array.from({ length: count }, (_, index) => addMonths(base, index)));
    }
  };

  const handleSave = () => {
    if (currentPosition === "SDR") {
      toast.error("SDR não pode registrar fechamentos.");
      return;
    }
    if (!closingDate || !clientName.trim()) {
      toast.error("Preencha a data de fechamento e o nome da empresa.");
      return;
    }
    if (!firstPaymentDate || !implantationPaymentDate) {
      toast.error("O preenchimento da data do primeiro pagamento e da data de implantação é obrigatório.");
      return;
    }
    if (currentPosition === "Diretor" && !selectedExecutivoId) {
      toast.error("Selecione o executivo responsável pelo fechamento.");
      return;
    }
    if (isInstallment && installmentDates.some((date) => !date)) {
      toast.error("Preencha a data de todas as parcelas da implantação.");
      return;
    }

    const dealUserId = currentPosition === "Diretor"
      ? selectedExecutivoId || undefined
      : editDeal?.userId || currentUserId;

    const deal: Deal = {
      id: editDeal?.id || "",
      closingDate: closingDate.toISOString(),
      operation,
      clientName: clientName.trim(),
      monthlyValue: parseFloat(monthlyValue) || 0,
      implantationValue: parseFloat(implantationValue) || 0,
      firstPaymentDate: firstPaymentDate.toISOString(),
      implantationPaymentDate: implantationPaymentDate.toISOString(),
      isInstallment,
      installmentCount: isInstallment ? parseInt(installmentCount) || 2 : 0,
      installmentDates: isInstallment ? installmentDates.map((d) => ({ date: d!.toISOString() })) : [],
      paymentStatus,
      userId: dealUserId,
      sdrUserId: selectedSdrId || undefined,
    };

    onSave(deal);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editDeal ? "Editar Fechamento" : "Novo Fechamento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel info="Data em que o contrato foi assinado. Ela alimenta os KPIs de fechamento do Dashboard.">Data do Fechamento</FieldLabel>
            <DatePicker date={closingDate} onSelect={handleClosingDateSelect} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel info="Define se o fechamento entra nos totais da BluePex ou da Opus Tech.">Operação</FieldLabel>
            <Select value={operation} onValueChange={(v) => setOperation(v as Operation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BluePex">BluePex</SelectItem>
                <SelectItem value="Opus Tech">Opus Tech</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {currentPosition === "Diretor" && !editDeal && executivos && executivos.length > 0 && (
            <div className="space-y-1.5">
              <FieldLabel info="O executivo selecionado será o dono comercial do contrato e receberá a comissão dele.">Executivo Responsável</FieldLabel>
              <Select value={selectedExecutivoId} onValueChange={setSelectedExecutivoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o executivo" /></SelectTrigger>
                <SelectContent>
                  {executivos.map((executivo) => (
                    <SelectItem key={executivo.id} value={executivo.id}>{executivo.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentPosition !== "SDR" && sdrs && sdrs.length > 0 && (
            <div className="space-y-1.5">
              <FieldLabel info="Quando houver SDR no contrato, a comissão dele é separada da comissão do executivo.">SDR Responsável</FieldLabel>
              <Select value={selectedSdrId} onValueChange={setSelectedSdrId}>
                <SelectTrigger><SelectValue placeholder="Selecione o SDR" /></SelectTrigger>
                <SelectContent>
                  {sdrs.map((sdr) => (
                    <SelectItem key={sdr.id} value={sdr.id}>{sdr.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <FieldLabel info="Nome que aparecerá no Dashboard, Financeiro, notificações e relatórios.">Empresa Cliente</FieldLabel>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome da empresa" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel info="Valor recorrente mensal do contrato. A comissão segue a data do primeiro pagamento.">Valor Mensalidade (R$)</FieldLabel>
              <Input type="number" min="0" step="0.01" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel info="Valor único ou parcelado da implantação. Se parcelar, cada parcela entra separada no Financeiro.">Valor Implantação (R$)</FieldLabel>
              <Input type="number" min="0" step="0.01" value={implantationValue} onChange={(e) => setImplantationValue(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel info="Por padrão fica 30 dias após o fechamento. Se cair depois do dia 07, a comissão transborda para o mês seguinte.">Data Pgto. 1ª Mensalidade</FieldLabel>
            <DatePicker date={firstPaymentDate} onSelect={setFirstPaymentDate} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel info="Por padrão fica 10 dias após o fechamento. Para implantação parcelada, use as datas de cada parcela.">Data Pgto. Implantação</FieldLabel>
            <DatePicker date={implantationPaymentDate} onSelect={setImplantationPaymentDate} />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isInstallment} onCheckedChange={handleInstallmentChange} />
            <div className="flex items-center gap-1.5">
              <Label>Implantação Parcelada?</Label>
              <InfoHint text="Ative quando a implantação será recebida em mais de uma parcela. Cada parcela terá vencimento, baixa e comissão próprios." />
            </div>
          </div>

          {isInstallment && (
            <div className="space-y-3 pl-4 border-l-2 border-primary/20">
              <div className="space-y-1.5">
                <FieldLabel info="Cada parcela divide proporcionalmente o valor e a comissão de implantação.">Número de Parcelas</FieldLabel>
                <Input type="number" min="2" max="24" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
              </div>
              {installmentDates.map((date, index) => (
                <div key={index} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Parcela {index + 1}</Label>
                  <DatePicker date={date} onSelect={(selectedDate) => {
                    const updated = [...installmentDates];
                    updated[index] = selectedDate;
                    setInstallmentDates(updated);
                  }} />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <FieldLabel info="Status geral do contrato. As baixas reais de mensalidade, implantação, comissão e salário acontecem no Financeiro.">Status do Pagamento</FieldLabel>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} className="w-full">
            {editDeal ? "Salvar Alterações" : "Registrar Fechamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DatePicker({ date, onSelect }: { date?: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy") : "Selecionar data"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}
