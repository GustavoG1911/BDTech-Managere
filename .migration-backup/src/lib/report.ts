import { Deal, AppSettings, MonthlyPresentations, MonthlySuperMeta } from "@/lib/types";
import { calculateCommission, formatCurrency, getMonthKey, getPresentationsForDeal } from "@/lib/commission";
import { format } from "date-fns";

interface ReportData {
  deals: Deal[];
  presentations: MonthlyPresentations;
  salary: number;
  periodLabel: string;
  settings: AppSettings;
  superMeta: MonthlySuperMeta;
}

export function generateReportHTML(data: ReportData): string {
  const { deals, presentations, salary, periodLabel, settings, superMeta } = data;
  const rate = ((settings.commissionRate || 0.20) * 100).toFixed(0);

  let totalProjected = 0;
  let totalPaid = 0;
  let totalMonthly = 0;
  let totalImplantation = 0;
  let totalSuperBonus = 0;
  let bluePexVolume = 0;
  let opusTechVolume = 0;

  const rows = deals.map((deal) => {
    const presCount = getPresentationsForDeal(deal, presentations);
    const dealMonthKey = getMonthKey(deal.closingDate);
    const dealSuperMeta = superMeta[dealMonthKey] || false;
    const comm = calculateCommission(deal, presCount, settings, dealSuperMeta);
    totalProjected += comm.totalCommission;
    if (deal.paymentStatus === "Pago") totalPaid += comm.totalCommission;
    totalMonthly += deal.monthlyValue;
    totalImplantation += deal.implantationValue;
    totalSuperBonus += comm.superMetaBonus;
    const vol = deal.monthlyValue + deal.implantationValue;
    if (deal.operation === "BluePex") bluePexVolume += vol;
    else opusTechVolume += vol;

    const basePercent = comm.monthlyBaseRate === 1 ? "100%" : "70%";

    return `
      <tr>
        <td>${format(new Date(deal.closingDate), "dd/MM/yyyy")}</td>
        <td>${deal.clientName}</td>
        <td><span class="badge ${deal.operation === "BluePex" ? "badge-blue" : "badge-purple"}">${deal.operation}</span></td>
        <td class="num">${formatCurrency(deal.monthlyValue)}</td>
        <td class="num">${formatCurrency(deal.implantationValue)}</td>
        <td class="num">${formatCurrency(comm.monthlyCommission)}</td>
        <td class="num">${formatCurrency(comm.implantationCommission)}</td>
        ${comm.superMetaBonus > 0 ? `<td class="num bold" style="color:#eab308">${formatCurrency(comm.superMetaBonus)}</td>` : `<td class="num">—</td>`}
        <td class="num bold">${formatCurrency(comm.totalCommission)}</td>
        <td><span class="status status-${deal.paymentStatus.toLowerCase()}">${deal.paymentStatus}</span></td>
      </tr>
      <tr class="detail-row">
        <td colspan="10" style="padding:4px 10px 8px 10px;background:#f8fafa;font-size:11px;color:#64748b;">
          <strong>Mensalidade:</strong> ${formatCurrency(deal.monthlyValue)} × ${basePercent} × ${rate}% = ${formatCurrency(comm.monthlyCommission)}
          &nbsp;|&nbsp;
          <strong>Implantação:</strong> ${formatCurrency(deal.implantationValue)} × 40% × ${rate}% = ${formatCurrency(comm.implantationCommission)}
          ${comm.superMetaBonus > 0 ? `&nbsp;|&nbsp;<strong style="color:#eab308">⚡ Super Meta:</strong> ${formatCurrency(comm.superMetaBonus)}` : ""}
        </td>
      </tr>`;
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Fechamentos — ${periodLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 1100px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #0d9488; padding-bottom: 20px; }
  .header h1 { font-size: 24px; color: #0d9488; }
  .header .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
  .header .date { font-size: 12px; color: #999; text-align: right; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .kpi { background: #f8fafa; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
  .kpi.highlight { background: #0d9488; color: white; }
  .kpi.highlight .kpi-label { color: rgba(255,255,255,0.8); }
  .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 4px; }
  .kpi-value { font-size: 22px; font-weight: 700; font-family: 'Courier New', monospace; }
  .section { margin-bottom: 28px; }
  .section h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #334155; border-left: 3px solid #0d9488; padding-left: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:hover { background: #fafbfc; }
  .detail-row td { border-bottom: 2px solid #e2e8f0; }
  .detail-row:hover { background: #f8fafa; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .bold { font-weight: 700; color: #0d9488; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-purple { background: #ede9fe; color: #7c3aed; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .status-pago { background: #dcfce7; color: #15803d; }
  .status-pendente { background: #fef9c3; color: #a16207; }
  .status-cancelado { background: #fecaca; color: #b91c1c; }
  .rules { background: #f8fafa; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; font-size: 12px; color: #64748b; }
  .rules strong { color: #334155; }
  .totals-row td { font-weight: 700; background: #f1f5f9; border-top: 2px solid #e2e8f0; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .summary-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .summary-item .label { color: #64748b; }
  .summary-item .val { font-weight: 600; font-family: 'Courier New', monospace; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Relatório de Fechamentos</h1>
      <div class="subtitle">Período: ${periodLabel}</div>
    </div>
    <div class="date">
      Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Salário Fixo</div>
      <div class="kpi-value">${formatCurrency(salary)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Comissão Projetada</div>
      <div class="kpi-value">${formatCurrency(totalProjected)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Comissão Paga</div>
      <div class="kpi-value">${formatCurrency(totalPaid)}</div>
    </div>
    <div class="kpi highlight">
      <div class="kpi-label">Total Geral</div>
      <div class="kpi-value">${formatCurrency(salary + totalPaid)}</div>
    </div>
  </div>

  <div class="section">
    <h2>Resumo por Operação</h2>
    <div class="summary-grid">
      <div>
        <div class="summary-item"><span class="label">BluePex — Volume</span><span class="val">${formatCurrency(bluePexVolume)}</span></div>
        <div class="summary-item"><span class="label">Opus Tech — Volume</span><span class="val">${formatCurrency(opusTechVolume)}</span></div>
      </div>
      <div>
        <div class="summary-item"><span class="label">Total Mensalidades</span><span class="val">${formatCurrency(totalMonthly)}</span></div>
        <div class="summary-item"><span class="label">Total Implantações</span><span class="val">${formatCurrency(totalImplantation)}</span></div>
        ${totalSuperBonus > 0 ? `<div class="summary-item"><span class="label" style="color:#eab308">⚡ Bônus Super Meta</span><span class="val" style="color:#eab308">${formatCurrency(totalSuperBonus)}</span></div>` : ""}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Fechamentos do Período (${deals.length} negócios)</h2>
    <table>
      <thead>
        <tr>
          <th>Data</th><th>Cliente</th><th>Operação</th>
          <th class="num">Mensalidade</th><th class="num">Implantação</th>
          <th class="num">Com. Mens.</th><th class="num">Com. Impl.</th>
          <th class="num">Super Meta</th><th class="num">Comissão Total</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
        <tr class="totals-row">
          <td colspan="3">TOTAIS</td>
          <td class="num">${formatCurrency(totalMonthly)}</td>
          <td class="num">${formatCurrency(totalImplantation)}</td>
          <td class="num" colspan="3"></td>
          <td class="num bold">${formatCurrency(totalProjected)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#94a3b8;margin-top:8px">* Estas comissões serão pagas até o dia 20 do mês subsequente.</p>
  </div>

  <div class="section">
    <h2>Regras Aplicadas</h2>
    <div class="rules">
      <p><strong>Comissão sobre Mensalidade:</strong> Base 100% (≥ 15 apres.) ou 70% (&lt; 15 apres.) × ${rate}% — verificada por operação no mês de fechamento</p>
      <p style="margin-top:6px"><strong>Comissão sobre Implantação:</strong> 40% do valor × ${rate}% (independente de apresentações)</p>
      <p style="margin-top:6px"><strong>Pagamento:</strong> Comissões pagas até o dia 20 do mês subsequente ao fechamento</p>
      <p style="margin-top:6px"><strong>Metas por Operação:</strong> BluePex e Opus Tech possuem contadores de apresentações separados</p>
    </div>
  </div>

  <div class="footer">
    <span>Relatório gerado automaticamente pelo sistema de Comissões</span>
    <span>Confidencial</span>
  </div>
</body>
</html>`;
}

export function downloadReportPDF(data: ReportData) {
  const html = generateReportHTML(data);
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 600);
  }
}

export function printReport(data: ReportData) {
  const html = generateReportHTML(data);
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
