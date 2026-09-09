-- 62: novo tipo de notificação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'lembrete_torneio'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'lembrete_torneio';
  END IF;
END $$;

-- 69: CHECK constraint em biblioteca_usuario.status
ALTER TABLE public.biblioteca_usuario
  DROP CONSTRAINT IF EXISTS biblioteca_usuario_status_check;

ALTER TABLE public.biblioteca_usuario
  ADD CONSTRAINT biblioteca_usuario_status_check
  CHECK (status IN ('ja_joguei','zerado','jogando','pausado','abandonado','quero_jogar','platinado'));
