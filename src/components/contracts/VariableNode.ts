import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Custom TipTap Node for contract variables.
 * Renders as an inline non-editable chip: {{key}}
 * Serializes to <span data-variable="key" class="contract-variable">{{key}}</span>
 * This ensures attributes are preserved during getHTML() serialization.
 */
export const VariableNode = Node.create({
  name: 'contractVariable',
  group: 'inline',
  inline: true,
  atom: true, // non-editable, treated as a single unit

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (el) => {
          // Try data-variable first, then extract from text content
          const attr = el.getAttribute('data-variable');
          if (attr) return attr;
          const text = el.textContent || '';
          const match = text.match(/\{\{(\w+)\}\}/);
          return match ? match[1] : null;
        },
        renderHTML: (attrs) => ({ 'data-variable': attrs.key }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable]',
      },
      {
        tag: 'span[data-type="variable"]',
        getAttrs: (el) => {
          if (typeof el === 'string') return false;
          const text = el.textContent || '';
          const match = text.match(/\{\{(\w+)\}\}/);
          return match ? { key: match[1] } : false;
        },
      },
      {
        tag: 'span.contract-variable',
        getAttrs: (el) => {
          if (typeof el === 'string') return false;
          const text = el.textContent || '';
          const match = text.match(/\{\{(\w+)\}\}/);
          return match ? { key: match[1] } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const key = HTMLAttributes['data-variable'] || '';
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'contract-variable' }),
      `{{${key}}}`,
    ];
  },

  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },
});
