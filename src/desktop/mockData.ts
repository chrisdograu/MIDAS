import { statusBadgeClass, toneBadge } from "@/lib/semanticTone";

// Mock data for all desktop backoffice modules

export const mockProdutos = [
  { id: '1', title: 'The Legend of Zelda: TOTK', description: 'Aventura épica em mundo aberto', category: 'Jogos Digitais', platform: 'Nintendo Switch', price: 299.90, cost_price: 180.00, stock: 45, stock_alert_threshold: 10, product_type: 'digital' as const, is_active: true, image_url: 'https://placehold.co/80x80/14B8A6/fff?text=Zelda', supplier: 'Nintendo Brasil', rating: 4.8, created_at: '2025-01-15' },
  { id: '2', title: 'God of War Ragnarök', description: 'Ação e aventura nórdica', category: 'Jogos Físicos', platform: 'PS5', price: 249.90, cost_price: 150.00, stock: 32, stock_alert_threshold: 8, product_type: 'physical' as const, is_active: true, image_url: 'https://placehold.co/80x80/A855F7/fff?text=GoW', supplier: 'Sony Interactive', rating: 4.9, created_at: '2025-02-10' },
  { id: '3', title: 'Controle DualSense Edge', description: 'Controle premium PS5', category: 'Acessórios', platform: 'PS5', price: 1299.90, cost_price: 900.00, stock: 3, stock_alert_threshold: 5, product_type: 'physical' as const, is_active: true, image_url: 'https://placehold.co/80x80/EF4444/fff?text=Ctrl', supplier: 'Sony Interactive', rating: 4.5, created_at: '2025-03-01' },
  { id: '4', title: 'Xbox Game Pass Ultimate 3M', description: 'Assinatura 3 meses', category: 'Assinaturas', platform: 'Xbox / PC', price: 149.90, cost_price: 100.00, stock: 999, stock_alert_threshold: 50, product_type: 'subscription' as const, is_active: true, image_url: 'https://placehold.co/80x80/22C55E/fff?text=GP', supplier: 'Microsoft', rating: 4.7, created_at: '2025-01-20' },
  { id: '5', title: 'Headset HyperX Cloud III', description: 'Headset gamer 7.1', category: 'Acessórios', platform: 'Multiplataforma', price: 599.90, cost_price: 350.00, stock: 12, stock_alert_threshold: 5, product_type: 'physical' as const, is_active: true, image_url: 'https://placehold.co/80x80/F59E0B/fff?text=HX', supplier: 'HyperX Distribuidora', rating: 4.6, created_at: '2025-02-15' },
  { id: '6', title: 'Elden Ring', description: 'RPG de ação em mundo aberto', category: 'Jogos Digitais', platform: 'PC / PS5 / Xbox', price: 199.90, cost_price: 120.00, stock: 0, stock_alert_threshold: 10, product_type: 'digital' as const, is_active: false, image_url: 'https://placehold.co/80x80/6B7280/fff?text=ER', supplier: 'Bandai Namco', rating: 4.9, created_at: '2024-12-01' },
  { id: '7', title: 'Nintendo Switch OLED', description: 'Console Nintendo edição OLED', category: 'Consoles', platform: 'Nintendo Switch', price: 2499.90, cost_price: 1800.00, stock: 7, stock_alert_threshold: 3, product_type: 'physical' as const, is_active: true, image_url: 'https://placehold.co/80x80/3B82F6/fff?text=NSW', supplier: 'Nintendo Brasil', rating: 4.7, created_at: '2025-03-10' },
  { id: '8', title: 'PS5 Slim Digital', description: 'Console PlayStation 5 edição digital', category: 'Consoles', platform: 'PS5', price: 3499.90, cost_price: 2800.00, stock: 5, stock_alert_threshold: 3, product_type: 'physical' as const, is_active: true, image_url: 'https://placehold.co/80x80/8B5CF6/fff?text=PS5', supplier: 'Sony Interactive', rating: 4.8, created_at: '2025-01-05' },
];

export const mockFuncionarios = [
  { id: '1', display_name: 'Carlos Silva', email: 'carlos@midias.com', role: 'admin' as const, phone: '(11) 99999-0001', created_at: '2024-06-01', is_active: true },
  { id: '2', display_name: 'Ana Oliveira', email: 'ana@midias.com', role: 'atendente' as const, phone: '(11) 99999-0002', created_at: '2024-08-15', is_active: true },
  { id: '3', display_name: 'Pedro Santos', email: 'pedro@midias.com', role: 'atendente' as const, phone: '(11) 99999-0003', created_at: '2025-01-10', is_active: true },
  { id: '4', display_name: 'Maria Costa', email: 'maria@midias.com', role: 'atendente' as const, phone: '(11) 99999-0004', created_at: '2024-12-01', is_active: false },
];

export const mockClientes = [
  { id: '1', display_name: 'João Mendes', email: 'joao@email.com', phone: '(11) 98888-1111', cpf: '123.456.789-00', total_compras: 5, total_gasto: 1549.50, created_at: '2024-10-01' },
  { id: '2', display_name: 'Fernanda Lima', email: 'fernanda@email.com', phone: '(21) 97777-2222', cpf: '987.654.321-00', total_compras: 12, total_gasto: 4230.80, created_at: '2024-07-15' },
  { id: '3', display_name: 'Lucas Rocha', email: 'lucas@email.com', phone: '(31) 96666-3333', cpf: '456.789.123-00', total_compras: 3, total_gasto: 899.70, created_at: '2025-01-20' },
  { id: '4', display_name: 'Beatriz Alves', email: 'bia@email.com', phone: '(41) 95555-4444', cpf: '321.654.987-00', total_compras: 8, total_gasto: 2780.40, created_at: '2024-09-05' },
  { id: '5', display_name: 'Rafael Dias', email: 'rafael@email.com', phone: '(51) 94444-5555', cpf: '654.321.987-00', total_compras: 1, total_gasto: 299.90, created_at: '2025-03-01' },
];

export const mockFornecedores = [
  { id: '1', name: 'Nintendo Brasil', cnpj: '12.345.678/0001-01', contact_name: 'Roberto Yamada', email: 'contato@nintendo.com.br', phone: '(11) 3333-1111', is_active: true, produtos_count: 15, notes: 'Distribuidor oficial Nintendo' },
  { id: '2', name: 'Sony Interactive', cnpj: '23.456.789/0001-02', contact_name: 'Patricia Souza', email: 'comercial@sony.com.br', phone: '(11) 3333-2222', is_active: true, produtos_count: 22, notes: 'PlayStation e acessórios' },
  { id: '3', name: 'Microsoft', cnpj: '34.567.890/0001-03', contact_name: 'André Lima', email: 'parceiros@microsoft.com', phone: '(11) 3333-3333', is_active: true, produtos_count: 18, notes: 'Xbox e Game Pass' },
  { id: '4', name: 'HyperX Distribuidora', cnpj: '45.678.901/0001-04', contact_name: 'Marcos Vieira', email: 'vendas@hyperx.com.br', phone: '(11) 3333-4444', is_active: true, produtos_count: 8, notes: 'Periféricos gamer' },
  { id: '5', name: 'Bandai Namco', cnpj: '56.789.012/0001-05', contact_name: 'Yuki Tanaka', email: 'latam@bandainamco.com', phone: '(11) 3333-5555', is_active: false, produtos_count: 6, notes: 'Distribuidor de jogos japoneses' },
];

export const mockCategorias = [
  { id: '1', name: 'Jogos Digitais', description: 'Keys e códigos digitais', produtos_count: 45, image_url: 'https://placehold.co/120x80/14B8A6/fff?text=Digital' },
  { id: '2', name: 'Jogos Físicos', description: 'Mídias físicas (disco/cartucho)', produtos_count: 38, image_url: 'https://placehold.co/120x80/A855F7/fff?text=Físico' },
  { id: '3', name: 'Consoles', description: 'Consoles de videogame', produtos_count: 12, image_url: 'https://placehold.co/120x80/3B82F6/fff?text=Console' },
  { id: '4', name: 'Acessórios', description: 'Controles, headsets, cabos', produtos_count: 25, image_url: 'https://placehold.co/120x80/F59E0B/fff?text=Acess.' },
  { id: '5', name: 'Assinaturas', description: 'Game Pass, PS Plus, etc.', produtos_count: 8, image_url: 'https://placehold.co/120x80/22C55E/fff?text=Subs' },
  { id: '6', name: 'Retro', description: 'Jogos e consoles clássicos', produtos_count: 15, image_url: 'https://placehold.co/120x80/EF4444/fff?text=Retro' },
  { id: '7', name: 'PC Gaming', description: 'Periféricos e componentes PC', produtos_count: 20, image_url: 'https://placehold.co/120x80/8B5CF6/fff?text=PC' },
  { id: '8', name: 'Colecionáveis', description: 'Figuras, steelbooks, edições limitadas', produtos_count: 10, image_url: 'https://placehold.co/120x80/EC4899/fff?text=Colec.' },
];

export const mockPedidosOnline = [
  { id: 'PED-001', cliente: 'Fernanda Lima', items: 3, total: 749.70, status: 'pending' as const, payment_method: 'PIX', created_at: '2025-04-05 14:30' },
  { id: 'PED-002', cliente: 'João Mendes', items: 1, total: 299.90, status: 'confirmed' as const, payment_method: 'Cartão de Crédito', created_at: '2025-04-05 10:15' },
  { id: 'PED-003', cliente: 'Beatriz Alves', items: 2, total: 549.80, status: 'processing' as const, payment_method: 'PIX', created_at: '2025-04-04 16:45' },
  { id: 'PED-004', cliente: 'Lucas Rocha', items: 1, total: 2499.90, status: 'shipped' as const, payment_method: 'Cartão 3x', created_at: '2025-04-03 09:20' },
  { id: 'PED-005', cliente: 'Rafael Dias', items: 4, total: 1199.60, status: 'delivered' as const, payment_method: 'Boleto', created_at: '2025-04-01 11:00' },
  { id: 'PED-006', cliente: 'Fernanda Lima', items: 1, total: 149.90, status: 'cancelled' as const, payment_method: 'PIX', created_at: '2025-03-30 18:30' },
];


export const mockMovimentacoes = [
  { id: '1', product: 'Controle DualSense Edge', type: 'entrada' as const, quantity: 10, quantity_before: 3, quantity_after: 13, employee: 'Carlos Silva', notes: 'Compra fornecedor Sony', created_at: '2025-04-06 08:00' },
  { id: '2', product: 'God of War Ragnarök', type: 'saida' as const, quantity: 2, quantity_before: 34, quantity_after: 32, employee: 'Ana Oliveira', notes: 'Venda presencial VP-001', created_at: '2025-04-06 10:30' },
  { id: '3', product: 'Nintendo Switch OLED', type: 'ajuste' as const, quantity: -1, quantity_before: 8, quantity_after: 7, employee: 'Carlos Silva', notes: 'Inventário - produto com defeito', created_at: '2025-04-05 18:00' },
  { id: '4', product: 'Xbox Game Pass Ultimate 3M', type: 'saida' as const, quantity: 5, quantity_before: 1004, quantity_after: 999, employee: 'Pedro Santos', notes: 'Pedido online PED-005', created_at: '2025-04-04 11:00' },
  { id: '5', product: 'Headset HyperX Cloud III', type: 'entrada' as const, quantity: 20, quantity_before: 12, quantity_after: 32, employee: 'Carlos Silva', notes: 'Reposição de estoque', created_at: '2025-04-03 14:30' },
];

export const mockDenuncias = [
  { id: '1', target_type: 'anuncio', target_title: 'PS5 usado - MEGA PROMOÇÃO!!!', reporter: 'Lucas Rocha', reason: 'Preço suspeito / possível golpe', status: 'pending', created_at: '2025-04-05 12:00' },
  { id: '2', target_type: 'usuario', target_title: 'user_gamer99', reporter: 'Fernanda Lima', reason: 'Spam de mensagens', status: 'pending', created_at: '2025-04-04 09:30' },
  { id: '3', target_type: 'anuncio', target_title: 'Conta Steam com 500 jogos', reporter: 'João Mendes', reason: 'Venda de contas é proibida', status: 'resolved', created_at: '2025-04-02 16:00' },
];

export const mockCertificados = [
  { id: '1', user: 'Lucas Rocha', status: 'pendente' as const, requested_at: '2025-04-05 10:00', reviewed_at: null, reason: null, expires_at: null },
  { id: '2', user: 'Beatriz Alves', status: 'ativo' as const, requested_at: '2025-03-01 14:00', reviewed_at: '2025-03-02 09:00', reason: 'Vendedora verificada', expires_at: '2025-09-02' },
  { id: '3', user: 'user_gamer99', status: 'recusado' as const, requested_at: '2025-02-20 11:00', reviewed_at: '2025-02-21 10:00', reason: 'Conta com denúncias pendentes', expires_at: null },
  { id: '4', user: 'Fernanda Lima', status: 'ativo' as const, requested_at: '2025-01-15 08:00', reviewed_at: '2025-01-16 09:30', reason: 'Histórico excelente', expires_at: '2026-01-16' },
  { id: '5', user: 'Rafael Dias', status: 'pendente' as const, requested_at: '2025-04-06 07:00', reviewed_at: null, reason: null, expires_at: null },
];

export const mockDashboardStats = {
  vendasHoje: 3,
  faturamentoHoje: 2099.63,
  faturamentoMes: 42580.90,
  pedidosPendentes: 2,
  estoqueBaixo: 3,
  totalClientes: 142,
  totalProdutos: 87,
  vendasSemana: [
    { dia: 'Seg', presencial: 1250, online: 890 },
    { dia: 'Ter', presencial: 980, online: 1200 },
    { dia: 'Qua', presencial: 1500, online: 750 },
    { dia: 'Qui', presencial: 870, online: 1100 },
    { dia: 'Sex', presencial: 2100, online: 1800 },
    { dia: 'Sáb', presencial: 3200, online: 2400 },
    { dia: 'Dom', presencial: 800, online: 1500 },
  ],
  topProdutos: [
    { name: 'Zelda: TOTK', vendas: 45 },
    { name: 'God of War', vendas: 38 },
    { name: 'Game Pass 3M', vendas: 32 },
    { name: 'PS5 Slim', vendas: 28 },
    { name: 'HyperX Cloud III', vendas: 22 },
  ],
};

export const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  processing: 'Em Separação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

/**
 * Regra 1 — cor de status vem do papel semântico (`statusTone`), nunca de uma
 * paleta escolhida na tela. Mantido como Record para não quebrar chamadas antigas.
 */
export const statusColors: Record<string, string> = {
  pending: statusBadgeClass('pending'),
  confirmed: statusBadgeClass('confirmed'),
  processing: statusBadgeClass('processing'),
  shipped: statusBadgeClass('shipped'),
  delivered: statusBadgeClass('delivered'),
  cancelled: statusBadgeClass('cancelled'),
  refunded: statusBadgeClass('refunded'),
};

export const certStatusLabels: Record<string, string> = {
  pendente: 'Pendente',
  ativo: 'Ativo',
  recusado: 'Recusado',
  revogado: 'Revogado',
  expirado: 'Expirado',
};

export const certStatusColors: Record<string, string> = {
  pendente: statusBadgeClass('pendente'),
  ativo: statusBadgeClass('ativo'),
  recusado: statusBadgeClass('recusado'),
  revogado: statusBadgeClass('rejeitado'),
  expirado: statusBadgeClass('expirado'),
};

// === Mobile Admin Mock Data ===

export const mockAnuncios = [
  { id: '1', seller: 'Lucas Rocha', title: 'PS5 Slim usado - 6 meses', game_title: 'Console PS5', platform: 'PS5', condition: 'usado', price: 2800.00, ad_type: 'venda' as const, category: 'console', status: 'active' as const, certificate_type: 'certificado_vendedor', created_at: '2025-04-05 10:00', fotos: 2 },
  { id: '2', seller: 'Beatriz Alves', title: 'Zelda TOTK - Troco por God of War', game_title: 'Zelda: TOTK', platform: 'Nintendo Switch', condition: 'novo', price: 0, ad_type: 'troca' as const, category: 'jogo_fisico', status: 'active' as const, certificate_type: 'sem_certificado', desired_item: 'God of War Ragnarök', created_at: '2025-04-04 14:30', fotos: 3 },
  { id: '3', seller: 'user_gamer99', title: 'MEGA PROMOÇÃO PS5!!!! BARATO', game_title: 'PS5', platform: 'PS5', condition: 'novo', price: 500.00, ad_type: 'venda' as const, category: 'console', status: 'flagged' as const, certificate_type: 'sem_certificado', created_at: '2025-04-03 18:00', fotos: 1 },
  { id: '4', seller: 'Fernanda Lima', title: 'Headset HyperX Cloud II', game_title: 'HyperX Cloud II', platform: 'Multiplataforma', condition: 'usado', price: 250.00, ad_type: 'venda' as const, category: 'acessorio', status: 'active' as const, certificate_type: 'certificado_vendedor', created_at: '2025-04-02 09:15', fotos: 4 },
  { id: '5', seller: 'Rafael Dias', title: 'Conta com jogos (BLOQUEADO)', game_title: 'Conta Steam', platform: 'PC', condition: 'novo', price: 300.00, ad_type: 'venda' as const, category: 'jogo_digital', status: 'removed' as const, certificate_type: 'sem_certificado', created_at: '2025-03-28 20:00', fotos: 0 },
  { id: '6', seller: 'João Mendes', title: 'FIFA 25 PS5 - Lacrado', game_title: 'FIFA 25', platform: 'PS5', condition: 'novo', price: 199.90, ad_type: 'venda' as const, category: 'jogo_fisico', status: 'sold' as const, certificate_type: 'sem_certificado', created_at: '2025-03-25 11:00', fotos: 2 },
];

export const mockPropostasTroca = [
  { id: '1', proposer: 'João Mendes', seller: 'Beatriz Alves', anuncio_title: 'Zelda TOTK - Troco por God of War', offered_item: 'God of War Ragnarök PS5 - Lacrado', status: 'pending' as const, proposer_confirmed: false, seller_confirmed: false, created_at: '2025-04-05 15:00' },
  { id: '2', proposer: 'Lucas Rocha', seller: 'Fernanda Lima', anuncio_title: 'Headset HyperX Cloud II', offered_item: 'Mouse Logitech G502 + R$50', status: 'accepted' as const, proposer_confirmed: true, seller_confirmed: true, created_at: '2025-04-03 10:30' },
  { id: '3', proposer: 'Rafael Dias', seller: 'João Mendes', anuncio_title: 'FIFA 25 PS5 - Lacrado', offered_item: 'eFootball coins R$100', status: 'rejected' as const, proposer_confirmed: false, seller_confirmed: false, created_at: '2025-04-01 08:00' },
  { id: '4', proposer: 'Fernanda Lima', seller: 'Lucas Rocha', anuncio_title: 'PS5 Slim usado - 6 meses', offered_item: 'Nintendo Switch OLED + R$500', status: 'pending' as const, proposer_confirmed: false, seller_confirmed: false, created_at: '2025-04-06 09:00' },
];

export const mockMensagensAdmin = [
  { id: '1', sender: 'João Mendes', receiver: 'Beatriz Alves', anuncio_title: 'Zelda TOTK - Troco por GoW', content: 'Oi! Tenho o GoW lacrado, aceita trocar?', is_read: true, created_at: '2025-04-05 14:55' },
  { id: '2', sender: 'Beatriz Alves', receiver: 'João Mendes', anuncio_title: 'Zelda TOTK - Troco por GoW', content: 'Aceito sim! Manda proposta', is_read: true, created_at: '2025-04-05 15:02' },
  { id: '3', sender: 'Lucas Rocha', receiver: 'Fernanda Lima', anuncio_title: 'Headset HyperX Cloud II', content: 'Ainda tem o headset? Posso trocar pelo meu mouse', is_read: true, created_at: '2025-04-03 10:00' },
  { id: '4', sender: 'user_gamer99', receiver: 'Rafael Dias', anuncio_title: null, content: 'Compra meu PS5 barato, pix na hora!!', is_read: false, created_at: '2025-04-04 22:00' },
  { id: '5', sender: 'Fernanda Lima', receiver: 'Lucas Rocha', anuncio_title: 'PS5 Slim usado', content: 'Aceita Switch OLED + dinheiro?', is_read: false, created_at: '2025-04-06 08:45' },
];

export const mockAvaliacoesUsuario = [
  { id: '1', reviewer: 'João Mendes', reviewed: 'Beatriz Alves', anuncio_title: 'Zelda TOTK', rating: 5, comment: 'Excelente vendedora, produto conforme descrito!', created_at: '2025-04-06 10:00' },
  { id: '2', reviewer: 'Fernanda Lima', reviewed: 'Lucas Rocha', anuncio_title: 'Headset HyperX', rating: 4, comment: 'Boa negociação, mas demorou um pouco pra responder.', created_at: '2025-04-04 16:00' },
  { id: '3', reviewer: 'Lucas Rocha', reviewed: 'Fernanda Lima', anuncio_title: 'Headset HyperX', rating: 5, comment: 'Troca tranquila, recomendo!', created_at: '2025-04-04 16:30' },
  { id: '4', reviewer: 'Rafael Dias', reviewed: 'user_gamer99', anuncio_title: 'PS5 MEGA PROMOÇÃO', rating: 1, comment: 'Parece golpe, produto não existe.', created_at: '2025-04-03 19:00' },
  { id: '5', reviewer: 'Beatriz Alves', reviewed: 'João Mendes', anuncio_title: 'FIFA 25', rating: 5, comment: 'Comprador honesto e pontual!', created_at: '2025-03-26 14:00' },
];

export const mockNotificacoesAdmin = [
  { id: '1', user: 'João Mendes', type: 'nova_mensagem', title: 'Nova mensagem', body: 'Beatriz Alves enviou uma mensagem', is_read: true, created_at: '2025-04-05 15:02' },
  { id: '2', user: 'Fernanda Lima', type: 'proposta_aceita', title: 'Proposta aceita!', body: 'Lucas Rocha aceitou sua proposta de troca', is_read: true, created_at: '2025-04-03 11:00' },
  { id: '3', user: 'Lucas Rocha', type: 'certificado_aprovado', title: 'Certificado aprovado!', body: 'Seu certificado de vendedor foi aprovado', is_read: false, created_at: '2025-04-02 09:30' },
  { id: '4', user: 'user_gamer99', type: 'certificado_recusado', title: 'Certificado não aprovado', body: 'Conta com denúncias pendentes', is_read: false, created_at: '2025-02-21 10:00' },
  { id: '5', user: 'Rafael Dias', type: 'comentario_review', title: 'Comentário na sua review', body: 'João Mendes comentou na sua avaliação', is_read: false, created_at: '2025-04-06 08:00' },
];

export const anuncioStatusLabels: Record<string, string> = {
  active: 'Ativo',
  sold: 'Vendido',
  traded: 'Trocado',
  flagged: 'Sinalizado',
  removed: 'Removido',
  inactive: 'Inativo',
};

export const anuncioStatusColors: Record<string, string> = {
  active: toneBadge.success,
  sold: toneBadge.primary,
  traded: toneBadge.accent,
  flagged: toneBadge.warning,
  removed: toneBadge.danger,
  inactive: toneBadge.muted,
};

export const tradeStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  rejected: 'Recusada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export const tradeStatusColors: Record<string, string> = {
  pending: toneBadge.warning,
  accepted: toneBadge.success,
  rejected: toneBadge.danger,
  completed: toneBadge.primary,
  cancelled: toneBadge.muted,
};
