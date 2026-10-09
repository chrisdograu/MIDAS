import { Link } from 'react-router-dom';
import { ArrowLeft, Github, Linkedin, Mail, Users, Loader2, Twitter, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import ErroCarregamento from '@/components/ErroCarregamento';

type SocialLinks = { github?: string; linkedin?: string; email?: string; twitter?: string; website?: string };

function safeLink(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export default function Equipe() {
  const { data: teamMembers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['public-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, role, photo_url, banner_url, bio, long_description, social_links')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs mb-3">
          <Users className="h-3 w-3" /> Projeto Acadêmico
        </div>
        <h1 className="text-3xl font-bold text-foreground">Equipe MIDIAS</h1>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Conheça as pessoas por trás da plataforma. Este é um projeto de Trabalho de Conclusão de Curso.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : isError ? (
        <ErroCarregamento titulo="Não foi possível carregar a equipe" onRetry={() => refetch()} />
      ) : teamMembers.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Equipe ainda não cadastrada" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teamMembers.map((member) => {
            const links = (member.social_links ?? {}) as SocialLinks;
            return <div key={member.id} className="bg-card border border-border rounded-lg overflow-hidden text-center hover:border-primary/40 transition-colors">
            {member.banner_url && <img src={member.banner_url} alt={`Capa de ${member.name}`} className="w-full aspect-[3/1] object-cover" loading="lazy" />}
            <div className="p-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground mb-4">
              {member.photo_url ? (
                <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover rounded-full" loading="lazy" />
              ) : (
                member.name[0]
              )}
            </div>
            <h3 className="text-lg font-bold text-foreground">{member.name}</h3>
            <p className="text-sm text-primary font-medium">{member.role}</p>
            {member.bio && (
              <p className="text-sm text-muted-foreground mt-2">{member.bio}</p>
            )}
            {member.long_description && <details className="mt-4 text-left"><summary className="cursor-pointer text-sm font-medium text-primary">Sobre {member.name}</summary><p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words">{member.long_description}</p></details>}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {safeLink(links.twitter) && <a href={safeLink(links.twitter) ?? undefined} aria-label={`X de ${member.name}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary"><Twitter className="h-4 w-4" /></a>}
              {safeLink(links.website) && <a href={safeLink(links.website) ?? undefined} aria-label={`Site de ${member.name}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary"><Globe className="h-4 w-4" /></a>}
              {safeLink(links.github) && (
                <a href={safeLink(links.github) ?? undefined} aria-label={`GitHub de ${member.name}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Github className="h-4 w-4" />
                </a>
              )}
              {safeLink(links.linkedin) && (
                <a href={safeLink(links.linkedin) ?? undefined} aria-label={`LinkedIn de ${member.name}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
              {links.email && (
                <a href={`mailto:${encodeURIComponent(links.email)}`} aria-label={`E-mail de ${member.name}`} className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Mail className="h-4 w-4" />
                </a>
              )}
            </div>
            </div>
          </div>;
          })}
        </div>
      )}

      <div className="mt-12 p-6 bg-card border border-border rounded-2xl text-center">
        <p className="text-sm text-muted-foreground">
          Este é um projeto acadêmico desenvolvido como Trabalho de Conclusão de Curso.
          <br />
          A MIDIAS é uma plataforma de jogos digitais com comunidade, marketplace e torneios.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          © 2026 MIDIAS - Todos os direitos reservados (projeto acadêmico)
        </p>
      </div>
    </div>
  );
}