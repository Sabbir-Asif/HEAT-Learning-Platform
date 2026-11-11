import { hlsCookie, hlsCookiePath } from "@heat/contracts";
import type { PlaybackSessionResponse } from "@heat/contracts";
import type { CookieResponse } from "../auth";

export interface HlsSession {
  value: string;
  expiresAt: string;
  maxAgeMilliseconds: number;
}

export interface PlaybackGrant {
  assetKey: string;
  session: HlsSession;
  body: PlaybackSessionResponse;
}

export const applyPlaybackGrant = (
  response: CookieResponse,
  grant: PlaybackGrant,
): PlaybackSessionResponse => {
  response.cookie(hlsCookie.name, grant.session.value, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: hlsCookiePath(grant.assetKey),
    maxAge: grant.session.maxAgeMilliseconds,
  });
  return grant.body;
};
