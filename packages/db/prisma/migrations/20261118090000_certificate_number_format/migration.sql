ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_number_format_check";

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_number_format_check" CHECK ("number" ~ '^[0-9A-F]{16}$' OR "number" ~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$');
