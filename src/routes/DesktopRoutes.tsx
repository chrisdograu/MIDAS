import { lazy } from "react";
import { Route } from "react-router-dom";
import { DesktopAuthProvider } from "@/hooks/useDesktopAuth";

const DesktopLayout = lazy(() => import("@/desktop/DesktopLayout"));
const DesktopLogin = lazy(() => import("@/desktop/DesktopLogin"));
const Dashboard = lazy(() => import("@/desktop/pages/Dashboard"));
const DesktopProdutos = lazy(() => import("@/desktop/pages/Produtos"));
const Funcionarios = lazy(() => import("@/desktop/pages/Funcionarios"));
const Clientes = lazy(() => import("@/desktop/pages/Clientes"));
const Fornecedores = lazy(() => import("@/desktop/pages/Fornecedores"));
const Categorias = lazy(() => import("@/desktop/pages/Categorias"));
const Cupons = lazy(() => import("@/desktop/pages/Cupons"));
const Estoque = lazy(() => import("@/desktop/pages/Estoque"));
const PedidosOnline = lazy(() => import("@/desktop/pages/PedidosOnline"));
const Moderacao = lazy(() => import("@/desktop/pages/Moderacao"));
const Relatorios = lazy(() => import("@/desktop/pages/Relatorios"));
const Certificados = lazy(() => import("@/desktop/pages/Certificados"));
const AnunciosAdmin = lazy(() => import("@/desktop/pages/AnunciosAdmin"));
const PropostasTroca = lazy(() => import("@/desktop/pages/PropostasTroca"));
const DisputasPartidas = lazy(() => import("@/desktop/pages/DisputasPartidas"));
const MensagensAdmin = lazy(() => import("@/desktop/pages/MensagensAdmin"));
const AvaliacoesUsuario = lazy(() => import("@/desktop/pages/AvaliacoesUsuario"));
const AvaliacoesJogos = lazy(() => import("@/desktop/pages/AvaliacoesJogos"));
const NotificacoesAdmin = lazy(() => import("@/desktop/pages/NotificacoesAdmin"));
const ForumAdmin = lazy(() => import("@/desktop/pages/ForumAdmin"));
const SugestoesJogos = lazy(() => import("@/desktop/pages/SugestoesJogos"));
const Configuracoes = lazy(() => import("@/desktop/pages/Configuracoes"));
const BadgesAdmin = lazy(() => import("@/desktop/pages/Badges"));
const Promocoes = lazy(() => import("@/desktop/pages/Promocoes"));
const TorneiosAdmin = lazy(() => import("@/desktop/pages/Torneios"));
const JogosAdmin = lazy(() => import("@/desktop/pages/JogosAdmin"));
const CriarJogo = lazy(() => import("@/desktop/pages/CriarJogo"));
const GamesCatalogAdmin = lazy(() => import("@/desktop/pages/GamesCatalogAdmin"));
const BundlesAdmin = lazy(() => import("@/desktop/pages/BundlesAdmin"));
const TrocasArquivadas = lazy(() => import("@/desktop/pages/TrocasArquivadas"));
const BibliotecaSocialAdmin = lazy(() => import("@/desktop/pages/BibliotecaSocialAdmin"));
const TorneiosEventos = lazy(() => import("@/desktop/pages/TorneiosEventos"));
const CriarTorneio = lazy(() => import("@/desktop/pages/CriarTorneio"));
const TicketsList = lazy(() => import("@/desktop/pages/TicketsList"));
const Denuncias = lazy(() => import("@/desktop/pages/Denuncias"));
const NotificacoesEspeciais = lazy(() => import("@/desktop/pages/NotificacoesEspeciais"));
const LogsAdministrativos = lazy(() => import("@/desktop/pages/LogsAdministrativos"));
const GruposAdmin = lazy(() => import("@/desktop/pages/GruposAdmin"));
const Analytics = lazy(() => import("@/desktop/pages/Analytics"));
const MetricasPlataforma = lazy(() => import("@/desktop/pages/MetricasPlataforma"));
const XPMobile = lazy(() => import("@/desktop/pages/XPMobile"));
const XPWeb = lazy(() => import("@/desktop/pages/XPWeb"));
const TitulosAdmin = lazy(() => import("@/desktop/pages/TitulosAdmin"));
const RecompensasAdmin = lazy(() => import("@/desktop/pages/RecompensasAdmin"));
const GameRewardsAdmin = lazy(() => import("@/desktop/pages/GameRewardsAdmin"));
const IntegracoesAdmin = lazy(() => import("@/desktop/pages/IntegracoesAdmin"));
const VendedoresAdmin = lazy(() => import("@/desktop/pages/VendedoresAdmin"));
const VerificacaoResponsaveis = lazy(() => import("@/desktop/pages/VerificacaoResponsaveis"));
const ChatAlertsQueue = lazy(() => import("@/desktop/pages/ChatAlertsQueue"));
const ParametrosSistema = lazy(() => import("@/desktop/pages/ParametrosSistema"));

export const desktopRoutes = (
  <>
    <Route path="/desktop/login" element={<DesktopAuthProvider><DesktopLogin /></DesktopAuthProvider>} />
    <Route path="/desktop" element={<DesktopAuthProvider><DesktopLayout /></DesktopAuthProvider>}>
      <Route index element={<Dashboard />} />
      <Route path="produtos" element={<DesktopProdutos />} />
      <Route path="funcionarios" element={<Funcionarios />} />
      <Route path="clientes" element={<Clientes />} />
      <Route path="fornecedores" element={<Fornecedores />} />
      <Route path="categorias" element={<Categorias />} />
      <Route path="cupons" element={<Cupons />} />
      <Route path="estoque" element={<Estoque />} />
      <Route path="pedidos" element={<PedidosOnline />} />
      <Route path="anuncios" element={<AnunciosAdmin />} />
      <Route path="propostas" element={<PropostasTroca />} />
      <Route path="disputas-partidas" element={<DisputasPartidas />} />
      <Route path="mensagens" element={<MensagensAdmin />} />
      <Route path="avaliacoes-usuario" element={<AvaliacoesUsuario />} />
      <Route path="avaliacoes-jogos" element={<AvaliacoesJogos />} />
      <Route path="notificacoes" element={<NotificacoesAdmin />} />
      <Route path="forum" element={<ForumAdmin />} />
      <Route path="sugestoes" element={<SugestoesJogos />} />
      <Route path="moderacao" element={<Moderacao />} />
      <Route path="relatorios" element={<Relatorios />} />
      <Route path="certificados" element={<Certificados />} />
      <Route path="configuracoes" element={<Configuracoes />} />
      <Route path="parametros" element={<ParametrosSistema />} />
      <Route path="badges" element={<BadgesAdmin />} />
      <Route path="promocoes" element={<Promocoes />} />
      <Route path="torneios" element={<TorneiosAdmin />} />
      <Route path="torneios/atuais" element={<TorneiosAdmin />} />
      <Route path="torneios/eventos" element={<TorneiosEventos />} />
      <Route path="torneios/novo" element={<CriarTorneio />} />
      <Route path="jogos" element={<JogosAdmin />} />
      <Route path="jogos/novo" element={<CriarJogo />} />
      <Route path="jogos/catalogo-tags" element={<GamesCatalogAdmin />} />
      <Route path="bundles" element={<BundlesAdmin />} />
      <Route path="trocas-arquivadas" element={<TrocasArquivadas />} />
      <Route path="biblioteca-social" element={<BibliotecaSocialAdmin />} />
      <Route path="tickets/mobile" element={<TicketsList channel="mobile" />} />
      <Route path="tickets/web" element={<TicketsList channel="web" />} />
      <Route path="denuncias" element={<Denuncias />} />
      <Route path="notificacoes/especiais" element={<NotificacoesEspeciais />} />
      <Route path="logs" element={<LogsAdministrativos />} />
      <Route path="grupos" element={<GruposAdmin />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="metricas" element={<MetricasPlataforma />} />
      <Route path="xp/mobile" element={<XPMobile />} />
      <Route path="xp/web" element={<XPWeb />} />
      <Route path="titulos" element={<TitulosAdmin />} />
      <Route path="recompensas" element={<RecompensasAdmin />} />
      <Route path="recompensas/jogos" element={<GameRewardsAdmin />} />
      <Route path="integracoes" element={<IntegracoesAdmin />} />
      <Route path="vendedores" element={<VendedoresAdmin />} />
      <Route path="eca/responsaveis" element={<VerificacaoResponsaveis />} />
      <Route path="eca/chat-alerts" element={<ChatAlertsQueue />} />
    </Route>
  </>
);
