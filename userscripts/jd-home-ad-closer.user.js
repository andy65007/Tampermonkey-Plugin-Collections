// ==UserScript==
// @name         京东首页全屏广告自动关闭
// @namespace    https://github.com/andy65007/Tampermonkey-Plugin-Collections
// @version      1.0.0
// @author       andy65007
// @description  打开京东首页时自动关闭 UMC 全屏广告。
// @homepageURL  https://github.com/andy65007/Tampermonkey-Plugin-Collections
// @supportURL   https://github.com/andy65007/Tampermonkey-Plugin-Collections/issues
// @downloadURL  https://raw.githubusercontent.com/andy65007/Tampermonkey-Plugin-Collections/main/userscripts/jd-home-ad-closer.user.js
// @updateURL    https://raw.githubusercontent.com/andy65007/Tampermonkey-Plugin-Collections/main/userscripts/jd-home-ad-closer.user.js
// @match        https://www.jd.com/*
// @match        https://jd.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  "use strict";

  const AD_SELECTOR = ".umc-equity";
  const CLOSE_SELECTOR = ".umc-equity-close-wrap";
  const STYLE_ID = "jd-home-ad-closer-style";
  const CLICK_MARK = "data-jd-home-ad-closer-clicked";

  const isJdHomePage = () =>
    (location.hostname === "www.jd.com" || location.hostname === "jd.com") &&
    (location.pathname === "/" || location.pathname === "/index.html");

  if (!isJdHomePage()) {
    return;
  }

  const ensureHidingStyle = () => {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const root = document.head || document.documentElement;
    if (!root) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `${AD_SELECTOR} { display: none !important; }`;
    root.appendChild(style);
  };

  const closeAd = () => {
    ensureHidingStyle();

    for (const ad of document.querySelectorAll(AD_SELECTOR)) {
      ad.style.setProperty("display", "none", "important");

      const closeControl =
        ad.querySelector(CLOSE_SELECTOR) || document.querySelector(CLOSE_SELECTOR);

      if (closeControl && !closeControl.hasAttribute(CLICK_MARK)) {
        closeControl.setAttribute(CLICK_MARK, "true");
        closeControl.click();
      }

      window.setTimeout(() => {
        if (ad.isConnected) {
          ad.remove();
        }
      }, 1200);
    }
  };

  let scanQueued = false;
  const queueScan = () => {
    if (scanQueued) {
      return;
    }

    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      closeAd();
    });
  };

  const observer = new MutationObserver(queueScan);
  observer.observe(document, { childList: true, subtree: true });

  document.addEventListener("DOMContentLoaded", queueScan, { once: true });
  window.setInterval(queueScan, 500);
  queueScan();
})();
