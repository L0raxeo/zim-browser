// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenPreloadedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";
import { ZenInstagramLimiterService } from "chrome://browser/content/zen-components/ZenInstagramLimiterService.sys.mjs";

const INTERSTITIAL_URL = "chrome://browser/content/zen-components/instagram-limiter.html";

class ZenInstagramLimiter extends nsZenPreloadedFeature {
  #progressListener = null;
  #tabCloseListener = null;
  #hasAttached = false;
  #allowOnce = new WeakSet();
  #allowInstagram = new WeakSet();

  init() {
    ZenInstagramLimiterService.ensureInitialized();
    if (window.gBrowser && typeof gBrowser.addTabsProgressListener === "function") {
      this.#attachListeners();
      return;
    }
    window.addEventListener(
      "load",
      () => {
        this.#attachListeners();
      },
      { once: true }
    );
  }

  #attachListeners() {
    if (this.#hasAttached || !window.gBrowser) {
      return;
    }
    this.#hasAttached = true;

    this.#progressListener = {
      onLocationChange: this.#onLocationChange.bind(this),
    };

    gBrowser.addTabsProgressListener(this.#progressListener);

    this.#tabCloseListener = this.#handleTabClose.bind(this);
    window.addEventListener("TabClose", this.#tabCloseListener);

    window.addEventListener(
      "unload",
      () => {
        this.#cleanup();
      },
      { once: true }
    );
  }

  #cleanup() {
    if (this.#progressListener) {
      gBrowser.removeTabsProgressListener(this.#progressListener);
      this.#progressListener = null;
    }
    if (this.#tabCloseListener) {
      window.removeEventListener("TabClose", this.#tabCloseListener);
      this.#tabCloseListener = null;
    }
  }

  #handleTabClose(event) {
    const tab = event.target;
    const browser = tab?.linkedBrowser;
    if (!browser) {
      return;
    }
    this.#allowOnce.delete(browser);
    this.#allowInstagram.delete(browser);
  }

  #onLocationChange(browser, webProgress, _request, location) {
    if (!browser || !location) {
      return;
    }
    if (webProgress && !webProgress.isTopLevel) {
      return;
    }

    const spec = location.spec;
    const isInstagram = this.#isInstagramUrl(spec);

    if (!isInstagram) {
      if (this.#allowInstagram.has(browser)) {
        this.#allowInstagram.delete(browser);
      }
      return;
    }

    if (this.#allowOnce.has(browser)) {
      this.#allowOnce.delete(browser);
      this.#allowInstagram.add(browser);
      return;
    }

    if (this.#allowInstagram.has(browser)) {
      return;
    }

    this.#openInterstitial(browser, spec);
  }

  #openInterstitial(browser, targetUrl) {
    const url = `${INTERSTITIAL_URL}?target=${encodeURIComponent(targetUrl)}`;
    const uri = Services.io.newURI(url);
    browser.loadURI(uri, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      loadFlags: Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY,
    });
  }

  #isInstagramUrl(spec) {
    try {
      const uri = Services.io.newURI(spec);
      if (uri.scheme !== "http" && uri.scheme !== "https") {
        return false;
      }
      const host = uri.host;
      return host === "instagram.com" || host.endsWith(".instagram.com");
    } catch (error) {
      return false;
    }
  }

  approveAndNavigate(browser, targetUrl) {
    if (!browser || !targetUrl) {
      return { success: false, newCount: ZenInstagramLimiterService.getRemainingCount() };
    }

    const result = ZenInstagramLimiterService.consumeCount();
    if (!result.success) {
      return result;
    }

    this.#allowOnce.add(browser);
    const uri = Services.io.newURI(targetUrl);
    browser.loadURI(uri, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      loadFlags: Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY,
    });

    return result;
  }
}

window.gZenInstagramLimiter = new ZenInstagramLimiter();
