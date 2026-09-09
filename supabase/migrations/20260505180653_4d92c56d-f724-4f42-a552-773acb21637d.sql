
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.games_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  cover_url text,
  publisher text,
  platforms text[] DEFAULT '{}'::text[],
  tags text[] DEFAULT '{}'::text[],
  popularity int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.games_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view games_catalog" ON public.games_catalog;
CREATE POLICY "Anyone can view games_catalog"
  ON public.games_catalog FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins manage games_catalog" ON public.games_catalog;
CREATE POLICY "Admins manage games_catalog"
  ON public.games_catalog FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_games_catalog_title_trgm
  ON public.games_catalog USING gin (title gin_trgm_ops);

INSERT INTO public.games_catalog (slug, title, publisher, platforms, tags, popularity) VALUES
  ('hollow-knight','Hollow Knight','Team Cherry','{PC,Switch,PS4,Xbox}','{metroidvania,indie}',95),
  ('elden-ring','Elden Ring','FromSoftware','{PC,PS5,Xbox}','{souls,rpg}',100),
  ('the-witcher-3','The Witcher 3','CD Projekt Red','{PC,PS5,Xbox,Switch}','{rpg,open-world}',98),
  ('cyberpunk-2077','Cyberpunk 2077','CD Projekt Red','{PC,PS5,Xbox}','{rpg,fps}',90),
  ('red-dead-redemption-2','Red Dead Redemption 2','Rockstar','{PC,PS4,Xbox}','{open-world}',97),
  ('gta-v','Grand Theft Auto V','Rockstar','{PC,PS5,Xbox}','{open-world}',99),
  ('minecraft','Minecraft','Mojang','{PC,Switch,PS5,Xbox,Mobile}','{sandbox}',100),
  ('terraria','Terraria','Re-Logic','{PC,Switch,Mobile}','{sandbox,indie}',88),
  ('stardew-valley','Stardew Valley','ConcernedApe','{PC,Switch,Mobile,PS5,Xbox}','{indie,sim}',92),
  ('hades','Hades','Supergiant','{PC,Switch,PS5,Xbox}','{roguelike,indie}',90),
  ('celeste','Celeste','Maddy Makes','{PC,Switch,PS5,Xbox}','{platformer,indie}',85),
  ('dark-souls-3','Dark Souls III','FromSoftware','{PC,PS4,Xbox}','{souls}',92),
  ('bloodborne','Bloodborne','FromSoftware','{PS4}','{souls,gothic}',93),
  ('sekiro','Sekiro','FromSoftware','{PC,PS4,Xbox}','{souls,action}',91),
  ('god-of-war','God of War (2018)','Sony','{PC,PS5}','{action,norse}',95),
  ('god-of-war-ragnarok','God of War Ragnarök','Sony','{PS5,PS4}','{action,norse}',96),
  ('horizon-zero-dawn','Horizon Zero Dawn','Sony','{PC,PS5}','{open-world}',88),
  ('spiderman-2','Marvel''s Spider-Man 2','Sony','{PS5}','{action}',93),
  ('the-last-of-us','The Last of Us Part I','Sony','{PC,PS5}','{action,story}',95),
  ('halo-infinite','Halo Infinite','343 Industries','{PC,Xbox}','{fps}',82),
  ('forza-horizon-5','Forza Horizon 5','Playground','{PC,Xbox}','{racing}',90),
  ('starfield','Starfield','Bethesda','{PC,Xbox}','{rpg,sci-fi}',80),
  ('skyrim','The Elder Scrolls V: Skyrim','Bethesda','{PC,Switch,PS5,Xbox}','{rpg}',96),
  ('fallout-4','Fallout 4','Bethesda','{PC,PS4,Xbox}','{rpg,post-apoc}',86),
  ('zelda-totk','The Legend of Zelda: Tears of the Kingdom','Nintendo','{Switch}','{adventure}',98),
  ('zelda-botw','The Legend of Zelda: Breath of the Wild','Nintendo','{Switch,WiiU}','{adventure}',97),
  ('mario-odyssey','Super Mario Odyssey','Nintendo','{Switch}','{platformer}',92),
  ('animal-crossing','Animal Crossing: New Horizons','Nintendo','{Switch}','{life-sim}',89),
  ('splatoon-3','Splatoon 3','Nintendo','{Switch}','{shooter}',82),
  ('pokemon-scarlet','Pokémon Scarlet','Nintendo','{Switch}','{rpg}',85),
  ('overwatch-2','Overwatch 2','Blizzard','{PC,PS5,Xbox,Switch}','{fps,hero}',78),
  ('valorant','Valorant','Riot','{PC}','{fps,tactical}',92),
  ('league-of-legends','League of Legends','Riot','{PC}','{moba}',95),
  ('dota-2','Dota 2','Valve','{PC}','{moba}',90),
  ('counter-strike-2','Counter-Strike 2','Valve','{PC}','{fps,tactical}',96),
  ('cs-go','Counter-Strike: Global Offensive','Valve','{PC}','{fps,tactical}',92),
  ('apex-legends','Apex Legends','Respawn','{PC,PS5,Xbox,Switch}','{br,fps}',88),
  ('fortnite','Fortnite','Epic','{PC,PS5,Xbox,Switch,Mobile}','{br,build}',95),
  ('genshin-impact','Genshin Impact','HoYoverse','{PC,PS5,Mobile}','{gacha,rpg}',93),
  ('honkai-star-rail','Honkai: Star Rail','HoYoverse','{PC,PS5,Mobile}','{gacha,rpg}',88),
  ('palworld','Palworld','Pocketpair','{PC,Xbox}','{survival,creature}',86),
  ('baldurs-gate-3','Baldur''s Gate 3','Larian','{PC,PS5,Xbox}','{crpg}',98),
  ('disco-elysium','Disco Elysium','ZA/UM','{PC,PS5,Xbox,Switch}','{crpg,indie}',90),
  ('persona-5','Persona 5 Royal','Atlus','{PC,PS5,Xbox,Switch}','{jrpg}',94),
  ('final-fantasy-7-remake','Final Fantasy VII Remake','Square Enix','{PC,PS5}','{jrpg}',91),
  ('final-fantasy-16','Final Fantasy XVI','Square Enix','{PC,PS5}','{action,jrpg}',86),
  ('monster-hunter-world','Monster Hunter: World','Capcom','{PC,PS4,Xbox}','{action,coop}',90),
  ('resident-evil-4-remake','Resident Evil 4 Remake','Capcom','{PC,PS5,Xbox}','{horror,action}',93),
  ('alan-wake-2','Alan Wake 2','Remedy','{PC,PS5,Xbox}','{horror,story}',88),
  ('control','Control','Remedy','{PC,PS5,Xbox,Switch}','{action,paranormal}',82)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'amizade',
  ADD COLUMN IF NOT EXISTS has_active_report boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.flag_conversa_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE conv_id uuid;
BEGIN
  IF NEW.target_type IN ('conversa','mensagem') THEN
    IF NEW.target_type = 'mensagem' THEN
      SELECT c.id INTO conv_id FROM public.conversas c
        JOIN public.mensagens m ON m.id = NEW.target_id
       WHERE (c.participant_1 = m.sender_id AND c.participant_2 = m.receiver_id)
          OR (c.participant_2 = m.sender_id AND c.participant_1 = m.receiver_id)
       LIMIT 1;
    ELSE
      conv_id := NEW.target_id;
    END IF;
    IF conv_id IS NOT NULL THEN
      UPDATE public.conversas SET has_active_report = true WHERE id = conv_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_flag_conversa_on_report ON public.denuncias;
CREATE TRIGGER trg_flag_conversa_on_report
AFTER INSERT ON public.denuncias
FOR EACH ROW EXECUTE FUNCTION public.flag_conversa_on_report();

CREATE OR REPLACE FUNCTION public.unflag_conversa_on_resolve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE conv_id uuid; remaining int;
BEGIN
  IF NEW.status <> 'pending' AND OLD.status = 'pending' AND NEW.target_type IN ('conversa','mensagem') THEN
    IF NEW.target_type = 'mensagem' THEN
      SELECT c.id INTO conv_id FROM public.conversas c
        JOIN public.mensagens m ON m.id = NEW.target_id
       WHERE (c.participant_1 = m.sender_id AND c.participant_2 = m.receiver_id)
          OR (c.participant_2 = m.sender_id AND c.participant_1 = m.receiver_id)
       LIMIT 1;
    ELSE
      conv_id := NEW.target_id;
    END IF;
    IF conv_id IS NOT NULL THEN
      SELECT count(*) INTO remaining FROM public.denuncias d
       WHERE d.status = 'pending' AND (
         (d.target_type = 'conversa' AND d.target_id = conv_id)
         OR (d.target_type = 'mensagem' AND EXISTS (
              SELECT 1 FROM public.mensagens m2
                JOIN public.conversas c2 ON (c2.participant_1 = m2.sender_id AND c2.participant_2 = m2.receiver_id)
                                          OR (c2.participant_2 = m2.sender_id AND c2.participant_1 = m2.receiver_id)
               WHERE m2.id = d.target_id AND c2.id = conv_id))
       );
      IF remaining = 0 THEN
        UPDATE public.conversas SET has_active_report = false WHERE id = conv_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_unflag_conversa_on_resolve ON public.denuncias;
CREATE TRIGGER trg_unflag_conversa_on_resolve
AFTER UPDATE ON public.denuncias
FOR EACH ROW EXECUTE FUNCTION public.unflag_conversa_on_resolve();

CREATE INDEX IF NOT EXISTS idx_forum_posts_user_created
  ON public.forum_posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_sender_created
  ON public.mensagens (sender_id, created_at DESC);
