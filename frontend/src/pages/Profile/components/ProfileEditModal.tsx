import React, { useState, useEffect } from 'react';
import type { QuestionData } from '../../Form/FormEditor/FormEditorPage';
import AnswerBox from '../../Form/Answer/components/AnswerBox';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  questionData: QuestionData;
  currentValue: any;
  onSave: (fieldKey: string, newValue: any) => Promise<void>;
};

export default function ProfileEditModal({ isOpen, onClose, questionData, currentValue, onSave }: Props) {
  const [value, setValue] = useState(currentValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let initialValue = currentValue;
    
    // DBにはテキストが保存されているが、AnswerBoxはIDを期待するため変換する
    if (questionData.type === 'checkbox') {
      if (Array.isArray(currentValue)) {
        initialValue = currentValue.map(textVal => {
          const opt = questionData.options.find(o => o.text === textVal || o.id === textVal);
          return opt ? opt.id : null;
        }).filter(v => v !== null);
      }
    } else if (questionData.type === 'radio' || questionData.type === 'dropdown') {
      const opt = questionData.options.find(o => o.text === currentValue || o.id === currentValue);
      initialValue = opt ? opt.id : currentValue;
    }

    setValue(initialValue);
    setError(null);
  }, [currentValue, isOpen, questionData]);

  if (!isOpen) return null;

  const handleSave = async () => {
    // AnswerBox内部でのバリデーションはAnswerBoxの表示上で行われるが、
    // 必須チェックや独自チェックなどをここで行うことも可能
    setIsSaving(true);
    setError(null);
    try {
      let valueToSave = value;
      // DBに保存する前に、IDからテキストに戻す
      if (questionData.type === 'checkbox') {
        if (Array.isArray(value)) {
          valueToSave = value.map(val => {
            const opt = questionData.options.find(o => o.id === val);
            return opt ? opt.text : val;
          });
        }
      } else if (questionData.type === 'radio' || questionData.type === 'dropdown') {
        const opt = questionData.options.find(o => o.id === value);
        valueToSave = opt ? opt.text : value;
      }

      await onSave(questionData.id, valueToSave);
      onClose();
    } catch (err: any) {
      setError(err.message || '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {questionData.title} の編集
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          
          <AnswerBox 
            question={questionData}
            answer={value}
            onChange={setValue}
          />
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                保存中...
              </>
            ) : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
