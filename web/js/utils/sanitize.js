// Lightweight HTML sanitizer for Civicomfy.
//
// Civitai model/version descriptions are rich HTML (paragraphs, bold, links,
// images) that we want to render, but they originate from untrusted, user-
// authored model pages. Rendering them raw via innerHTML is a stored-XSS
// vector. This sanitizer keeps safe formatting markup while stripping anything
// that can execute script or load active content.

// Elements removed entirely (including their contents).
const FORBIDDEN_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META',
  'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'NOSCRIPT',
]);

// Attributes allowed on surviving elements. Everything else (notably every
// on* event handler, style, srcdoc, formaction, etc.) is dropped.
const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'width', 'height', 'target', 'rel',
  'colspan', 'rowspan', 'class',
]);

// Attributes whose value is a URL — only safe schemes are permitted.
const URL_ATTRS = new Set(['href', 'src']);

function isSafeUrl(value) {
  const v = String(value).trim();
  // Reject javascript:, data: (except images), vbscript:, etc. Allow relative
  // URLs, http(s), mailto, and inline image data URIs.
  if (/^\s*(javascript|vbscript)\s*:/i.test(v)) return false;
  if (/^\s*data\s*:/i.test(v)) return /^\s*data:image\//i.test(v);
  return true;
}

/**
 * Sanitize an untrusted HTML string into safe HTML.
 * @param {string} html
 * @returns {string} sanitized HTML, safe to assign to innerHTML
 */
export function sanitizeHtml(html) {
  if (html == null || html === '') return '';

  // Parse without executing: <template> content is an inert document fragment,
  // so no <img>/<script> side effects fire during parsing.
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html);

  const walk = (node) => {
    // Iterate over a static copy since we mutate the tree.
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName;
        if (FORBIDDEN_TAGS.has(tag)) {
          child.remove();
          continue;
        }
        // Strip disallowed / dangerous attributes.
        for (const attr of Array.from(child.attributes)) {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) {
            child.removeAttribute(attr.name);
          } else if (URL_ATTRS.has(name) && !isSafeUrl(attr.value)) {
            child.removeAttribute(attr.name);
          }
        }
        // Harden links that open a new tab.
        if (child.tagName === 'A' && child.getAttribute('target') === '_blank') {
          child.setAttribute('rel', 'noopener noreferrer');
        }
        walk(child);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
      }
    }
  };

  walk(tpl.content);
  return tpl.innerHTML;
}
