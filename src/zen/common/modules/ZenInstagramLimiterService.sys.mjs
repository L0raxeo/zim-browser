// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const DEFAULT_DAILY_LIMIT = 5;
const EST_OFFSET_MINUTES = -5 * 60;
const RESET_HOUR = 23;
const RESET_MINUTE = 59;

const COUNT_PREF = "zen.instagram-limiter.count";
const NEXT_RESET_PREF = "zen.instagram-limiter.next-reset";

const approvedBrowserIds = new Set();
const instagramBrowserIds = new Set();

function computeNextResetTimestamp(nowMs = Date.now()) {
  const now = new Date(nowMs);
  const estTime = new Date(
    now.getTime() + (EST_OFFSET_MINUTES + now.getTimezoneOffset()) * 60000
  );
  const nextReset = new Date(estTime);
  nextReset.setHours(RESET_HOUR, RESET_MINUTE, 0, 0);
  if (estTime >= nextReset) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  const localNextReset = new Date(
    nextReset.getTime() - (EST_OFFSET_MINUTES + now.getTimezoneOffset()) * 60000
  );
  return localNextReset.getTime();
}

function normalizeCount(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_DAILY_LIMIT;
  }
  if (value < 0) {
    return 0;
  }
  if (value > DEFAULT_DAILY_LIMIT) {
    return DEFAULT_DAILY_LIMIT;
  }
  return value;
}

function readCount() {
  const stored = Services.prefs.getIntPref(COUNT_PREF, DEFAULT_DAILY_LIMIT);
  return normalizeCount(stored);
}

function writeCount(count) {
  Services.prefs.setIntPref(COUNT_PREF, normalizeCount(count));
}

function readNextReset() {
  const raw = Services.prefs.getStringPref(NEXT_RESET_PREF, "");
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : 0;
}

function writeNextReset(timestamp) {
  Services.prefs.setStringPref(NEXT_RESET_PREF, String(Math.trunc(timestamp)));
}

function resetDaily(nowMs = Date.now()) {
  const nextReset = computeNextResetTimestamp(nowMs);
  writeCount(DEFAULT_DAILY_LIMIT);
  writeNextReset(nextReset);
  approvedBrowserIds.clear();
  instagramBrowserIds.clear();
}

function ensureDailyReset() {
  const now = Date.now();
  const nextReset = readNextReset();
  if (!nextReset || now >= nextReset) {
    resetDaily(now);
    return;
  }

  const storedCount = Services.prefs.getIntPref(COUNT_PREF, DEFAULT_DAILY_LIMIT);
  const normalizedCount = normalizeCount(storedCount);
  if (!Services.prefs.prefHasUserValue(COUNT_PREF) || storedCount !== normalizedCount) {
    writeCount(normalizedCount);
  }
  if (!Services.prefs.prefHasUserValue(NEXT_RESET_PREF)) {
    writeNextReset(nextReset);
  }
}

function normalizeBrowserId(browserId) {
  return Number.isFinite(browserId) ? browserId : null;
}

export const ZenInstagramLimiterService = {
  ensureInitialized() {
    ensureDailyReset();
  },

  getRemainingCount() {
    ensureDailyReset();
    return readCount();
  },

  consumeCount() {
    ensureDailyReset();
    const count = readCount();
    if (count <= 0) {
      return { success: false, newCount: 0 };
    }
    const newCount = count - 1;
    writeCount(newCount);
    return { success: true, newCount };
  },

  approveBrowserId(browserId) {
    ensureDailyReset();
    const normalizedId = normalizeBrowserId(browserId);
    if (normalizedId === null) {
      return { success: false, newCount: readCount() };
    }
    const count = readCount();
    if (count <= 0) {
      return { success: false, newCount: 0 };
    }
    const newCount = count - 1;
    writeCount(newCount);
    approvedBrowserIds.add(normalizedId);
    return { success: true, newCount };
  },

  consumeApproval(browserId) {
    ensureDailyReset();
    const normalizedId = normalizeBrowserId(browserId);
    if (normalizedId === null) {
      return false;
    }
    if (!approvedBrowserIds.has(normalizedId)) {
      return false;
    }
    approvedBrowserIds.delete(normalizedId);
    return true;
  },

  markInstagramBrowserId(browserId) {
    const normalizedId = normalizeBrowserId(browserId);
    if (normalizedId === null) {
      return;
    }
    instagramBrowserIds.add(normalizedId);
  },

  isInstagramBrowserId(browserId) {
    const normalizedId = normalizeBrowserId(browserId);
    return normalizedId !== null && instagramBrowserIds.has(normalizedId);
  },

  clearInstagramBrowserId(browserId) {
    const normalizedId = normalizeBrowserId(browserId);
    if (normalizedId === null) {
      return;
    }
    instagramBrowserIds.delete(normalizedId);
  },

  clearBrowserId(browserId) {
    const normalizedId = normalizeBrowserId(browserId);
    if (normalizedId === null) {
      return;
    }
    approvedBrowserIds.delete(normalizedId);
    instagramBrowserIds.delete(normalizedId);
  },
};
