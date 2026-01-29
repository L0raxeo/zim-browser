// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const EDITABLE_SELECTOR =
  "input, textarea, [contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']";
const NAVIGATION_SELECTOR =
  "#navigation-button-down, #navigation-button-up, ytd-reel-video-navigation-renderer, ytd-shorts-video-navigation-renderer";
const NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Down", "Up"]);

export class ZenYouTubeShortsLimiterChild extends JSWindowActorChild {
  #allowedShortsPath = null;
  #historyGuardInstalled = false;
  #wasOnShorts = false;

  handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === "function") {
      handler.call(this, event);
    }
  }

  on_DOMContentLoaded() {
    this.#updateShortsState();
  }

  on_wheel(event) {
    this.#blockScrollEvent(event);
  }

  on_touchmove(event) {
    this.#blockScrollEvent(event);
  }

  on_click(event) {
    this.#blockNavigationClick(event);
  }

  on_keydown(event) {
    this.#blockNavigationKey(event);
  }

  #blockScrollEvent(event) {
    this.#updateShortsState();
    if (event.defaultPrevented) {
      return;
    }
    if (!this.#isShortsPage()) {
      return;
    }
    if (this.#isEditableTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  #blockNavigationClick(event) {
    this.#updateShortsState();
    if (event.defaultPrevented) {
      return;
    }
    if (!this.#isShortsPage()) {
      return;
    }
    if (this.#isEditableTarget(event.target)) {
      return;
    }
    if (!this.#isNavigationControl(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  #blockNavigationKey(event) {
    this.#updateShortsState();
    if (event.defaultPrevented) {
      return;
    }
    if (!this.#isShortsPage()) {
      return;
    }
    if (this.#isEditableTarget(event.target)) {
      return;
    }
    if (!NAVIGATION_KEYS.has(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  #isShortsPage() {
    const location = this.contentWindow?.location;
    if (!location) {
      return false;
    }

    const host = location.hostname;
    if (!this.#isAllowedHost(host)) {
      return false;
    }

    const path = location.pathname || "";
    return path === "/shorts" || path.startsWith("/shorts/");
  }

  #isAllowedHost(host) {
    return host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com";
  }

  #isEditableTarget(target) {
    return Boolean(target?.closest?.(EDITABLE_SELECTOR));
  }

  #isNavigationControl(target) {
    if (!target?.closest) {
      return false;
    }

    if (target.closest("#navigation-button-down, #navigation-button-up")) {
      return true;
    }

    const container = target.closest(NAVIGATION_SELECTOR);
    if (!container) {
      return false;
    }

    const button = target.closest("button, [role='button']");
    return Boolean(button && container.contains(button));
  }

  #updateShortsState() {
    const isShorts = this.#isShortsPage();
    if (isShorts && !this.#wasOnShorts) {
      this.#allowedShortsPath = this.contentWindow?.location?.pathname ?? null;
      this.#installHistoryGuard();
    }
    if (!isShorts && this.#wasOnShorts) {
      this.#allowedShortsPath = null;
    }
    this.#wasOnShorts = isShorts;
  }

  #installHistoryGuard() {
    if (this.#historyGuardInstalled) {
      return;
    }
    const win = this.contentWindow;
    if (!win?.history) {
      return;
    }

    const originalPushState = win.history.pushState.bind(win.history);
    const originalReplaceState = win.history.replaceState.bind(win.history);

    const shouldBlock = (url) => this.#shouldBlockShortsNavigation(url);

    win.history.pushState = (...args) => {
      if (shouldBlock(args[2])) {
        return undefined;
      }
      return originalPushState(...args);
    };

    win.history.replaceState = (...args) => {
      if (shouldBlock(args[2])) {
        return undefined;
      }
      return originalReplaceState(...args);
    };

    this.#historyGuardInstalled = true;
  }

  #shouldBlockShortsNavigation(url) {
    if (!this.#allowedShortsPath) {
      return false;
    }
    const resolved = this.#resolveUrl(url);
    if (!resolved) {
      return false;
    }
    if (!this.#isAllowedHost(resolved.hostname)) {
      return false;
    }
    if (!resolved.pathname.startsWith("/shorts")) {
      return false;
    }
    return resolved.pathname !== this.#allowedShortsPath;
  }

  #resolveUrl(url) {
    if (!url || typeof url !== "string") {
      return null;
    }
    try {
      return new URL(url, this.contentWindow?.location?.href);
    } catch (error) {
      return null;
    }
  }
}
