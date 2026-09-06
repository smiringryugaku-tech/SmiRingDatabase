import { join } from 'node:path';
import { BUCKET, downloadTo } from './storage';
import { supabase } from './supabase';

/**
 * Downloads each identity's profile avatar (same photo the live call UI shows for a
 * camera-off tile — see `frontend/.../ParticipantTileContent.tsx`), so the compositor can
 * use it as a stand-in tile for someone who never had a camera track for a given stretch.
 *
 * An identity with no `avatar_id`, or whose avatar row/file has since been removed, is
 * simply left out of the returned map — the caller treats that exactly like "no avatar",
 * which keeps that person out of icon-tile contention rather than rendering a blank tile.
 */
export async function fetchAvatarPaths(identities: string[], workDir: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (identities.length === 0) return result;

  const { data: profiles, error: profileError } = await supabase
    .from('basic_profile_info')
    .select('id, avatar_id')
    .in('id', identities);
  if (profileError) {
    console.warn('[Compositor] Failed to look up avatars:', profileError);
    return result;
  }

  const avatarIds = (profiles ?? []).map((p) => p.avatar_id).filter((id): id is string => !!id);
  if (avatarIds.length === 0) return result;

  const { data: galleryItems, error: galleryError } = await supabase
    .from('gallery')
    .select('id, storage_path, thumbnail_path')
    .in('id', avatarIds);
  if (galleryError) {
    console.warn('[Compositor] Failed to look up avatar files:', galleryError);
    return result;
  }
  const keyByAvatarId = new Map((galleryItems ?? []).map((g) => [g.id, g.thumbnail_path || g.storage_path]));

  await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const key = profile.avatar_id ? keyByAvatarId.get(profile.avatar_id) : null;
      if (!key) return;
      const extension = key.includes('.') ? key.split('.').pop() : 'jpg';
      const path = join(workDir, `avatar_${profile.id}.${extension}`);
      try {
        await downloadTo(BUCKET, key, path);
        result.set(profile.id, path);
      } catch (e) {
        console.warn(`[Compositor] Failed to download avatar for ${profile.id}:`, e);
      }
    }),
  );

  return result;
}
