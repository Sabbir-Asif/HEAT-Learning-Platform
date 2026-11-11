import { describe, expect, test } from "vitest";
import { mapSmtpError, parseResponseCode } from "../../../src/core/mail/smtp-error-mapping";

const smtpError = (responseCode: number, response: string, code = "EENVELOPE") =>
  Object.assign(new Error(response), { responseCode, response, code });

describe("mapSmtpError", () => {
  test("maps the Gmail daily limit response to quota-exceeded", () => {
    expect(
      mapSmtpError(smtpError(550, "550-5.4.5 Daily user sending limit exceeded. For more")),
    ).toEqual({ status: "quota-exceeded", responseCode: 550 });
    expect(mapSmtpError(smtpError(550, "550 5.4.5 Daily user sending quota exceeded"))).toEqual({
      status: "quota-exceeded",
      responseCode: 550,
    });
  });

  test("maps other 550 responses to permanent", () => {
    expect(mapSmtpError(smtpError(550, "550 5.1.1 No such user"))).toEqual({
      status: "permanent-failure",
      responseCode: 550,
    });
  });

  test.each([421, 450, 451, 452, 454])("maps %i to transient", (code) => {
    expect(mapSmtpError(smtpError(code, `${code} try again later`))).toEqual({
      status: "transient-failure",
      responseCode: code,
    });
  });

  test.each([500, 501, 535, 552, 553, 554])("maps %i to permanent", (code) => {
    expect(mapSmtpError(smtpError(code, `${code} refused`))).toEqual({
      status: "permanent-failure",
      responseCode: code,
    });
  });

  test.each(["ETIMEDOUT", "ECONNECTION", "ECONNRESET", "ECONNREFUSED", "ESOCKET", "EDNS", "EDNS"])(
    "maps the network failure %s without a response to transient",
    (code) => {
      expect(mapSmtpError(Object.assign(new Error("network"), { code }))).toEqual({
        status: "transient-failure",
        responseCode: null,
      });
    },
  );

  test.each(["EAUTH", "EENVELOPE", "EMESSAGE"])(
    "maps the rejection %s without a response to permanent",
    (code) => {
      expect(mapSmtpError(Object.assign(new Error("rejected"), { code }))).toEqual({
        status: "permanent-failure",
        responseCode: null,
      });
    },
  );

  test("treats an unknown failure as transient so it is retried", () => {
    expect(mapSmtpError(new Error("boom"))).toEqual({
      status: "transient-failure",
      responseCode: null,
    });
    expect(mapSmtpError("boom")).toEqual({ status: "transient-failure", responseCode: null });
  });

  test("never carries the error message into the result", () => {
    const result = mapSmtpError(smtpError(550, "550 5.1.1 person@example.test does not exist"));
    expect(JSON.stringify(result)).not.toContain("person@example.test");
  });
});

describe("parseResponseCode", () => {
  test("reads the leading three digit code", () => {
    expect(parseResponseCode("250 2.0.0 OK 1234 abc")).toBe(250);
    expect(parseResponseCode("250-OK")).toBe(250);
  });

  test("returns null when there is none", () => {
    expect(parseResponseCode("queued")).toBeNull();
    expect(parseResponseCode("")).toBeNull();
  });
});
