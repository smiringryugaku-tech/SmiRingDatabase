import { JobsClient } from '@google-cloud/run';
import { supabase } from './supabase';

// Reuses the project/region the backend is already deployed with (also read by
// lib/ai.ts for Vertex) rather than introducing separate GCP_PROJECT_ID/GCP_REGION vars
// — this service and the Job it triggers live in the same project and region.
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const GCP_REGION = process.env.GOOGLE_CLOUD_LOCATION;
const COMPOSITOR_JOB_NAME = process.env.COMPOSITOR_JOB_NAME;

const jobsClient =
  GCP_PROJECT_ID && GCP_REGION && COMPOSITOR_JOB_NAME ? new JobsClient() : null;

/**
 * Kicks off the Cloud Run Job that muxes a finished call's per-track files into one video.
 *
 * A Job rather than an endpoint on this service: compositing runs for minutes, and Cloud
 * Run stops guaranteeing CPU to a service once its response is sent (the same constraint
 * workerRoutes.ts works around by awaiting inline — viable for seconds, not for ffmpeg).
 * The execution is fire-and-forget; the job reports back by updating the recording row.
 */
export async function triggerCompositor(roomId: string, recordingId: string): Promise<void> {
  if (!jobsClient) {
    console.error(
      '[Recording] Compositor not configured (GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION / COMPOSITOR_JOB_NAME) — ' +
        `recording ${recordingId} will stay in processing`,
    );
    return;
  }

  try {
    await jobsClient.runJob({
      name: `projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/jobs/${COMPOSITOR_JOB_NAME}`,
      overrides: {
        containerOverrides: [
          {
            env: [
              { name: 'ROOM_NAME', value: roomId },
              { name: 'RECORDING_ID', value: recordingId },
            ],
          },
        ],
      },
    });
  } catch (error: any) {
    console.error(`[Recording] Failed to start compositor job for ${recordingId}:`, error?.message);
    // Nothing will retry this, so don't leave the row claiming work is underway.
    await supabase.from('connect_recordings').update({ status: 'failed' }).eq('id', recordingId);
  }
}
