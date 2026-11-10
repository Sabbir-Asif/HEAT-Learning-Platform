import { adminCsrf, csrfHeaderName, studentCsrf } from "@heat/contracts";
import { readCookie } from "../../src/auth";

export const csrfHeaders = (cookie: string | undefined): Record<string, string> => {
  const token = readCookie(cookie, studentCsrf.cookie) ?? readCookie(cookie, adminCsrf.cookie);
  return token === undefined ? {} : { [csrfHeaderName]: token };
};
