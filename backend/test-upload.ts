import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { supabase } from './src/lib/supabase';

const app = express();
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

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/gallery/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file!;
    const key = `uploads/test.png`;
    console.log('uploading to r2...');
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    console.log('uploaded to r2. returning');
    res.json({ ok: true });
  } catch (error: any) {
    console.error('ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

const server = app.listen(3001, () => {
  console.log('test server running');
});
