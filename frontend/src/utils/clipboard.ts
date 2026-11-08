/**
 * OrbitGuard Cross-Platform Clipboard Copy Utility
 * Provides multi-tier fallback for Electron desktop, standard HTTPS, and headless/restricted contexts.
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  // 1. Try modern asynchronous Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText rejected, attempting fallback:', err);
    }
  }

  // 2. Fallback using legacy document.execCommand('copy') with hidden textarea
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) return true;
    } catch (err) {
      console.warn('[Clipboard] execCommand fallback failed:', err);
    }
  }

  return false;
}
