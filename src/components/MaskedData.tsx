
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaskedDataProps {
  value: string;
  type: 'cpf' | 'phone' | 'email' | 'address' | 'credit_card';
  showToggle?: boolean;
  className?: string;
}

const masks: Record<string, (v: string) => string> = {
  cpf: (v) => v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.***.**'),
  phone: (v) => v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-****'),
  email: (v) => v.replace(/(.{2}).*(@.*)/, '$1***$2'),
  address: (v) => v.replace(/(.{10}).*/, '$1...'),
  credit_card: (v) => v.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '**** **** **** $4'),
};

export function MaskedData({ value, type, showToggle = true, className = '' }: MaskedDataProps) {
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className={className}>—</span>;

  const maskedValue = masks[type] ? masks[type](value) : value;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="font-mono">
        {revealed ? value : maskedValue}
      </span>
      {showToggle && (
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="text-muted-foreground hover:text-primary transition-colors p-0.5"
          title={revealed ? 'Ocultar' : 'Revelar'}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}