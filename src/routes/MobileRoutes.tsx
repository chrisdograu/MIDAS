import { lazy } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import MobileLayout from "@/mobile/MobileLayout";

const MAuth = lazy(() => import("@/mobile/pages/MAuth"));
const MHome = lazy(() => import("@/mobile/pages/MHome"));
const MMarketplace = lazy(() => import("@/mobile/pages/MMarketplace"));
const MMarketplaceItem = lazy(() => import("@/mobile/pages/MMarketplaceItem"));
const MNewAd = lazy(() => import("@/mobile/pages/MNewAd"));
const MForum = lazy(() => import("@/mobile/pages/MForum"));
const MForumGame = lazy(() => import("@/mobile/pages/MForumGame"));
const MForumPost = lazy(() => import("@/mobile/pages/MForumPost"));
const MChat = lazy(() => import("@/mobile/pages/MChat"));
const MChatThread = lazy(() => import("@/mobile/pages/MChatThread"));
const MProfile = lazy(() => import("@/mobile/pages/MProfile"));
const MConfig = lazy(() => import("@/mobile/pages/MConfig"));
const MBlockedUsers = lazy(() => import("@/mobile/pages/MBlockedUsers"));
const MTrocas = lazy(() => import("@/mobile/pages/MTrocas"));
const MReview = lazy(() => import("@/mobile/pages/MReview"));
const MFavoritos = lazy(() => import("@/mobile/pages/MFavoritos"));
const MFriends = lazy(() => import("@/mobile/pages/MFriends"));
const MSocialLibrary = lazy(() => import("@/mobile/pages/MSocialLibrary"));
const MGroups = lazy(() => import("@/mobile/pages/MGroups"));
const MGroupNew = lazy(() => import("@/mobile/pages/MGroupNew"));
const MGroupChat = lazy(() => import("@/mobile/pages/MGroupChat"));
const MGroupInfo = lazy(() => import("@/mobile/pages/MGroupInfo"));
const MChatInfo = lazy(() => import("@/mobile/pages/MChatInfo"));
const MTournamentGroup = lazy(() => import("@/mobile/pages/MTournamentGroup"));
const MTutoriais = lazy(() => import("@/mobile/pages/MTutoriais"));
const MTutorial = lazy(() => import("@/mobile/pages/MTutorial"));
const MForumComunidade = lazy(() => import("@/mobile/pages/MForumComunidade"));
const MNotFound = lazy(() => import("@/mobile/pages/MNotFound"));
const VendedorConfig = lazy(() => import("@/pages/VendedorConfig"));

const wrap = (el: React.ReactNode) => <MobileLayout>{el}</MobileLayout>;
const protect = (el: React.ReactNode) => <ProtectedRoute redirectTo="/m/auth">{el}</ProtectedRoute>;

export const mobileRoutes = (
  <>
    <Route path="/m/auth" element={<MAuth />} />
    <Route path="/m" element={wrap(<MHome />)} />
    <Route path="/m/marketplace" element={wrap(<MMarketplace />)} />
    <Route path="/m/marketplace/novo" element={wrap(protect(<MNewAd />))} />
    <Route path="/m/marketplace/:id" element={wrap(<MMarketplaceItem />)} />
    <Route path="/m/forum" element={wrap(<MForum />)} />
    <Route path="/m/forum/:gameId" element={wrap(<MForumGame />)} />
    <Route path="/m/forum/jogo/:gameId" element={wrap(<MForumGame />)} />
    <Route path="/m/forum/post/:postId" element={wrap(<MForumPost />)} />
    <Route path="/m/review/:productId" element={wrap(<MReview />)} />
    <Route path="/m/chat" element={wrap(protect(<MChat />))} />
    <Route path="/m/chat/:conversationId" element={wrap(protect(<MChatThread />))} />
    <Route path="/m/chat/:conversationId/info" element={wrap(protect(<MChatInfo />))} />
    <Route path="/m/grupos" element={wrap(protect(<MGroups />))} />
    <Route path="/m/grupos/novo" element={wrap(protect(<MGroupNew />))} />
    <Route path="/m/grupos/:id" element={wrap(protect(<MGroupChat />))} />
    <Route path="/m/grupos/:id/info" element={wrap(protect(<MGroupInfo />))} />
    <Route path="/m/torneios/:id/grupo" element={wrap(protect(<MTournamentGroup />))} />
    <Route path="/m/perfil" element={wrap(protect(<MProfile />))} />
    <Route path="/m/perfil/:userId" element={wrap(<MProfile />)} />
    <Route path="/m/config" element={wrap(protect(<MConfig />))} />
    <Route path="/m/config/bloqueados" element={wrap(protect(<MBlockedUsers />))} />
    <Route path="/m/trocas" element={wrap(protect(<MTrocas />))} />
    <Route path="/m/favoritos" element={wrap(protect(<MFavoritos />))} />
    <Route path="/m/amigos" element={wrap(protect(<MFriends />))} />
    <Route path="/m/friends" element={wrap(protect(<MFriends />))} />
    <Route path="/m/biblioteca-social" element={wrap(protect(<MSocialLibrary />))} />
    <Route path="/m/tutoriais" element={wrap(protect(<MTutoriais />))} />
    <Route path="/m/tutorial/:key" element={wrap(protect(<MTutorial />))} />
    <Route path="/m/forum-comunidade" element={wrap(<MForumComunidade />)} />
    <Route path="/m/forum-comunidade/:slug" element={wrap(<MForumComunidade />)} />
    <Route path="/m/vendedor" element={wrap(protect(<VendedorConfig />))} />
    <Route path="/m/*" element={wrap(<MNotFound />)} />
  </>
);
