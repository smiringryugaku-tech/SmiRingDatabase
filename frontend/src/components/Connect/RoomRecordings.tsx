import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, Loader2, Play } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface Recording {
  id: string;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  durationSeconds: number | null;
  createdAt: string;
  completedAt: string | null;
  url: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}分${seconds % 60}秒` : `${seconds}秒`;
}

const STATUS_LABEL: Record<Recording['status'], string> = {
  recording: '録画中',
  processing: '合成中',
  completed: '',
  failed: '失敗',
};

/**
 * Recordings for one room, fetched only when the section is opened — most cards are never
 * expanded, and the playback URLs are signed per request so they can't be prefetched and
 * cached anyway.
 */
export default function RoomRecordings({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || recordings) return;

    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`/api/connect/rooms/${roomId}/recordings`);
      if (!response.ok) throw new Error('録画の取得に失敗しました');
      const data = await response.json();
      setRecordings(data.recordings ?? []);
    } catch (e: any) {
      setError(e.message ?? '録画の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-slate-100 pt-2">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-indigo-600 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>録画</span>
        {loading && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
      </button>

      {open && !loading && (
        <div className="mt-2 space-y-1.5">
          {error && <p className="text-[10px] text-rose-500 font-medium">{error}</p>}
          {recordings?.length === 0 && !error && (
            <p className="text-[10px] text-gray-400 font-medium">録画はまだありません</p>
          )}
          {recordings?.map((recording) => (
            <div key={recording.id} className="flex items-center gap-2 text-[10px]">
              <span className="text-gray-500 font-medium">
                {new Date(recording.createdAt).toLocaleDateString('ja-JP')}
              </span>
              {recording.status === 'completed' && recording.url ? (
                <>
                  <span className="text-gray-400">{formatDuration(recording.durationSeconds)}</span>
                  <a
                    href={recording.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold"
                  >
                    <Play className="w-3 h-3" />
                    再生
                  </a>
                  <a
                    href={recording.url}
                    download
                    className="flex items-center gap-1 text-gray-400 hover:text-indigo-600 font-bold"
                  >
                    <Download className="w-3 h-3" />
                  </a>
                </>
              ) : (
                <span
                  className={`ml-auto font-bold ${recording.status === 'failed' ? 'text-rose-500' : 'text-gray-400'}`}
                >
                  {STATUS_LABEL[recording.status]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
