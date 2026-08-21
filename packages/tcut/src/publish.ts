import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { readCast } from "./cast";
import { applyOverrides, resolveConfig } from "./config";
import { buildHtml } from "./export/html";

/** Any S3-compatible target: RustFS, MinIO, Cloudflare R2, AWS S3, … */
export interface PublishConfig {
  /** e.g. https://s3.amanv.cloud */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Default "us-east-1" (what MinIO/RustFS expect). */
  region?: string;
  /** Base URL objects are served from. Default `${endpoint}/${bucket}` (path-style). */
  publicUrl?: string;
  /** Key prefix inside the bucket, e.g. "casts/". */
  prefix?: string;
}

export const configDir = (): string => process.env.TCUT_CONFIG_DIR ?? path.join(homedir(), ".config", "tcut");
export const configPath = (): string => path.join(configDir(), "publish.json");

/** Env (TCUT_S3_*) overrides the config file; either source may provide each field. */
export async function loadPublishConfig(): Promise<PublishConfig | null> {
  let fromFile: Partial<PublishConfig> = {};
  const file = Bun.file(configPath());
  if (await file.exists()) {
    try {
      fromFile = (await file.json()) as Partial<PublishConfig>;
    } catch {
      throw new Error(`${configPath()} is not valid JSON`);
    }
  }
  const env = process.env;
  const merged: Partial<PublishConfig> = {
    ...fromFile,
    ...(env.TCUT_S3_ENDPOINT && { endpoint: env.TCUT_S3_ENDPOINT }),
    ...(env.TCUT_S3_BUCKET && { bucket: env.TCUT_S3_BUCKET }),
    ...(env.TCUT_S3_ACCESS_KEY && { accessKeyId: env.TCUT_S3_ACCESS_KEY }),
    ...(env.TCUT_S3_SECRET_KEY && { secretAccessKey: env.TCUT_S3_SECRET_KEY }),
    ...(env.TCUT_S3_REGION && { region: env.TCUT_S3_REGION }),
    ...(env.TCUT_PUBLIC_URL && { publicUrl: env.TCUT_PUBLIC_URL }),
    ...(env.TCUT_S3_PREFIX !== undefined && { prefix: env.TCUT_S3_PREFIX }),
  };
  if (!merged.endpoint || !merged.bucket || !merged.accessKeyId || !merged.secretAccessKey) return null;
  return merged as PublishConfig;
}

export async function savePublishConfig(cfg: PublishConfig): Promise<string> {
  await mkdir(configDir(), { recursive: true });
  await Bun.write(configPath(), JSON.stringify(cfg, null, 2) + "\n");
  await chmod(configPath(), 0o600);
  return configPath();
}

export function publicUrlFor(cfg: PublishConfig, key: string): string {
  const base = (cfg.publicUrl ?? `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}`).replace(/\/$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

const MIME = new Map<string, string>([
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".html", "text/html; charset=utf-8"],
  [".cast", "application/x-asciicast"],
  [".txt", "text/plain; charset=utf-8"],
]);

export async function contentHash(file: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(await Bun.file(file).arrayBuffer());
  return hasher.digest("hex");
}

/** Keys are content-addressed: publishing the same bytes twice yields the same URL. */
export async function keyFor(cfg: PublishConfig, file: string, name?: string): Promise<string> {
  const hash = (await contentHash(file)).slice(0, 12);
  return `${cfg.prefix ?? ""}${hash}/${name ?? path.basename(file)}`;
}

function client(cfg: PublishConfig): Bun.S3Client {
  return new Bun.S3Client({
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    region: cfg.region ?? "us-east-1",
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  });
}

export interface Published {
  file: string;
  key: string;
  url: string;
}

export interface PublishOptions {
  /** Override the object name (defaults to the file's basename). */
  name?: string;
  log?: (message: string) => void;
}

async function upload(cfg: PublishConfig, file: string, key: string): Promise<void> {
  const s3 = client(cfg);
  const type = MIME.get(path.extname(file).toLowerCase()) ?? "application/octet-stream";
  try {
    await s3.write(key, Bun.file(file), { type, acl: "public-read" });
  } catch (err) {
    // Some S3 clones reject ACL headers; public access then comes from the bucket policy (see ensurePublicBucket).
    if (!/acl|NotImplemented|InvalidArgument/i.test(String(err))) throw err;
    await s3.write(key, Bun.file(file), { type });
  }
}

/** Upload files and return their public URLs. A `.cast` is also rendered to a playable `.html` next to it. */
export async function publishFiles(files: string[], cfg: PublishConfig, opts: PublishOptions = {}): Promise<Published[]> {
  const results: Published[] = [];
  for (const file of files) {
    if (!(await Bun.file(file).exists())) throw new Error(`File not found: ${file}`);
    const key = await keyFor(cfg, file, opts.name);
    await upload(cfg, file, key);
    results.push({ file, key, url: publicUrlFor(cfg, key) });

    if (file.endsWith(".cast")) {
      const rec = await readCast(file);
      const base = rec.header.bunVideo ?? resolveConfig({ output: "x.html", cols: rec.header.width, rows: rec.header.height });
      const html = await buildHtml(rec, applyOverrides(base, {}));
      const htmlFile = path.join(path.dirname(file), `${path.basename(file, ".cast")}.html`);
      await Bun.write(htmlFile, html);
      const htmlKey = `${key.replace(/\/[^/]+$/, "")}/${path.basename(htmlFile)}`;
      await upload(cfg, htmlFile, htmlKey);
      results.push({ file: htmlFile, key: htmlKey, url: publicUrlFor(cfg, htmlKey) });
    }
  }
  return results;
}

// ---- Bucket bootstrap (create + public-read policy) with a minimal SigV4 signer; Bun.S3Client has no admin calls.

function hmac(key: Uint8Array | string, data: string): Uint8Array {
  return new Uint8Array(new Bun.CryptoHasher("sha256", key).update(data).digest());
}
const sha256Hex = (data: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(data).digest("hex");

export function signV4(cfg: PublishConfig, method: string, url: URL, body: string, now = new Date()) {
  const region = cfg.region ?? "us-east-1";
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const headers = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const sortedHeaders = Object.entries(headers).sort(([a], [b]) => (a < b ? -1 : 1));
  const signedHeaders = sortedHeaders.map(([h]) => h).join(";");
  const canonicalHeaders = sortedHeaders.map(([h, v]) => `${h}:${v.trim()}\n`).join("");
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const canonicalRequest = [method, url.pathname || "/", canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = Buffer.from(hmac(kSigning, stringToSign)).toString("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function s3Request(cfg: PublishConfig, method: string, pathname: string, query = "", body = ""): Promise<Response> {
  const url = new URL(`${cfg.endpoint.replace(/\/$/, "")}${pathname}${query}`);
  const headers = signV4(cfg, method, url, body);
  return fetch(url, { method, headers, body: body || undefined });
}

export interface BootstrapResult {
  bucketCreated: boolean;
  policyApplied: boolean;
  publicReadOk: boolean;
}

/** Make sure the bucket exists and is publicly readable, then prove it with an anonymous GET. */
export async function ensurePublicBucket(cfg: PublishConfig, log: (m: string) => void = () => {}): Promise<BootstrapResult> {
  let bucketCreated = false;
  const head = await s3Request(cfg, "HEAD", `/${cfg.bucket}`);
  if (head.status === 404) {
    const create = await s3Request(cfg, "PUT", `/${cfg.bucket}`);
    if (!create.ok && create.status !== 409) throw new Error(`Creating bucket ${cfg.bucket} failed: ${create.status} ${await create.text()}`);
    bucketCreated = create.ok;
    log(`created bucket ${cfg.bucket}`);
  } else if (head.status === 403) {
    throw new Error(`Access denied to bucket ${cfg.bucket} — check the access key / secret.`);
  }

  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Principal: { AWS: ["*"] }, Action: ["s3:GetObject"], Resource: [`arn:aws:s3:::${cfg.bucket}/*`] }],
  });
  const put = await s3Request(cfg, "PUT", `/${cfg.bucket}`, "?policy", policy);
  const policyApplied = put.ok;
  if (!put.ok) log(`could not set a public-read bucket policy (${put.status}); objects may need a public URL configured differently`);

  const probeKey = `${cfg.prefix ?? ""}.tcut-probe.txt`;
  await client(cfg).write(probeKey, "tcut publish probe", { type: "text/plain" });
  const anon = await fetch(publicUrlFor(cfg, probeKey));
  const publicReadOk = anon.ok && (await anon.text()).includes("tcut publish probe");
  await client(cfg).delete(probeKey).catch(() => undefined);
  return { bucketCreated, policyApplied, publicReadOk };
}
