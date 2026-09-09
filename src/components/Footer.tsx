import { Gamepad2, Mail, Phone, CreditCard, QrCode, Landmark, ArrowUp, Github, Twitter, Youtube, Instagram } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { toast } from 'sonner';

interface StoreInfo { name?: string; email?: string; phone?: string; description?: string }

// GAP-FO01: Redes sociais
interface SocialLink {
  icon: typeof Github;
  href: string;
  label: string;
}

// GAP-FO02: Newsletter
const NewsletterSection = () => {
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribing(true);
    // TODO: Integrar com backend de newsletter
    await new Promise(resolve => setTimeout(resolve, 800));
    toast.success('Inscrição realizada com sucesso!');
    setEmail('');
    setSubscribing(false);
  };

  return (
    <div>
      <h4 className="font-semibold text-foreground mb-3">Newsletter</h4>
      <p className="text-sm text-muted-foreground mb-3">
        Receba ofertas exclusivas e novidades
      </p>
      <form onSubmit={handleSubscribe} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          required
        />
        <button
          type="submit"
          disabled={subscribing}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {subscribing ? '...' : 'Inscrever'}
        </button>
      </form>
    </div>
  );
};

// GAP-FO03: Botão de voltar ao topo
const ScrollToTop = () => {
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:opacity-90 transition-opacity z-50"
      aria-label="Voltar ao topo"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
};

export default function Footer() {
  const { user } = useAuth();
  const { value: store } = useSiteSettings<StoreInfo>('store_info');

  const name = store?.name || 'MIDIAS';
  const description = store?.description || 'Sua loja de jogos digitais com os melhores preços e ofertas exclusivas.';
  const email = store?.email || 'suporte@midias.com.br';
  const phone = store?.phone;

  // GAP-FO01: Redes sociais
  const socialLinks: SocialLink[] = [
    { icon: Github, href: 'https://github.com/midias', label: 'GitHub' },
    { icon: Twitter, href: 'https://twitter.com/midias', label: 'Twitter' },
    { icon: Youtube, href: 'https://youtube.com/midias', label: 'YouTube' },
    { icon: Instagram, href: 'https://instagram.com/midias', label: 'Instagram' },
  ];

  return (
    <>
      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="lg:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <Gamepad2 className="h-6 w-6 text-primary" />
                <span className="font-display text-lg font-bold gradient-text">{name}</span>
              </Link>
              <p className="text-sm text-muted-foreground">{description}</p>
              
              {/* GAP-FO01: Redes sociais */}
              <div className="flex gap-2 mt-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  </a>
                ))}
              
              <Link to="/privacidade" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                Política de Privacidade
              </Link>
              <Link to="/equipe" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                Equipe
              </Link>
              <Link to="/desenvolvedores" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                Desenvolvedores
              </Link></div>
            </div>

            {/* Navegação */}
            <div>
              <h4 className="font-semibold text-foreground mb-3">Navegação</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="hover:text-primary transition-colors">Início</Link></li>
                <li><Link to="/catalogo" className="hover:text-primary transition-colors">Catálogo</Link></li>
                <li><Link to="/ofertas" className="hover:text-primary transition-colors">Ofertas</Link></li>
                {user && <li><Link to="/biblioteca" className="hover:text-primary transition-colors">Biblioteca</Link></li>}
              </ul>
            </div>

            {/* Minha Conta */}
            <div>
              <h4 className="font-semibold text-foreground mb-3">Minha Conta</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {user ? (
                  <>
                    <li><Link to="/perfil" className="hover:text-primary transition-colors">Perfil</Link></li>
                    <li><Link to="/pedidos" className="hover:text-primary transition-colors">Pedidos</Link></li>
                    <li><Link to="/favoritos" className="hover:text-primary transition-colors">Favoritos</Link></li>
                  </>
                ) : (
                  <li><Link to="/auth" className="hover:text-primary transition-colors">Entrar / Cadastrar</Link></li>
                )}
                <li><Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
                <li><Link to="/contato" className="hover:text-primary transition-colors">Contato</Link></li>
                <li><Link to="/termos" className="hover:text-primary transition-colors">Termos de Uso</Link></li>
              </ul>
            </div>

            {/* Contato + Pagamento */}
            <div>
              <h4 className="font-semibold text-foreground mb-3">Contato</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary" />{email}</li>
                {phone && <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" />{phone}</li>}
              </ul>
              <h4 className="font-semibold text-foreground mt-4 mb-2">Pagamento</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5 text-primary" />Cartão de Crédito</li>
                <li className="flex items-center gap-2"><QrCode className="h-3.5 w-3.5 text-primary" />Pix</li>
                <li className="flex items-center gap-2"><Landmark className="h-3.5 w-3.5 text-primary" />Boleto Bancário</li>
              </ul>
            </div>

            {/* GAP-FO02: Newsletter */}
            <div className="lg:col-span-1">
              <NewsletterSection />
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground space-y-1">
            <p>Encarregado de proteção de dados (DPO): {email}</p>
            <p>© {new Date().getFullYear()} {name}. Todos os direitos reservados. Preços e ofertas sujeitos a alteração.</p>
          </div>
        </div>
      </footer>

      {/* GAP-FO03: Scroll to top */}
      <ScrollToTop />
    </>
  );
}