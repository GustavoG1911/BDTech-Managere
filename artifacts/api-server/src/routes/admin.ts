import { Router, Response } from "express";
import { db } from "@workspace/db";
import { dealsTable, presentationsTable, commissionPaymentsTable, salaryPaymentsTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthWithRole, requireGestor, AuthRequest } from "../middlewares/auth";

const router = Router();

function addDays(dateStr: string, days: number): string {
  const dt = new Date(dateStr + "T12:00:00");
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

const clientNames = [
  "TechNova Labs", "Autoparts Brasil", "Grupo Zeta", "MegaStore Digital",
  "CloudSec Solutions", "DataVault Inc", "FarmaTech S.A.", "OceanBlue Logística",
  "Pinnacle Corp", "SkyNet Telecomunicações", "NexGen Fibra", "EcoSolar Energy",
  "MetaForge AI", "Quantum Dynamics", "BioVida Saúde", "RapidPay Fintech",
  "Atlas Mineração", "Vortex Energia", "CyberShield Pro", "Integra ERP",
  "SmartGrid IoT", "ApexTrade Global", "GreenField Agro", "NovaFront UI",
  "CoreStack Infra", "PulseWave Media", "BlueHorizon Travel", "SwiftCode Labs",
  "IronClad Security", "NetSphere Hosting", "PrimeData Analytics", "VeloCity Courier",
  "InfiniLoop Games", "HydraCloud PaaS", "TitanBridge Capital", "PixelCraft Studio",
  "SilverPeak Mining", "ZenithTech Corp", "OrbitalEdge Space", "FlexStack Dev",
];

interface SeedDealInput {
  clientName: string;
  operation: string;
  monthlyValue: string;
  implantationValue: string;
  closingDate: string;
  firstPaymentDate: string;
  implantationPaymentDate: string;
  paymentStatus: string;
  userId: string;
  sdrUserId: string;
  isTestData: true;
  commissionRateSnapshot: string;
  commissionAmountSnapshot: string;
  isPaidToUser: boolean;
  isUserConfirmedPayment: boolean;
  isMensalidadePaidByClient: boolean;
  isImplantacaoPaidByClient: boolean;
}

function makeDeal(
  index: number,
  closingDate: string,
  firstPaymentDate: string,
  operation: "BluePex" | "Opus Tech",
  monthlyValue: number,
  implantationValue: number,
  status: "pago" | "aguardando_sdr" | "pendente",
  commissionRate: number,
  executivoId: string,
  sdrId: string
): SeedDealInput {
  const implPayment = addDays(closingDate, 30);
  const commSnapshot = Math.round(
    (monthlyValue * commissionRate + implantationValue * 0.4 * commissionRate) * 100
  ) / 100;

  return {
    clientName: clientNames[index % clientNames.length],
    operation,
    monthlyValue: String(monthlyValue),
    implantationValue: String(implantationValue),
    closingDate,
    firstPaymentDate,
    implantationPaymentDate: implPayment,
    paymentStatus: status === "pendente" ? "Pendente" : "Pago",
    userId: executivoId,
    sdrUserId: sdrId,
    isTestData: true,
    commissionRateSnapshot: String(commissionRate),
    commissionAmountSnapshot: String(commSnapshot),
    isPaidToUser: status === "pago" || status === "aguardando_sdr",
    isUserConfirmedPayment: status === "pago",
    isMensalidadePaidByClient: status === "pago",
    isImplantacaoPaidByClient: status === "pago" && implantationValue > 0,
  };
}

router.post("/seed", requireAuthWithRole, requireGestor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const executivoId = req.userId;
    const { sdrUserId } = req.body as { sdrUserId?: string };
    const sdrId = sdrUserId || req.userId;
    const RATE = 0.20;
    let i = 0;

    const deals: SeedDealInput[] = [
      makeDeal(i++, "2025-12-05", "2026-01-04", "BluePex",   1200, 1500, "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2025-12-10", "2026-01-09", "BluePex",   2800, 3000, "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2025-12-15", "2026-01-14", "Opus Tech", 4500, 5000, "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2025-12-08", "2026-01-07", "BluePex",   1800, 2000, "aguardando_sdr", RATE, executivoId, sdrId),
      makeDeal(i++, "2025-12-20", "2026-01-19", "Opus Tech", 3200, 0,    "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-01-03", "2026-02-02", "BluePex",   950,  750,  "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-01-12", "2026-02-11", "BluePex",   1400, 0,    "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-01-18", "2026-02-17", "Opus Tech", 2200, 1800, "aguardando_sdr", RATE, executivoId, sdrId),
      makeDeal(i++, "2026-01-05", "2026-02-04", "BluePex",   3100, 2500, "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-01-22", "2026-02-21", "Opus Tech", 5200, 4000, "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-02-04", "2026-03-05", "BluePex",   1750, 900,  "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-02-14", "2026-03-15", "Opus Tech", 3400, 2700, "aguardando_sdr", RATE, executivoId, sdrId),
      makeDeal(i++, "2026-02-25", "2026-03-26", "BluePex",   600,  0,    "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-02-10", "2026-03-11", "Opus Tech", 4800, 3500, "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-02-28", "2026-03-29", "BluePex",   2100, 1200, "aguardando_sdr", RATE, executivoId, sdrId),
      makeDeal(i++, "2026-02-01", "2026-03-02", "BluePex",   800,  500,  "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-02-02", "2026-03-03", "BluePex",   950,  400,  "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-02-03", "2026-03-04", "BluePex",   700,  0,    "pago",           RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-05", "2026-04-04", "BluePex",   1100, 800,  "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-06", "2026-04-05", "Opus Tech", 2000, 1500, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-08", "2026-04-07", "BluePex",   3500, 2800, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-04", "2026-04-03", "BluePex",   4200, 3000, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-07", "2026-04-06", "Opus Tech", 6000, 5000, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-10", "2026-04-09", "BluePex",   1300, 600,  "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-15", "2026-04-14", "Opus Tech", 4100, 3200, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-20", "2026-04-19", "BluePex",   2700, 2000, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-12", "2026-04-11", "Opus Tech", 5500, 4500, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-03-25", "2026-04-24", "BluePex",   3800, 2800, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-04-02", "2026-05-01", "BluePex",   1900, 1200, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-04-15", "2026-05-14", "Opus Tech", 3600, 2800, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-04-05", "2026-05-04", "BluePex",   2500, 1800, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-04-20", "2026-05-19", "Opus Tech", 7200, 6000, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-05-10", "2026-06-09", "BluePex",   2100, 1500, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-05-18", "2026-06-17", "Opus Tech", 4900, 3800, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-05-22", "2026-06-21", "BluePex",   3300, 2200, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-06-08", "2026-07-07", "Opus Tech", 5500, 4200, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-06-15", "2026-07-14", "BluePex",   2800, 2000, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-06-25", "2026-07-24", "Opus Tech", 6100, 5000, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-07-12", "2026-08-11", "BluePex",   1600, 1000, "pendente",       RATE, executivoId, sdrId),
      makeDeal(i++, "2026-07-20", "2026-08-19", "Opus Tech", 8500, 7000, "pendente",       RATE, executivoId, sdrId),
    ];

    const presentations = [
      { userId: sdrId, operation: "BluePex",   count: 8,  date: "2026-01-01", isTestData: true as const },
      { userId: sdrId, operation: "Opus Tech", count: 6,  date: "2026-01-01", isTestData: true as const },
      { userId: sdrId, operation: "BluePex",   count: 15, date: "2026-02-01", isTestData: true as const },
      { userId: sdrId, operation: "Opus Tech", count: 12, date: "2026-02-01", isTestData: true as const },
      { userId: sdrId, operation: "BluePex",   count: 32, date: "2026-03-01", isTestData: true as const },
      { userId: sdrId, operation: "Opus Tech", count: 10, date: "2026-03-01", isTestData: true as const },
      { userId: sdrId, operation: "BluePex",   count: 10, date: "2026-04-01", isTestData: true as const },
      { userId: sdrId, operation: "Opus Tech", count: 8,  date: "2026-04-01", isTestData: true as const },
    ];

    await db.delete(dealsTable).where(eq(dealsTable.isTestData, true));
    await db.delete(presentationsTable).where(eq(presentationsTable.isTestData, true));

    for (let batch = 0; batch < deals.length; batch += 10) {
      await db.insert(dealsTable).values(deals.slice(batch, batch + 10));
    }
    await db.insert(presentationsTable).values(presentations);

    res.json({ dealCount: deals.length, presentationCount: presentations.length });
  } catch (err) {
    console.error("[admin/seed]", err);
    res.status(500).json({ error: "Failed to seed test data" });
  }
});

router.post("/clear", requireAuthWithRole, requireGestor, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await db.delete(dealsTable).where(eq(dealsTable.isTestData, true));
    await db.delete(presentationsTable).where(eq(presentationsTable.isTestData, true));
    await db.delete(commissionPaymentsTable).where(eq(commissionPaymentsTable.isTestData, true));
    await db.delete(salaryPaymentsTable).where(eq(salaryPaymentsTable.isTestData, true));
    await db.delete(notificationsTable).where(eq(notificationsTable.isTestData, true));
    res.json({ success: true });
  } catch (err) {
    console.error("[admin/clear]", err);
    res.status(500).json({ error: "Failed to clear test data" });
  }
});

export default router;
