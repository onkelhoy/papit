import { Lexer, StateRules } from "./lexer";

// Simple, focused token types
export type MarkdownToken =
  | { type: "heading"; level: number; text: string }
  | { type: "code-block"; lang: string; code: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "blank" }
  | { type: "tab" };

type BlockCtx = {
  level: number;
  lang: string;
  items: string[];
  headers: string[];
  rows: string[][];
  currentRow: string[];
  quote: boolean;
};

// Block-level: processes line by line
const blockRules: StateRules<BlockCtx, MarkdownToken> = {
  EOF: [
    {
      condition: () => true,
      action: (ctx, char, buffer) => {
        const trimmed = buffer.trim();
        if (!trimmed) return;

        if (ctx.level > 0) 
          ctx.emit({ type: "heading", level: ctx.level, text: trimmed });
        else if (ctx.quote)
          ctx.emit({ type: "quote", text: trimmed });
        else 
          ctx.emit({ type: "paragraph", text: trimmed });
      },
    },
  ],

  lineStart: [
    // Blank line
    { condition: /\n/, action: (ctx) => ctx.emit({ type: "blank" }) },
    
    // Heading: #
    { condition: "#", next: "maybeHeading" },
    
    // Code block: ```
    { condition: "`", next: "maybeCodeBlock" },
    
    // Quote: >
    { condition: ">", next: "quote", action: ctx => {
      ctx.quote = true;
    } },
    
    // Table: |
    {
      condition: "|",
      next: "tableCell",
      action: (ctx) => {
        ctx.headers = [];
        ctx.rows = [];
        ctx.currentRow = [];
      },
    },
    
    // List: - or 1.
    { condition: "-", next: "maybeList" },
    { condition: /\d/, next: "maybeOrderedList", action: (ctx, char) => ctx.append(char) },
    
    // Regular paragraph
    { condition: (char) => char?.trim() !== "", next: "paragraph", action: (ctx, char) => ctx.append(char) },
  ],

  // === HEADINGS ===
  maybeHeading: [
    { condition: "#", action: ctx => ctx.level = 2, next: "heading" },
    { condition: " ", action: ctx => ctx.level = 1, next: "headingText" },
    { condition: () => true, action: (ctx, char) => ctx.append("#" + char), next: "paragraph" }
  ],

  heading: [
    { condition: "#", action: (ctx) => ctx.level++ },
    { condition: " ", next: "headingText" },
  ],

  headingText: [
    {
      condition: /\n/,
      next: "lineStart",
      action: (ctx, char, buffer) => {
        ctx.emit({ type: "heading", level: ctx.level, text: buffer.trim() });
        ctx.level = 0;
      },
    },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  // === CODE BLOCKS ===
  maybeCodeBlock: [
    { condition: "`", next: "maybeCodeBlock2" },
    { condition: () => true, next: "paragraph", action: (ctx, char) => ctx.append("`" + char) },
  ],

  maybeCodeBlock2: [
    { condition: "`", next: "codeBlockLang" },
    { condition: () => true, next: "paragraph", action: (ctx, char) => ctx.append("``" + char) },
  ],

  codeBlockLang: [
    { condition: /\n/, next: "codeBlockContent" },
    { condition: () => true, action: (ctx, char) => (ctx.lang += char) },
  ],

  codeBlockContent: [
    { condition: "`", next: "maybeCodeBlockEnd" },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  maybeCodeBlockEnd: [
    { condition: "`", next: "maybeCodeBlockEnd2" },
    { condition: () => true, next: "codeBlockContent", action: (ctx, char) => ctx.append("`" + char) },
  ],

  maybeCodeBlockEnd2: [
    {
      condition: "`",
      next: "lineStart",
      action: (ctx, char, buffer) => {
        ctx.emit({ type: "code-block", lang: ctx.lang.trim(), code: buffer.trimEnd() });
        ctx.lang = "";
      },
    },
    { condition: () => true, next: "codeBlockContent", action: (ctx, char) => ctx.append("``" + char) },
  ],

  // === QUOTES ===
  quote: [
    { condition: " ", next: "quoteText" },
    { condition: () => true, next: "quoteText", action: (ctx, char) => ctx.append(char) },
  ],

  quoteText: [
    { condition: /\n/, next: "quoteEnd" },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  quoteEnd: [
    {
      condition: /\n/,
      next: "lineStart",
      action: (ctx, char, buffer) => {
        ctx.quote = false;
        ctx.emit({ type: "quote", text: buffer.trim() });
      },
    },
    { condition: ">", action: ctx => ctx.append("\n"), next: "quote" }
  ],

  // === TABLES ===
  tableCell: [
    {
      condition: "|",
      action: (ctx, char, buffer) => {
        ctx.currentRow.push(buffer.trim());
      },
    },
    {
      condition: /\n/,
      next: "maybeTableSeparator",
      action: (ctx, char, buffer) => {
        if (buffer.trim()) ctx.currentRow.push(buffer.trim());
        ctx.headers = [...ctx.currentRow];
        ctx.currentRow = [];
      },
    },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  maybeTableSeparator: [
    {
      condition: "|",
      next: "tableSeparator",
    },
    {
      condition: () => true,
      next: "lineStart",
      action: (ctx, char) => {
        // Not a table, just a paragraph with pipes
        ctx.emit({ type: "paragraph", text: ctx.headers.join(" | ") });
        ctx.headers = [];
        ctx.append(char);
      },
    },
  ],

  tableSeparator: [
    { condition: /[-:\s]/, action: () => {} }, // Skip separator content
    {
      condition: /\n/,
      next: "tableRow",
    },
  ],

  tableRow: [
    {
      condition: "|",
      next: "tableRowCell",
      action: (ctx) => {
        ctx.currentRow = [];
      },
    },
    {
      condition: /\n/,
      next: "lineStart",
      action: (ctx) => {
        // Empty line ends table
        ctx.emit({ type: "table", headers: ctx.headers, rows: ctx.rows });
        ctx.headers = [];
        ctx.rows = [];
      },
    },
    {
      condition: () => true,
      next: "lineStart",
      action: (ctx, char) => {
        // Not a table row, end table
        ctx.emit({ type: "table", headers: ctx.headers, rows: ctx.rows });
        ctx.headers = [];
        ctx.rows = [];
        ctx.append(char);
      },
    },
  ],

  tableRowCell: [
    {
      condition: "|",
      action: (ctx, char, buffer) => {
        ctx.currentRow.push(buffer.trim());
      },
    },
    {
      condition: /\n/,
      next: "tableRow",
      action: (ctx, char, buffer) => {
        if (buffer.trim()) ctx.currentRow.push(buffer.trim());
        ctx.rows.push([...ctx.currentRow]);
        ctx.currentRow = [];
      },
    },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  // === LISTS ===
  maybeList: [
    {
      condition: " ",
      next: "listItem",
      action: (ctx) => {
        ctx.items = [];
        ctx.level = 0; // 0 = unordered
      },
    },
    { condition: () => true, next: "paragraph", action: (ctx, char) => ctx.append("-" + char) },
  ],

  maybeOrderedList: [
    { condition: /\d/, action: (ctx, char) => ctx.append(char) },
    {
      condition: ".",
      next: "maybeOrderedListSpace",
    },
    { condition: () => true, next: "paragraph", action: (ctx, char) => ctx.append(char) },
  ],

  maybeOrderedListSpace: [
    {
      condition: " ",
      next: "listItem",
      action: (ctx, char, buffer) => {
        ctx.items = [];
        ctx.level = 1; // 1 = ordered
      },
    },
    { condition: () => true, next: "paragraph", action: (ctx, char) => ctx.append("." + char) },
  ],

  listItem: [
    {
      condition: /\n/,
      next: "maybeListContinue",
      action: (ctx, char, buffer) => {
        ctx.items.push(buffer.trim());
      },
    },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  maybeListContinue: [
    { condition: "-", next: "maybeListContinue2" },
    { condition: /\d/, next: "maybeOrderedListContinue", action: (ctx, char) => ctx.append(char) },
    {
      condition: () => true,
      next: "lineStart",
      action: (ctx, char) => {
        ctx.emit({ type: "list", ordered: ctx.level === 1, items: ctx.items });
        ctx.items = [];
        ctx.append(char);
      },
    },
  ],

  maybeListContinue2: [
    { condition: " ", next: "listItem" },
    {
      condition: () => true,
      next: "lineStart",
      action: (ctx, char) => {
        ctx.emit({ type: "list", ordered: ctx.level === 1, items: ctx.items });
        ctx.items = [];
        ctx.append("-" + char);
      },
    },
  ],

  maybeOrderedListContinue: [
    { condition: /\d/, action: (ctx, char) => ctx.append(char) },
    { condition: ".", next: "maybeOrderedListContinue2" },
    {
      condition: () => true,
      next: "lineStart",
      action: (ctx, char) => {
        ctx.emit({ type: "list", ordered: ctx.level === 1, items: ctx.items });
        ctx.items = [];
        ctx.append(char);
      },
    },
  ],

  maybeOrderedListContinue2: [
    { condition: " ", next: "listItem" },
    {
      condition: () => true,
      next: "lineStart",
      action: (ctx, char) => {
        ctx.emit({ type: "list", ordered: ctx.level === 1, items: ctx.items });
        ctx.items = [];
        ctx.append("." + char);
      },
    },
  ],

  // === PARAGRAPHS ===
  paragraph: [
    {
      condition: /\n/,
      next: "lineStart",
      action: (ctx, char, buffer) => {
        if (buffer.trim()) {
          ctx.emit({ type: "paragraph", text: buffer.trim() });
        }
      },
    },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],
};

export function markdown(content: string): MarkdownToken[] {
  const lexer = new Lexer<BlockCtx, MarkdownToken>(
    blockRules, 
    "lineStart", {
      level: 0,
      lang: "",
      items: [],
      headers: [],
      rows: [],
      currentRow: [],
      quote: false,
    }
  );

  return lexer.run(content);
}

// import { Lexer, StateRules } from "./lexer";

// // Block-level context
// type BlockCtx = {
//   indent: number;
//   listLevel: number;
//   codeLanguage: string;
//   inCodeBlock: boolean;
//   tableHeaders: string[];
//   tableAlignments: ("left" | "center" | "right" | null)[];
//   tableCurrentRow: string[];
//   inTable: boolean;
// };

// // Block-level tokens
// export type BlockToken =
//   | { type: "heading"; level: number; content: string }
//   | { type: "code-block"; language?: string; content: string }
//   | { type: "quote"; content: string }
//   | { type: "list-item"; ordered: boolean; checked?: boolean; content: string }
//   | { type: "horizontal-rule" }
//   | { type: "table"; headers: string[]; alignments: ("left" | "center" | "right" | null)[]; rows: string[][] }
//   | { type: "paragraph"; content: string }
//   | { type: "blank-line" };

// // Inline-level tokens
// export type InlineToken =
//   | { type: "text"; value: string }
//   | { type: "bold"; value: string }
//   | { type: "italic"; value: string }
//   | { type: "code"; value: string }
//   | { type: "link"; text: string; href: string; title?: string }
//   | { type: "image"; alt: string; src: string; title?: string }
//   | { type: "line-break" };

// // Combined markdown token
// export type MarkdownToken = BlockToken & { inline?: InlineToken[] };

// // ============================================================================
// // PASS 1: Block-level lexer (line-by-line)
// // ============================================================================

// const blockRules: StateRules<BlockCtx, BlockToken> = {
//   EOF: [
//     {
//       condition: () => true,
//       action: (ctx, char, buffer) => {
//         if (buffer.trim()) {
//           ctx.emit({ type: "paragraph", content: buffer.trim() });
//         }
//       },
//     },
//   ],

//   lineStart: [
//     // Headings: # ## ###
//     {
//       condition: "#",
//       next: "heading",
//       action: (ctx) => {
//         ctx.indent = 1;
//       },
//     },
//     // Code block: ```
//     {
//       condition: "`",
//       next: "potentialCodeBlock",
//     },
//     // Quote: >
//     {
//       condition: ">",
//       next: "quote",
//     },
//     // Horizontal rule: --- or ***
//     {
//       condition: "-",
//       next: "potentialHR",
//     },
//     {
//       condition: "*",
//       next: "potentialHRorList",
//     },
//     // Table or ordered list: |
//     {
//       condition: "|",
//       next: "tableRow",
//       action: (ctx) => {
//         if (!ctx.inTable) {
//           ctx.inTable = true;
//           ctx.tableCurrentRow = [];
//         }
//       },
//     },
//     // Ordered list: 1. 2.
//     {
//       condition: /\d/,
//       next: "potentialOrderedList",
//       action: (ctx, char) => ctx.append(char),
//     },
//     // Unordered list: - or *
//     // Blank line
//     {
//       condition: /\n/,
//       action: (ctx) => {
//         // End table if we were in one
//         if (ctx.inTable && ctx.tableHeaders.length > 0) {
//           ctx.emit({
//             type: "table",
//             headers: ctx.tableHeaders,
//             alignments: ctx.tableAlignments,
//             rows: [],
//           });
//           ctx.tableHeaders = [];
//           ctx.tableAlignments = [];
//           ctx.tableCurrentRow = [];
//           ctx.inTable = false;
//         }
//         ctx.emit({ type: "blank-line" });
//       },
//     },
//     // Regular paragraph
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => {
//         // End table if we were in one
//         if (ctx.inTable && ctx.tableHeaders.length > 0) {
//           ctx.emit({
//             type: "table",
//             headers: ctx.tableHeaders,
//             alignments: ctx.tableAlignments,
//             rows: [],
//           });
//           ctx.tableHeaders = [];
//           ctx.tableAlignments = [];
//           ctx.tableCurrentRow = [];
//           ctx.inTable = false;
//         }
//         ctx.append(char);
//       },
//     },
//   ],

//   heading: [
//     {
//       condition: "#",
//       action: (ctx) => {
//         ctx.indent++;
//       },
//     },
//     {
//       condition: " ",
//       next: "headingContent",
//     },
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx, char, buffer) => {
//         ctx.emit({ type: "heading", level: ctx.indent, content: buffer.trim() });
//         ctx.indent = 0;
//       },
//     },
//   ],

//   headingContent: [
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx, char, buffer) => {
//         ctx.emit({ type: "heading", level: ctx.indent, content: buffer.trim() });
//         ctx.indent = 0;
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   potentialCodeBlock: [
//     {
//       condition: "`",
//       next: "potentialCodeBlock2",
//     },
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => {
//         ctx.append("`");
//         ctx.append(char);
//       },
//     },
//   ],

//   potentialCodeBlock2: [
//     {
//       condition: "`",
//       next: "codeBlockLanguage",
//       action: (ctx) => {
//         ctx.inCodeBlock = true;
//       },
//     },
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => {
//         ctx.append("``");
//         ctx.append(char);
//       },
//     },
//   ],

//   codeBlockLanguage: [
//     {
//       condition: /\n/,
//       next: "codeBlockContent",
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => {
//         ctx.codeLanguage += char;
//       },
//     },
//   ],

//   codeBlockContent: [
//     {
//       condition: "`",
//       next: "potentialCodeBlockEnd",
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   potentialCodeBlockEnd: [
//     {
//       condition: "`",
//       next: "potentialCodeBlockEnd2",
//     },
//     {
//       condition: () => true,
//       next: "codeBlockContent",
//       action: (ctx, char) => {
//         ctx.append("`");
//         ctx.append(char);
//       },
//     },
//   ],

//   potentialCodeBlockEnd2: [
//     {
//       condition: "`",
//       next: "lineStart",
//       action: (ctx, char, buffer) => {
//         ctx.emit({
//           type: "code-block",
//           language: ctx.codeLanguage || undefined,
//           content: buffer.trimEnd(),
//         });
//         ctx.codeLanguage = "";
//         ctx.inCodeBlock = false;
//       },
//     },
//     {
//       condition: () => true,
//       next: "codeBlockContent",
//       action: (ctx, char) => {
//         ctx.append("``");
//         ctx.append(char);
//       },
//     },
//   ],

//   quote: [
//     {
//       condition: " ",
//       next: "quoteContent",
//     },
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx) => ctx.emit({ type: "quote", content: "" }),
//     },
//     {
//       condition: () => true,
//       next: "quoteContent",
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   quoteContent: [
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx, char, buffer) => {
//         ctx.emit({ type: "quote", content: buffer.trim() });
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   potentialHR: [
//     {
//       condition: "-",
//       next: "potentialHR2",
//     },
//     {
//       condition: " ",
//       next: "listItem",
//     },
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => {
//         ctx.append("-");
//         ctx.append(char);
//       },
//     },
//   ],

//   potentialHR2: [
//     {
//       condition: "-",
//       next: "horizontalRule",
//     },
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => {
//         ctx.append("--");
//         ctx.append(char);
//       },
//     },
//   ],

//   horizontalRule: [
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx) => ctx.emit({ type: "horizontal-rule" }),
//     },
//     {
//       condition: () => true,
//     },
//   ],

//   potentialHRorList: [
//     {
//       condition: "*",
//       next: "potentialHR2Star",
//     },
//     {
//       condition: " ",
//       next: "listItem",
//     },
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => {
//         ctx.append("*");
//         ctx.append(char);
//       },
//     },
//   ],

//   potentialHR2Star: [
//     {
//       condition: "*",
//       next: "horizontalRule",
//     },
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => {
//         ctx.append("**");
//         ctx.append(char);
//       },
//     },
//   ],

//   potentialOrderedList: [
//     {
//       condition: /\d/,
//       action: (ctx, char) => ctx.append(char),
//     },
//     {
//       condition: ".",
//       next: "orderedListSpace",
//     },
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   orderedListSpace: [
//     {
//       condition: " ",
//       next: "orderedListContent",
//     },
//     {
//       condition: () => true,
//       next: "paragraph",
//       action: (ctx, char) => {
//         ctx.append(".");
//         ctx.append(char);
//       },
//     },
//   ],

//   orderedListContent: [
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx, char, buffer) => {
//         ctx.emit({ type: "list-item", ordered: true, content: buffer.trim() });
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   listItem: [
//     {
//       condition: "[",
//       next: "checkboxList",
//     },
//     {
//       condition: () => true,
//       next: "unorderedListContent",
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   checkboxList: [
//     {
//       condition: " ",
//       next: "checkboxUnchecked",
//     },
//     {
//       condition: "x",
//       next: "checkboxChecked",
//     },
//     {
//       condition: "X",
//       next: "checkboxChecked",
//     },
//     {
//       condition: () => true,
//       next: "unorderedListContent",
//       action: (ctx, char) => {
//         ctx.append("[");
//         ctx.append(char);
//       },
//     },
//   ],

//   checkboxUnchecked: [
//     {
//       condition: "]",
//       next: "checkboxContent",
//       action: (ctx) => {
//         ctx.indent = 0; // unchecked
//       },
//     },
//     {
//       condition: () => true,
//       next: "unorderedListContent",
//       action: (ctx, char) => {
//         ctx.append("[ ");
//         ctx.append(char);
//       },
//     },
//   ],

//   checkboxChecked: [
//     {
//       condition: "]",
//       next: "checkboxContent",
//       action: (ctx) => {
//         ctx.indent = 1; // checked
//       },
//     },
//     {
//       condition: () => true,
//       next: "unorderedListContent",
//       action: (ctx, char) => {
//         ctx.append("[x");
//         ctx.append(char);
//       },
//     },
//   ],

//   checkboxContent: [
//     {
//       condition: " ",
//     },
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx, char, buffer) => {
//         ctx.emit({
//           type: "list-item",
//           ordered: false,
//           checked: ctx.indent === 1,
//           content: buffer.trim(),
//         });
//         ctx.indent = 0;
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   unorderedListContent: [
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx, char, buffer) => {
//         ctx.emit({ type: "list-item", ordered: false, content: buffer.trim() });
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   paragraph: [
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx, char, buffer) => {
//         if (buffer.trim()) {
//           ctx.emit({ type: "paragraph", content: buffer.trim() });
//         }
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   // Table parsing states
//   tableRow: [
//     {
//       condition: "|",
//       action: (ctx, char, buffer) => {
//         ctx.tableCurrentRow.push(buffer.trim());
//       },
//     },
//     {
//       condition: /\n/,
//       next: "potentialTableSeparator",
//       action: (ctx, char, buffer) => {
//         // Add last cell
//         if (buffer.trim() || ctx.tableCurrentRow.length > 0) {
//           ctx.tableCurrentRow.push(buffer.trim());
//         }
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   potentialTableSeparator: [
//     {
//       condition: "|",
//       next: "tableSeparator",
//       action: (ctx) => {
//         // Previous row was headers
//         ctx.tableHeaders = [...ctx.tableCurrentRow];
//         ctx.tableCurrentRow = [];
//         ctx.tableAlignments = [];
//       },
//     },
//     {
//       condition: () => true,
//       next: "lineStart",
//       action: (ctx, char) => {
//         // Not a table, it was just a line with pipes
//         if (ctx.tableCurrentRow.length > 0) {
//           const content = ctx.tableCurrentRow.join(" | ");
//           ctx.emit({ type: "paragraph", content });
//           ctx.tableCurrentRow = [];
//           ctx.inTable = false;
//         }
//         ctx.append(char);
//       },
//     },
//   ],

//   tableSeparator: [
//     {
//       condition: "|",
//       action: (ctx, char, buffer) => {
//         // Parse alignment from separator (e.g., :---, :---:, ---:)
//         const trimmed = buffer.trim();
//         let alignment: "left" | "center" | "right" | null = null;
        
//         if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
//           alignment = "center";
//         } else if (trimmed.startsWith(":")) {
//           alignment = "left";
//         } else if (trimmed.endsWith(":")) {
//           alignment = "right";
//         }
        
//         ctx.tableAlignments.push(alignment);
//       },
//     },
//     {
//       condition: /\n/,
//       next: "tableDataRow",
//       action: (ctx, char, buffer) => {
//         // Add last alignment
//         const trimmed = buffer.trim();
//         let alignment: "left" | "center" | "right" | null = null;
        
//         if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
//           alignment = "center";
//         } else if (trimmed.startsWith(":")) {
//           alignment = "left";
//         } else if (trimmed.endsWith(":")) {
//           alignment = "right";
//         }
        
//         ctx.tableAlignments.push(alignment);
//         ctx.tableCurrentRow = [];
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],

//   tableDataRow: [
//     {
//       condition: "|",
//       next: "tableDataRowContent",
//     },
//     {
//       condition: /\n/,
//       next: "lineStart",
//       action: (ctx) => {
//         // Empty line ends table
//         if (ctx.tableHeaders.length > 0) {
//           ctx.emit({
//             type: "table",
//             headers: ctx.tableHeaders,
//             alignments: ctx.tableAlignments,
//             rows: [],
//           });
//           ctx.tableHeaders = [];
//           ctx.tableAlignments = [];
//           ctx.tableCurrentRow = [];
//           ctx.inTable = false;
//         }
//       },
//     },
//     {
//       condition: () => true,
//       next: "lineStart",
//       action: (ctx, char) => {
//         // Not a table row, end table
//         if (ctx.tableHeaders.length > 0) {
//           ctx.emit({
//             type: "table",
//             headers: ctx.tableHeaders,
//             alignments: ctx.tableAlignments,
//             rows: [],
//           });
//           ctx.tableHeaders = [];
//           ctx.tableAlignments = [];
//           ctx.tableCurrentRow = [];
//           ctx.inTable = false;
//         }
//         ctx.append(char);
//       },
//     },
//   ],

//   tableDataRowContent: [
//     {
//       condition: "|",
//       action: (ctx, char, buffer) => {
//         ctx.tableCurrentRow.push(buffer.trim());
//       },
//     },
//     {
//       condition: /\n/,
//       next: "tableDataRow",
//       action: (ctx, char, buffer) => {
//         // Add last cell and emit row
//         if (buffer.trim() || ctx.tableCurrentRow.length > 0) {
//           ctx.tableCurrentRow.push(buffer.trim());
//         }
        
//         // Emit the row as part of building the table
//         // We'll collect rows in a different way - actually let's just emit
//         // each row and then merge them later
//         ctx.emit({
//           type: "table",
//           headers: ctx.tableHeaders,
//           alignments: ctx.tableAlignments,
//           rows: [ctx.tableCurrentRow],
//         });
        
//         ctx.tableCurrentRow = [];
//       },
//     },
//     {
//       condition: () => true,
//       action: (ctx, char) => ctx.append(char),
//     },
//   ],
// };

// // ============================================================================
// // PASS 2: Inline-level lexer (processes content within blocks)
// // ============================================================================

// type InlineCtx = {
//   linkText: string;
//   linkHref: string;
//   linkTitle: string;
// };

// const inlineRules: StateRules<InlineCtx, InlineToken> = {
//   EOF: [
//     { 
//       condition: () => true, 
//       action: (ctx, char, buffer) => buffer.length > 0 && ctx.emit({ type: "text", value: buffer }) 
//     },
//   ],

//   text: [
//     { 
//       condition: "*", 
//       next: "italicOrBold",
//       action: (ctx, char, buffer) => buffer && ctx.emit({ type: "text", value: buffer }),
//     },
//     { condition: "`", next: "code" },
//     {
//       condition: "!",
//       next: "potentialImage",
//       action: (ctx, char, buffer) => buffer && ctx.emit({ type: "text", value: buffer }),
//     },
//     {
//       condition: "[",
//       next: "linkText",
//       action: (ctx, char, buffer) => buffer && ctx.emit({ type: "text", value: buffer }),
//     },
//     { condition: () => true, action: (ctx, char) => ctx.append(char) },
//   ],

//   italicOrBold: [
//     { condition: "*", next: "bold" },
//     { condition: () => true, next: "italic", action: (ctx, char) => ctx.append(char) },
//   ],


//   // Bold: **text**
//   bold: [
//     { condition: "*", next: "boldEnd" },
//     { condition: () => true, action: (ctx, char) => ctx.append(char) },
//   ],
//   boldEnd: [
//     { condition: "*", next: "text", action: (ctx, char, buffer) => ctx.emit({ type: "bold", value: buffer }) },
//     { condition: () => true, action: (ctx) => ctx.append("*"), next: "bold" },
//   ],

//   // Italic: *text*
//   italic: [
//     {
//       condition: "*",
//       next: "text",
//       action: (ctx, char, buffer) => ctx.emit({ type: "italic", value: buffer }),
//     },
//     { condition: () => true, action: (ctx, char) => ctx.append(char) },
//   ],

//   // Code: `code`
//   code: [
//     {
//       condition: "`",
//       next: "text",
//       action: (ctx, char, buffer) => ctx.emit({ type: "code", value: buffer }),
//     },
//     { condition: () => true, action: (ctx, char) => ctx.append(char) },
//   ],

//   // Image: ![alt](src)
//   potentialImage: [
//     {
//       condition: "[",
//       next: "imageAlt",
//     },
//     {
//       condition: () => true,
//       next: "text",
//       action: (ctx, char) => {
//         ctx.append("!");
//         ctx.append(char);
//       },
//     },
//   ],

//   imageAlt: [
//     {
//       condition: "]",
//       next: "imageSrcStart",
//       action: (ctx, char, buffer) => {
//         ctx.linkText = buffer;
//       },
//     },
//     { condition: () => true, action: (ctx, char) => ctx.append(char) },
//   ],

//   imageSrcStart: [
//     {
//       condition: "(",
//       next: "imageSrc",
//     },
//     {
//       condition: () => true,
//       next: "text",
//       action: (ctx, char) => {
//         ctx.append("![");
//         ctx.append(ctx.linkText);
//         ctx.append("]");
//         ctx.append(char);
//         ctx.linkText = "";
//       },
//     },
//   ],

//   imageSrc: [
//     {
//       condition: ")",
//       next: "text",
//       action: (ctx, char, buffer) => {
//         ctx.emit({ type: "image", alt: ctx.linkText, src: buffer });
//         ctx.linkText = "";
//       },
//     },
//     { condition: () => true, action: (ctx, char) => ctx.append(char) },
//   ],

//   // Link: [text](href)
//   linkText: [
//     {
//       condition: "]",
//       next: "linkHrefStart",
//       action: (ctx, char, buffer) => {
//         ctx.linkText = buffer;
//       },
//     },
//     { condition: () => true, action: (ctx, char) => ctx.append(char) },
//   ],

//   linkHrefStart: [
//     {
//       condition: "(",
//       next: "linkHref",
//     },
//     {
//       condition: () => true,
//       next: "text",
//       action: (ctx, char) => {
//         ctx.append("[");
//         ctx.append(ctx.linkText);
//         ctx.append("]");
//         ctx.append(char);
//         ctx.linkText = "";
//       },
//     },
//   ],

//   linkHref: [
//     {
//       condition: ")",
//       next: "text",
//       action: (ctx, char, buffer) => {
//         ctx.emit({ type: "link", text: ctx.linkText, href: buffer });
//         ctx.linkText = "";
//       },
//     },
//     { condition: () => true, action: (ctx, char) => ctx.append(char) },
//   ],
// };

// // ============================================================================
// // Public API
// // ============================================================================

// export function markdown(value: string): MarkdownToken[] {
//   // Pass 1: Block-level tokenization
//   const blockLexer = new Lexer<BlockCtx, BlockToken>(blockRules, "lineStart", {
//     indent: 0,
//     listLevel: 0,
//     codeLanguage: "",
//     inCodeBlock: false,
//     tableHeaders: [],
//     tableAlignments: [],
//     tableCurrentRow: [],
//     inTable: false,
//   });

//   const blockTokens = blockLexer.run(value + "\n");

//   // Merge consecutive table tokens into one
//   const mergedTokens: BlockToken[] = [];
//   let currentTable: BlockToken | null = null;

//   for (const token of blockTokens) {
//     if (token.type === "table") {
//       if (currentTable && currentTable.type === "table") {
//         // Merge rows
//         currentTable.rows.push(...token.rows);
//       } else {
//         currentTable = { ...token };
//         mergedTokens.push(currentTable);
//       }
//     } else {
//       currentTable = null;
//       mergedTokens.push(token);
//     }
//   }

//   // Pass 2: Inline tokenization for content-bearing blocks
//   const inlineLexer = (content: string): InlineToken[] => {
//     const lexer = new Lexer<InlineCtx, InlineToken>(inlineRules, "text", {
//       linkText: "",
//       linkHref: "",
//       linkTitle: "",
//     });
//     return lexer.run(content);
//   };

//   // Combine block and inline tokens
//   return mergedTokens.map((block) => {
//     if (block.type === "table") {
//       // Process inline content in table headers and cells
//       return {
//         ...block,
//         headers: block.headers.map((h) => h), // Could add inline processing here
//         rows: block.rows.map((row) => row.map((cell) => cell)), // Could add inline processing here
//       };
//     } else if ("content" in block && block.content) {
//       return { ...block, inline: inlineLexer(block.content) };
//     }
//     return block;
//   }) as MarkdownToken[];
// }