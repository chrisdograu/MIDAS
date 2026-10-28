CREATE POLICY "Chat partners can view each other profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE (c.participant_1 = auth.uid() AND c.participant_2 = profiles.id)
       OR (c.participant_2 = auth.uid() AND c.participant_1 = profiles.id)
  )
);

DROP FUNCTION IF EXISTS public.start_conversation(uuid, uuid, uuid, text);