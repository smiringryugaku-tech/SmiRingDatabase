import React, { useState, useRef, useEffect } from 'react';
import QuestionMenu from './QuestionMenu';
import { CircleDot, CheckSquare, SquareChevronDown, LineDotRightHorizontal, LayoutGrid, PenLine, NotebookPen } from 'lucide-react';
import RichTextEditor from '../../../../components/ui/RichTextEditor';
import type { QuestionData } from '../FormEditorPage';

type QuestionBoxProps = {
  question: QuestionData;
  isActive: boolean;
  onChange: (updates: Partial<QuestionData>) => void;
  onDelete: () => void;
};

export default function QuestionBox({ question, isActive, onChange, onDelete }: QuestionBoxProps) {
  
  const questionTypeIcons: Record<string, React.ElementType> = {
    radio: CircleDot, 
    checkbox: CheckSquare, 
    dropdown: SquareChevronDown,
    scale: LineDotRightHorizontal, 
    grid_radio: LayoutGrid, 
    short_text: PenLine, 
    long_text_md: NotebookPen,
  };

  // --- 共通の操作ロジック（親の onChange を呼ぶ） ---
  const handleAddOption = () => onChange({ options: [...question.options, { id: Date.now(), text: '' }] });
  const handleUpdateOption = (id: number, text: string) => onChange({ options: question.options.map(opt => opt.id === id ? { ...opt, text } : opt) });
  const handleRemoveOption = (id: number) => { if (question.options.length > 1) onChange({ options: question.options.filter(opt => opt.id !== id) }); };

  // --- グリッドの操作ロジック ---
  const handleAddGridRow = () => onChange({ gridRows: [...question.gridRows, { id: Date.now(), text: '' }] });
  const handleUpdateGridRow = (id: number, text: string) => onChange({ gridRows: question.gridRows.map(r => r.id === id ? { ...r, text } : r) });
  const handleRemoveGridRow = (id: number) => { if (question.gridRows.length > 1) onChange({ gridRows: question.gridRows.filter(r => r.id !== id) }); };

  const handleAddGridCol = () => onChange({ gridCols: [...question.gridCols, { id: Date.now(), text: '' }] });
  const handleUpdateGridCol = (id: number, text: string) => onChange({ gridCols: question.gridCols.map(c => c.id === id ? { ...c, text } : c) });
  const handleRemoveGridCol = (id: number) => { if (question.gridCols.length > 1) onChange({ gridCols: question.gridCols.filter(c => c.id !== id) }); };

  // --- スケールのスクロール制御（UIの見た目だけなのでローカルState） ---
  const scaleRef = useRef<HTMLDivElement>(null);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [showLeftShadow, setShowLeftShadow] = useState(false);

  const handleScaleScroll = () => {
    const el = scaleRef.current;
    if (!el) return;
    setShowLeftShadow(el.scrollLeft > 0);
    setShowRightShadow(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    handleScaleScroll();
  }, [question.scale.min, question.scale.max]);


  // --- UI: ラジオ・チェックボックス ---
  const renderListOptions = (type: string) => {
    return (
      <div className="pt-4 space-y-2">
        {question.options.map((opt, index) => {
          const isDuplicate = question.options.some(other => other.id !== opt.id && other.text.trim() !== '' && other.text.trim() === opt.text.trim());
          return (
            <div key={opt.id} className="space-y-1">
              <div className="flex items-center space-x-3 group/option">
                {type === 'radio' && <div className={`w-5 h-5 border-2 ${isDuplicate ? 'border-red-300' : 'border-gray-300'} rounded-full flex-shrink-0`} />}
                {type === 'checkbox' && <div className={`w-5 h-5 border-2 ${isDuplicate ? 'border-red-300' : 'border-gray-300'} rounded-md flex-shrink-0`} />}
                
                <input 
                  type="text" 
                  value={opt.text}
                  placeholder={`選択肢 ${index + 1}`}
                  onChange={(e) => handleUpdateOption(opt.id, e.target.value)}
                  className={`flex-1 text-sm border-b transition-colors focus:outline-none py-1 ${
                    isDuplicate 
                      ? 'border-red-500 text-red-600 focus:border-red-600' 
                      : 'border-transparent focus:border-blue-500 hover:border-gray-200 text-gray-700'
                  }`} 
                />
                <button 
                  onClick={() => handleRemoveOption(opt.id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover/option:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
              {isDuplicate && (
                <p className="text-[10px] text-red-500 font-bold pl-8 animate-in fade-in slide-in-from-top-1">
                  「{opt.text}」はすでに存在します
                </p>
              )}
            </div>
          );
        })}
        <div className="flex items-center space-x-2 pt-2 cursor-pointer text-blue-500 hover:text-blue-700" onClick={handleAddOption}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm font-bold">選択肢を追加</span>
        </div>
        {/* 選択肢ごとのカスタム設定がある場合の表示バッジ */}
        {question.allowCustomAnswer && (
          <p className="text-xs text-blue-500 font-medium pt-1 pl-8">＋ カスタム回答が有効</p>
        )}
        {question.type === 'checkbox' && question.checkboxValidation?.enabled && (
          <p className="text-xs text-orange-500 font-medium pt-1 pl-8">
            ※ 選択数の制限: {question.checkboxValidation.min !== '' ? `${question.checkboxValidation.min}個以上` : ''}{question.checkboxValidation.min !== '' && question.checkboxValidation.max !== '' ? ' / ' : ''}{question.checkboxValidation.max !== '' ? `${question.checkboxValidation.max}個以下` : ''}
          </p>
        )}
      </div>
    );
  };

  // --- UI: ドロップダウン ---
  const renderDropdown = () => {
    return (
      <div className="pt-4">
        <div className="w-full md:w-2/3 border border-gray-300 rounded-md bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm text-gray-500">回答者はここから1つ選びます</span>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className="p-2 space-y-1 bg-white">
            {question.options.map((opt, index) => {
              const isDuplicate = question.options.some(other => other.id !== opt.id && other.text.trim() !== '' && other.text.trim() === opt.text.trim());
              return (
                <div key={opt.id} className="space-y-1">
                  <div className="flex items-center space-x-3 group/option p-2 hover:bg-gray-50 rounded-md transition-colors">
                    <span className={`font-bold w-5 text-right ${isDuplicate ? 'text-red-300' : 'text-gray-400'}`}>{index + 1}.</span>
                    <input 
                      type="text" value={opt.text} placeholder={`選択肢 ${index + 1}`}
                      onChange={(e) => handleUpdateOption(opt.id, e.target.value)}
                      className={`flex-1 text-sm bg-transparent border-b transition-colors focus:outline-none py-1 ${
                        isDuplicate 
                          ? 'border-red-500 text-red-600 focus:border-red-600' 
                          : 'border-transparent focus:border-blue-500'
                      }`} 
                    />
                    <button onClick={() => handleRemoveOption(opt.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover/option:opacity-100 transition-opacity">✕</button>
                  </div>
                  {isDuplicate && (
                    <p className="text-[10px] text-red-500 font-bold pl-10 animate-in fade-in slide-in-from-top-1">
                      「{opt.text}」はすでに存在します
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex items-center space-x-2 pt-2 cursor-pointer text-blue-500 hover:text-blue-700 p-2" onClick={handleAddOption}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              <span className="text-sm font-bold">選択肢を追加</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- UI: スケール ---
  const renderScale = () => {
    return (
      <div className="pt-4 space-y-4">
        <div className="flex items-center space-x-4">
          <select 
            value={question.scale.min} 
            onChange={e => onChange({ scale: { ...question.scale, min: Number(e.target.value) }})} 
            className="p-2 border border-gray-300 rounded-md bg-white text-sm"
          >
            <option value={0}>0</option><option value={1}>1</option>
          </select>
          <span className="text-gray-500">〜</span>
          <select 
            value={question.scale.max} 
            onChange={e => onChange({ scale: { ...question.scale, max: Number(e.target.value) }})} 
            className="p-2 border border-gray-300 rounded-md bg-white text-sm"
          >
            {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="bg-gray-50 p-6 rounded-xl mt-2 border border-gray-100">
          <div className="flex items-center space-x-4">
            <input 
              type="text" placeholder="下限ラベル(任意)" 
              value={question.scale.minLabel} 
              onChange={e => onChange({ scale: { ...question.scale, minLabel: e.target.value }})} 
              className="w-24 flex-shrink-0 text-sm text-center border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent pb-1 transition-colors" 
            />
            <div className="relative flex-1 overflow-hidden">
              {showLeftShadow && <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none" />}
              {showRightShadow && <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none" />}
              <div ref={scaleRef} onScroll={handleScaleScroll} className="overflow-x-auto">
                <div className="flex justify-center space-x-4 md:space-x-8 pb-1 min-w-max mx-auto">
                  {Array.from({ length: question.scale.max - question.scale.min + 1 }).map((_, i) => {
                    const num = question.scale.min + i;
                    return (
                      <div key={num} className="flex flex-col items-center space-y-2">
                        <span className="text-gray-700 font-bold">{num}</span>
                        <div className="w-5 h-5 border-2 border-gray-400 rounded-full bg-white shadow-sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <input 
              type="text" placeholder="上限ラベル(任意)" 
              value={question.scale.maxLabel} 
              onChange={e => onChange({ scale: { ...question.scale, maxLabel: e.target.value }})} 
              className="w-24 flex-shrink-0 text-sm text-center border-b border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent pb-1 transition-colors" 
            />
          </div>
        </div>
      </div>
    );
  };

  // --- UI: 長文入力 ---
  const renderMarkdown = () => {
    return (
      <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
        <RichTextEditor 
          placeholder="回答者はここに長文を入力します。" 
          readOnly={true} 
        />
      </div>
    );
  };

  // ---  短文入力（フォーマット指定付き） ---
  const renderShortText = () => {
    const validationEnabled = question.shortTextValidation?.enabled;
    const multipleEnabled = question.shortTextMultiple?.enabled;
    
    return (
      <div className="pt-4 space-y-3">
        <input 
          type="text" 
          placeholder="回答者はここに短文を入力します。" 
          readOnly
          className="w-full md:w-1/2 border-b border-gray-300 border-dotted focus:outline-none py-2 text-sm text-gray-400 bg-transparent"
        />
        {/* 設定状況のバッジ */}
        {(validationEnabled || multipleEnabled) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {multipleEnabled && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full font-medium">
                複数回答: {question.shortTextMultiple?.style === 'none' ? 'なし' : question.shortTextMultiple?.style === 'bullet' ? '箇条書き' : question.shortTextMultiple?.style === 'number' ? '番号付き' : '矢印'}
              </span>
            )}
            {validationEnabled && (
              <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded-full font-medium">
                ※ 検証: {question.shortTextValidation?.type}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // --- グリッド（プレビュー直接編集型） ---
  const renderGrid = () => {
    return (
      <div className="pt-4">
        <div className="flex justify-end items-center gap-3 mb-4">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button 
              onClick={() => onChange({ gridInputType: 'radio' })}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${question.gridInputType === 'radio' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ラジオ (単一)
            </button>
            <button 
              onClick={() => onChange({ gridInputType: 'checkbox' })}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${question.gridInputType === 'checkbox' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              チェック (複数)
            </button>
          </div>
        </div>

        <div className="bg-gray-50 p-6 pb-3 rounded-xl border border-gray-200">
          <div className="flex justify-end mb-2">
            <button onClick={handleAddGridCol} className="text-blue-500 hover:text-blue-700 flex items-center font-bold text-sm">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              列を追加
            </button>
          </div>

          <div className="overflow-x-auto px-6 pb-3">
            <table className="w-full text-sm text-left border-separate border-spacing-y-2 border-spacing-x-4">
              <thead>
                <tr>
                  <th className="pb-4 min-w-[120px]"></th>
                  {question.gridCols.map((col, index) => {
                    const isDuplicate = question.gridCols.some(other => other.id !== col.id && other.text.trim() !== '' && other.text.trim() === col.text.trim());
                    return (
                      <th key={col.id} className="pb-4 min-w-[100px] text-center group/col relative">
                        <input 
                          type="text" value={col.text} placeholder={`列 ${index + 1}`}
                          onChange={e => handleUpdateGridCol(col.id, e.target.value)}
                          className={`w-full text-center bg-transparent border-b transition-colors focus:outline-none pb-1 font-bold ${
                            isDuplicate 
                              ? 'border-red-500 text-red-600 focus:border-red-600' 
                              : 'border-gray-300 focus:border-blue-500 text-gray-700'
                          }`}
                        />
                        <button onClick={() => handleRemoveGridCol(col.id)} className="absolute -top-4 right-0 text-gray-300 hover:text-red-500 opacity-0 group-hover/col:opacity-100 transition-opacity">✕</button>
                        {isDuplicate && (
                          <p className="absolute left-1/2 -translate-x-1/2 -bottom-0 text-[8px] text-red-500 font-bold whitespace-nowrap bg-white px-1">重複</p>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                  {question.gridRows.map((row, rowIndex) => {
                    const isDuplicate = question.gridRows.some(other => other.id !== row.id && other.text.trim() !== '' && other.text.trim() === row.text.trim());
                    return (
                      <tr key={row.id} className="group/row">
                        <td className="py-2 px-2 relative">
                          <input 
                            type="text" value={row.text} placeholder={`行 ${rowIndex + 1}`}
                            onChange={e => handleUpdateGridRow(row.id, e.target.value)}
                            className={`w-full bg-transparent border-b transition-colors focus:outline-none py-1 font-bold ${
                              isDuplicate 
                                ? 'border-red-500 text-red-600 focus:border-red-600' 
                                : 'border-transparent focus:border-blue-500 text-gray-700'
                            }`}
                          />
                          <button onClick={() => handleRemoveGridRow(row.id)} className="absolute top-3 -left-6 text-gray-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity">✕</button>
                          {isDuplicate && (
                            <p className="absolute left-2 -bottom-2 text-[8px] text-red-500 font-bold whitespace-nowrap bg-white px-1">重複しています</p>
                          )}
                        </td>
                        {question.gridCols.map(col => (
                          <td key={col.id} className="py-2 text-center border-y border-gray-100 shadow-sm bg-white">
                            <div className={`mx-auto w-5 h-5 border-2 border-gray-300 ${question.gridInputType === 'radio' ? 'rounded-full' : 'rounded-md'}`} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                <tr>
                  <td className="pt-4 pl-2">
                    <button onClick={handleAddGridRow} className="text-blue-500 hover:text-blue-700 flex items-center font-bold text-sm">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      行を追加
                    </button>
                  </td>
                  <td colSpan={question.gridCols.length} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative w-full bg-white rounded-xl shadow-sm p-6 group focus-within:ring-2 focus-within:ring-blue-200 transition-all ${isActive ? 'border-3 border-blue-500' : 'border-3 border-gray-200'}`}>
      
      {(() => {
        const Icon = questionTypeIcons[question.type];
        return Icon ? (
          <div className="absolute top-4 right-4 p-2 bg-blue-50 rounded-lg">
            <Icon className="w-5 h-5 text-blue-400" strokeWidth={2} />
          </div>
        ) : null;
      })()}
      
      <div className="flex flex-col space-y-4">
        
        <input 
          type="text" 
          placeholder="質問" 
          value={question.title}
          onChange={e => onChange({ title: e.target.value })}
          className="w-full md:w-2/3 text-xl font-medium bg-gray-50 p-3 rounded-md border-b-2 border-transparent focus:border-blue-600 focus:bg-white focus:outline-none transition-colors"
        />
        <RichTextEditor 
          value={question.description} 
          placeholder='質問の説明（任意）' 
          onChange={(html) => onChange({ description: html })}
        />

        {question.type === 'radio' && renderListOptions('radio')}
        {question.type === 'checkbox' && renderListOptions('checkbox')}
        {question.type === 'dropdown' && renderDropdown()}
        {question.type === 'scale' && renderScale()}
        {question.type === 'grid_radio' && renderGrid()}
        {question.type === 'short_text' && renderShortText()}
        {question.type === 'long_text_md' && renderMarkdown()}
        
        {!['radio', 'checkbox', 'dropdown', 'scale', 'long_text_md', 'short_text', 'grid_radio'].includes(question.type) && (
          <div className="pt-4 p-4 bg-red-50 text-red-600 rounded-md flex items-center justify-center">
            <span className="font-bold">Invalid Question Type (未実装の形式です)</span>
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end">
          <label className="flex items-center cursor-pointer gap-2 group">
            <span className={`text-sm font-bold transition-colors ${question.isRequired ? 'text-blue-700' : 'text-gray-500 group-hover:text-gray-700'}`}>
              必須
            </span>
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={question.isRequired || false}
                onChange={(e) => onChange({ isRequired: e.target.checked })}
              />
              <div className={`block w-10 h-6 rounded-full transition-colors ${question.isRequired ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${question.isRequired ? 'transform translate-x-4' : ''}`}></div>
            </div>
          </label>
        </div>
      </div>

      <QuestionMenu 
        currentType={question.type}
        onChangeType={(newType) => onChange({ type: newType })}
        isActive={isActive}
        onDelete={onDelete}
        question={question}
        onChange={onChange}
      />
    </div>
  );
}