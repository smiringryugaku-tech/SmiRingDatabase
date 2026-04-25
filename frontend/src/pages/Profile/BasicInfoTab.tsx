import React, { useState } from 'react';

type Props = {
  initialData: any;
  isEditable?: boolean;
};

// --- 編集ペンアイコン ---
function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// --- シェブロンアイコン（大きめ・太め） ---
function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 flex-shrink-0 ${
        isOpen ? 'rotate-90 opacity-70' : 'opacity-30'
      }`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// --- 値の表示：カンマ区切りをそのまま表示 ---
function ValueDisplay({ value }: { value: any }) {
  if (value === null || value === undefined || value === '') {
    return (
      <span className="text-[14px] sm:text-[15px] text-gray-300 italic font-normal">—</span>
    );
  }

  let stringValue = '';
  if (Array.isArray(value)) {
    stringValue = value.join(', ');
  } else {
    stringValue = String(value);
  }

  return (
    // 🌟 textのサイズをスマホで少しだけ小さくし、長い単語も折り返せるように break-words を追加
    <div className="w-full break-words">
      <span className="text-[14px] sm:text-[15px] font-medium text-gray-900 leading-snug">
        {stringValue}
      </span>
    </div>
  );
}

// --- 📱 レスポンシブ対応のプロフィール行 ---
type ProfileInfoRowProps = {
  title: string;
  value: string;
  onEdit: () => void;
  children?: React.ReactNode;
  isEditable?: boolean;
};

function ProfileInfoRow({
  title,
  value,
  onEdit,
  children,
  isEditable = false,
}: ProfileInfoRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div>
      <div
        onClick={() => hasChildren && setIsOpen((prev) => !prev)}
        className={`group flex px-3 py-3 md:py-4 border-b border-gray-100 transition-colors ${
          hasChildren ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
        }`}
      >
        {/* 🌟 ここがレスポンシブの肝！
          flex-col (縦並び) を基本とし、md:flex-row (画面幅768px以上で横並び) に切り替えます。
          md:items-center でPC表示のときは上下中央揃えにします。
        */}
        <div className="flex-1 flex flex-col md:flex-row md:items-center min-w-0 gap-1 md:gap-4">
          
          {/* 左側：タイトル */}
          <span className="text-[11px] font-medium tracking-wide text-gray-400 uppercase w-full md:w-48 flex-shrink-0">
            {title}
          </span>
          
          {/* 右側：値 */}
          <div className="flex-1 w-full pl-2 md:pl-0">
            <ValueDisplay value={value} />
          </div>
        </div>

        {/* アイコン類は常に右端 */}
        <div className="flex items-center ml-2 flex-shrink-0 gap-1">
          {isEditable ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              // スマホでもタップしやすいように少し大きめに
              className="flex items-center justify-center w-8 h-8 md:w-8 md:h-8 rounded-md bg-transparent border-none cursor-pointer text-gray-400 opacity-40 transition-all hover:opacity-100 hover:bg-gray-100"
            >
              <EditIcon />
            </button>
          ) : (
            <div className="w-8" />
          )}

          {hasChildren ? <ChevronIcon isOpen={isOpen} /> : <div className="w-5" />}
        </div>
      </div>

      {hasChildren && (
        <div
          className={`overflow-hidden transition-all duration-200 ease-in-out ${
            isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {/* 子要素のインデントもスマホ向けに微調整 */}
          <div className="ml-2 md:ml-5 pl-3 md:pl-4 border-l-2 border-gray-100 my-1 md:my-2">
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, { isEditable } as any);
              }
              return child;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- セクションタイトル ---
function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="text-[12px] font-bold tracking-widest uppercase text-gray-500 mt-8 mb-2 px-3 pb-2 border-b border-gray-100 first:mt-0">
      {title}
    </h3>
  );
}

// --- メインページ ---
export default function BasicInfoPage({ initialData, isEditable = false }: Props) {
  const data = initialData || {};

  const handleEdit = (key: string, title: string) => {
    alert(`TODO: "${title}" の編集モーダルを開き、Supabaseの ${key} を更新する`);
  };

  return (
    // 🌟 左右の余白もレスポンシブに対応 (スマホはpx-4, PCはpx-6)
    <div className="w-full px-4 md:px-6 py-6 pb-20">
      {/* Name */}
      <SectionTitle title="Name" />
      <ProfileInfoRow title="Name (English)" value={data['name_english']} onEdit={() => handleEdit('name_english', 'Name (English)')} isEditable={isEditable}>
        <ProfileInfoRow title="Name (Kanji)" value={data['name_kanji']} onEdit={() => handleEdit('name_kanji', 'Name (Kanji)')} isEditable={isEditable} />
      </ProfileInfoRow>

      {/* Background & Education */}
      <SectionTitle title="Background & Education" />
      <ProfileInfoRow title="Birthday" value={data['birthday']} onEdit={() => handleEdit('birthday', 'Birthday')} isEditable={isEditable} />
      <ProfileInfoRow title="Hometown" value={data['hometown']} onEdit={() => handleEdit('hometown', 'Hometown')} isEditable={isEditable} />
      <ProfileInfoRow title="Study Abroad Country" value={data['study_abroad_country']} onEdit={() => handleEdit('study_abroad_country', 'Study Abroad Country')} isEditable={isEditable}>
        <ProfileInfoRow title="City" value={data['study_aborad_city']} onEdit={() => handleEdit('study_aborad_city', 'City')} isEditable={isEditable} />
        <ProfileInfoRow title="Type" value={data['study_abroad_type']} onEdit={() => handleEdit('study_abroad_type', 'Type')} isEditable={isEditable} />
        <ProfileInfoRow title="History" value={data['study_abroad_history']} onEdit={() => handleEdit('study_abroad_history', 'History')} isEditable={isEditable} />
        <ProfileInfoRow title="English School" value={data['english_school']} onEdit={() => handleEdit('english_school', 'English School')} isEditable={isEditable} />
      </ProfileInfoRow>
      <ProfileInfoRow title="Current School" value={data['current_school']} onEdit={() => handleEdit('current_school', 'Current School')} isEditable={isEditable}>
        <ProfileInfoRow title="School History" value={data['school_history']} onEdit={() => handleEdit('school_history', 'School History')} isEditable={isEditable} />
      </ProfileInfoRow>
      <ProfileInfoRow title="Grade Level" value={data['grade_level']} onEdit={() => handleEdit('grade_level', 'Grade Level')} isEditable={isEditable} />
      <ProfileInfoRow title="Majors" value={data['majors']} onEdit={() => handleEdit('majors', 'Majors')} isEditable={isEditable}>
        <ProfileInfoRow title="Minors" value={data['minors']} onEdit={() => handleEdit('minors', 'Minors')} isEditable={isEditable} />
        <ProfileInfoRow title="Major History" value={data['major_history']} onEdit={() => handleEdit('major_history', 'Major History')} isEditable={isEditable} />
      </ProfileInfoRow>

      {/* Personal Identity */}
      <SectionTitle title="Personal Identity" />
      <ProfileInfoRow title="Personality" value={data['personality']} onEdit={() => handleEdit('personality', 'Personality')} isEditable={isEditable} />
      <ProfileInfoRow title="Important Values" value={data['important_values']} onEdit={() => handleEdit('important_values', 'Important Values')} isEditable={isEditable} />
      <ProfileInfoRow title="Future Image" value={data['future_image']} onEdit={() => handleEdit('future_image', 'Future Image')} isEditable={isEditable} />

      {/* SmiRing Info */}
      <SectionTitle title="SmiRing Info" />
      <ProfileInfoRow title="Department" value={data['smiring_department']} onEdit={() => handleEdit('smiring_department', 'Department')} isEditable={isEditable} />
      <ProfileInfoRow title="Join Date" value={data['smiring_join_date']} onEdit={() => handleEdit('smiring_join_date', 'Join Date')} isEditable={isEditable} />

    </div>
  );
}