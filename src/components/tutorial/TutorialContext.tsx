import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { dbWrite } from '@/lib/dbWrite';
import { toast } from 'sonner';

export type TutorialKey =
  | 'web_perfil' | 'web_biblioteca' | 'web_review_completa' | 'web_torneios'
  | 'web_busca_global' | 'web_conversas_opinioes' | 'web_destaques'
  | 'mobile_feed' | 'mobile_marketplace' | 'mobile_forum'
  | 'mobile_chat' | 'mobile_anunciar' | 'mobile_perfil';

export interface TutorialMeta {
  key: TutorialKey;
  title: string;
  description: string;
  replicaRoute: string;
  area: 'web' | 'mobile';
  /** GAP-TC03: Feature que este tutorial ensina */
  feature?: string;
}

export const TUTORIALS: TutorialMeta[] = [
  { key: 'web_perfil',             title: 'Personalizar Perfil',       description: 'Banner, cor do tema, bio, troféus em destaque', replicaRoute: '/tutorial/web_perfil', area: 'web', feature: 'profile' },
  { key: 'web_biblioteca',         title: 'Sua Biblioteca',            description: 'Status de jogos, horas, platinas, capas customizadas', replicaRoute: '/tutorial/web_biblioteca', area: 'web', feature: 'library' },
  { key: 'web_review_completa',    title: 'Review Completa',           description: 'Escrever review longa, anexar screenshots, publicar', replicaRoute: '/tutorial/web_review_completa', area: 'web', feature: 'reviews' },
  { key: 'web_torneios',           title: 'Torneios',                  description: 'Inscrição, chat do torneio, brackets, partidas', replicaRoute: '/tutorial/web_torneios', area: 'web', feature: 'tournaments' },
  { key: 'web_busca_global',       title: 'Busca Global',              description: 'Buscar em todo o ecossistema (Mobile + Web)', replicaRoute: '/tutorial/web_busca_global', area: 'web', feature: 'search' },
  { key: 'web_conversas_opinioes', title: 'Conversas de Opiniões',     description: 'Como uma opinião vira conversa privada permanente', replicaRoute: '/tutorial/web_conversas_opinioes', area: 'web', feature: 'opinions' },
  { key: 'web_destaques',          title: 'Destaques do Perfil',       description: 'Fixar até 6 itens (jogos, reviews, opiniões) no perfil', replicaRoute: '/tutorial/web_destaques', area: 'web', feature: 'highlights' },
  { key: 'mobile_feed',            title: 'Feed Mobile',               description: 'Como funciona o feed da comunidade', replicaRoute: '/tutorial/mobile_feed', area: 'mobile', feature: 'feed' },
  { key: 'mobile_marketplace',     title: 'Marketplace C2C',           description: 'Anúncios, filtros, certificado de proteção', replicaRoute: '/tutorial/mobile_marketplace', area: 'mobile', feature: 'marketplace' },
  { key: 'mobile_forum',           title: 'Fórum',                     description: 'Tópicos por jogo, likes, respostas', replicaRoute: '/tutorial/mobile_forum', area: 'mobile', feature: 'forum' },
  { key: 'mobile_chat',            title: 'Chat',                      description: 'Conversas, grupos, denúncias', replicaRoute: '/tutorial/mobile_chat', area: 'mobile', feature: 'chat' },
  { key: 'mobile_anunciar',        title: 'Anunciar Item',             description: 'Como criar um anúncio passo a passo', replicaRoute: '/tutorial/mobile_anunciar', area: 'mobile', feature: 'ads' },
  { key: 'mobile_perfil',          title: 'Perfil Mobile',             description: 'Foto, bio, certificação de vendedor', replicaRoute: '/tutorial/mobile_perfil', area: 'mobile', feature: 'profile' },
];

interface TutorialCtx {
  seen: Set<TutorialKey>;
  markSeen: (key: TutorialKey) => Promise<void>;
  isLoading: boolean;
  /** GAP-TC01: Progresso geral */
  progress: number;
  /** GAP-TC02: Resetar todos os tutoriais */
  resetAll: () => Promise<void>;
  /** GAP-TC03: Verificar se tutorial deve ser mostrado para uma feature */
  shouldShowForFeature: (feature: string) => boolean;
  /** GAP-TC03: Marcar feature como vista */
  markFeatureSeen: (feature: string) => Promise<void>;
}

const Ctx = createContext<TutorialCtx>({ 
  seen: new Set(), 
  markSeen: async () => {}, 
  isLoading: true,
  progress: 0,
  resetAll: async () => {},
  shouldShowForFeature: () => false,
  markFeatureSeen: async () => {},
});

// GAP-TC03: Features que têm tutorial
const FEATURE_MAP: Record<string, TutorialKey> = {
  'profile': 'web_perfil',
  'library': 'web_biblioteca',
  'reviews': 'web_review_completa',
  'tournaments': 'web_torneios',
  'search': 'web_busca_global',
  'opinions': 'web_conversas_opinioes',
  'highlights': 'web_destaques',
  'feed': 'mobile_feed',
  'marketplace': 'mobile_marketplace',
  'forum': 'mobile_forum',
  'chat': 'mobile_chat',
  'ads': 'mobile_anunciar',
};

export const TutorialProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [seen, setSeen] = useState<Set<TutorialKey>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  // GAP-TC03: Features já vistas
  const [featuresSeen, setFeaturesSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setSeen(new Set()); setFeaturesSeen(new Set()); setIsLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('tutorials_seen').select('tutorial_key, feature_key').eq('user_id', user.id);
      const tutorialKeys = new Set((data ?? []).map(d => d.tutorial_key as TutorialKey));
      const featureKeys = new Set((data ?? []).map(d => d.feature_key).filter(Boolean));
      setSeen(tutorialKeys);
      setFeaturesSeen(featureKeys);
      setIsLoading(false);
    })();
  }, [user?.id]);

  const markSeen = async (key: TutorialKey) => {
    if (!user) return;
    const ok = await dbWrite(supabase.from('tutorials_seen').upsert({
      user_id: user.id, tutorial_key: key, completed: true,
    } as any, { onConflict: 'user_id,tutorial_key' }), 'Não foi possível salvar seu progresso');
    if (!ok) return;
    setSeen(prev => new Set([...prev, key]));
  };

  // GAP-TC03: Marcar feature como vista
  const markFeatureSeen = async (feature: string) => {
    const tutorialKey = FEATURE_MAP[feature];
    if (!tutorialKey) return;
    if (featuresSeen.has(feature)) return;
    await markSeen(tutorialKey);
    setFeaturesSeen(prev => new Set([...prev, feature]));
  };

  // GAP-TC03: Verificar se deve mostrar tutorial para uma feature
  const shouldShowForFeature = useCallback((feature: string) => {
    const tutorialKey = FEATURE_MAP[feature];
    if (!tutorialKey) return false;
    return !seen.has(tutorialKey) && !featuresSeen.has(feature);
  }, [seen, featuresSeen]);

  // GAP-TC01: Calcular progresso
  const progress = useMemo(() => {
    const total = TUTORIALS.length;
    const completed = TUTORIALS.filter(t => seen.has(t.key)).length;
    return Math.round((completed / total) * 100);
  }, [seen]);

  // GAP-TC02: Resetar todos os tutoriais
  const resetAll = async () => {
    if (!user) return;
    const ok = await dbWrite(supabase.from('tutorials_seen').delete().eq('user_id', user.id), 'Não foi possível resetar');
    if (!ok) return;
    setSeen(new Set());
    setFeaturesSeen(new Set());
    toast.success('Todos os tutoriais foram reiniciados');
  };

  return (
    <Ctx.Provider value={{ 
      seen, 
      markSeen, 
      isLoading, 
      progress,
      resetAll,
      shouldShowForFeature,
      markFeatureSeen,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useTutorial = () => useContext(Ctx);

// ─── GAP-TC03: HOOK PARA TUTORIAL CONTEXTUAL ─────────────────────────────

export function useContextualTutorial(feature: string) {
  const { shouldShowForFeature, markFeatureSeen, isLoading } = useTutorial();
  const shouldShow = shouldShowForFeature(feature);
  
  const dismiss = () => markFeatureSeen(feature);
  
  return { shouldShow, dismiss, isLoading };
}

// ─── GAP-TC01: COMPONENTE DE PROGRESSO ─────────────────────────────────────

export function TutorialProgress() {
  const { progress, isLoading } = useTutorial();
  
  if (isLoading) return null;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">Tutoriais</span>
      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-foreground">{progress}%</span>
    </div>
  );
}