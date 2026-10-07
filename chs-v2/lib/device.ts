// A stable, anonymous identifier for THIS browser or phone, kept on the device itself. CHS uses it to notice when an account is opened
// from a device it has not seen before — a common sign that someone else has the login — and to ask for extra confirmation then.
export function getDeviceId(): string {
  try {
    const key = "chs_device_id";
    let id = localStorage.getItem(key);
    if (!id || id.length < 10) {
      id = "dev-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "dev-unknown-" + Math.random().toString(36).slice(2, 12); // storage blocked: each visit looks like a new device, which is the safe side
  }
}

// A short human description shown in "new device signed in" alerts, e.g. "Chrome on Android".
export function describeDevice(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "an unknown device";
  return `${browser} on ${os}`;
}
