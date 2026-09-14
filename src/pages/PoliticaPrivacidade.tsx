import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Mail, Lock, Database, UserCheck, FileText, Trash2 } from 'lucide-react';

export default function PoliticaPrivacidade() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="text-center mb-8">
        <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-foreground">Política de Privacidade</h1>
        <p className="text-muted-foreground mt-2">Última atualização: 16 de julho de 2026</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> 1. Dados que coletamos
          </h2>
          <p className="text-muted-foreground mt-2">
            A MIDIAS coleta os seguintes dados para fornecer seus serviços:
          </p>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li><strong>Dados de cadastro:</strong> Nome, e-mail, data de nascimento, telefone, CPF (apenas para vendedores)</li>
            <li><strong>Dados de uso:</strong> Biblioteca de jogos, avaliações, posts, participações em torneios</li>
            <li><strong>Dados de compra:</strong> Histórico de pedidos, chaves de ativação</li>
            <li><strong>Dados técnicos:</strong> Endereço IP, tipo de dispositivo, navegador</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> 2. Como usamos seus dados
          </h2>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li>Entregar jogos e chaves de ativação</li>
            <li>Personalizar sua experiência (recomendações, radar)</li>
            <li>Processar pagamentos e reembolsos</li>
            <li>Enviar notificações sobre pedidos, torneios e novidades</li>
            <li>Melhorar a plataforma com análises de uso</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" /> 3. Compartilhamento de dados
          </h2>
          <p className="text-muted-foreground mt-2">
            A MIDIAS <strong>não vende</strong> seus dados pessoais. Compartilhamos dados apenas:
          </p>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li>Com prestadores de serviço (pagamentos, e-mail) para operar a plataforma</li>
            <li>Quando exigido por lei ou ordem judicial</li>
            <li>Com seu consentimento explícito</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-primary" /> 4. Seus direitos (LGPD, Art. 18)
          </h2>
          <p className="text-muted-foreground mt-2">
            Você tem direito a:
          </p>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li><strong>Acesso:</strong> Saber quais dados temos sobre você</li>
            <li><strong>Correção:</strong> Atualizar dados incompletos ou incorretos</li>
            <li><strong>Portabilidade:</strong> Baixar seus dados em formatos JSON/CSV</li>
            <li><strong>Exclusão:</strong> Anonimizar sua conta (exceto dados fiscais obrigatórios)</li>
            <li><strong>Esquecimento:</strong> Solicitar a remoção completa de seus dados</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3 bg-secondary/30 p-3 rounded-lg">
            <strong>Exercer seus direitos:</strong> Acesse a <Link to="/privacidade" className="text-primary hover:underline">Central de Privacidade</Link> ou entre em contato com nosso Encarregado de Dados.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> 5. Encarregado de proteção de dados (DPO)
          </h2>
          <p className="text-muted-foreground mt-2">
            <strong>E-mail:</strong> <a href="mailto:suporte@midias.com.br" className="text-primary hover:underline">suporte@midias.com.br</a>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Canal para solicitações de titulares de dados: acesso, correção, portabilidade, anonimização e exclusão.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> 6. Cookies e rastreamento
          </h2>
          <p className="text-muted-foreground mt-2">
            Usamos cookies para:
          </p>
          <ul className="list-disc pl-5 mt-2 text-muted-foreground space-y-1">
            <li>Manter sua sessão ativa</li>
            <li>Lembrar suas preferências (tema, filtros)</li>
            <li>Analisar o uso da plataforma</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">
            Você pode desativar cookies nas configurações do seu navegador, mas isso pode afetar algumas funcionalidades.
          </p>
        </section>

        <div className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>Esta política de privacidade é parte integrante dos <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link> da MIDIAS.</p>
          <p className="mt-1">Em caso de dúvidas, entre em contato pelo e-mail acima ou pela página de <Link to="/contato" className="text-primary hover:underline">Contato</Link>.</p>
        </div>
      </div>
    </div>
  );
}