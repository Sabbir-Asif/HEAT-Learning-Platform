DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "University" GROUP BY lower("name") HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Two universities have names that differ only by letter case. Rename one of them, then deploy this migration again.';
  END IF;
  IF EXISTS (SELECT 1 FROM "Faculty" GROUP BY lower("name") HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Two faculties have names that differ only by letter case. Rename one of them, then deploy this migration again.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Department"
    GROUP BY "universityId", "facultyId", lower("name")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Two departments under one university and faculty have names that differ only by letter case. Rename one of them, then deploy this migration again.';
  END IF;
END $$;

CREATE UNIQUE INDEX "University_name_lower_key" ON "University" (lower("name"));

CREATE UNIQUE INDEX "Faculty_name_lower_key" ON "Faculty" (lower("name"));

CREATE UNIQUE INDEX "Department_pair_name_lower_key" ON "Department" ("universityId", "facultyId", lower("name"));
