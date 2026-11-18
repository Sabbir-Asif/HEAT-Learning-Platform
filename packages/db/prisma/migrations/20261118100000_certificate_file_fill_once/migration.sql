CREATE OR REPLACE FUNCTION "certificate_freeze_issued"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."number" IS DISTINCT FROM OLD."number"
    OR NEW."recipientName" IS DISTINCT FROM OLD."recipientName"
    OR (NEW."fileKey" IS DISTINCT FROM OLD."fileKey" AND OLD."fileKey" IS NOT NULL)
    OR (NEW."fileSha256" IS DISTINCT FROM OLD."fileSha256" AND OLD."fileSha256" IS NOT NULL)
  THEN
    RAISE EXCEPTION 'an issued certificate cannot be changed except to revoke it';
  END IF;
  RETURN NEW;
END
$$;
