import { Link } from 'react-router-dom';
import { ArrowLeft, Github, Linkedin, Mail, Users } from 'lucide-react';

const teamMembers = [
  {
    id: '1',
    name: 'Christopher',
    role: 'Desenvolvedor Full Stack',
    photo: null,
    bio: 'Responsável pela arquitetura da plataforma, desenvolvimento web e mobile, e integrações com Supabase.',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    email: 'chris@midias.com.br',
  },
];

export default function Equipe() {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teamMembers.map((member) => (
          <div key={member.id} className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/40 transition-colors">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground mb-4">
              {member.photo ? (
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover rounded-full" loading="lazy" />
              ) : (
                member.name[0]
              )}
            </div>
            <h3 className="text-lg font-bold text-foreground">{member.name}</h3>
            <p className="text-sm text-primary font-medium">{member.role}</p>
            {member.bio && (
              <p className="text-sm text-muted-foreground mt-2">{member.bio}</p>
            )}
            <div className="flex items-center justify-center gap-3 mt-4">
              {member.github && (
                <a href={member.github} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Github className="h-4 w-4" />
                </a>
              )}
              {member.linkedin && (
                <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
              {member.email && (
                <a href={`mailto:${member.email}`} className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                  <Mail className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

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