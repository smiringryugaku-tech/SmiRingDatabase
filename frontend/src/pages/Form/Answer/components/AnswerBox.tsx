import React from 'react';
import type { QuestionData } from '../../FormEditor/FormEditorPage';
import RichTextEditor from '../../../../components/ui/RichTextEditor';

type Props = {
  question: QuestionData;
  answer: any;
  onChange: (newAnswer: any) => void;
};

export default function AnswerBox({ question, answer, onChange }: Props) {
  
  // --- 各質問タイプの入力UI ---

  const renderRadio = () => (
    <div className="space-y-3 pt-2">
      {question.options.map((opt) => (
        <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input 
              type="radio" 
              name={`q-${question.id}`} 
              value={opt.id}
              checked={answer === opt.id}
              onChange={() => onChange(opt.id)}
              className="peer sr-only" 
            />
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
          <span className="text-gray-700 group-hover:text-blue-900 transition-colors">{opt.text}</span>
        </label>
      ))}
    </div>
  );

  const renderCheckbox = () => {
    // チェックボックスは複数選択なので、配列で管理します
    const currentAnswers: number[] = Array.isArray(answer) ? answer : [];
    
    const handleToggle = (id: number) => {
      if (currentAnswers.includes(id)) {
        onChange(currentAnswers.filter(a => a !== id));
      } else {
        onChange([...currentAnswers, id]);
      }
    };

    return (
      <div className="space-y-3 pt-2">
        {question.options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={currentAnswers.includes(opt.id)}
                onChange={() => handleToggle(opt.id)}
                className="peer sr-only" 
              />
              <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-colors" />
              <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-gray-700 group-hover:text-blue-900 transition-colors">{opt.text}</span>
          </label>
        ))}
      </div>
    );
  };

  const renderShortText = () => {
    const val = answer || '';
    const validation = question.shortTextValidation;
    let errorMsg = null;

    // バリデーションロジック（入力がある時だけチェックする）
    if (validation?.enabled && val) {
      if (validation.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) errorMsg = '数値を入力してください';
        else if (validation.condition === 'between') {
          const min = Math.min(Number(validation.value1), Number(validation.value2));
          const max = Math.max(Number(validation.value1), Number(validation.value2));
          if (num < min || num > max) {
            errorMsg = validation.errorMsg || `${min}から${max}の間で入力してください`;
          }
        }
        else if (validation.condition === 'greater' && num <= Number(validation.value1)) errorMsg = validation.errorMsg || `${validation.value1}より大きい数値を入力してください`;
        else if (validation.condition === 'less' && num >= Number(validation.value1)) errorMsg = validation.errorMsg || `${validation.value1}より小さい数値を入力してください`;
      } else if (validation.type === 'text') {
        if (validation.condition === 'contains' && !val.includes(validation.value1)) errorMsg = validation.errorMsg || `「${validation.value1}」を含めてください`;
        if (validation.condition === 'not_contains' && val.includes(validation.value1)) errorMsg = validation.errorMsg || `「${validation.value1}」を含めないでください`;
        if (validation.condition === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) errorMsg = validation.errorMsg || '有効なメールアドレスを入力してください';
        if (validation.condition === 'url' && !/^https?:\/\/.*/.test(val)) errorMsg = validation.errorMsg || '有効なURL(http/https)を入力してください';
      } else if (validation.type === 'regex') {
        try {
          const regex = new RegExp(validation.value1);
          const isMatch = regex.test(val);
          if (validation.condition === 'match' && !isMatch) errorMsg = validation.errorMsg || '指定された形式で入力してください: ' + validation.value1;
          if (validation.condition === 'not_match' && isMatch) errorMsg = validation.errorMsg || '指定された形式は使用できません: ' + validation.value1;;
        } catch (e) {
           // 正規表現が壊れている場合は無視
        }
      }
    }

    const isDate = validation?.enabled && validation.type === 'date';

    return (
      <div className="pt-2">
        <input 
          type={isDate ? "date" : "text"} 
          value={val}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isDate ? "" : "回答を入力"} 
          className={`w-full md:w-2/3 border-b-2 py-2 outline-none transition-colors bg-transparent
            ${errorMsg ? 'border-red-500 focus:border-red-600' : 'border-gray-200 focus:border-blue-600'}
          `}
        />
        {/* エラーメッセージの表示 */}
        {errorMsg && (
          <p className="text-red-500 text-xs mt-2 flex items-center gap-1 font-bold animate-in fade-in slide-in-from-top-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {errorMsg}
          </p>
        )}
      </div>
    );
  };

  const renderGrid = () => {
    // 答えの形式: { rowId1: colId1, rowId2: [colId1, colId2] }
    const gridAnswer = answer || {};

    const handleGridChange = (rowId: number, colId: number) => {
      if (question.gridInputType === 'radio') {
        onChange({ ...gridAnswer, [rowId]: colId });
      } else {
        const rowAnswers = Array.isArray(gridAnswer[rowId]) ? gridAnswer[rowId] : [];
        if (rowAnswers.includes(colId)) {
          onChange({ ...gridAnswer, [rowId]: rowAnswers.filter((id: number) => id !== colId) });
        } else {
          onChange({ ...gridAnswer, [rowId]: [...rowAnswers, colId] });
        }
      }
    };

    return (
      <div className="pt-4 overflow-x-auto pb-4">
        <table className="text-sm text-left min-w-max border-separate border-spacing-y-2 mx-auto">
          <thead>
            <tr>
              <th className="pb-2"></th>
              {question.gridCols.map(col => (
                <th key={col.id} className="pb-2 px-4 text-center font-bold text-gray-600 w-24">
                  {col.text || <span className="text-gray-300 italic">列</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {question.gridRows.map((row, rowIndex) => (
              <tr key={row.id} className={`${rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="py-3 px-4 rounded-l-lg font-medium text-gray-700 max-w-[200px] break-words whitespace-normal">
                  {row.text || <span className="text-gray-300 italic">行</span>}
                </td>
                {question.gridCols.map((col, colIndex) => {
                  const isChecked = question.gridInputType === 'radio' 
                    ? gridAnswer[row.id] === col.id 
                    : (Array.isArray(gridAnswer[row.id]) ? gridAnswer[row.id] : []).includes(col.id);

                  return (
                    <td key={col.id} className={`py-3 px-4 text-center ${colIndex === question.gridCols.length - 1 ? 'rounded-r-lg' : ''}`}>
                      <label className="flex items-center justify-center w-full h-full cursor-pointer">
                        <div className="relative flex items-center justify-center">
                          <input 
                            type={question.gridInputType === 'radio' ? 'radio' : 'checkbox'} 
                            name={`grid-${question.id}-${row.id}`}
                            checked={isChecked}
                            onChange={() => handleGridChange(row.id, col.id)}
                            className="peer sr-only"
                          />
                          <div className={`w-5 h-5 border-2 border-gray-300 peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-colors ${question.gridInputType === 'radio' ? 'rounded-full' : 'rounded'}`} />
                          {question.gridInputType === 'radio' ? (
                            <div className="absolute w-2 h-2 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity" />
                          ) : (
                            <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </div>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLongText = () => (
    <div className="pt-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-500 transition-all bg-white">
      <RichTextEditor 
        value={answer || ''}
        onChange={(html) => onChange(html)}
        placeholder="詳細を入力してください..."
      />
    </div>
  );

  const renderDropdown = () => (
    <div className="pt-2">
      <select 
        value={answer || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full md:w-2/3 p-3 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
      >
        <option value="" disabled>選択してください</option>
        {question.options.map(opt => (
          <option key={opt.id} value={opt.text}>{opt.text}</option>
        ))}
      </select>
    </div>
  );

  const renderScale = () => (
    <div className="pt-4">
      <div className="flex justify-between md:justify-center items-end gap-2 md:gap-8">
        {question.scale.minLabel && <span className="text-sm text-gray-500 pb-1">{question.scale.minLabel}</span>}
        
        <div className="flex gap-4 md:gap-8">
          {Array.from({ length: question.scale.max - question.scale.min + 1 }).map((_, i) => {
            const num = question.scale.min + i;
            return (
              <label key={num} className="flex flex-col items-center gap-3 cursor-pointer group">
                <span className={`text-sm font-bold ${answer === num ? 'text-blue-700' : 'text-gray-500 group-hover:text-blue-500'}`}>
                  {num}
                </span>
                <div className="relative flex items-center justify-center">
                  <input 
                    type="radio" 
                    name={`scale-${question.id}`}
                    value={num}
                    checked={answer === num}
                    onChange={() => onChange(num)}
                    className="peer sr-only"
                  />
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-colors shadow-sm" />
                  <div className="absolute w-2.5 h-2.5 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
              </label>
            );
          })}
        </div>

        {question.scale.maxLabel && <span className="text-sm text-gray-500 pb-1">{question.scale.maxLabel}</span>}
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 space-y-4 hover:border-blue-200 transition-all">
      <div className="flex gap-2 mb-2">
        <h3 className="font-bold text-gray-800 text-lg leading-relaxed">{question.title || '無題の質問'}</h3>
      </div>
      
      {question.description && (
        <div 
          className="text-sm text-gray-500 prose prose-sm max-w-none" 
          dangerouslySetInnerHTML={{ __html: question.description }} 
        />
      )}
      
      <div className="pt-2">
        {question.type === 'radio' && renderRadio()}
        {question.type === 'checkbox' && renderCheckbox()}
        {question.type === 'short_text' && renderShortText()}
        {question.type === 'long_text_md' && renderLongText()}
        {question.type === 'dropdown' && renderDropdown()}
        {question.type === 'scale' && renderScale()}
        {question.type === 'grid_radio' && renderGrid()}
      </div>
    </div>
  );
}