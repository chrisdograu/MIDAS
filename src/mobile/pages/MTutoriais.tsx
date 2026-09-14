import { Link } from 'react-router-dom';
import { ChevronRight, GraduationCap, ArrowLeft, CheckCircle2, Filter, Smartphone, Monitor } from 'lucide-react';
import { TUTORIALS, useTutorial } from '@/components/tutorial/TutorialContext';
import { useState } from 'react';

type Area = 'all' | 'mobile' | 'web';

export default function MTutoriais() {
  const { seen } = useTutorial();
  const [area, setArea] = useState<Area>('mobile');
  const allTutorials = TUTORIALS.filter(t => area === 'all' ? true : t.area === area);
  
  // GAP-1128: Já existe filtro por área (mobile), mas adicionamos toggle para ver todos
  const mobileList = TUTORIALS.filter(t => t.area === 'mobile');
  
  return (
    <div className="px-4 py-5 space-y-4 pb-24">
      <Link to="/m/config" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Configurações</Link>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-accent" />
          <h1 className="font-display text-xl font-bold gradient-text">Tutoriais mobile</h1>
        </div>
        <span className="text-xs text-muted-foreground">{mobileList.length} disponíveis</span>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Cada tutorial é interativo: você passa por etapas, mexe em mini-componentes e termina com um link direto para a versão real.
      </p>
      
      {/* GAP-1128: Filtro por área (já existe, apenas melhorado) */}
      <div className="flex gap-1.5 p-1 bg-secondary/40 rounded-lg">
        <button
          onClick={() => setArea('mobile')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 ${area === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          <Smartphone className="h-3.5 w-3.5" /> Mobile
        </button>
        <button
          onClick={() => setArea('web')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 ${area === 'web' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          <Monitor className="h-3.5 w-3.5" /> Web
        </button>
        <button
          onClick={() => setArea('all')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semidold flex items-center justify-center gap-1 ${area === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          <Filter className="h-3.5 w-3.5" /> Todos
        </button>
      </div>
      
      <div className="space-y-2">
        {allTutorials.map(t => (
          <Link key={t.key} to={t.area === 'web' ? `/tutorial/${t.key}` : `/m/tutorial/${t.key}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg">
              {t.area === 'mobile' ? '📱' : '💻'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold truncate">{t.title}</p>
                {seen.has(t.key) && <CheckCircle2 className="h-3 w-3 text-success shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}