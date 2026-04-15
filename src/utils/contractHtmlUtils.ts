/**
 * Robust utility to clean contract HTML for display and PDF generation.
 * Strips all variable-related span wrappers, leaving only the inner text content.
 * Handles multiple attribute patterns that TipTap might generate.
 */
export function cleanContractHtml(html: string): string {
  let clean = html;

  // 1. Handle <span data-variable="key">{{key}}</span> (new VariableNode format)
  clean = clean.replace(
    /<span[^>]*data-variable\s*=\s*["'][^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_, inner) => stripInnerTags(inner)
  );

  // 2. Handle <span data-type="variable" ...>{{key}}</span> (legacy format)
  clean = clean.replace(
    /<span[^>]*data-type\s*=\s*["']variable["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_, inner) => stripInnerTags(inner)
  );

  // 3. Handle <span class="...contract-variable...">{{key}}</span> (legacy format)
  clean = clean.replace(
    /<span[^>]*class\s*=\s*["'][^"']*contract-variable[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_, inner) => stripInnerTags(inner)
  );

  // 4. Catch-all: any remaining span with variable-related attributes
  clean = clean.replace(
    /<span[^>]*(?:data-variable|data-type\s*=\s*["']variable["']|contract-variable)[^>]*>([\s\S]*?)<\/span>/gi,
    (_, inner) => stripInnerTags(inner)
  );

  // 5. Handle HTML-entity-encoded spans (sometimes TipTap or copy-paste escapes them)
  clean = clean.replace(
    /&lt;span[^&]*?(?:data-variable|data-type|contract-variable)[^&]*?&gt;([\s\S]*?)&lt;\/span&gt;/gi,
    (_, inner) => inner.replace(/&lt;[^&]*?&gt;/g, '').trim()
  );

  // 6. Remove raw {{variable}} leftover text patterns that look like code
  // (but keep the text content, just strip the braces if already substituted)

  // 7. Clean up stray &nbsp; entities
  clean = clean.replace(/&nbsp;/g, ' ');

  // 8. Remove any orphaned empty spans left behind
  clean = clean.replace(/<span[^>]*>\s*<\/span>/gi, '');

  return clean;
}

/**
 * Strip nested HTML tags from inner content, returning only text.
 */
function stripInnerTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Substitute {{variable}} placeholders with actual values.
 * Works on both raw {{key}} text and span-wrapped variables.
 */
export function substituteContractVariables(
  html: string,
  variableMap: Record<string, string>
): string {
  let result = html;

  // 1. Handle <span data-variable="key">{{key}}</span> (new format)
  result = result.replace(
    /<span[^>]*data-variable\s*=\s*["'](\w+)["'][^>]*>[\s\S]*?<\/span>/gi,
    (_, key) => variableMap[key] ?? `{{${key}}}`
  );

  // 2. Handle <span data-type="variable" ...>content</span> (legacy)
  result = result.replace(
    /<span[^>]*data-type\s*=\s*["']variable["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_, innerContent) => {
      const text = stripInnerTags(innerContent).replace(/&nbsp;/g, ' ').trim();
      const match = text.match(/^\{\{(\w+)\}\}$/);
      if (match) return variableMap[match[1]] ?? text;
      return stripInnerTags(innerContent);
    }
  );

  // 3. Handle <span class="...contract-variable...">content</span> (legacy)
  result = result.replace(
    /<span[^>]*class\s*=\s*["'][^"']*contract-variable[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_, innerContent) => {
      const text = stripInnerTags(innerContent).replace(/&nbsp;/g, ' ').trim();
      const match = text.match(/^\{\{(\w+)\}\}$/);
      if (match) return variableMap[match[1]] ?? text;
      return stripInnerTags(innerContent);
    }
  );

  // 4. Handle raw {{key}} not inside spans
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variableMap[key] ?? `{{${key}}}`;
  });

  // 5. Final cleanup: remove ANY remaining variable-related span wrappers
  result = result.replace(
    /<span[^>]*(?:data-variable|data-type\s*=\s*["']variable["']|contract-variable)[^>]*>([\s\S]*?)<\/span>/gi,
    (_, inner) => stripInnerTags(inner)
  );

  // 6. Handle entity-encoded spans
  result = result.replace(
    /&lt;span[^&]*?(?:data-variable|data-type|contract-variable)[^&]*?&gt;([\s\S]*?)&lt;\/span&gt;/gi,
    (_, inner) => inner.replace(/&lt;[^&]*?&gt;/g, '').trim()
  );

  // 7. Clean stray &nbsp;
  result = result.replace(/&nbsp;\s*/g, ' ');

  return result;
}
