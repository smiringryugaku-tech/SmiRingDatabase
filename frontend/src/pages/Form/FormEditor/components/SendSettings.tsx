import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Search, Users, Square, X, Settings, ChevronDown } from 'lucide-react';
import { WorldLocations } from '../../../../lib/timezones';
import { supabase } from '../../../../lib/supabase';

type Member = { id: string; name_english: string; role?: string; avatar_link?: string; };

type Props = {
  onBackToEdit: () => void;
  onSend: (settings: { 
    assignedUsers: string[], 
    dueDate: string, 
    dueTime: string,
    isAnonymous: boolean, 
    timezone: string
  }) => void;
  initialTimezone?: string;
  isPublished?: boolean;
  initialAssignedUsers?: string[];
  initialDueDate?: string;
  initialIsAnonymous?: boolean;
};

export default function SendSettings({ 
  onBackToEdit, onSend, 
  isPublished = false, 
  initialAssignedUsers = [], 
  initialDueDate = '', 
  initialIsAnonymous = false,
  initialTimezone = 'Asia/Tokyo'
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialAssignedUsers);
  const [isAnonymous, setIsAnonymous] = useState(initialIsAnonymous);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimezone, setSelectedTimezone] = useState('Asia/Tokyo');
  const [dueDate, setDueDate] = useState(''); // yyyy-MM-dd
  const [dueTime, setDueTime] = useState('23:59'); // HH:mm
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/basic_profile_info');
        if (response.ok) setMembers(await response.json());
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    const fetchMyTimezone = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch('http://localhost:3000/api/basic_profile_info/me', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.timezone) setSelectedTimezone(data.timezone);
      }
    };
    fetchMyTimezone();
  }, []);

  useEffect(() => {
    if (initialDueDate) {
      // サーバーから届く "2026-04-13T14:59:59Z" 形式をパース
      const dateObj = new Date(initialDueDate);
      
      // 指定されたタイムゾーンでの文字列表記を取得
      const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: selectedTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      
      const parts = formatter.formatToParts(dateObj);
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      const hh = parts.find(p => p.type === 'hour')?.value;
      const mm = parts.find(p => p.type === 'minute')?.value;

      if (y && m && d) setDueDate(`${y}-${m}-${d}`);
      if (hh && mm) {
        setDueTime(`${hh}:${mm}`);
        if (hh !== '23' || mm !== '59') setShowTimePicker(true);
      }
    }
  }, [initialDueDate, selectedTimezone]);

  // 🌟 メンバーを「選択済み」と「未選択」に分離
  const selectedMembers = members.filter(m => selectedUserIds.includes(m.id));
  const unselectedMembers = members.filter(m => !selectedUserIds.includes(m.id));
  const filteredUnselected = unselectedMembers.filter(m => 
    (m.name_english || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const hasChanges = 
    // 選ばれているメンバーが変わったか（順番に関わらず比較するためsortしてJSON化）
    JSON.stringify([...selectedUserIds].sort()) !== JSON.stringify([...initialAssignedUsers].sort()) ||
    // 締切日が変わったか
    dueDate !== initialDueDate ||
    selectedTimezone !== initialTimezone ||
    // 匿名設定が変わったか
    isAnonymous !== initialIsAnonymous;

  const isButtonDisabled = isPublished ? !hasChanges : selectedUserIds.length === 0;

  return (
    <div className="w-full h-full bg-white p-8 border-l border-gray-200 flex flex-col overflow-y-auto">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3 mb-8">
        <span className={`w-2 h-8 rounded-full inline-block ${isPublished ? 'bg-green-500' : 'bg-blue-600'}`} />
        {isPublished ? '公開設定の変更' : '送信設定'}
      </h2>

      <div className="space-y-8 flex-1">
        
        {/* --- 🌟 追加済みのメンバー一覧 (上部) --- */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            回答を依頼するメンバー ({selectedUserIds.length}人)
          </label>
          
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
              {selectedMembers.map(member => (
                <div key={member.id} className="flex items-center gap-2 bg-white border border-blue-200 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm transition-all group">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-700 font-bold overflow-hidden">
                    {member.avatar_link ? <img src={member.avatar_link} className="w-full h-full object-cover" alt="" /> : member.name_english?.charAt(0)}
                  </div>
                  <span className="text-blue-900">{member.name_english}</span>
                  <button onClick={() => toggleUser(member.id)} className="text-blue-300 hover:text-red-500 transition-colors ml-1 focus:outline-none">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- 未選択メンバーの検索とリスト (下部) --- */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="メンバーを検索して追加..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm" 
            />
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white h-48 overflow-y-auto shadow-inner">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
            ) : unselectedMembers.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">すべてのメンバーを追加済みです！🎉</div>
            ) : filteredUnselected.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">見つかりませんでした</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredUnselected.map(member => (
                  <label key={member.id} className="flex items-center gap-4 p-3 cursor-pointer transition-colors hover:bg-gray-50">
                    <button type="button" onClick={() => toggleUser(member.id)} className="flex-shrink-0 focus:outline-none">
                      <Square className="w-5 h-5 text-gray-300" />
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs overflow-hidden">
                        {member.avatar_link ? <img src={member.avatar_link} className="w-full h-full object-cover" alt="" /> : member.name_english?.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{member.name_english}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- 締切日と匿名オプション（既存コードとほぼ同じ） --- */}
        <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
          {/* 左側: タイムゾーン (短い名前を表示) */}
          <div className="relative flex-shrink-0 border-r border-gray-200 bg-gray-50 group">
            <select 
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              className="appearance-none bg-transparent pl-4 pr-10 py-3 text-sm font-bold text-gray-700 outline-none cursor-pointer"
            >
              {WorldLocations.map(loc => (
                <option key={loc.cityId} value={loc.cityId}>
                  {loc.emoji} {loc.names[0]}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* 右側: 日付入力 */}
          <input 
            type="date" 
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 px-4 py-3 text-sm outline-none bg-white" 
          />
        </div>

        {/* 🌟 時刻設定のトグルと入力 */}
        <div className="px-1">
          {!showTimePicker ? (
            <button 
              onClick={() => setShowTimePicker(true)}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
            >
              ＋ 時刻を設定する (デフォルトは 23:59)
            </button>
          ) : (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
              <input 
                type="time" 
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="p-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-500"
              />
              <button onClick={() => { setShowTimePicker(false); setDueTime('23:59'); }} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors group">
          <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="w-5 h-5 accent-blue-600" />
          
          <div>
            <span className="block text-sm font-bold text-gray-700 group-hover:text-blue-900 transition-colors">匿名回答を許可する</span>
            <span className="block text-xs text-gray-500 mt-0.5">誰が回答したか分からなくなります</span>
          </div>
        </label>
      </div>

      {/* --- 🌟 ボタンエリアのテキスト変更 --- */}
      <div className="pt-8 mt-4 flex gap-3 border-t border-gray-100">
        <button onClick={onBackToEdit} className="flex-1 bg-white border border-gray-200 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-all flex justify-center items-center gap-2">
          <ArrowLeft className="w-5 h-5" />戻る
        </button>
        <button 
          onClick={() => onSend({ 
            assignedUsers: selectedUserIds, 
            dueDate, 
            dueTime,
            isAnonymous, 
            timezone: selectedTimezone 
          })}
            disabled={isButtonDisabled}
            className={`flex-[2] text-white py-3.5 rounded-xl font-bold shadow-md transition-all transform hover:scale-[1.02] flex justify-center items-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed ${isPublished ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
          {isPublished ? (
            <><Settings className="w-5 h-5" />設定を更新</>
          ) : (
            <><Send className="w-5 h-5" />{selectedUserIds.length > 0 ? `${selectedUserIds.length}人に送信する` : '送信先を選択'}</>
          )}
        </button>
      </div>
    </div>
  );
}