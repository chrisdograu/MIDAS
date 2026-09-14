-- ============================================
-- RPC FUNCTIONS FOR DESKTOP ADMIN
-- ============================================

-- ============================================
-- DEVELOPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION admin_create_developer(
  _name TEXT,
  _slug TEXT,
  _description TEXT,
  _bio TEXT,
  _website TEXT,
  _founded_year INTEGER,
  _country TEXT,
  _headquarters TEXT,
  _employees INTEGER,
  _parent_company TEXT,
  _logo_url TEXT DEFAULT NULL,
  _banner_url TEXT DEFAULT NULL,
  _notable_games TEXT[] DEFAULT NULL,
  _social_links JSONB DEFAULT '{}'::JSONB,
  _wikipedia_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO developers (
    name, slug, description, bio, website, founded_year,
    country, headquarters, employees, parent_company,
    logo_url, banner_url, notable_games, social_links,
    wikipedia_url, created_by, created_at, updated_at
  ) VALUES (
    _name, _slug, _description, _bio, _website, _founded_year,
    _country, _headquarters, _employees, _parent_company,
    _logo_url, _banner_url, _notable_games, _social_links,
    _wikipedia_url, auth.uid(), NOW(), NOW()
  )
  RETURNING id INTO _id;
  
  RETURN _id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_update_developer(
  _id UUID,
  _name TEXT,
  _slug TEXT,
  _description TEXT,
  _bio TEXT,
  _website TEXT,
  _founded_year INTEGER,
  _country TEXT,
  _headquarters TEXT,
  _employees INTEGER,
  _parent_company TEXT,
  _logo_url TEXT DEFAULT NULL,
  _banner_url TEXT DEFAULT NULL,
  _notable_games TEXT[] DEFAULT NULL,
  _social_links JSONB DEFAULT '{}'::JSONB,
  _wikipedia_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE developers SET
    name = _name,
    slug = _slug,
    description = _description,
    bio = _bio,
    website = _website,
    founded_year = _founded_year,
    country = _country,
    headquarters = _headquarters,
    employees = _employees,
    parent_company = _parent_company,
    logo_url = _logo_url,
    banner_url = _banner_url,
    notable_games = _notable_games,
    social_links = _social_links,
    wikipedia_url = _wikipedia_url,
    updated_at = NOW()
  WHERE id = _id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_delete_developer(_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE produtos SET developer_id = NULL WHERE developer_id = _id;
  DELETE FROM developers WHERE id = _id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PUBLISHER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION admin_create_publisher(
  _name TEXT,
  _slug TEXT,
  _description TEXT,
  _bio TEXT,
  _website TEXT,
  _founded_year INTEGER,
  _country TEXT,
  _headquarters TEXT,
  _employees INTEGER,
  _parent_company TEXT,
  _logo_url TEXT DEFAULT NULL,
  _banner_url TEXT DEFAULT NULL,
  _notable_games TEXT[] DEFAULT NULL,
  _social_links JSONB DEFAULT '{}'::JSONB,
  _wikipedia_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO publishers (
    name, slug, description, bio, website, founded_year,
    country, headquarters, employees, parent_company,
    logo_url, banner_url, notable_games, social_links,
    wikipedia_url, created_by, created_at, updated_at
  ) VALUES (
    _name, _slug, _description, _bio, _website, _founded_year,
    _country, _headquarters, _employees, _parent_company,
    _logo_url, _banner_url, _notable_games, _social_links,
    _wikipedia_url, auth.uid(), NOW(), NOW()
  )
  RETURNING id INTO _id;
  
  RETURN _id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CURATED LIST FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION admin_create_curated_list(
  _title TEXT,
  _slug TEXT,
  _description TEXT,
  _long_description TEXT DEFAULT NULL,
  _category TEXT DEFAULT 'recomendados',
  _is_official BOOLEAN DEFAULT false,
  _is_featured BOOLEAN DEFAULT false,
  _cover_image TEXT DEFAULT NULL,
  _banner_image TEXT DEFAULT NULL,
  _items TEXT[] DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  _list_id UUID;
  _product_id TEXT;
BEGIN
  INSERT INTO curated_lists (
    title, slug, description, long_description,
    category, is_official, is_featured, is_public,
    cover_image, banner_image,
    created_by, created_at, updated_at
  ) VALUES (
    _title, _slug, _description, _long_description,
    _category, _is_official, _is_featured, true,
    _cover_image, _banner_image,
    auth.uid(), NOW(), NOW()
  )
  RETURNING id INTO _list_id;
  
  IF _items IS NOT NULL THEN
    FOR i IN 1..array_length(_items, 1) LOOP
      _product_id := _items[i];
      INSERT INTO curated_list_items (list_id, product_id, position)
      VALUES (_list_id, _product_id::UUID, i);
    END LOOP;
  END IF;
  
  RETURN _list_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_update_curated_list(
  _id UUID,
  _title TEXT,
  _slug TEXT,
  _description TEXT,
  _long_description TEXT DEFAULT NULL,
  _category TEXT DEFAULT 'recomendados',
  _is_official BOOLEAN DEFAULT false,
  _is_featured BOOLEAN DEFAULT false,
  _is_public BOOLEAN DEFAULT true,
  _cover_image TEXT DEFAULT NULL,
  _banner_image TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE curated_lists SET
    title = _title,
    slug = _slug,
    description = _description,
    long_description = _long_description,
    category = _category,
    is_official = _is_official,
    is_featured = _is_featured,
    is_public = _is_public,
    cover_image = _cover_image,
    banner_image = _banner_image,
    updated_at = NOW()
  WHERE id = _id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_approve_curated_list(_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE curated_lists SET
    approved_by = auth.uid(),
    approved_at = NOW()
  WHERE id = _id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEW FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_developer_with_games(_developer_id UUID)
RETURNS JSONB AS $$
DECLARE
  _result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'developer', to_jsonb(d.*),
    'games', (
      SELECT jsonb_agg(to_jsonb(p.*))
      FROM produtos p
      WHERE p.developer_id = d.id AND p.is_active = true
    ),
    'total_games', (
      SELECT COUNT(*)
      FROM produtos p
      WHERE p.developer_id = d.id AND p.is_active = true
    ),
    'average_rating', (
      SELECT AVG(p.rating)
      FROM produtos p
      WHERE p.developer_id = d.id AND p.is_active = true
    )
  )
  INTO _result
  FROM developers d
  WHERE d.id = _developer_id;
  
  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_developer_stats(_developer_id UUID)
RETURNS JSONB AS $$
DECLARE
  _result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_games', COUNT(p.id),
    'average_rating', COALESCE(AVG(p.rating), 0),
    'most_played_platform', (
      SELECT p.platform
      FROM produtos p
      WHERE p.developer_id = _developer_id
      GROUP BY p.platform
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    'total_views', (
      SELECT COUNT(*) 
      FROM product_views pv
      JOIN produtos p ON pv.product_id = p.id
      WHERE p.developer_id = _developer_id
    )
  )
  INTO _result
  FROM produtos p
  WHERE p.developer_id = _developer_id AND p.is_active = true;
  
  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;