import { createWriteStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Transform } from "node:stream";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { ApiException } from "../http/api-exception";

export interface UploadState {
  length: number;
  offset: number;
  createdAt: Date;
  complete: boolean;
}

export interface UploadStore {
  create(key: string, length: number, createdAt: Date): Promise<void>;
  state(key: string): Promise<UploadState | null>;
  append(key: string, source: Readable, room: number): Promise<number>;
  head(key: string, size: number): Promise<Buffer>;
  complete(key: string): Promise<void>;
  discard(key: string): Promise<void>;
}

export const UPLOAD_STORE = Symbol("UPLOAD_STORE");

const safeKey = /^[A-Za-z0-9_-]{32}$/;

const infoSchema = z.object({ length: z.number().int().positive(), createdAt: z.iso.datetime() });

const isMissing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

class RoomLimit extends Transform {
  private received = 0;

  constructor(private readonly room: number) {
    super();
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void,
  ): void {
    if (this.received + chunk.length > this.room) {
      callback(new ApiException(413, "UPLOAD_TOO_LARGE"));
      return;
    }
    this.received += chunk.length;
    callback(null, chunk);
  }
}

export class FileUploadStore implements UploadStore {
  constructor(private readonly root: string) {}

  async create(key: string, length: number, createdAt: Date): Promise<void> {
    const paths = this.paths(key);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const info = JSON.stringify({ length, createdAt: createdAt.toISOString() });
    await writeFile(paths.info, info, { flag: "wx", mode: 0o600 });
    await writeFile(paths.part, "", { flag: "wx", mode: 0o600 });
  }

  async state(key: string): Promise<UploadState | null> {
    const paths = this.paths(key);
    let info: z.infer<typeof infoSchema>;
    try {
      info = infoSchema.parse(JSON.parse(await readFile(paths.info, "utf8")));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    const createdAt = new Date(info.createdAt);
    try {
      await stat(paths.original);
      return { length: info.length, offset: info.length, createdAt, complete: true };
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    try {
      const { size } = await stat(paths.part);
      return { length: info.length, offset: size, createdAt, complete: false };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async append(key: string, source: Readable, room: number): Promise<number> {
    const { part } = this.paths(key);
    try {
      await pipeline(source, new RoomLimit(room), createWriteStream(part, { flags: "a" }));
    } catch (error) {
      if (error instanceof ApiException) throw error;
    }
    return (await stat(part)).size;
  }

  async head(key: string, size: number): Promise<Buffer> {
    const { part } = this.paths(key);
    const handle = await open(part, "r");
    try {
      const buffer = Buffer.alloc(size);
      const { bytesRead } = await handle.read(buffer, 0, size, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async complete(key: string): Promise<void> {
    const paths = this.paths(key);
    await rename(paths.part, paths.original);
  }

  async discard(key: string): Promise<void> {
    const paths = this.paths(key);
    await Promise.all([
      rm(paths.part, { force: true }),
      rm(paths.original, { force: true }),
      rm(paths.info, { force: true }),
    ]);
  }

  private paths(key: string): { part: string; original: string; info: string } {
    if (!safeKey.test(key)) throw new Error("Invalid upload key");
    return {
      part: join(this.root, `${key}.part`),
      original: join(this.root, `${key}.orig`),
      info: join(this.root, `${key}.info`),
    };
  }
}
