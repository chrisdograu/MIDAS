
-- Create employee position enum
CREATE TYPE public.employee_position AS ENUM (
  'admin',
  'gerente',
  'moderador',
  'atendente_marketplace',
  'estoquista',
  'atendente'
);

-- Add position column to user_roles for staff members
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS position public.employee_position;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_position ON public.user_roles(position);

-- Function to get employee position
CREATE OR REPLACE FUNCTION public.get_employee_position(_user_id uuid)
RETURNS public.employee_position
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT position FROM public.user_roles
  WHERE user_id = _user_id AND role IN ('admin', 'atendente')
  LIMIT 1
$$;
