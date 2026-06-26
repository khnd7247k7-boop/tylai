-- Offline USDA-style nutrition store (sample rows). FTS5 for search-as-you-type.
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE foods (
  fdc_id INTEGER PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE VIRTUAL TABLE foods_fts USING fts5(
  fdc_id UNINDEXED,
  description,
  tokenize = 'unicode61 remove_diacritics 1'
);

CREATE TABLE nutrients (
  fdc_id INTEGER NOT NULL,
  nutrient_id INTEGER NOT NULL,
  nutrient_name TEXT NOT NULL,
  amount REAL NOT NULL,
  unit_name TEXT NOT NULL,
  PRIMARY KEY (fdc_id, nutrient_id)
);

CREATE INDEX idx_nutrients_fdc ON nutrients(fdc_id);

CREATE TABLE food_portions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fdc_id INTEGER NOT NULL,
  portion_description TEXT NOT NULL,
  gram_weight REAL NOT NULL,
  amount REAL NOT NULL DEFAULT 1,
  FOREIGN KEY (fdc_id) REFERENCES foods(fdc_id)
);

CREATE INDEX idx_portions_fdc ON food_portions(fdc_id);

INSERT INTO foods (fdc_id, description) VALUES
  (1001, 'Apple, raw'),
  (1002, 'Pineapple, raw'),
  (1003, 'Apple juice, canned or bottled'),
  (1004, 'Pineapple juice, canned');

INSERT INTO foods_fts(fdc_id, description) VALUES
  (1001, 'Apple, raw'),
  (1002, 'Pineapple, raw'),
  (1003, 'Apple juice, canned or bottled'),
  (1004, 'Pineapple juice, canned');

INSERT INTO nutrients (fdc_id, nutrient_id, nutrient_name, amount, unit_name) VALUES
  (1001, 1008, 'Energy', 52, 'kcal'),
  (1001, 1003, 'Protein', 0.26, 'g'),
  (1001, 1004, 'Total lipid (fat)', 0.17, 'g'),
  (1001, 1005, 'Carbohydrate, by difference', 13.8, 'g'),
  (1001, 1079, 'Fiber, total dietary', 2.4, 'g'),
  (1001, 1087, 'Calcium, Ca', 6, 'mg'),
  (1001, 1090, 'Magnesium, Mg', 5, 'mg'),
  (1002, 1008, 'Energy', 50, 'kcal'),
  (1002, 1003, 'Protein', 0.54, 'g'),
  (1002, 1004, 'Total lipid (fat)', 0.12, 'g'),
  (1002, 1005, 'Carbohydrate, by difference', 13.1, 'g'),
  (1003, 1008, 'Energy', 46, 'kcal'),
  (1003, 1003, 'Protein', 0.1, 'g'),
  (1003, 1005, 'Carbohydrate, by difference', 11.3, 'g'),
  (1004, 1008, 'Energy', 53, 'kcal'),
  (1004, 1005, 'Carbohydrate, by difference', 12.9, 'g');

INSERT INTO food_portions (fdc_id, portion_description, gram_weight, amount) VALUES
  (1001, '1 small', 149, 1),
  (1001, '1 medium', 182, 1),
  (1001, '1 large', 223, 1),
  (1001, '1 cup, quartered or chopped', 125, 1),
  (1002, '1 cup, diced', 165, 1),
  (1002, '1 slice', 84, 1),
  (1003, '1 cup', 248, 1),
  (1003, '1 fl oz', 31.1, 1);

ANALYZE foods;
ANALYZE nutrients;
ANALYZE food_portions;
