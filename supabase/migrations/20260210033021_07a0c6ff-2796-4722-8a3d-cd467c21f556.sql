-- Add mood field to evolutions
ALTER TABLE evolutions ADD COLUMN mood text;
-- Values: 'otima', 'boa', 'neutra', 'ruim', 'muito_ruim'