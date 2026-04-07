import React from 'react';

// --- プロフィール行の共通コンポーネント (Flutterの ProfileInfoRow 相当) ---
type ProfileInfoRowProps = {
  title: string;
  value: string;
  onEdit: () => void;
  children?: React.ReactNode;
};

function ProfileInfoRow({ title, value, onEdit, children }: ProfileInfoRowProps) {
  return (
    <div className="mb-1">
      <div 
        onClick={onEdit}
        className="flex justify-between items-center py-3 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100"
      >
        <span className="text-gray-600 font-medium">{title}</span>
        <span className="text-gray-900 font-medium">{value || '-'}</span>
      </div>
      {/* 子要素（入れ子の行）がある場合は少しインデントして線をつける */}
      {children && (
        <div className="pl-6 ml-2 border-l-2 border-gray-100 mt-1 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

// --- メイン画面 ---
export default function BasicInfoPage() {
  // TODO: 後で Supabase から取得するダミーデータ
  const data: Record<string, string> = {
    name_english: 'Shogo Toiyama',
    name_kanji: '問山 翔悟',
    birthday: '2004-08',
    hometown: 'Japan',
    study_abroad_country: 'United Kingdom',
    current_school: 'Lancaster University',
    majors: 'Computer Science',
    smiring_department: 'Tech Lead',
  };

  const handleEdit = (key: string, title: string) => {
    alert(`TODO: "${title}" の編集モーダルを開き、Supabaseの ${key} を更新する`);
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <h3 className="text-xl font-bold text-slate-700 mt-10 mb-4 pb-2 border-b-2 border-slate-100">
      {title}
    </h3>
  );

  return (
    <div className="p-10 max-w-4xl">
      
      {/* --- セクション1: Name --- */}
      <SectionTitle title="Name" />
      <ProfileInfoRow
        title="Name (English)"
        value={data['name_english']}
        onEdit={() => handleEdit('name_english', 'Name (English)')}
      >
        <ProfileInfoRow
          title="Name (Kanji)"
          value={data['name_kanji']}
          onEdit={() => handleEdit('name_kanji', 'Name (Kanji)')}
        />
      </ProfileInfoRow>

      {/* --- セクション2: Background & Education --- */}
      <SectionTitle title="Background & Education" />
      <ProfileInfoRow title="Birthday" value={data['birthday']} onEdit={() => handleEdit('birthday', 'Birthday')} />
      <ProfileInfoRow title="Hometown" value={data['hometown']} onEdit={() => handleEdit('hometown', 'Hometown')} />
      
      <ProfileInfoRow
        title="Study Abroad Country"
        value={data['study_abroad_country']}
        onEdit={() => handleEdit('study_abroad_country', 'Study Abroad Country')}
      >
        <ProfileInfoRow title="City" value={data['study_aborad_city']} onEdit={() => handleEdit('study_aborad_city', 'City')} />
        <ProfileInfoRow title="Type" value={data['study_abroad_type']} onEdit={() => handleEdit('study_abroad_type', 'Type')} />
        <ProfileInfoRow title="History" value={data['study_abroad_history']} onEdit={() => handleEdit('study_abroad_history', 'History')} />
        <ProfileInfoRow title="English School" value={data['english_school']} onEdit={() => handleEdit('english_school', 'English School')} />
      </ProfileInfoRow>

      <ProfileInfoRow
        title="Current School"
        value={data['current_school']}
        onEdit={() => handleEdit('current_school', 'Current School')}
      >
        <ProfileInfoRow title="School History" value={data['school_history']} onEdit={() => handleEdit('school_history', 'School History')} />
      </ProfileInfoRow>

      <ProfileInfoRow title="Grade Level" value={data['grade_level']} onEdit={() => handleEdit('grade_level', 'Grade Level')} />
      
      <ProfileInfoRow
        title="Majors"
        value={data['majors']}
        onEdit={() => handleEdit('majors', 'Majors')}
      >
        <ProfileInfoRow title="Minors" value={data['minors']} onEdit={() => handleEdit('minors', 'Minors')} />
        <ProfileInfoRow title="Major History" value={data['major_history']} onEdit={() => handleEdit('major_history', 'Major History')} />
      </ProfileInfoRow>

      {/* --- セクション3: Personal Identity --- */}
      <SectionTitle title="Personal Identity" />
      <ProfileInfoRow title="Personality" value={data['personality']} onEdit={() => handleEdit('personality', 'Personality')} />
      <ProfileInfoRow title="Important Values" value={data['important_values']} onEdit={() => handleEdit('important_values', 'Important Values')} />
      <ProfileInfoRow title="Future Image" value={data['future_image']} onEdit={() => handleEdit('future_image', 'Future Image')} />

      {/* --- セクション4: SmiRing Info --- */}
      <SectionTitle title="SmiRing Info" />
      <ProfileInfoRow title="Department" value={data['smiring_department']} onEdit={() => handleEdit('smiring_department', 'Department')} />
      <ProfileInfoRow title="Join Date" value={data['smiring_join_date']} onEdit={() => handleEdit('smiring_join_date', 'Join Date')} />
      
      {/* 最後の余白 */}
      <div className="h-20"></div>
    </div>
  );
}