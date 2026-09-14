import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldOff } from 'lucide-react';
import BlockedUsersTab from '@/components/perfil/BlockedUsersTab';

export default function MBlockedUsers() {
  return (
    <div className="px-4 py-5 space-y-4">
      <Link to="/m/config" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para configurações
      </Link>
      <h1 className="font-display text-xl font-bold gradient-text flex items-center gap-2">
        <ShieldOff className="h-5 w-5 text-primary" /> Usuários bloqueados
      </h1>
      <p className="text-xs text-muted-foreground">
        Gerencie aqui as pessoas que você bloqueou. Elas não podem te enviar mensagens nem ver seu perfil.
      </p>
      <div className="glass rounded-2xl p-4">
        <BlockedUsersTab />
      </div>
    </div>
  );
}
