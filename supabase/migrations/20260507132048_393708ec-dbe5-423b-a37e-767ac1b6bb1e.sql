
-- Backfill procedure_id e package_id a partir das tags em notes
UPDATE appointments
SET procedure_id = (regexp_match(notes, '\[procedimento:([0-9a-fA-F-]{36})\]'))[1]::uuid
WHERE procedure_id IS NULL
  AND notes ~ '\[procedimento:[0-9a-fA-F-]{36}\]';

UPDATE appointments
SET package_id = (regexp_match(notes, '\[pacote:([0-9a-fA-F-]{36})\]'))[1]::uuid
WHERE package_id IS NULL
  AND notes ~ '\[pacote:[0-9a-fA-F-]{36}\]';
