// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenInstagramLimiterService } from "chrome://browser/content/zen-components/ZenInstagramLimiterService.sys.mjs";

export class ZenInstagramLimiterParent extends JSWindowActorParent {
  receiveMessage(message) {
    switch (message.name) {
      case "ZenInstagramLimiter:GetCount":
        return ZenInstagramLimiterService.getRemainingCount();
      case "ZenInstagramLimiter:ApproveAndNavigate": {
        const window = this.browsingContext?.topChromeWindow;
        const browser = this.browsingContext?.top?.embedderElement ?? window?.gBrowser?.selectedBrowser;
        if (!window?.gZenInstagramLimiter) {
          return { success: false, newCount: ZenInstagramLimiterService.getRemainingCount() };
        }
        return window.gZenInstagramLimiter.approveAndNavigate(browser, message.data?.targetUrl);
      }
      default:
        return undefined;
    }
  }
}
