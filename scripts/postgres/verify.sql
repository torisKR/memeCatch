SELECT 'memes' AS table_name, count(*) FROM memes
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'auth.users', count(*) FROM auth.users
ORDER BY 1;

SELECT md5(string_agg(id::text, ',' ORDER BY id)) AS meme_id_checksum
  FROM (SELECT id FROM memes ORDER BY id LIMIT 100) sample;
