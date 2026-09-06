import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Loader2, Play, Video } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface Recording {
  id: string;
  roomId: string;
  roomTitle: string | null;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  durationSeconds: number | null;
  createdAt: string;
  thumbnailUrl: string | null;
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

export default function RecordingsListPage() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get('/api/connect/recordings')
      .then(async (response) => {
        if (!response.ok) throw new Error('録画一覧の取得に失敗しました');
        const data = await response.json();
        setRecordings(data.recordings ?? []);
      })
      .catch((e: any) => setError(e.message ?? '録画一覧の取得に失敗しました'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-10 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-indigo-600 font-bold text-sm tracking-wide uppercase">
              <Film className="w-4 h-4" />
              <span>SmiRing Connect</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">録画一覧</h1>
          </div>

          <button
            onClick={() => navigate('/connect')}
            className="self-start flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Connectに戻る</span>
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm font-semibold text-rose-600">
            {error}
          </div>
        )}

        {!recordings && !error && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}

        {recordings?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Video className="w-10 h-10 mb-3" />
            <p className="text-sm font-semibold">録画はまだありません</p>
          </div>
        )}

        {recordings && recordings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recordings.map((recording) => {
              const isPlayable = recording.status === 'completed';
              return (
                <button
                  key={recording.id}
                  onClick={() => isPlayable && navigate(`/connect/recordings/${recording.id}`)}
                  disabled={!isPlayable}
                  className="text-left bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  <div className="relative aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                    {recording.thumbnailUrl ? (
                      <img
                        src={recording.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="w-8 h-8 text-gray-300" />
                    )}
                    {isPlayable && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <Play className="w-5 h-5 text-indigo-600 ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    )}
                    {!isPlayable && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded-lg text-[10px] font-bold text-white flex items-center gap-1">
                        {recording.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {STATUS_LABEL[recording.status]}
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <h3 className="font-black text-gray-900 text-sm line-clamp-1">
                      {recording.roomTitle || recording.roomId}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 font-semibold">
                      <span>{new Date(recording.createdAt).toLocaleDateString('ja-JP')}</span>
                      {recording.durationSeconds && (
                        <>
                          <span>・</span>
                          <span>{formatDuration(recording.durationSeconds)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
