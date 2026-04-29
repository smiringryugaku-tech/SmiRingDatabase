import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export type Member = {
  id: string;
  name_english: string;
  name_kanji: string;
  birthday: string;
  hometown: string;
  study_abroad_country: string;
  study_aborad_city: string;
  study_abroad_type: string;
  study_abroad_history: string;
  english_school: string;
  current_school: string;
  school_history: string;
  grade_level: string;
  majors: string | string[];
  minors: string | string[];
  major_history: string;
  personality: string;
  important_values: string;
  future_image: string;
  smiring_department: string;
  smiring_join_date: string;
  avatar_link: string;
};

export function memberMatchesQuery(m: Member, q: string): boolean {
  if (!q) return false;
  const toStr = (v: string | string[] | undefined | null) =>
    Array.isArray(v) ? v.join(' ') : (v || '');
  const haystack = [
    m.name_english, m.name_kanji, m.birthday, m.hometown,
    m.study_abroad_country, m.study_aborad_city, m.study_abroad_type,
    m.study_abroad_history, m.english_school, m.current_school,
    m.school_history, m.grade_level,
    toStr(m.majors), toStr(m.minors), m.major_history,
    m.personality, m.important_values, m.future_image,
    m.smiring_department, m.smiring_join_date,
  ].join(' ').toLowerCase();
  return haystack.includes(q.toLowerCase());
}

export function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function HomeSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/basic_profile_info')
      .then(res => res.json())
      .then(data => setMembers(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = query.trim().length === 0
    ? []
    : members.filter(m => memberMatchesQuery(m, query.trim())).slice(0, 6);

  const totalItems = suggestions.length + 1;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;

    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') { setIsOpen(false); navigate(`/search?q=${encodeURIComponent(query.trim())}`); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setIsOpen(false);
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        navigate(`/members/${suggestions[activeIndex].id}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  return (
    <div ref={wrapperRef} className="w-full max-w-2xl mx-auto mb-6 relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full pl-11 pr-4 py-3 rounded-full border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm transition-all text-sm"
          placeholder="Search members, photos, forms..."
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {suggestions.map((member, index) => {
            const avatarUrl = member.avatar_link || '/assets/images/profile_photo_empty.png';
            const majorsText = Array.isArray(member.majors) ? member.majors.join(', ') : member.majors;
            const subText = [member.current_school, member.study_abroad_country, majorsText].filter(Boolean).join(' · ');
            const isActive = activeIndex === index;
            return (
              <div
                key={member.id}
                onMouseDown={() => { setIsOpen(false); navigate(`/members/${member.id}`); }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <img src={avatarUrl} alt={member.name_english} className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0 border border-gray-200" />
                <div className="flex-1 overflow-hidden">
                  <p className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                    <HighlightedText text={member.name_english || ''} query={query.trim()} />
                    {member.name_kanji && (
                      <span className="ml-2 font-normal text-gray-500 text-xs">
                        <HighlightedText text={member.name_kanji} query={query.trim()} />
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    <HighlightedText text={subText} query={query.trim()} />
                  </p>
                </div>
              </div>
            );
          })}
          <div
            onMouseDown={() => { setIsOpen(false); navigate(`/search?q=${encodeURIComponent(query.trim())}`); }}
            className={`flex items-center gap-2 px-4 py-3 border-t border-gray-100 cursor-pointer text-sm font-bold transition-colors ${activeIndex === suggestions.length ? 'bg-gray-50 text-blue-700' : 'hover:bg-gray-50 text-blue-600'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            「{query}」ですべて検索
          </div>
        </div>
      )}
    </div>
  );
}
