-- =====================================================
-- SEED: Projeto Breakr com tarefas do ClickUp
-- Rodar após Docker/PostgreSQL estar disponível
-- =====================================================

-- 1. Criar projeto Breakr
INSERT INTO projects (workspace_id, name, prefix, description, color)
SELECT id, 'Breakr', 'BRK', 'Sistema Breakr - BPO Financeiro, Precificação e Gestão para restaurantes', '#f97316'
FROM workspaces LIMIT 1
ON CONFLICT DO NOTHING;

-- 2. Criar board "Desenvolvimento"
INSERT INTO boards (project_id, name, type, is_default)
SELECT p.id, 'Desenvolvimento', 'kanban', true
FROM projects p WHERE p.prefix = 'BRK'
ON CONFLICT DO NOTHING;

-- 3. Criar cliente Breakr
INSERT INTO clients (workspace_id, name, color, contact_email, is_active)
SELECT w.id, 'Breakr', '#f97316', 'contato@breakr.com.br', true
FROM workspaces w LIMIT 1
ON CONFLICT DO NOTHING;

-- 4. Buscar IDs necessários
DO $$
DECLARE
  v_ws_id UUID;
  v_proj_id UUID;
  v_board_id UUID;
  v_client_id UUID;
  v_status_todo UUID;
  v_status_progress UUID;
  v_type_historia UUID;
  v_type_tarefa UUID;
  v_type_bug UUID;
BEGIN
  SELECT id INTO v_ws_id FROM workspaces LIMIT 1;
  SELECT id INTO v_proj_id FROM projects WHERE prefix = 'BRK' LIMIT 1;
  SELECT id INTO v_board_id FROM boards WHERE project_id = v_proj_id AND is_default = true LIMIT 1;
  SELECT id INTO v_client_id FROM clients WHERE name = 'Breakr' LIMIT 1;
  SELECT id INTO v_status_todo FROM statuses WHERE name ILIKE '%INICI%' LIMIT 1;
  SELECT id INTO v_status_progress FROM statuses WHERE name ILIKE '%PROGR%' LIMIT 1;
  SELECT id INTO v_type_historia FROM ticket_types WHERE name ILIKE '%hist%' LIMIT 1;
  SELECT id INTO v_type_tarefa FROM ticket_types WHERE name ILIKE '%tare%' LIMIT 1;
  SELECT id INTO v_type_bug FROM ticket_types WHERE name ILIKE '%bug%' LIMIT 1;

  -- =====================================================
  -- VERSÃO 2.0 — Módulo BPO Financeiro
  -- =====================================================

  -- Epic: Tela Inicial
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Tela Inicial - Seletor de empresa',
    '<p><strong>Versão 2.0</strong></p><p>A tela Inicial precisa permitir escolher a empresa - como fazemos o financeiro dos clientes preciso ter a opção de escolher na tela inicial em qual cliente vou trabalhar.</p>', 'high');

  -- Epic: Área de Cadastros Base
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Cadastro de Integração (PDV)',
    '<p>Cadastrar Integração: Campos - Acesso ao PDV - exemplo: Suitable - buscar cadastro e vincular informações do sistema Suitable.</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Cadastro de Meios de Pagamento',
    '<p>Novo Meio de Pagamento: Ifood, Aiqfome, Cartão de Crédito, Cartão de Débito.</p><p>Campos vinculados: % de Taxa, Dias de Repasse.</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Cadastro de Fornecedores',
    '<p>Campos: CNPJ, Nome, dados bancários. Vincular conta bancária para pagamento via Open Finance.</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Cadastro de Contas Bancárias + Open Finance',
    '<p>Opções: manual e automático. Automação via API Open Finance dos bancos: Sicredi, Banrisul, Pagseguro, Ifood, Itaú, CEF, Sicoob, Safra, Stone, Santander, Asaas, Cora, Inter, Nubank, BB, Bradesco, Infinitepay, Mercado Pago.</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Cadastro de Categorias (lista/excel)',
    '<p>Permite inclusão por excel ou um a um.</p>', 'low');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Cadastro de Funcionários',
    '<p>Campos: Nome, CPF, Dados bancários, Cargo/Setor (Cozinha, Salão, Administrativo, Entrega), Freelancer/Motoboy, Variáveis (comissões, gorjetas, horas extras).</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Cadastro de Sócios + Pró-labore',
    '<p>Campos: Nome, CPF, Valor Pró-labore, Conta corrente pessoal. Regra: após atingir pró-labore, lançar como "Retirada de Capital".</p>', 'medium');

  -- Epic: Contas a Pagar
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Contas a Pagar - NF Eletrônica + Código de Barras + Manual',
    '<p>Opções de entrada: NF Eletrônica (XML), Código de Barras (boleto), Manual. Dados: Fornecedor, Valor, Vencimento, Previsão Pagamento, NF, Categoria, Impostos Retidos, Departamento, Recorrência/Parcelamento.</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Agendamento de pagamentos via banco (Open Finance)',
    '<p>Agendar pagamento selecionando banco vinculado. Caixa seleção se agendado. Opção pagamento parcial com histórico. Lançamentos em massa por planilha.</p>', 'high');

  -- Epic: Contas a Receber
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Contas a Receber - NF + Código + Manual + Buscar PDV',
    '<p>Buscar do PDV: formato planilha com valor, data venda, forma recebimento (PIX, Cartão, Ifood, Aiqfome). Dados: Cliente, Valor, Vencimento, NF, Categoria, Recorrência.</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Automação DDA - boletos caem automaticamente no sistema',
    '<p>Com automação Open Finance, boletos contra o CNPJ caem no DDA e são lançados automaticamente no sistema.</p>', 'medium');

  -- Epic: Relatórios
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Relatórios: Contas a Receber/Pagar, DRE, Fluxo de Caixa',
    '<p>Filtros por períodos dinâmicos. Opção de filtros e baixar em excel. Seleção em massa. Relatórios: Contas a Receber, Contas a Pagar, DRE, Fluxo de Caixa, Contas Recebidas, Contas Pagas.</p>', 'high');

  -- Epic: Dashboard
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Dashboard Dinâmico com gráficos',
    '<p>Dashboard dinâmico com gráficos. Selecionar informações dos relatórios e montar visão dinâmica com filtros.</p>', 'medium');

  -- Epic: Gestão Bancária
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Gestão Bancária - Conciliação + Transferências',
    '<p>Lista de bancos com saldo. Ícone/logo do banco. Conciliar conta bancária. Categorizar cada recebimento/pagamento. IA sugere categorização por padrão. Transferência entre contas.</p>', 'high');

  -- Epic: WhatsApp
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Automação WhatsApp - Receber documentos e lançar',
    '<p>Cliente informa empresa, envia documento/foto de boleto/NF. Tipo: nota/guia/boleto. Tipo lançamento: A receber/A pagar. Conta bancária. Categoria. Nome. Lançamento cai em lista para validação com 1 clique.</p>', 'medium');

  -- Epic: Painel de Acompanhamento
  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Painel de Acompanhamento - Atividades pendentes',
    '<p>Visão por cliente: Boletos vencendo, Agendamentos sem baixa, Informações sem validar, Conciliações a realizar. Emissão de NF. Emissão de Boletos/Cobrança.</p>', 'medium');

  -- =====================================================
  -- VERSÃO 1.2 — Correções
  -- =====================================================

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'Funcionários: campo custo total provisionamento (itens 3 a 7)',
    '<p>Criar campo de custo total de provisionamento por funcionário (sem salário e FGTS), junto com custo mensal efetivo. Custo total CLT, PJ, Freela com %. Aviso de risco para Freelancer.</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'Sócios: campo total pró-labore com custo real',
    '<p>Campo com Total de pró-labore com custo real (soma de todos os pró-labores).</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'Serviços recorrentes: aviso recorrência > 1 mês',
    '<p>Dedetização: aviso "Em caso de recorrência maior que um mês, dividir o valor pelo período recorrente. Ex: Trimestral R$ 150 = R$ 50/mês".</p>', 'low');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Sumário na tela inicial com todas as etapas',
    '<p>Na tela inicial adicionar sumário com todas as etapas para o cliente ter o mapa do caminho.</p>', 'low');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'Custos operacionais: acrescentar "Descartáveis (Média)"',
    '<p>Acrescentar campo "Descartáveis (Média)" com dica sobre embalagens delivery/salão e média dos últimos 3 meses.</p>', 'low');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'Painel: custos variáveis totais - % divergente (52% vs 46%)',
    '<p>O que compõe os custos variáveis totais? E por que está mostrando % diferente 52% e 46%?</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Painel ADM: visão DRE Aberto com valores',
    '<p>No painel ADM preciso ter a visão de um DRE Aberto com seus respectivos valores (Receita Operacional Bruta, Deduções, Custos, Despesas, Resultado Operacional, Lucro Líquido, Pró Labore).</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'Base: tirar provisionamento e depreciação do cálculo',
    '<p>Deixar somente salário + FGTS no cálculo. Manter dados no painel financeiro ou checkbox para apresentar BASE com/sem provisionamento (padrão: sem).</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'DRE: renomear CMV para "CMV Teórico"',
    '<p>A descrição correta para CMV é "CMV Teórico".</p>', 'low');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'Fichas Técnicas: gramatura kg/gr e indexação de insumos',
    '<p>Dados de gramatura diferentes (kg vs gr). Fichas não indexadas aos ingredientes - alterar insumo deve atualizar em todas as fichas que o usam.</p>', 'urgent');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Antecipação de Recebíveis - nova página',
    '<p>Página para antecipação em operadoras de cartão ou marketplaces. Campos: taxa a.m., valor médio, dias antecipados. Cálculos de valor líquido, taxa/dia, desconto total, valor final. Aparecer como "Dinheiro na Mesa" no Painel.</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Empréstimos e Financiamentos - nova página',
    '<p>Criar nova página com contexto "Empréstimos e Financiamentos".</p>', 'low');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Ficha técnica: personalizar categorias',
    '<p>Opção de personalizar as categorias (prato principal para baguete, por exemplo).</p>', 'low');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'SUPER ADMIN: verificação antes de excluir projeto',
    '<p>Criar sistema de verificação antes de excluir um projeto.</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Painel de Administração do sistema',
    '<p>Criar Painel de Administração do sistema.</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_tarefa, v_status_todo,
    'Implementar 2FA por email para login',
    '<p>Colocar 2FA (email) para logar. Personalizar emails do no-reply@breakr.com.br com logo do Hub.</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_bug, v_status_todo,
    'Remover modal ao clicar em BASE - substituir por indicadores',
    '<p>Essa janela que abre ao clicar na BASE precisa ser de indicadores de precificação dentro do painel ou fichas técnicas.</p>', 'medium');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Fichas Técnicas MODULARES para Pizzas e compostos',
    '<p>Tipo de fichas técnicas MODULAR para Pizzas e outros produtos compostos e dinâmicos.</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Insumos prontos pré-preparados (compostos)',
    '<p>Toggle: Insumo Pronto vs Pré-preparo/Componente. Se pré-preparado, escolher ingredientes base. Ex: Molho de Tomate (tomate, sal, alho, cebola). Massa de pizza (farinha, água, fermento).</p>', 'high');

  INSERT INTO tickets (workspace_id, project_id, board_id, client_id, ticket_type_id, status_id, title, description, priority)
  VALUES (v_ws_id, v_proj_id, v_board_id, v_client_id, v_type_historia, v_status_todo,
    'Menu de Precificação interativo (BASE + CMV + Lucro)',
    '<p>Tela interativa: escolher produto com ficha técnica, arrastar switch lucro 10-30%, indicador de preço no cardápio próprio e marketplace. Fórmula: CMV máx = 100% - BASE(25%) - Lucro alvo.</p>', 'high');

END $$;
