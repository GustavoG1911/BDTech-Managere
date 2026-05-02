-- ═══════════════════════════════════════════════════════════════
-- 🌱 MOCK DATA MASTER - SQL Seed + Migration de Isolamento
-- ═══════════════════════════════════════════════════════════════
-- Execute este script inteiro no SQL Editor do Supabase Dashboard.
-- Ele cria a coluna de isolamento, os auth users e popula 50 deals.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;

-- Marcar todos os dados existentes como produção (explicitamente)
UPDATE deals SET is_test_data = false WHERE is_test_data IS NULL;
UPDATE profiles SET is_test_data = false WHERE is_test_data IS NULL;

-- ─── PERSONAS DE TESTE ───
-- ADMIN:   aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001  (diretor@teste.com)
-- GESTOR:  aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002  (executivo@teste.com)
-- SDR:     aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003  (sdr@teste.com)
-- Senha padrão: teste123

-- ─── STEP 0: Limpar dados de teste anteriores ───
DELETE FROM deals WHERE user_id IN ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003');
DELETE FROM profiles WHERE user_id IN ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003');
DELETE FROM auth.identities WHERE user_id IN ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003');
DELETE FROM auth.users WHERE id IN ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003');

-- Remover usuário teste legado (teste@teste.com)
DELETE FROM deals WHERE user_id = (SELECT id FROM auth.users WHERE email = 'teste@teste.com');
DELETE FROM profiles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'teste@teste.com');
DELETE FROM auth.identities WHERE user_id = (SELECT id FROM auth.users WHERE email = 'teste@teste.com');
DELETE FROM auth.users WHERE email = 'teste@teste.com';

-- ─── STEP 1: Criar Auth Users (Supabase Auth) ───
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token
) VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001',
  '00000000-0000-0000-0000-000000000000',
  'diretor@teste.com',
  crypt('teste123', gen_salt('bf')),
  now(),
  'authenticated', 'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Ricardo Diretor (Teste)"}',
  now(), now(), '', ''
), (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002',
  '00000000-0000-0000-0000-000000000000',
  'executivo@teste.com',
  crypt('teste123', gen_salt('bf')),
  now(),
  'authenticated', 'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Carlos Executivo (Teste)"}',
  now(), now(), '', ''
), (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003',
  '00000000-0000-0000-0000-000000000000',
  'sdr@teste.com',
  crypt('teste123', gen_salt('bf')),
  now(),
  'authenticated', 'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Ana SDR (Teste)"}',
  now(), now(), '', ''
);

-- Criar identidades de email
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001',
  jsonb_build_object('sub', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'email', 'diretor@teste.com'),
  'email', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001',
  now(), now(), now()
), (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002',
  jsonb_build_object('sub', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'email', 'executivo@teste.com'),
  'email', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002',
  now(), now(), now()
), (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003',
  jsonb_build_object('sub', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 'email', 'sdr@teste.com'),
  'email', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003',
  now(), now(), now()
);

-- ─── STEP 2: Criar Profiles de Teste (is_test_data = true) ───
INSERT INTO profiles (user_id, full_name, display_name, role, commission_percent, fixed_salary, job_title, is_test_data)
VALUES
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'Ricardo Diretor (Teste)', 'Ricardo Diretor', 'admin', 0, 8000, 'Diretor', true),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'Carlos Executivo (Teste)', 'Carlos Executivo', 'user', 15, 5000, 'Executivo de Negócios', true),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 'Ana SDR (Teste)', 'Ana SDR', 'user', 10, 2500, 'SDR', true)
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  commission_percent = EXCLUDED.commission_percent,
  fixed_salary = EXCLUDED.fixed_salary,
  job_title = EXCLUDED.job_title,
  is_test_data = true;

-- ─── STEP 3: Inserir 50 Deals Fictícios (is_test_data = true) ───
-- Todos com is_test_data = true para isolamento total

-- BLOCO 1: PASSADO (Jan/Fev/Mar 2026) — 20 deals
-- Janeiro 2026 (7 deals - todos pagos, distribuídos entre Executivo e SDR)
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('TechNova Labs',     'BluePex',   1200, 1500, '2025-12-05', '2026-01-04', '2026-01-04', 'Pago', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 180.00,  true,  true,  true, true, true),
('Autoparts Brasil',  'BluePex',   2800, 3000, '2025-12-10', '2026-01-09', '2026-01-09', 'Pago', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 400.00,  true,  true,  true, true, true),
('Grupo Zeta',        'Opus Tech', 4500, 5000, '2025-12-15', '2026-01-14', '2026-01-14', 'Pago', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 650.00,  true,  true,  true, true, true),
('MegaStore Digital', 'BluePex',   1800, 2000, '2025-12-08', '2026-01-07', '2026-01-07', 'Pago', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 390.00,  true,  true,  true, true, true),
('CloudSec Solutions','Opus Tech', 3200, 0,    '2025-12-20', '2026-01-19', '2026-01-19', 'Pago', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 480.00,  true,  true,  true, false, true),
('SkyNet Telecom',    'BluePex',   2200, 1800, '2025-12-03', '2026-01-02', '2026-01-02', 'Pago', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 438.00,  true,  true,  true, true, true),
('DataVault Inc',     'Opus Tech', 3800, 2500, '2025-12-12', '2026-01-11', '2026-01-11', 'Pago', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 480.00,  true,  true,  true, true, true);

-- Fevereiro 2026 (7 deals - pagos + aguardando SDR)
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('FarmaTech S.A.',    'BluePex',   950,  750,  '2026-01-03', '2026-02-02', '2026-02-02', 'Pago',     'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 125.00,  true,  true,  true, true, true),
('OceanBlue Log.',    'BluePex',   1400, 0,    '2026-01-12', '2026-02-11', '2026-02-11', 'Pago',     'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 140.00,  true,  true,  true, false, true),
('Pinnacle Corp',     'Opus Tech', 2200, 1800, '2026-01-18', '2026-02-17', '2026-02-17', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 292.00,  true,  false, false, false, true),
('NexGen Fibra',      'BluePex',   3100, 2500, '2026-01-05', '2026-02-04', '2026-02-04', 'Pago',     'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 615.00,  true,  true,  true, true, true),
('EcoSolar Energy',   'Opus Tech', 5200, 4000, '2026-01-22', '2026-02-21', '2026-02-21', 'Pago',     'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 1020.00, true,  true,  true, true, true),
('MetaForge AI',      'BluePex',   1600, 1200, '2026-01-08', '2026-02-07', '2026-02-07', 'Pago',     'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 312.00,  true,  true,  true, true, true),
('Quantum Dynamics',  'Opus Tech', 4200, 3000, '2026-01-15', '2026-02-14', '2026-02-14', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 540.00,  true,  false, false, false, true);

-- Março 2026 (6 deals - mistura de status + volumetria)
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('BioVida Saúde',     'BluePex',   1750, 900,  '2026-02-04', '2026-03-06', '2026-03-06', 'Pago',     'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 211.00,  true,  true,  true, true, true),
('RapidPay Fintech',  'Opus Tech', 3400, 2700, '2026-02-14', '2026-03-16', '2026-03-16', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 448.00,  true,  false, false, false, true),
('Atlas Mineração',   'BluePex',   600,  0,    '2026-02-25', '2026-03-27', '2026-03-27', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 60.00,   false, false, false, false, true),
('Vortex Energia',    'Opus Tech', 4800, 3500, '2026-02-10', '2026-03-12', '2026-03-12', 'Pago',     'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 930.00,  true,  true,  true, true, true),
('CyberShield Pro',   'BluePex',   2100, 1200, '2026-02-28', '2026-03-30', '2026-03-30', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 387.00,  true,  false, false, false, true),
('SparkForge Robot.', 'BluePex',   800,  500,  '2026-02-01', '2026-03-03', '2026-03-03', 'Pago',     'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 100.00,  true,  true,  true, true, true);

-- BLOCO 2: MÊS ATUAL (Abril 2026) — 10 deals para testar Transbordo do Dia 7
-- Pagamentos ANTES ou NO dia 7 → comissão em 20/Abril (mesmo mês)
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('Integra ERP',       'BluePex',   1100, 800,  '2026-03-05', '2026-04-04', '2026-04-04', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 142.00,  false, false, false, false, true),
('SmartGrid IoT',     'Opus Tech', 2000, 1500, '2026-03-06', '2026-04-05', '2026-04-05', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 260.00,  false, false, false, false, true),
('ApexTrade Global',  'BluePex',   3500, 2800, '2026-03-08', '2026-04-07', '2026-04-07', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 462.00,  true,  false, false, false, true),
('GreenField Agro',   'BluePex',   4200, 3000, '2026-03-04', '2026-04-03', '2026-04-03', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 810.00,  false, false, false, false, true),
('NovaFront UI',      'Opus Tech', 6000, 5000, '2026-03-07', '2026-04-06', '2026-04-06', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 1200.00, false, false, false, false, true);

-- Pagamentos DEPOIS do dia 7 → comissão empurrada para 20/MAIO (transbordo!)
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('CoreStack Infra',   'BluePex',   1300, 600,  '2026-03-10', '2026-04-09', '2026-04-09', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 154.00,  false, false, false, false, true),
('PulseWave Media',   'Opus Tech', 4100, 3200, '2026-03-15', '2026-04-14', '2026-04-14', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 538.00,  false, false, false, false, true),
('BlueHorizon Travel','BluePex',   2700, 2000, '2026-03-20', '2026-04-19', '2026-04-19', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 350.00,  false, false, false, false, true),
('SwiftCode Labs',    'Opus Tech', 5500, 4500, '2026-03-12', '2026-04-11', '2026-04-11', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 1095.00, false, false, false, false, true),
('IronClad Security', 'BluePex',   3800, 2800, '2026-03-25', '2026-04-24', '2026-04-24', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 738.00,  false, false, false, false, true);

-- BLOCO 3: FUTURO (Mai–Dez 2026) — 20 deals
-- Todos fechados no PASSADO, mas com pagamentos futuros (contratos longos)
-- Maio 2026 (4 deals) - fechados em Mar/Abr, pagamento em Maio
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('NetSphere Hosting', 'BluePex',   1900, 1200, '2026-03-01', '2026-05-02', '2026-05-02', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 238.00,  false, false, false, false, true),
('PrimeData Analyt.', 'Opus Tech', 3600, 2800, '2026-03-15', '2026-05-15', '2026-05-15', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 472.00,  false, false, false, false, true),
('VeloCity Courier',  'BluePex',   2500, 1800, '2026-03-05', '2026-05-05', '2026-05-05', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 483.00,  false, false, false, false, true),
('InfiniLoop Games',  'Opus Tech', 7200, 6000, '2026-03-20', '2026-05-20', '2026-05-20', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 1440.00, false, false, false, false, true);

-- Junho 2026 (3 deals) - fechados em Mar/Abr, pagamento em Junho
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('HydraCloud PaaS',   'BluePex',   2100, 1500, '2026-03-10', '2026-06-09', '2026-06-09', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 270.00,  false, false, false, false, true),
('TitanBridge Cap.',  'Opus Tech', 4900, 3800, '2026-03-18', '2026-06-17', '2026-06-17', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 642.00,  false, false, false, false, true),
('PixelCraft Studio', 'BluePex',   3300, 2200, '2026-03-22', '2026-06-21', '2026-06-21', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 627.00,  false, false, false, false, true);

-- Julho 2026 (3 deals) - fechados em Fev/Mar, pagamento em Julho
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('SilverPeak Mining', 'Opus Tech', 5500, 4200, '2026-02-08', '2026-07-08', '2026-07-08', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 718.00,  false, false, false, false, true),
('ZenithTech Corp',   'BluePex',   2800, 2000, '2026-02-15', '2026-07-15', '2026-07-15', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 540.00,  false, false, false, false, true),
('OrbitalEdge Space', 'Opus Tech', 6100, 5000, '2026-02-25', '2026-07-25', '2026-07-25', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 1215.00, false, false, false, false, true);

-- Agosto 2026 (2 deals) - fechados em Mar, pagamento em Agosto
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('FlexStack Dev',     'BluePex',   1600, 1000, '2026-03-12', '2026-08-11', '2026-08-11', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 200.00,  false, false, false, false, true),
('DeltaOps Consult.', 'Opus Tech', 8500, 7000, '2026-03-20', '2026-08-19', '2026-08-19', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 1695.00, false, false, false, false, true);

-- Setembro 2026 (2 deals) - fechados em Abr, pagamento em Setembro
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('ArcticNode CDN',    'Opus Tech', 3800, 2900, '2026-04-05', '2026-09-04', '2026-09-04', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 496.00,  false, false, false, false, true),
('TerraByte Storage', 'BluePex',   4200, 3100, '2026-04-08', '2026-09-17', '2026-09-17', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 816.00,  false, false, false, false, true);

-- Outubro 2026 (2 deals) - fechados em Mar/Abr, pagamento em Outubro
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('MagnaVolt Power',   'BluePex',   2400, 1800, '2026-03-10', '2026-10-10', '2026-10-10', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 312.00,  false, false, false, false, true),
('Sapphire Retail',   'Opus Tech', 5800, 4500, '2026-03-22', '2026-10-22', '2026-10-22', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 1140.00, false, false, false, false, true);

-- Novembro 2026 (2 deals) - fechados em Abr, pagamento em Novembro
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('EchoStream Audio',  'Opus Tech', 6200, 4800, '2026-04-07', '2026-11-06', '2026-11-06', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 812.00,  false, false, false, false, true),
('VaultLine Crypto',  'BluePex',   3500, 2600, '2026-04-05', '2026-11-14', '2026-11-14', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 681.00,  false, false, false, false, true);

-- Dezembro 2026 (2 deals) - fechados em Abr, pagamento em Dezembro
INSERT INTO deals (client_name, operation, monthly_value, implantation_value, closing_date, first_payment_date, implantation_payment_date, payment_status, user_id, commission_rate_snapshot, commission_amount_snapshot, is_paid_to_user, is_user_confirmed_payment, is_mensalidade_paid_by_client, is_implantacao_paid_by_client, is_test_data) VALUES
('NeuroLink Health',  'BluePex',   4000, 3200, '2026-04-03', '2026-12-03', '2026-12-03', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 0.10, 528.00,  false, false, false, false, true),
('CrestWave Marine',  'Opus Tech', 9200, 7500, '2026-04-08', '2026-12-20', '2026-12-20', 'Pendente', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 0.15, 1830.00, false, false, false, false, true);

-- ─── RELATÓRIO ───
SELECT 'SEED COMPLETO!' AS status, COUNT(*) AS total_deals
FROM deals
WHERE is_test_data = true;
