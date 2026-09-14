import { lazy } from "react";
import { Route, useLocation, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RouteMeta from "@/components/RouteMeta";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";

const Catalogo = lazy(() => import("@/pages/Catalogo"));
const Ofertas = lazy(() => import("@/pages/Ofertas"));
const GameDetail = lazy(() => import("@/pages/GameDetail"));
const Carrinho = lazy(() => import("@/pages/Carrinho"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Pedidos = lazy(() => import("@/pages/Pedidos"));
const Favoritos = lazy(() => import("@/pages/Favoritos"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const TimelineGamer = lazy(() => import("@/pages/TimelineGamer"));
const Biblioteca = lazy(() => import("@/pages/Biblioteca"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Contato = lazy(() => import("@/pages/Contato"));
const TermosDeUso = lazy(() => import("@/pages/TermosDeUso"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const CheckoutSucesso = lazy(() => import("@/pages/CheckoutSucesso"));
const EmAlta = lazy(() => import("@/pages/EmAlta"));
const ParaVoce = lazy(() => import("@/pages/ParaVoce"));
const Social = lazy(() => import("@/pages/SocialLibrary"));
const Torneios = lazy(() => import("@/pages/Torneios"));
const TournamentEvent = lazy(() => import("@/pages/torneios/TournamentEvent"));
const TournamentMatch = lazy(() => import("@/pages/torneios/TournamentMatch"));
const TournamentGroup = lazy(() => import("@/pages/torneios/TournamentGroup"));
const BundleDetail = lazy(() => import("@/pages/BundleDetail"));
const BibliotecaJogo = lazy(() => import("@/pages/BibliotecaJogo"));
const GameSocialHub = lazy(() => import("@/pages/GameSocialHub"));
const ReviewCompletaEditor = lazy(() => import("@/pages/ReviewCompletaEditor"));
const FriendProfile = lazy(() => import("@/pages/FriendProfile"));
const SellerProfile = lazy(() => import("@/pages/SellerProfile"));
const CriarVendedor = lazy(() => import("@/pages/CriarVendedor"));
const BuscaGlobal = lazy(() => import("@/pages/BuscaGlobal"));
const OpinionsConversations = lazy(() => import("@/pages/OpinionsConversations"));
const OpinionConversation = lazy(() => import("@/pages/OpinionConversation"));
const Tutoriais = lazy(() => import("@/pages/Tutoriais"));
const Tutorial = lazy(() => import("@/pages/Tutorial"));
const PrivacidadeCentral = lazy(() => import("@/pages/PrivacidadeCentral"));
const VendedorConfig = lazy(() => import("@/pages/VendedorConfig"));
const Oportunidades = lazy(() => import("@/pages/Oportunidades"));

type Meta = { title: string; description: string; type?: 'website' | 'profile' | 'article' | 'product' };

const shell = (el: React.ReactNode, meta?: Meta) => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1">
      {/* Base de título/descrição da rota; páginas dinâmicas sobrescrevem com o próprio useDocumentMeta. */}
      {meta && <RouteMeta {...meta} />}
      {el}
    </main>
    <Footer />
  </div>
);

const entries: { path: string; el: React.ReactNode; meta: Meta }[] = [
  { path: '/', el: <Index />, meta: { title: 'MIDIAS — loja e comunidade de jogos', description: 'Compre jogos, acompanhe o que está em alta e converse com a comunidade gamer no MIDIAS.' } },
  { path: '/catalogo', el: <Catalogo />, meta: { title: 'Catálogo de jogos | MIDIAS', description: 'Explore o catálogo completo de jogos por plataforma, gênero e preço, com estoque em tempo real.' } },
  { path: '/ofertas', el: <Ofertas />, meta: { title: 'Ofertas e promoções de jogos | MIDIAS', description: 'Jogos com desconto no MIDIAS: promoções relâmpago, cupons e queda de preço acompanhada em tempo real.' } },
  { path: '/em-alta', el: <EmAlta />, meta: { title: 'Jogos em alta agora | MIDIAS', description: 'O que a comunidade está jogando: ranking de jogos em alta por visitas, posts e avaliações recentes.' } },
  { path: '/pra-voce', el: <ParaVoce />, meta: { title: 'Recomendações pra você | MIDIAS', description: 'Indicações de jogos a partir da sua biblioteca, gêneros preferidos e atividade dos seus amigos.' } },
  { path: '/social', el: <Social />, meta: { title: 'Biblioteca social | MIDIAS', description: 'Veja o que seus amigos estão jogando, avaliando e comentando na comunidade MIDIAS.' } },
  { path: '/torneios', el: <Torneios />, meta: { title: 'Torneios e eventos | MIDIAS', description: 'Inscreva-se em torneios da comunidade MIDIAS, acompanhe chaves, partidas e resultados ao vivo.' } },
  { path: '/torneios/:id', el: <TournamentEvent />, meta: { title: 'Torneio | MIDIAS', description: 'Chaves, partidas, regras e classificação do torneio.', type: 'article' } },
  { path: '/torneios/:id/partida/:matchId', el: <TournamentMatch />, meta: { title: 'Partida de torneio | MIDIAS', description: 'Placar, envio de resultado e chat da partida do torneio.', type: 'article' } },
  { path: '/torneios/:id/grupo', el: <ProtectedRoute><TournamentGroup /></ProtectedRoute>, meta: { title: 'Grupo do torneio | MIDIAS', description: 'Conversa e organização do seu grupo dentro do torneio.' } },
  { path: '/jogo/:id', el: <GameDetail />, meta: { title: 'Detalhes do jogo | MIDIAS', description: 'Preço, estoque, avaliações da comunidade e prints do jogo no MIDIAS.', type: 'product' } },
  { path: '/jogo/:id/social', el: <ProtectedRoute><GameSocialHub /></ProtectedRoute>, meta: { title: 'Hub social do jogo | MIDIAS', description: 'Posts, opiniões e conversas da comunidade sobre este jogo.' } },
  { path: '/jogo/:id/review-completa', el: <ProtectedRoute><ReviewCompletaEditor /></ProtectedRoute>, meta: { title: 'Escrever review completa | MIDIAS', description: 'Escreva sua análise completa do jogo para a comunidade MIDIAS.' } },
  { path: '/jogo/:productId/review-completa', el: <ProtectedRoute><ReviewCompletaEditor /></ProtectedRoute>, meta: { title: 'Escrever review completa | MIDIAS', description: 'Escreva sua análise completa do jogo para a comunidade MIDIAS.' } },
  { path: '/busca', el: <BuscaGlobal />, meta: { title: 'Busca | MIDIAS', description: 'Busque jogos, usuários, vendedores, torneios e posts do fórum em um só lugar.' } },
  { path: '/conversas-opinioes', el: <ProtectedRoute><OpinionsConversations /></ProtectedRoute>, meta: { title: 'Conversas sobre opiniões | MIDIAS', description: 'Acompanhe as conversas abertas a partir das suas opiniões sobre jogos.' } },
  { path: '/perfil/:userId/jogo/:productId/opniao/:opinionId/conversa/:convId', el: <ProtectedRoute><OpinionConversation /></ProtectedRoute>, meta: { title: 'Conversa | MIDIAS', description: 'Conversa privada sobre uma opinião publicada na comunidade.' } },
  { path: '/amigo/:userId', el: <ProtectedRoute><FriendProfile /></ProtectedRoute>, meta: { title: 'Perfil de amigo | MIDIAS', description: 'Biblioteca, favoritos e atividade recente do seu amigo no MIDIAS.', type: 'profile' } },
  { path: '/bundle/:id', el: <BundleDetail />, meta: { title: 'Bundle de jogos | MIDIAS', description: 'Pacotes de jogos com preço fechado e economia em relação à compra separada.', type: 'product' } },
  { path: '/biblioteca/:productId', el: <ProtectedRoute><BibliotecaJogo /></ProtectedRoute>, meta: { title: 'Meu jogo na biblioteca | MIDIAS', description: 'Status, etiquetas, diário e sua avaliação deste jogo da sua biblioteca.' } },
  { path: '/carrinho', el: <Carrinho />, meta: { title: 'Carrinho | MIDIAS', description: 'Revise os jogos do seu carrinho, aplique cupons e siga para o checkout.' } },
  { path: '/checkout', el: <ProtectedRoute><Checkout /></ProtectedRoute>, meta: { title: 'Checkout | MIDIAS', description: 'Finalize seu pedido escolhendo Pix com desconto ou cartão parcelado.' } },
  { path: '/checkout/sucesso', el: <ProtectedRoute><CheckoutSucesso /></ProtectedRoute>, meta: { title: 'Pedido confirmado | MIDIAS', description: 'Seu pedido foi registrado. Acompanhe o status em Meus pedidos.' } },
  { path: '/auth', el: <Auth />, meta: { title: 'Entrar ou criar conta | MIDIAS', description: 'Acesse sua conta MIDIAS para comprar jogos, avaliar e participar da comunidade.' } },
  { path: '/reset-password', el: <ResetPassword />, meta: { title: 'Redefinir senha | MIDIAS', description: 'Defina uma nova senha para voltar a acessar sua conta MIDIAS.' } },
  { path: '/pedidos', el: <ProtectedRoute><Pedidos /></ProtectedRoute>, meta: { title: 'Meus pedidos | MIDIAS', description: 'Histórico de compras, status de entrega e detalhes de cada pedido.' } },
  { path: '/favoritos', el: <ProtectedRoute><Favoritos /></ProtectedRoute>, meta: { title: 'Meus favoritos | MIDIAS', description: 'Jogos que você salvou, com alerta de queda de preço e disponibilidade.' } },
  { path: '/perfil', el: <ProtectedRoute><Perfil /></ProtectedRoute>, meta: { title: 'Meu perfil | MIDIAS', description: 'Edite seus dados, preferências de gênero, privacidade e personalização do perfil.', type: 'profile' } },
  { path: '/perfil/timeline', el: <ProtectedRoute><TimelineGamer /></ProtectedRoute>, meta: { title: 'Minha timeline gamer | MIDIAS', description: 'Linha do tempo dos seus jogos, conquistas e marcos na comunidade MIDIAS.' } },
  { path: '/perfil/:userId', el: <PublicProfile />, meta: { title: 'Perfil público | MIDIAS', description: 'Biblioteca, reputação e atividade pública deste jogador no MIDIAS.', type: 'profile' } },
  { path: '/profile/:userId', el: <PublicProfile />, meta: { title: 'Perfil público | MIDIAS', description: 'Biblioteca, reputação e atividade pública deste jogador no MIDIAS.', type: 'profile' } },
  { path: '/vendedor/criar', el: <ProtectedRoute><CriarVendedor mode="create" /></ProtectedRoute>, meta: { title: 'Criar perfil de vendedor | MIDIAS', description: 'Crie seu perfil de vendedor do marketplace, com handle, bio comercial e reputação próprios.' } },
  { path: '/vendedor/editar', el: <ProtectedRoute><CriarVendedor mode="edit" /></ProtectedRoute>, meta: { title: 'Editar perfil de vendedor | MIDIAS', description: 'Atualize nome, bio comercial e privacidade do seu perfil de vendedor.' } },
  { path: '/vendedor/:handle', el: <SellerProfile />, meta: { title: 'Perfil de vendedor | MIDIAS', description: 'Anúncios, reputação e garantias deste vendedor do marketplace MIDIAS.', type: 'profile' } },
  { path: '/biblioteca', el: <ProtectedRoute><Biblioteca /></ProtectedRoute>, meta: { title: 'Minha biblioteca | MIDIAS', description: 'Organize os jogos que você tem, quer jogar e já zerou, com etiquetas próprias.' } },
  { path: '/faq', el: <FAQ />, meta: { title: 'Perguntas frequentes | MIDIAS', description: 'Dúvidas sobre compras, entrega digital, trocas no marketplace, contas e privacidade.' } },
  { path: '/contato', el: <Contato />, meta: { title: 'Contato e suporte | MIDIAS', description: 'Fale com o suporte MIDIAS sobre pedidos, denúncias, privacidade ou parcerias.' } },
  { path: '/termos', el: <TermosDeUso />, meta: { title: 'Termos de uso e privacidade | MIDIAS', description: 'Regras de uso da plataforma, tratamento de dados pessoais e canais de contato do DPO.', type: 'article' } },
  { path: '/tutoriais', el: <Tutoriais />, meta: { title: 'Tutoriais da plataforma | MIDIAS', description: 'Aprenda a comprar, avaliar, negociar no marketplace e participar de torneios no MIDIAS.' } },
  { path: '/tutorial/:key', el: <Tutorial />, meta: { title: 'Tutorial | MIDIAS', description: 'Passo a passo para usar os recursos da plataforma MIDIAS.', type: 'article' } },
  { path: '/privacidade', el: <ProtectedRoute><PrivacidadeCentral /></ProtectedRoute>, meta: { title: 'Central de privacidade | MIDIAS', description: 'Exporte seus dados, ajuste visibilidade, pause ou exclua sua conta MIDIAS.' } },
  { path: '/vendedor', el: <ProtectedRoute><VendedorConfig /></ProtectedRoute>, meta: { title: 'Configuração de vendedor | MIDIAS', description: 'Gerencie seu perfil de vendedor, modo férias e privacidade dos seus anúncios.' } },
  { path: '/oportunidades', el: <Oportunidades />, meta: { title: 'Oportunidades | MIDIAS', description: 'Achados do marketplace e da loja: melhores preços, trocas e itens raros disponíveis agora.' } },
];

function GlobalCatchAll() {
  const location = useLocation();
  if (location.pathname.startsWith('/m')) return <Navigate to="/m" replace />;
  return shell(<NotFound />, { title: 'Página não encontrada | MIDIAS', description: 'O endereço acessado não existe ou saiu do ar. Volte para a loja e continue explorando o catálogo.' });
}

export const webRoutes = (
  <>
    {entries.map(r => (
      <Route key={r.path} path={r.path} element={shell(r.el, r.meta)} />
    ))}
    <Route path="*" element={<GlobalCatchAll />} />
  </>
);
