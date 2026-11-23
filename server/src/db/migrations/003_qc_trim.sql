-- The Quick Chat bubble only fills part of its 420px canvas, which chat apps show as a
-- black band. Crop it to its content (keeping 8px) unless an admin already set trim.
-- The version bump refreshes thumbnails and cached renders.
UPDATE templates
SET definition = json_set(definition, '$.trim', 8),
    version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'qc' AND json_extract(definition, '$.trim') IS NULL;
