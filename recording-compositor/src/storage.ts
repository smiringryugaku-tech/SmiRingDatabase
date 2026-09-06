import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // AWS SDK v3がデフォルトで付与するCRC32チェックサムをR2は拒否するため無効化
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

// One bucket for everything: temp per-track files under `connect/recordings-tmp/`,
// finished videos under `connect/recordings/` — nested under `connect/` alongside the
// app's existing `connect/backgrounds/` prefix. A separate bucket would buy no isolation
// here — egress
// and this job both use the same R2 credentials either way — so this matches how the
// rest of the app already uses a single R2 bucket.
export const BUCKET = process.env.R2_BUCKET_NAME!;

export async function listKeys(bucket: string, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    for (const object of response.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

export async function downloadTo(bucket: string, key: string, destination: string): Promise<void> {
  const response = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(response.Body as Readable, createWriteStream(destination));
}

export async function uploadFile(bucket: string, key: string, path: string, contentType: string): Promise<void> {
  await r2.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: await readFile(path), ContentType: contentType }),
  );
}

export async function deleteKeys(bucket: string, keys: string[]): Promise<void> {
  // DeleteObjects caps at 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
  }
}
