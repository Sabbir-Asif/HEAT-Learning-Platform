"use client";

import { Button, FieldError, Input } from "@heat/ui";
import { SearchCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { normaliseCertificateNumber } from "./certificate-number";

export function VerifyLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const number = normaliseCertificateNumber(value);
        if (number === null) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        router.push(`/verify/${encodeURIComponent(number)}`);
      }}
    >
      <label htmlFor="certificate-number" className="text-sm font-semibold">
        Certificate number
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="certificate-number"
          value={value}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="0A80-GT3K-11W3"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? "certificate-number-error" : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          className="h-11 font-mono text-base tracking-wider uppercase"
        />
        <Button type="submit" size="lg" className="h-11 sm:px-6">
          <SearchCheckIcon aria-hidden="true" data-icon="inline-start" />
          Verify
        </Button>
      </div>
      {invalid ? (
        <FieldError id="certificate-number-error">
          Enter the 12-character number printed on the certificate, like 0A80-GT3K-11W3.
        </FieldError>
      ) : null}
    </form>
  );
}
