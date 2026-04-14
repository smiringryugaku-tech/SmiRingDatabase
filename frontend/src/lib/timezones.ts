export type LocationInfo = {
  locationName: string;
  cityId: string;
  emoji: string;
  names: string[];
  timeZone: string[];
};

export const WorldLocations: LocationInfo[] = [
  { locationName: 'Hawaii (USA)', cityId: 'Pacific/Honolulu', emoji: '🇺🇸', names: ['Haw(US)', 'Hawaii', 'ハワイ', 'HW'], timeZone: ['HST', 'HST'] },
  { locationName: 'California (USA)', cityId: 'America/Los_Angeles', emoji: '🇺🇸', names: ['Cal(US)', 'California', 'カリフォルニア', 'CA'], timeZone: ['PST', 'PDT'] },
  { locationName: 'Chicago (USA)', cityId: 'America/Chicago', emoji: '🇺🇸', names: ['Chi(US)', 'Chicago', 'シカゴ', 'CH'], timeZone: ['CST', 'CDT'] },
  { locationName: 'New York (USA)', cityId: 'America/New_York', emoji: '🇺🇸', names: ['NY(US)', 'New York', 'ニューヨーク', 'NY'], timeZone: ['EST', 'EDT'] },
  { locationName: 'Toronto (Canada)', cityId: 'America/Toronto', emoji: '🇨🇦', names: ['Tor(CA)', 'Toronto', 'トロント', 'TR'], timeZone: ['EST', 'EDT'] },
  { locationName: 'London (UK)', cityId: 'Europe/London', emoji: '🇬🇧', names: ['UK', 'London', 'イギリス'], timeZone: ['GMT', 'BST'] },
  { locationName: 'Madrid (Spain)', cityId: 'Europe/Madrid', emoji: '🇪🇸', names: ['ES', 'Spain', 'スペイン'], timeZone: ['CET', 'CEST'] },
  { locationName: 'Paris (France)', cityId: 'Europe/Paris', emoji: '🇫🇷', names: ['FR', 'France', 'フランス'], timeZone: ['CET', 'CEST'] },
  { locationName: 'Bangkok (Thailand)', cityId: 'Asia/Bangkok', emoji: '🇹🇭', names: ['TH', 'Thailand', 'タイ'], timeZone: ['ICT', 'ICT'] },
  { locationName: 'Kuala Lumpur (Malaysia)', cityId: 'Asia/Kuala_Lumpur', emoji: '🇲🇾', names: ['MY', 'Malaysia', 'マレーシア'], timeZone: ['MYT', 'MYT'] },
  { locationName: 'Shanghai (China)', cityId: 'Asia/Shanghai', emoji: '🇨🇳', names: ['Sha(CN)', 'Shanghai', '上海', 'SH'], timeZone: ['CST', 'CST'] },
  { locationName: 'Taipei (Taiwan)', cityId: 'Asia/Taipei', emoji: '🇹🇼', names: ['TW', 'Taiwan', '台湾'], timeZone: ['CST', 'CST'] },
  { locationName: 'Tokyo (Japan)', cityId: 'Asia/Tokyo', emoji: '🇯🇵', names: ['JP', 'Japan', '日本'], timeZone: ['JST', 'JST'] },
  { locationName: 'Sydney (Australia)', cityId: 'Australia/Sydney', emoji: '🇦🇺', names: ['Syd(AU)', 'Sydney', 'シドニー', 'SY'], timeZone: ['AEST', 'AEDT'] },
];