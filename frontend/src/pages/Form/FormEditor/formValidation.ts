/**
 * フォームのバリデーションユーティリティ
 *
 * - validateFormCritical: 送信前・公開中自動保存前に使う致命的エラーのチェック
 * - getQuestionSettingsErrors: その場で表示する設定の矛盾エラーのチェック
 */
import type { QuestionData } from './FormEditorPage';

// ============================================================
// 型定義
// ============================================================

export type FormCriticalError = {
  type: 'form_title' | 'question_title' | 'option_empty' | 'no_options';
  questionId?: string;
  questionTitle?: string;
  message: string;
};

export type QuestionSettingsError = {
  field: string;
  message: string;
};

// ============================================================
// 致命的エラーチェック（送信時 / 公開中自動保存の抑制用）
// ============================================================

export function validateFormCritical(
  title: string,
  questions: QuestionData[]
): FormCriticalError[] {
  const errors: FormCriticalError[] = [];

  // フォームタイトルが空
  if (!title.trim()) {
    errors.push({ type: 'form_title', message: 'フォームのタイトルが入力されていません' });
  }

  for (const q of questions) {
    const label = q.title.trim() ? `「${q.title.trim()}」` : '（無題の質問）';

    // 質問タイトルが空
    if (!q.title.trim()) {
      errors.push({
        type: 'question_title',
        questionId: q.id,
        questionTitle: q.title,
        message: `${label} のタイトルが入力されていません`,
      });
    }

    // 選択肢が必要な質問タイプのチェック
    const needsOptions = ['radio', 'checkbox', 'dropdown'].includes(q.type);
    const needsGrid = q.type === 'grid_radio';

    if (needsOptions) {
      if (q.options.length === 0) {
        errors.push({
          type: 'no_options',
          questionId: q.id,
          questionTitle: q.title,
          message: `${label} に選択肢がありません`,
        });
      } else {
        const emptyOptions = q.options.filter(o => !o.text.trim());
        if (emptyOptions.length > 0) {
          errors.push({
            type: 'option_empty',
            questionId: q.id,
            questionTitle: q.title,
            message: `${label} にテキストが空の選択肢があります`,
          });
        }
      }
    }

    if (needsGrid) {
      const emptyRows = q.gridRows.filter(r => !r.text.trim());
      const emptyCols = q.gridCols.filter(c => !c.text.trim());
      if (emptyRows.length > 0 || emptyCols.length > 0) {
        errors.push({
          type: 'option_empty',
          questionId: q.id,
          questionTitle: q.title,
          message: `${label} にテキストが空の行または列があります`,
        });
      }
    }
  }

  return errors;
}

// ============================================================
// 設定の矛盾チェック（QuestionSettingsModalでその場表示用）
// ============================================================

export function getQuestionSettingsErrors(question: QuestionData): QuestionSettingsError[] {
  const errors: QuestionSettingsError[] = [];

  // ===== チェックボックスの選択数制限 =====
  const cbv = question.checkboxValidation;
  if (cbv?.enabled) {
    const min = cbv.min !== '' ? Number(cbv.min) : null;
    const max = cbv.max !== '' ? Number(cbv.max) : null;

    if (min === null && max === null) {
      errors.push({
        field: 'checkboxValidation',
        message: '最小・最大どちらかの値を入力してください',
      });
    } else if (min !== null && max !== null && min > max) {
      errors.push({
        field: 'checkboxValidation',
        message: `最小（${min}）が最大（${max}）より大きくなっています`,
      });
    } else if (min !== null && max === null && question.allowCustomAnswer === false) {
      // 最小だけ指定している時に、最大が選択肢の数を超えていないかはオプション（ここでは行わない）
    }
  }

  // ===== 短文のフォーマット指定 =====
  const stv = question.shortTextValidation;
  if (stv?.enabled) {
    const needsValue1 = stv.type !== 'date' && !['email', 'url'].includes(stv.condition);
    const needsValue2 = stv.type === 'number' && stv.condition === 'between';

    if (needsValue1 && !stv.value1.trim()) {
      errors.push({
        field: 'shortTextValidation_value1',
        message: stv.type === 'regex'
          ? '正規表現のパターンを入力してください'
          : stv.condition === 'between'
          ? '最小値を入力してください'
          : '値を入力してください',
      });
    }
    if (needsValue2 && !stv.value2.trim()) {
      errors.push({
        field: 'shortTextValidation_value2',
        message: '最大値を入力してください',
      });
    }

    // テキストタイプで「次を含む」「次を含まない」だが値が空
    if (
      stv.type === 'text' &&
      ['contains', 'not_contains'].includes(stv.condition) &&
      !stv.value1.trim()
    ) {
      // Already caught above by needsValue1, but explicit for clarity
    }
  }

  return errors;
}
