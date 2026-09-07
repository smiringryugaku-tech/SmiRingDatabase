import { join } from 'node:path';
import { canDecodeImage, createPlaceholderAvatar } from './ffmpeg';
import { BUCKET, downloadTo } from './storage';
import { supabase } from './supabase';

/**
 * Downloads each identity's profile avatar (same photo the live call UI shows for a
 * camera-off tile — see `frontend/.../ParticipantTileContent.tsx`), so the compositor can
 * use it as a stand-in tile for someone who never had a camera track for a given stretch.
 *
 * Everyone real gets an entry: an identity with no `avatar_id`, whose avatar row or file has
 * since been removed, or whose image this ffmpeg can't decode, falls back to a generic
 * silhouette. Only non-user identities are absent from the result.
 */
// `basic_profile_info.id` is a uuid column. `identities` is really "every identity that
// appeared in this recording's tracks or presence rows", which normally means real users —
// but LiveKit's own Egress joins each room as a hidden participant too (identity like
// `EG_xxxxx`, filtered out further upstream by `ParticipantInfo_Kind`, see
// backend/src/routes/connectRoutes.ts). Filtering here as well is cheap insurance: a single
// non-uuid value in an `.in()` filter fails the whole query, which previously meant nobody's
// avatar resolved, not just the bad one's.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchAvatarPaths(identities: string[], workDir: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uuids = identities.filter((id) => UUID_RE.test(id));
  if (uuids.length === 0) return result;

  const { data: profiles, error: profileError } = await supabase
    .from('basic_profile_info')
    .select('id, avatar_id')
    .in('id', uuids);
  if (profileError) {
    console.warn('[Compositor] Failed to look up avatars:', profileError);
    return result;
  }

  const avatarIds = (profiles ?? []).map((p) => p.avatar_id).filter((id): id is string => !!id);

  const { data: galleryItems, error: galleryError } = avatarIds.length
    ? await supabase.from('gallery').select('id, storage_path, thumbnail_path').in('id', avatarIds)
    : { data: [], error: null };
  if (galleryError) {
    console.warn('[Compositor] Failed to look up avatar files:', galleryError);
  }
  // Thumbnail first — it is a fraction of the size and far larger than the tile it fills.
  // The full-size original is the fallback, not because it looks better but because it is a
  // different format (JPEG vs the thumbnail's WebP): if this ffmpeg build can't read one, it
  // can very likely read the other.
  const keysByAvatarId = new Map(
    (galleryItems ?? []).map((g) => [g.id, [g.thumbnail_path, g.storage_path].filter(Boolean) as string[]]),
  );

  await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const keys = profile.avatar_id ? keysByAvatarId.get(profile.avatar_id) ?? [] : [];
      for (const [attempt, key] of keys.entries()) {
        const extension = key.includes('.') ? key.split('.').pop() : 'jpg';
        const path = join(workDir, `avatar_${profile.id}_${attempt}.${extension}`);
        try {
          await downloadTo(BUCKET, key, path);
          // Checked rather than assumed: an avatar that ffmpeg can't open would otherwise
          // reach `renderSegment` and take the whole segment's render down with it.
          if (await canDecodeImage(path)) {
            result.set(profile.id, path);
            return;
          }
          console.warn(`[Compositor] Avatar for ${profile.id} is not decodable, trying next: ${key}`);
        } catch (e) {
          console.warn(`[Compositor] Failed to download avatar for ${profile.id} (${key}):`, e);
        }
      }
    }),
  );

  // Anyone left — no profile row, no avatar set, or an avatar we couldn't read — gets the
  // generic silhouette. Without it they would hold no tile at all, and a lone participant
  // with their camera off would produce an entirely black recording.
  const withoutAvatar = uuids.filter((id) => !result.has(id));
  if (withoutAvatar.length > 0) {
    const placeholderPath = join(workDir, 'avatar_placeholder.png');
    try {
      await createPlaceholderAvatar(placeholderPath);
      for (const id of withoutAvatar) result.set(id, placeholderPath);
      console.log(`[Compositor] Using the generic avatar for ${withoutAvatar.length} participant(s)`);
    } catch (e) {
      console.warn('[Compositor] Failed to draw the generic avatar:', e);
    }
  }

  return result;
}
