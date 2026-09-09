ALTER TABLE public.biblioteca_usuario
  ADD CONSTRAINT biblioteca_usuario_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.avaliacoes
  ADD CONSTRAINT avaliacoes_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.forum_posts
  ADD CONSTRAINT forum_posts_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.game_opinions
  ADD CONSTRAINT game_opinions_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;