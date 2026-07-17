/**
 * Artifact object storage abstraction.
 * Local filesystem is the operational provider; S3/GCS/R2 adapters plug in later
 * without changing ProductArtifact consumers.
 */
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  type ReadStream,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type ArtifactObjectRef = {
  storageKey: string;
  absolutePath: string;
};

export type ArtifactAccessPolicy = {
  /** Content is only served via authenticated TradeOps proxy. */
  mode: 'authenticated_proxy';
  /** Never mount private buckets as public static roots. */
  publicBucket: false;
};

export type ArtifactLifecyclePolicy = {
  retainOriginals: boolean;
  maxSyncIngestBytes: number;
};

export interface ArtifactStorageProvider {
  readonly providerId: string;
  readonly accessPolicy: ArtifactAccessPolicy;
  resolveKey(parts: {
    organizationId: string;
    productId: string;
    artifactId: string;
    name: string;
  }): string;
  writeObject(storageKey: string, body: Buffer): ArtifactObjectRef;
  readObject(storageKey: string): Buffer;
  openReadStream(storageKey: string): ReadStream;
  exists(storageKey: string): boolean;
  absolutePath(storageKey: string): string;
}

export function createLocalArtifactStorage(
  root?: string,
): ArtifactStorageProvider {
  const base =
    root?.trim() ||
    process.env.ARTIFACT_STORAGE_ROOT?.trim() ||
    join(process.cwd(), '.tradeops-storage');

  return {
    providerId: 'local-filesystem',
    accessPolicy: {
      mode: 'authenticated_proxy',
      publicBucket: false,
    },
    resolveKey({ organizationId, productId, artifactId, name }) {
      return `organizations/${organizationId}/products/${productId}/artifacts/${artifactId}/${name}`;
    },
    writeObject(storageKey, body) {
      const absolutePath = join(base, storageKey);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, body);
      return { storageKey, absolutePath };
    },
    readObject(storageKey) {
      const absolutePath = join(base, storageKey);
      if (!existsSync(absolutePath)) {
        throw new Error(`Artifact object missing: ${storageKey}`);
      }
      return readFileSync(absolutePath);
    },
    openReadStream(storageKey) {
      const absolutePath = join(base, storageKey);
      if (!existsSync(absolutePath)) {
        throw new Error(`Artifact object missing: ${storageKey}`);
      }
      return createReadStream(absolutePath);
    },
    exists(storageKey) {
      return existsSync(join(base, storageKey));
    },
    absolutePath(storageKey) {
      return join(base, storageKey);
    },
  };
}

export const DEFAULT_ARTIFACT_LIFECYCLE: ArtifactLifecyclePolicy = {
  retainOriginals: true,
  maxSyncIngestBytes: 8 * 1024 * 1024,
};
