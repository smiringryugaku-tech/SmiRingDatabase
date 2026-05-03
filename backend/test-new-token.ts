import * as dotenv from 'dotenv';
dotenv.config();
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

async function run() {
  console.log('Testing upload to R2 bucket:', BUCKET_NAME);
  try {
    const testKey = 'uploads/system-test.txt';
    // Upload test
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: 'This is a test upload to verify R2 credentials.',
      ContentType: 'text/plain',
    }));
    console.log('✅ Upload SUCCESS!');

    // Delete test
    await r2.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    }));
    console.log('✅ Delete SUCCESS!');

  } catch (e: any) {
    console.error('❌ ERROR:', e.name, e.message);
  }
}
run();
