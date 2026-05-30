// Lightweight cookie helpers for Civicomfy UI
// Exports: setCookie, getCookie

export function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  // Encode the value so characters like ';', ',' or whitespace (common in
  // JSON-serialized settings and free-text API keys/tokens) don't truncate or
  // corrupt the cookie.
  document.cookie = `${name}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name) {
  const nameEQ = name + "=";
  const parts = document.cookie.split(";");
  for (let i = 0; i < parts.length; i++) {
    let c = parts[i];
    while (c.charAt(0) === " ") c = c.substring(1);
    if (c.indexOf(nameEQ) === 0) {
      const raw = c.substring(nameEQ.length);
      try {
        return decodeURIComponent(raw);
      } catch (_) {
        // Value was stored before encoding was introduced, or is malformed.
        return raw;
      }
    }
  }
  return null;
}

