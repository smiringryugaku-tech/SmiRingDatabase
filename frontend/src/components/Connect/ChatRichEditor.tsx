import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Extension, wrappingInputRule } from '@tiptap/core';
import {
  Bold,
  Italic,
  Heading3,
  List,
  ListOrdered,
  Code,
  Send,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ChatRichEditorProps {
  onSend: (html: string, plainText: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const chatContentStyles =
  'text-xs text-gray-100 prose prose-sm prose-invert max-w-none ' +
  'prose-p:my-0.5 prose-p:leading-relaxed ' +
  'prose-headings:my-1 prose-headings:font-bold prose-h1:text-base prose-h2:text-sm prose-h3:text-xs ' +
  'prose-ul:my-1 prose-ul:pl-4 prose-ul:list-disc ' +
  'prose-ol:my-1 prose-ol:pl-4 prose-ol:list-decimal ' +
  'prose-li:my-0.5 ' +
  'prose-code:bg-gray-800/90 prose-code:text-indigo-300 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none';

function parseNumber(str: string): number {
  const half = str.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0),
  );
  return parseInt(half, 10) || 1;
}

// Custom input rule for ordered lists: supports both half-width and full-width numbers/dots/spaces
const JapaneseOrderedListInputRule = Extension.create({
  name: 'japaneseOrderedListInputRule',
  addInputRules() {
    return [
      wrappingInputRule({
        find: /^([0-9０-９]+)[.．][\s\u3000]$/,
        type: this.editor.schema.nodes.orderedList,
        getAttributes: (match) => ({ start: parseNumber(match[1]) }),
        joinPredicate: (match, node) =>
          node.childCount + node.attrs.start === parseNumber(match[1]),
      }),
    ];
  },
});

export default function ChatRichEditor({
  onSend,
  placeholder = 'メッセージを送信...',
  disabled = false,
}: ChatRichEditorProps) {
  const [, setForceUpdate] = useState(0);
  const [isEmpty, setIsEmpty] = useState(true);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      JapaneseOrderedListInputRule,
    ],
    editorProps: {
      attributes: {
        class: `outline-none min-h-[38px] max-h-32 overflow-y-auto px-3 py-2 text-xs ${chatContentStyles}`,
      },
      handleKeyDown: (_view, event) => {
        // IME (Japanese input) composition handling
        if (event.isComposing || event.keyCode === 229) {
          return false;
        }

        // Shift + Enter handling: if inside a list, split the item to create the next bullet/number
        if (event.key === 'Enter' && event.shiftKey) {
          if (editor.isActive('bulletList') || editor.isActive('orderedList')) {
            event.preventDefault();
            editor.commands.splitListItem('listItem');
            return true;
          }
          return false;
        }

        // Enter without shift sends message
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          handleSendSubmit();
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.getText().trim().length === 0);
    },
    onSelectionUpdate: () => setForceUpdate((prev) => prev + 1),
    onTransaction: () => setForceUpdate((prev) => prev + 1),
  });

  const handleSendSubmit = () => {
    if (!editor) return;
    const text = editor.getText().trim();
    if (!text) return;

    const html = editor.getHTML();
    onSendRef.current(html, text);
    editor.commands.clearContent();
    setIsEmpty(true);
  };

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col bg-gray-900 border border-gray-700/90 rounded-xl overflow-hidden transition-colors focus-within:border-indigo-500">
      {/* Editor Content Area */}
      <EditorContent editor={editor} className="select-text" />

      {/* Bottom Action / Formatting Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-950/40 border-t border-gray-800/80">
        {/* Formatting Buttons */}
        <div className="flex items-center gap-0.5 text-gray-400">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            className={`p-1 rounded-md transition-all ${
              editor.isActive('bold')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
            title="太字 (Cmd/Ctrl + B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            className={`p-1 rounded-md transition-all ${
              editor.isActive('italic')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
            title="斜体 (Cmd/Ctrl + I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleHeading({ level: 3 }).run();
            }}
            className={`p-1 rounded-md transition-all ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
            title="見出し"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-3 bg-gray-800 mx-1" />

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBulletList().run();
            }}
            className={`p-1 rounded-md transition-all ${
              editor.isActive('bulletList')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
            title="箇条書きリスト"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleOrderedList().run();
            }}
            className={`p-1 rounded-md transition-all ${
              editor.isActive('orderedList')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
            title="番号付きリスト"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleCode().run();
            }}
            className={`p-1 rounded-md transition-all ${
              editor.isActive('code')
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
            title="インラインコード"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Send Button & Hint */}
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-[9px] text-gray-500">
            Shift+Enterで改行
          </span>
          <button
            type="button"
            disabled={isEmpty || disabled}
            onClick={handleSendSubmit}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white rounded-lg shadow-sm transition-all active:scale-95"
            title="送信 (Enter)"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
