/**
 * classify.js
 * Image classification functions for SmartSync
 */

// Trusted domains for callable check
const trustedDomains = ['images.unsplash.com', 'cdn.shopify.com'];

// Valid image file extensions
const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];

/**
 * Check if the URL is a properly structured, callable image URL
 */
export async function isCallable(imageUrl) {
  const logs = [];
  const result = { ok: false, class: 1, reason: '', logs };

  if (!imageUrl || typeof imageUrl !== 'string') {
    result.reason = 'No image URL provided';
    result.class = 5;
    logs.push(result.reason);
    return result;
  }

  let url;
  try {
    url = new URL(imageUrl);
  } catch (err) {
    result.reason = 'Invalid URL object';
    result.class = 5;
    logs.push(result.reason);
    return result;
  }

  if (!['https:'].includes(url.protocol)) {
    result.reason = 'Invalid protocol: must be HTTPS';
    result.class = 5;
    logs.push(result.reason);
    return result;
  }

  if (!trustedDomains.includes(url.hostname)) {
    logs.push(`Domain ${url.hostname} is not trusted, attempting HEAD/GET request`);
    try {
      const headRes = await fetch(imageUrl, { method: 'HEAD' });
      if (headRes.ok) {
        result.ok = true;
        result.reason = 'HEAD request succeeded';
        return result;
      } else if (headRes.status === 405) {
        const getRes = await fetch(imageUrl, { method: 'GET' });
        if (getRes.ok) {
          result.ok = true;
          result.reason = 'GET request succeeded';
          return result;
        }
        result.reason = 'GET request failed after 405';
        result.class = 5;
        return result;
      } else {
        result.reason = `HEAD failed with status ${headRes.status}`;
        result.class = 5;
        return result;
      }
    } catch (e) {
      result.reason = `Fetch failed: ${e.message}`;
      result.class = 5;
      return result;
    }
  }

  const ext = url.pathname.split('.').pop().toLowerCase();
  if (!validExtensions.includes(ext)) {
    result.reason = `Invalid extension: .${ext}`;
    result.class = 5;
    logs.push(result.reason);
    return result;
  }

  result.ok = true;
  result.reason = 'Trusted domain and valid extension';
  return result;
}

/**
 * Check if the image is from a Wix source
 */
export function isWix(imageUrl) {
  const logs = [];
  const result = { ok: false, class: 2, reason: '', logs };

  if (!imageUrl || typeof imageUrl !== 'string') {
    result.reason = 'No image URL provided';
    logs.push(result.reason);
    return result;
  }

  const patterns = ['wix:image://', 'wix:document://', 'static.wixstatic.com', 'wixmp-'];
  const matched = patterns.some(p => imageUrl.includes(p));

  if (matched) {
    result.ok = true;
    result.reason = 'Matches Wix media pattern';
  } else {
    result.reason = 'Does not match any Wix pattern';
  }

  return result;
}

/**
 * Check if the image path is local
 */
export function isLocal(imagePath) {
  const logs = [];
  const result = { ok: false, class: 3, reason: '', logs };

  if (!imagePath || typeof imagePath !== 'string') {
    result.reason = 'No path provided';
    logs.push(result.reason);
    return result;
  }

  const trimmed = imagePath.trim();
  if (/^(https?:|wix:)/.test(trimmed)) {
    result.reason = 'URL has protocol — not local';
    logs.push(result.reason);
    return result;
  }

  const driveLetter = /^[A-Za-z]:/.test(trimmed);
  const hasExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
    .some(ext => trimmed.toLowerCase().endsWith('.' + ext));

  if (driveLetter || hasExt) {
    result.ok = true;
    result.reason = 'Looks like local path';
  } else {
    result.reason = 'No drive letter or known extension';
  }

  return result;
}

/**
 * Check if image is empty
 */
export function isEmpty(imageUrl) {
  const result = {
    ok: false,
    class: 4,
    reason: '',
    logs: []
  };

  if (!imageUrl || imageUrl.trim() === '') {
    result.ok = true;
    result.reason = 'Image URL is empty';
  } else {
    result.reason = 'Image URL is not empty';
  }

  return result;
}

/**
 * Final fallback for uncategorized cases
 */
export function isNotCallable(imageUrl) {
  return {
    ok: true,
    class: 5,
    reason: 'Falls through all cases – Not Callable',
    logs: []
  };
}