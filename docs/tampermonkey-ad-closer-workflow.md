# 通用网页首页广告关闭脚本开发流程

本流程适用于为 Tampermonkey 开发站点首页广告自动关闭脚本。核心原则是：先确认广告
根节点和网站自己的关闭回调，再写最小的自动化逻辑；不能只凭“看起来像关闭按钮”就
进行页面操作。

## 1. 明确范围和风险边界

开始前写清楚脚本负责什么：

- 适用域名和路径，例如仅 `https://www.example.com/` 首页。
- 目标元素特征，例如全屏固定定位、特定广告容器、特定关闭控件。
- 不处理的对象，例如登录、验证码、Cookie 同意、支付确认、安全警告。

广告脚本不应自动接受协议、登录账号、提交表单、绕过验证，或关闭影响安全和用户知情
权的对话框。自动关闭只应作用于明确的商业广告遮罩。

## 2. 用独立调试浏览器复现

启动一个使用临时 profile 的 Chrome，避免污染日常浏览器：

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  '--remote-debugging-port=9222' `
  '--remote-debugging-address=127.0.0.1' `
  '--user-data-dir=C:\temp\userscript-debug' `
  '--no-first-run' `
  'https://www.example.com/'
```

打开 DevTools，完成以下观察：

- 广告出现的时间点和持续时间。
- 是否由异步请求、首屏脚本或 A/B 实验触发。
- 广告是否位于 iframe 或 Shadow DOM 内。
- 广告出现时页面的滚动和点击是否被锁定。
- 关闭后页面是否恢复 `overflow`、焦点和事件监听。

如广告出现频率受 Cookie 控制，可使用新的 `--user-data-dir` 重新复现。不要为了测试
而删除用户的长期浏览器数据。

## 3. 识别广告根节点

使用“覆盖视口面积 + 定位方式 + z-index”筛选遮罩，而不是全页面搜索 Close：

```js
(() => {
  const viewportArea = innerWidth * innerHeight;

  return [...document.querySelectorAll("body *")]
    .map((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        element,
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className:
          typeof element.className === "string" ? element.className : "",
        position: style.position,
        zIndex: style.zIndex,
        rect: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        areaRatio: (rect.width * rect.height) / viewportArea,
      };
    })
    .filter(
      (item) =>
        ["fixed", "absolute"].includes(item.position) &&
        item.areaRatio >= 0.5,
    );
})();
```

记录稳定的识别依据：

- 广告专用 id 或 class。
- `role="dialog"`、`aria-modal`、`data-*` 等稳定属性。
- 根节点的固定定位、高 z-index 和接近 100% 视口覆盖。
- 广告内部的品牌、倒计时或关闭文本，仅作为辅助判断。

动态哈希 class、图片 URL、绝对 DOM 层级和随机 id 不应作为唯一选择器。

## 4. 确认真正的事件目标

在 Elements 面板选中候选关闭节点后，在 Console 运行：

```js
getEventListeners($0);
```

或在 CDP / DevTools Protocol 中使用：

```js
DOMDebugger.getEventListeners({
  objectId: remoteObjectId,
  depth: 1,
  pierce: true,
});
```

需要检查：

- 事件监听是否直接位于候选按钮、其父元素或更上层容器。
- 点击是否依赖事件冒泡或捕获阶段。
- 关闭动作是直接移除 DOM，还是触发 React/Vue 状态更新、动画和清理回调。
- 关闭控件是否与倒计时共用处理器。

如果事件绑定在子节点，但脚本点击父节点，浏览器事件不会向下冒泡到子节点，关闭可能
不会发生。反之，点击子节点通常会冒泡到父级处理器。优先选择“真实处理器所在节点”，
或在证据充分时选择事件链上的子节点。

## 5. 先手动验证关闭，再自动化

广告实际出现时执行：

```js
(() => {
  const ad = document.querySelector("广告根选择器");
  const closeControl = ad?.querySelector("关闭事件目标选择器");

  if (!ad || !closeControl) {
    return { clicked: false };
  }

  closeControl.click();
  return { clicked: true };
})();
```

等待至少一个关闭动画周期并观察：

- 广告是否消失。
- 页面滚动是否恢复。
- 是否出现登录、下载或其他必须由用户确认的弹窗。
- 是否重复弹出广告。
- 是否产生 React/Vue 状态错误或未捕获异常。

## 6. 设计稳定的用户脚本

推荐元数据：

```js
// ==UserScript==
// @name         示例首页广告自动关闭
// @namespace    https://github.com/<user>/<repository>
// @version      1.0.0
// @description  自动关闭示例网站首页广告
// @match        https://www.example.com/
// @downloadURL  https://raw.githubusercontent.com/<user>/<repository>/main/userscripts/example.user.js
// @updateURL    https://raw.githubusercontent.com/<user>/<repository>/main/userscripts/example.user.js
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==
```

推荐结构：

```js
(() => {
  "use strict";

  const AD_SELECTOR = ".example-ad-overlay";
  const CLOSE_SELECTOR = ".example-ad-close";
  const MARK = "data-ad-closer-clicked";

  if (
    !["www.example.com", "example.com"].includes(location.hostname) ||
    (location.pathname !== "/" && location.pathname !== "/index.html")
  ) {
    return;
  }

  function closeAd() {
    for (const ad of document.querySelectorAll(AD_SELECTOR)) {
      const closeControl = ad.querySelector(CLOSE_SELECTOR);
      if (!closeControl || closeControl.hasAttribute(MARK)) {
        continue;
      }

      closeControl.setAttribute(MARK, "true");
      closeControl.click();

      window.setTimeout(() => {
        if (ad.isConnected) {
          ad.remove();
        }
      }, 1200);
    }
  }

  let scanQueued = false;
  function queueScan() {
    if (scanQueued) {
      return;
    }
    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      closeAd();
    });
  }

  new MutationObserver(queueScan).observe(document, {
    childList: true,
    subtree: true,
  });

  document.addEventListener("DOMContentLoaded", queueScan, { once: true });
  window.setInterval(queueScan, 500);
  queueScan();
})();
```

实现要点：

- `document-start` 让脚本尽早运行，避免错过首屏插入。
- `MutationObserver` 负责动态节点，低频轮询负责监听器异常或执行时机兜底。
- 选择器先锁定广告根节点，再在其内部锁定关闭节点，防止误伤其他弹窗。
- 标记属性防止对同一控件重复触发关闭处理器。
- 先点击网站自己的关闭控件，再延时移除残留节点。
- 不要无条件修改全局 CSS、`overflow`、`pointer-events` 或 `z-index`。

## 7. 验证与回归

至少覆盖以下场景：

1. 正常首页首次打开。
2. 刷新后广告再次出现。
3. 广告延迟出现或异步插入。
4. 关闭动画执行期间的页面状态。
5. 非首页路径不执行脚本。
6. 登录、验证码、Cookie 同意和安全弹窗不受影响。
7. 多个标签页同时打开首页。
8. 浏览器 Console 无脚本异常。
9. Tampermonkey 可识别元数据并检查更新。

对于已发布脚本，可以在目标页中动态插入相同结构做快速回归，但必须记录这只是结构
回归；线上真实广告是最终验收。

## 8. 选择器失效后的更新策略

按照证据顺序更新：

1. 重新复现广告并截图/记录 DOM。
2. 查找根节点是否改 class、id 或包装层级。
3. 检查关闭控件是否迁移到新的子节点或父节点。
4. 在 Sources 全局搜索旧 class，确认事件处理器的新位置。
5. 只修改必要选择器，并升级 `@version`。
6. 重新执行完整验证矩阵。
7. 推送 `main`，确认 raw `@updateURL` 可访问。

不要因为一次更新就扩大到所有 `div[class*="close"]`、所有 fixed 层或整个站点。

## 9. 发布检查清单

- [ ] 脚本语法检查通过。
- [ ] 真实广告关闭成功。
- [ ] 页面滚动和点击正常。
- [ ] 非广告弹窗未被误关。
- [ ] 非首页路径未执行。
- [ ] `@match` 尽量精确。
- [ ] `@version` 已递增。
- [ ] `@downloadURL` 和 `@updateURL` 指向正确 raw 地址。
- [ ] README 的安装入口和说明已同步。
- [ ] 提交和远程分支一致。

## 10. 常见反模式

- 直接删除全屏层而不触发网站关闭回调。
- 用页面文字“关闭”匹配所有按钮。
- 对整个站点使用宽泛的 `.modal`、`.dialog` 或 `.close`。
- 每秒高频扫描整个 DOM。
- 忽略 iframe 或 Shadow DOM 边界。
- 在没有线上证据时猜测事件目标。
- 更新脚本但不升级版本号。
- 只验证合成 DOM，不验证真实广告。
