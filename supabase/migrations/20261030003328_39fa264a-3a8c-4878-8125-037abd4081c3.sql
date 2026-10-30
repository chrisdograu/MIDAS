BEGIN;
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id='09c33459-df66-45c2-95de-78ba0fe44989' AND role='admin') THEN RAISE EXCEPTION 'Organizador real não encontrado'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','09c33459-df66-45c2-95de-78ba0fe44989',true);
SELECT set_config('request.jwt.claims','{"sub":"09c33459-df66-45c2-95de-78ba0fe44989","role":"authenticated"}',true);
INSERT INTO public.tournaments (id,title,description,narrative,custom_rules,type,status,event_state,max_participants,starts_at,ends_at,created_by,product_id,banner_url,default_format,bracket_type,is_community,unlisted,entry_price,prize,prize_distribution,archived_at)
SELECT s.id::uuid,s.title,s.description,'Evento de demonstração para a apresentação MIDIAS. Inscrição gratuita, sem premiação financeira.',s.rules,'semanal',s.status,s.event_state,s.capacity,now()+s.start_offset,now()+s.end_offset,'09c33459-df66-45c2-95de-78ba0fe44989'::uuid,p.id,p.image_url,'single_elimination','single',s.community,s.community,0,NULL,'{"first":0,"second":0,"third":0}'::jsonb,CASE WHEN s.status='closed' THEN now() ELSE NULL END
FROM (VALUES
('7e8bce22-4147-4ea4-9e4c-64a0f1b72d01','Copa MIDIAS FC 25 · Demonstração','EA Sports FC 25: copa amistosa individual com 16 vagas e partidas de eliminação simples. Sem cobrança ou prêmio em dinheiro.','Partidas 1 contra 1. Melhor de uma partida. Em caso de empate, prorrogação e pênaltis. Compareça com 15 minutos de antecedência. Respeito aos adversários é obrigatório.','open','registration',16,interval '8 days',interval '8 days 4 hours','EA Sports FC 25',false),
('7e8bce22-4147-4ea4-9e4c-64a0f1b72d02','Desafio F1 24 · Demonstração privada','Grupo comunitário de F1 24 para combinar corridas e horários pelo chat. Quatro vagas, acesso por convite.','Corridas amistosas. Combine circuito, assistências e duração no grupo antes da largada. Sem prêmios ou resultados oficiais.','open','registration',4,interval '10 days',interval '10 days 3 hours','F1 24',true),
('7e8bce22-4147-4ea4-9e4c-64a0f1b72d03','Estratégia Age of Empires IV · Demonstração privada','Grupo comunitário para partidas amistosas de Age of Empires IV. Oito vagas para combinar confrontos e tirar dúvidas.','Modo 1 contra 1 em mapa combinado. Melhor de uma partida. Não são permitidos exploits. Horários definidos no grupo.','open','registration',8,interval '12 days',interval '12 days 4 hours','Age of Empires IV',true),
('7e8bce22-4147-4ea4-9e4c-64a0f1b72d04','Arquivo FC 25 · Demonstração','Registro arquivado de demonstração de uma copa de futebol. Sem participantes, partidas ou vencedores reais registrados.','Formato ilustrativo: eliminação simples. Este arquivo não registra uma competição realizada.','closed','archived',8,interval '-14 days',interval '-13 days','EA Sports FC 25',false),
('7e8bce22-4147-4ea4-9e4c-64a0f1b72d05','Arquivo F1 24 · Demonstração','Registro arquivado para conferir a página de um evento de corrida. Sem classificação ou vencedores reais.','Formato ilustrativo: corrida amistosa. Este arquivo não registra uma competição realizada.','closed','archived',8,interval '-21 days',interval '-20 days','F1 24',false),
('7e8bce22-4147-4ea4-9e4c-64a0f1b72d06','Arquivo Age of Empires IV · Demonstração','Registro arquivado de um encontro de estratégia. Dados ilustrativos, sem vitórias, recompensas ou atividade atribuída a usuários.','Formato ilustrativo: partidas 1 contra 1. Este arquivo não registra uma competição realizada.','closed','archived',8,interval '-28 days',interval '-27 days','Age of Empires IV',false)
) s(id,title,description,rules,status,event_state,capacity,start_offset,end_offset,game_title,community)
JOIN public.produtos p ON p.title=s.game_title
ORDER BY CASE WHEN s.status='closed' THEN 0 ELSE 1 END
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.tournament_participants(tournament_id,user_id,chat_role)
SELECT id,created_by,'admin'::public.tournament_chat_role FROM public.tournaments WHERE id IN ('7e8bce22-4147-4ea4-9e4c-64a0f1b72d01','7e8bce22-4147-4ea4-9e4c-64a0f1b72d02','7e8bce22-4147-4ea4-9e4c-64a0f1b72d03') ON CONFLICT(tournament_id,user_id) DO NOTHING;
INSERT INTO public.tournament_matches(tournament_id,round,position,status,scheduled_at)
SELECT t.id,r.n,p.n,'pending',t.starts_at + (r.n-1)*interval '1 hour'
FROM public.tournaments t CROSS JOIN LATERAL generate_series(1,log(2,t.max_participants)::integer) r(n) CROSS JOIN LATERAL generate_series(0,(t.max_participants/power(2,r.n))::integer-1) p(n)
WHERE t.id IN ('7e8bce22-4147-4ea4-9e4c-64a0f1b72d01','7e8bce22-4147-4ea4-9e4c-64a0f1b72d02','7e8bce22-4147-4ea4-9e4c-64a0f1b72d03') AND NOT EXISTS(SELECT 1 FROM public.tournament_matches m WHERE m.tournament_id=t.id AND m.round=r.n AND m.position=p.n);
DO $$ BEGIN
IF (SELECT count(*) FROM public.tournaments WHERE id::text LIKE '7e8bce22-4147-4ea4-9e4c-64a0f1b72d0%')<>6 THEN RAISE EXCEPTION 'Não foram criados todos os seis torneios'; END IF;
IF (SELECT count(*) FROM public.tournament_matches WHERE tournament_id IN ('7e8bce22-4147-4ea4-9e4c-64a0f1b72d01','7e8bce22-4147-4ea4-9e4c-64a0f1b72d02','7e8bce22-4147-4ea4-9e4c-64a0f1b72d03'))<>25 THEN RAISE EXCEPTION 'Chaveamento incompleto'; END IF;
END $$;
COMMIT;