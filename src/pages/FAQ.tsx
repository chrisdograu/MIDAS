import { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle, Search, ThumbsUp, ThumbsDown, Filter, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';

// GAP-477: Categorias
type FAQCategory = 'compras' | 'conta' | 'tecnico' | 'marketplace' | 'privacidade' | 'geral';

const CATEGORIES: { id: FAQCategory; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'compras', label: 'Compras' },
  { id: 'conta', label: 'Conta' },
  { id: 'tecnico', label: 'Técnico' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'privacidade', label: 'Privacidade' },
];

// GAP-475: Interface FAQ
interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: FAQCategory;
  order: number;
  helpful_count: number;
  not_helpful_count: number;
}

// GAP-478: Registrar feedback
async function registerFeedback(faqId: string, helpful: boolean) {
  const field = helpful ? 'helpful_count' : 'not_helpful_count';
  // Usar RPC para incremento atômico
  const { error } = await supabase.rpc('increment_faq_feedback' as any, {
    _faq_id: faqId,
    _field: field,
  });
  if (error) {
    console.error('Erro ao registrar feedback:', error);
    toast.error('Erro ao registrar feedback');
  } else {
    toast.success(helpful ? 'Obrigado pelo feedback!' : 'Feedback registrado');
  }
}

export default function FAQ() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FAQCategory | 'all'>('all');
  // GAP-478: Estado de feedback (para evitar spam)
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({});

  // GAP-475: Carregar FAQs do banco
  useEffect(() => {
    async function loadFAQs() {
      setLoading(true);
      const { data, error } = await supabase
        .from('faq')
        .select('*')
        .order('order', { ascending: true });
      if (error) {
        console.error('Erro ao carregar FAQs:', error);
        // Fallback: usar dados estáticos
        setFaqs(getFallbackFAQs());
      } else {
        setFaqs(data as FAQItem[] || getFallbackFAQs());
      }
      setLoading(false);
    }
    loadFAQs();
  }, []);

  // GAP-475: Fallback caso o banco esteja vazio
  const getFallbackFAQs = (): FAQItem[] => [
    { id: '1', question: 'Como funciona a compra de jogos digitais?', answer: 'Após finalizar a compra, você receberá a chave de ativação do jogo por e-mail instantaneamente. Basta ativar na plataforma correspondente (Steam, PlayStation Store, Xbox Store, etc.).', category: 'compras', order: 1, helpful_count: 0, not_helpful_count: 0 },
    { id: '2', question: 'Quais formas de pagamento são aceitas?', answer: 'Aceitamos cartão de crédito (parcelado em até 12x sem juros), Pix (com desconto) e boleto bancário.', category: 'compras', order: 2, helpful_count: 0, not_helpful_count: 0 },
    { id: '3', question: 'Os jogos têm garantia?', answer: 'Sim! Todos os jogos possuem garantia de 30 dias. Se houver qualquer problema com a chave, faremos a substituição ou reembolso.', category: 'compras', order: 3, helpful_count: 0, not_helpful_count: 0 },
    { id: '4', question: 'Em quanto tempo recebo meu jogo?', answer: 'A entrega é instantânea! Após a confirmação do pagamento, a chave será enviada para o e-mail cadastrado em poucos minutos.', category: 'compras', order: 4, helpful_count: 0, not_helpful_count: 0 },
    { id: '5', question: 'Posso devolver um jogo?', answer: 'Caso a chave não tenha sido ativada, aceitamos devoluções em até 7 dias após a compra. Entre em contato pelo nosso canal de suporte.', category: 'compras', order: 5, helpful_count: 0, not_helpful_count: 0 },
    { id: '6', question: 'Como funciona o sistema de avaliações?', answer: 'Usuários logados podem avaliar jogos com notas de 0,5 a 5 estrelas. A nota média é exibida na página do produto e no catálogo.', category: 'geral', order: 6, helpful_count: 0, not_helpful_count: 0 },
    { id: '7', question: 'O que é a Biblioteca do Usuário?', answer: 'A Biblioteca é onde ficam todos os jogos que você comprou. Você pode organizar seus jogos por status: "Quero Jogar" ou "Já Joguei".', category: 'conta', order: 7, helpful_count: 0, not_helpful_count: 0 },
    { id: '8', question: 'Como entro em contato com o suporte?', answer: 'Você pode nos contatar pela página de Contato, por e-mail ou pelas redes sociais. Nosso suporte funciona 24/7.', category: 'geral', order: 8, helpful_count: 0, not_helpful_count: 0 },
    { id: '9', question: 'Quem é o Encarregado de proteção de dados (DPO)?', answer: 'Encarregado de proteção de dados: suporte@midias.com.br — mesmo contato do rodapé. Fale com o Encarregado para pedidos de acesso, correção ou exclusão de dados pessoais (LGPD, Art. 41).', category: 'privacidade', order: 9, helpful_count: 0, not_helpful_count: 0 },
    { id: '10', question: 'Como funciona o marketplace C2C?', answer: 'O marketplace permite que usuários comprem e vendam jogos entre si. Vendedores podem criar anúncios e compradores podem fazer ofertas. A MIDIAS atua como intermediadora, oferecendo proteção e garantia.', category: 'marketplace', order: 10, helpful_count: 0, not_helpful_count: 0 },
    { id: '11', question: 'O que é um certificado de proteção?', answer: 'O certificado de proteção é uma verificação de identidade que permite ao vendedor oferecer anúncios "protegidos pela loja". Isso garante reembolso em caso de problemas na transação.', category: 'marketplace', order: 11, helpful_count: 0, not_helpful_count: 0 },
    { id: '12', question: 'Como funciona o sistema de XP e níveis?', answer: 'Você ganha XP ao comprar jogos, escrever reviews, participar de torneios e interagir na comunidade. A cada nível, você desbloqueia novos títulos e badges para seu perfil.', category: 'conta', order: 12, helpful_count: 0, not_helpful_count: 0 },
  ];

  // GAP-476: Busca
  const filteredFaqs = faqs.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // GAP-478: Feedback
  const handleFeedback = (faqId: string, helpful: boolean) => {
    if (feedbackGiven[faqId]) {
      toast.info('Você já avaliou esta resposta');
      return;
    }
    registerFeedback(faqId, helpful);
    setFeedbackGiven(prev => ({ ...prev, [faqId]: true }));
    // Atualizar contagem local
    setFaqs(prev => prev.map(item => {
      if (item.id === faqId) {
        return {
          ...item,
          helpful_count: helpful ? (item.helpful_count || 0) + 1 : item.helpful_count,
          not_helpful_count: helpful ? item.not_helpful_count : (item.not_helpful_count || 0) + 1,
        };
      }
      return item;
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <HelpCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Perguntas Frequentes</h1>
          <p className="text-muted-foreground mt-2">Carregando...</p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="text-center mb-10">
        <HelpCircle className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-foreground">Perguntas Frequentes</h1>
        <p className="text-muted-foreground mt-2">Tire suas dúvidas sobre a MIDIAS</p>
      </div>

      {/* GAP-476: Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar perguntas..."
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* GAP-477: Filtro por categoria */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Categoria:</span>
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            categoryFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Todas ({faqs.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = faqs.filter(f => f.category === cat.id).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {filteredFaqs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HelpCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p>Nenhuma pergunta encontrada</p>
          <p className="text-sm mt-1">Tente outro termo ou categoria.</p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {filteredFaqs.map((item) => (
            <AccordionItem
              key={item.id}
              value={`faq-${item.id}`}
              className="bg-card border border-border rounded-xl px-4"
            >
              <AccordionTrigger className="text-left text-foreground hover:text-primary">
                <span className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {CATEGORIES.find(c => c.id === item.category)?.label || 'Geral'}
                  </span>
                  {item.question}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-3">{item.answer}</p>
                {/* GAP-478: "Esta resposta foi útil?" */}
                <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Esta resposta foi útil?</span>
                  <button
                    onClick={() => handleFeedback(item.id, true)}
                    disabled={!!feedbackGiven[item.id]} aria-label="Marcar resposta como útil"
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                      feedbackGiven[item.id]
                        ? 'bg-success/10 text-success cursor-default'
                        : 'bg-secondary hover:bg-success/20 text-muted-foreground hover:text-success'
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" />
                    {item.helpful_count > 0 && <span>{item.helpful_count}</span>}
                  </button>
                  <button
                    onClick={() => handleFeedback(item.id, false)}
                    disabled={!!feedbackGiven[item.id]} aria-label="Marcar resposta como não útil"
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                      feedbackGiven[item.id]
                        ? 'bg-destructive/10 text-destructive cursor-default'
                        : 'bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive'
                    }`}
                  >
                    <ThumbsDown className="h-3 w-3" />
                    {item.not_helpful_count > 0 && <span>{item.not_helpful_count}</span>}
                  </button>
                  {feedbackGiven[item.id] && (
                    <span className="text-xs text-muted-foreground">✓ Avaliado</span>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}