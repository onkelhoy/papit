import { Lexer, StateRules } from "./lexer";

type CTX = {
  attrName: string;
  attrValue: string;
  attributes: Record<string, string | true>;
  selfClosing: boolean;
}
export type HtmlToken =
  | { type: "text"; value: string }
  | { type: "doctype"; value: string }
  | { type: "comment"; value: string }
  | { type: "startTag"; name: string; attributes: Record<string, string | true>; selfClosing: boolean }
  | { type: "endTag"; name: string };

const htmlRules: StateRules<CTX, HtmlToken> = {
  EOF: [
    { condition: () => true, action: (ctx, char, buffer) => buffer.length > 0 && ctx.emit({ type: "text", value: buffer }) },
  ],

  data: [
    { condition: "<", next: "tagOpen", action: (ctx, char, buffer) => buffer.length > 0 && ctx.emit({ type: "text", value: buffer }) },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  tagOpen: [
    { condition: "/", next: "endTagOpen" },
    { condition: "!", next: "markupDeclarationOpen" },
    { condition: () => true, next: "tagName", action: (ctx, char) => ctx.append(char) },
  ],

  endTagOpen: [
    { condition: /\s/, action: () => { } },
    { condition: () => true, next: "endTagName", action: (ctx, char) => ctx.append(char) },
  ],

  endTagName: [
    { condition: /\s/, action: () => { } },
    { condition: ">", next: "data", action: (ctx, char, buffer) => { ctx.emit({ type: "endTag", name: buffer }); } },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  markupDeclarationOpen: [
    { condition: "-", next: "comment" },
    { condition: () => true, next: "doctype", action: (ctx, char) => ctx.append(char) },
  ],

  comment: [
    {
      condition: ">",
      next: "data",
      action: (ctx, char, buffer) => { ctx.emit({ type: "comment", value: buffer.replace(/^\<?!?-?-?/, '').replace(/-?-?\>?$/, '').trim() }); }
    },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  doctype: [
    {
      condition: ">",
      next: "data",
      action: (ctx, char, buffer) => { ctx.emit({ type: "doctype", value: buffer.replace(/^doctype ?/i, '').trim() }); }
    },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  tagName: [
    { condition: /\s/, next: "beforeAttributeName" },
    { condition: "/", next: "selfClosingStartTag", action: (ctx) => ctx.selfClosing = true },
    {
      condition: ">",
      next: "data",
      action: (ctx, char, buffer) => {
        ctx.emit({ type: "startTag", name: buffer, attributes: ctx.attributes, selfClosing: ctx.selfClosing });
        ctx.attributes = {};
        ctx.selfClosing = false;
      }
    },
    { condition: () => true, action: (ctx, char) => ctx.append(char) },
  ],

  beforeAttributeName: [
    { condition: /\s/, action: () => { } },
    { condition: "/", next: "selfClosingStartTag", action: (ctx) => ctx.selfClosing = true },
    {
      condition: ">",
      next: "data",
      action: (ctx, char, buffer) => {
        ctx.emit({ type: "startTag", name: buffer, attributes: ctx.attributes, selfClosing: ctx.selfClosing });
        ctx.attributes = {};
        ctx.selfClosing = false;
      }
    },
    { condition: () => true, next: "attributeName", action: (ctx, char) => ctx.attrName = char! },
  ],

  attributeName: [
    {
      condition: /\s/,
      next: "beforeAttributeName",
      action: (ctx) => {
        ctx.attributes[ctx.attrName] = ctx.attrValue || true;
        ctx.attrName = "";
        ctx.attrValue = "";
      }
    },
    { condition: "=", next: "beforeAttributeValue" },
    {
      condition: ">",
      next: "data",
      action: (ctx, char, buffer) => {
        ctx.attributes[ctx.attrName] = ctx.attrValue || true;
        ctx.emit({ type: "startTag", name: buffer, attributes: ctx.attributes, selfClosing: ctx.selfClosing });
        ctx.attrName = "";
        ctx.attrValue = "";
        ctx.attributes = {};
        ctx.selfClosing = false;
      }
    },
    { condition: () => true, action: (ctx, char) => ctx.attrName += char },
  ],

  beforeAttributeValue: [
    { condition: /\s/, action: () => { } },
    { condition: '"', next: "attributeValueDouble" },
    { condition: "'", next: "attributeValueSingle" },
    { condition: () => true, next: "attributeValueUnquoted", action: (ctx, char) => ctx.attrValue = char! },
  ],

  attributeValueDouble: [
    {
      condition: '"',
      next: "beforeAttributeName",
      action: (ctx) => {
        ctx.attributes[ctx.attrName] = ctx.attrValue;
        ctx.attrName = "";
        ctx.attrValue = "";
      }
    },
    { condition: () => true, action: (ctx, char) => ctx.attrValue += char },
  ],

  attributeValueSingle: [
    {
      condition: "'",
      next: "beforeAttributeName",
      action: (ctx) => {
        ctx.attributes[ctx.attrName] = ctx.attrValue;
        ctx.attrName = "";
        ctx.attrValue = "";
      }
    },
    { condition: () => true, action: (ctx, char) => ctx.attrValue += char },
  ],

  attributeValueUnquoted: [
    {
      condition: /\s/,
      next: "beforeAttributeName",
      action: (ctx) => {
        ctx.attributes[ctx.attrName] = ctx.attrValue;
        ctx.attrName = "";
        ctx.attrValue = "";
      }
    },
    {
      condition: ">",
      next: "data",
      action: (ctx, char, buffer) => {
        ctx.attributes[ctx.attrName] = ctx.attrValue;
        ctx.emit({ type: "startTag", name: buffer, attributes: ctx.attributes, selfClosing: ctx.selfClosing });
        ctx.attrName = "";
        ctx.attrValue = "";
        ctx.attributes = {};
        ctx.selfClosing = false;
      }
    },
    { condition: () => true, action: (ctx, char) => ctx.attrValue += char },
  ],

  selfClosingStartTag: [
    {
      condition: ">",
      next: "data",
      action: (ctx, char, buffer) => {
        ctx.emit({ type: "startTag", name: buffer, attributes: ctx.attributes, selfClosing: ctx.selfClosing });
        ctx.attributes = {};
        ctx.selfClosing = false;
      }
    },
  ],
};

// Run the lexer
export function html(value: string) {
  const lexer = new Lexer<CTX, HtmlToken>(
    htmlRules,
    "data",
    {
      attrName: "",
      attrValue: "",
      attributes: {},
      selfClosing: false,
    },
  );

  return lexer.run(value);
}
