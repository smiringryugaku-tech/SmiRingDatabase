import RichTextEditor from '../../../../components/ui/RichTextEditor';

type Props = {
  title: string;
  description: string;
  onTitleChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
};

export default function TitleBox({ title, description, onTitleChange, onDescriptionChange }: Props) {
  return (
    <div className="w-full bg-white rounded-xl shadow-sm border-t-8 border-t-blue-700 p-6 mb-4">
      <input 
        type="text" 
        placeholder="無題のフォーム" 
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="w-full text-3xl font-bold border-b border-transparent focus:border-gray-200 focus:outline-none pb-2 mb-4"
      />
      <RichTextEditor 
        placeholder="フォームの説明" 
        value={description}
        onChange={(html) => onDescriptionChange(html)}
      />
    </div>
  );
}
