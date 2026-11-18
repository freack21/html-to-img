-- Bundled templates that were already offered to this database. New bundled
-- templates are added on boot once; ones an admin deleted stay deleted.
CREATE TABLE seeded_templates (
  slug TEXT PRIMARY KEY,
  seeded_at TEXT NOT NULL
);

-- Databases created before this table got the original 13 templates at setup.
INSERT INTO seeded_templates (slug, seeded_at)
SELECT value, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM json_each('["banner","certificate","code","ig-feed","meme","polaroid","profile","qc","quote","spotify","tweet","wa","yt-thumb"]')
WHERE EXISTS (SELECT 1 FROM templates);
