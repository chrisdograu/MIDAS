import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2, Filter, X } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';
import { DeveloperCard } from '@/components/developer/DeveloperCard';

export default function DevelopersList() {
  const [developers, setDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('developers')
        .select('id, name, slug, logo_url, country, founded_year')
        .order('name');
      
      if (data) {
        const devIds = data.map(d => d.id);
        const { data: games } = await supabase
          .from('produtos')
          .select('developer_id')
          .in('developer_id', devIds);
        
        const counts = new Map();
        games?.forEach(g => {
          counts.set(g.developer_id, (counts.get(g.developer_id) || 0) + 1);
        });
        
        const devs = data.map(d => ({
          ...d,
          game_count: counts.get(d.id) || 0,
        }));
        
        setDevelopers(devs);
        const uniqueCountries = [...new Set(devs.map(d => d.country).filter(Boolean))].sort();
        setCountries(uniqueCountries);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = developers.filter(d => {
    const matchName = d.name.toLowerCase().includes(busca.toLowerCase());
    const matchCountry = countryFilter === 'all' || d.country === countryFilter;
    return matchName && matchCountry;
  });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Desenvolvedores</h1>
        <span className="text-sm text-muted-foreground">({developers.length})</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <BuscaInput
          value={busca}
          onChange={setBusca}
          placeholder="Buscar desenvolvedor..."
          className="flex-1 min-w-[200px]"
        />
        
        {countries.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)} aria-label="Filtrar por país"
              className="px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">Todos os países</option>
              {countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {countryFilter !== 'all' && (
              <button
                onClick={() => setCountryFilter('all')} aria-label="Limpar filtro de país"
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EstadoVazio
          icone={Building2}
          titulo="Nenhum desenvolvedor encontrado"
          descricao={busca ? 'Tente outro termo de busca.' : 'Ainda não há desenvolvedores cadastrados.'}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((dev) => (
            <DeveloperCard
              key={dev.id}
              id={dev.id}
              name={dev.name}
              logo_url={dev.logo_url}
              game_count={dev.game_count}
            />
          ))}
        </div>
      )}
    </div>
  );
}