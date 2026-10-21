# 京东首页广告脚本维护手册（Codex Handoff）

本文件记录京东首页全屏广告脚本的实测结论、维护边界和下次网站改版后的更新步骤。
目标是让新的 Codex 会话无需重新猜测页面结构，即可复现、定位、修改和验证脚本。

## 快速结论

- 目标页面：`https://www.jd.com/` 桌面首页。
- 广告根节点：`.umc-equity`。
- 关闭事件目标：`.umc-equity-close-wrap`。
- 外层容器：`#umc-equity-close-btn`。
- 实测时间：2026-10-21。
- 实测浏览器：Chrome 155.0.8059.40。
- 广告以固定定位覆盖视口，实测 `z-index` 为 `1000`，并显示“3秒后自动关闭”。
- 关闭逻辑不是挂在外层按钮上，而是挂在 `.umc-equity-close-wrap` 的 `onClick` 上。
  直接 `button.click()` 不保证关闭，必须点击 `.umc-equity-close-wrap`。
- 京东脚本可能通过 React/UMC 组件卸载广告。脚本应触发原关闭逻辑，并保留 DOM
  移除兜底，不要只修改 CSS。

## 当前实现约定

脚本路径：

```text
userscripts/jd-home-ad-closer.user.js
```

当前行为：

1. 仅在 `www.jd.com` 或 `jd.com` 的 `/`、`/index.html` 首页执行。
2. `@run-at document-start` 启动。
3. 使用 `MutationObserver` 监听动态广告插入。
4. 插入 `.umc-equity { display: none !important; }`，避免页面闪现广告。
5. 找到广告根节点内的 `.umc-equity-close-wrap` 并调用 `click()`。
6. 使用 `data-jd-home-ad-closer-clicked` 防止重复点击同一控件。
7. 1.2 秒后若广告节点仍连接在 DOM 中，则强制移除。
8. 使用 500ms 轮询作为 MutationObserver 之外的兜底。

不要关闭 `#login2025-dialog-wrap`。它属于登录福利弹窗，不是本脚本负责的全屏广告。
不要使用模糊的 `.close`、`[class*="close"]` 或全页面文本匹配，以免误关验证码、登录、
安全提示或其他正常业务弹窗。

## 已观测的页面结构

广告的典型结构如下，类名比元素层级更稳定：

```html
<div class="umc-equity">
  <div class="umc-advert">
    <img class="umc-advert-link" src="...">
    <div id="umc-equity-close-btn">
      <div class="jd-main-modal-close">
        <div class="umc-equity-close-wrap">
          <img class="umc-equity-close-img" src="...">
          <svg class="countdown-ring">...</svg>
          <div class="countdown-number">3秒后自动关闭</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

实测时间线：

- 约 0.75 秒：页面尚在加载，广告未出现。
- 约 1.5–2.5 秒：`.umc-equity` 出现，倒计时从 3 秒递减。
- 约 4 秒：广告通过自身倒计时关闭。
- 约 8.5 秒：可能出现独立的登录福利弹窗，不属于广告关闭目标。

广告频率受服务端、Cookie、账号和实验分组影响。广告没有在第二次页面加载时出现，
并不表示选择器失效。

## 下次京东改版后的更新流程

### 1. 启动独立调试浏览器

不要复用已经运行的默认 Chrome 配置，单独使用临时 profile：

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  '--remote-debugging-port=9222' `
  '--remote-debugging-address=127.0.0.1' `
  '--user-data-dir=C:\Users\eric\Desktop\jd\.chrome-jd-debug' `
  '--no-first-run' `
  '--no-default-browser-check' `
  'https://www.jd.com/'
```

确认调试端点：

```powershell
Invoke-RestMethod 'http://127.0.0.1:9222/json/version'
Invoke-RestMethod 'http://127.0.0.1:9222/json/list'
```

如果当前执行环境无法打开可见窗口，可以临时使用：

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  '--headless=new' `
  '--disable-gpu' `
  '--no-sandbox' `
  '--disable-breakpad' `
  '--remote-debugging-port=9222' `
  '--remote-debugging-address=127.0.0.1' `
  '--user-data-dir=C:\Users\eric\Desktop\jd\.chrome-jd-debug' `
  'https://www.jd.com/'
```

### 2. 在 Chrome DevTools 中定位广告

打开 DevTools Console，筛选覆盖大部分视口的固定/绝对定位元素：

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
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        areaRatio: (rect.width * rect.height) / viewportArea,
      };
    })
    .filter(
      (item) =>
        ["fixed", "absolute"].includes(item.position) &&
        item.areaRatio >= 0.5,
    )
    .sort((left, right) => right.areaRatio - left.areaRatio);
})();
```

确认根节点后，在 Elements 面板检查其内是否包含关闭图标、`aria-label`、`title` 或
倒计时文本。优先记录类名和稳定的数据属性，避免依赖自动生成的层级或动态图片 URL。

### 3. 查找真正的关闭事件目标

在 Elements 面板选中疑似关闭节点，再在 Console 中检查事件监听：

```js
getEventListeners($0);
```

也可以在 Sources 面板的全局搜索中搜索旧选择器：

```text
umc-equity
umc-equity-close-wrap
umc-equity-close-btn
```

当前版本的证据是：React 组件的 `onClick` 创建在
`.umc-equity-close-wrap` 上，外壳 `#umc-equity-close-btn` 自身没有该处理器。

可以从该事件目标向上查找广告根节点：

```js
const closeControl = document.querySelector(".umc-equity-close-wrap");
closeControl?.closest(".umc-equity");
```

### 4. 手动验证关闭路径

广告出现时执行：

```js
(() => {
  const ad = document.querySelector(".umc-equity");
  const closeControl = ad?.querySelector(".umc-equity-close-wrap");

  if (!ad || !closeControl) {
    return { clicked: false, reason: "ad or close control missing" };
  }

  closeControl.click();
  return {
    clicked: true,
    connectedImmediately: ad.isConnected,
  };
})();
```

再观察至少 1.5 秒，确认广告移除、页面可滚动、页面主体可点击，且 Console 没有新增
异常。若关闭控件选择器变化，应优先修改脚本中的 `AD_SELECTOR` 和
`CLOSE_SELECTOR`，不要新增宽泛匹配。

### 5. 更新脚本

如果页面改名，按以下顺序修改：

1. 用新的广告根节点替换 `AD_SELECTOR`。
2. 用真正绑定 `click`/`onClick` 的节点替换 `CLOSE_SELECTOR`。
3. 保持广告根节点与关闭控件的包含关系校验。
4. 更新脚本内的 CSS 隐藏选择器。
5. 更新 `@version`，例如从 `1.0.0` 升为 `1.0.1`。
6. 不需要修改 `@downloadURL`、`@updateURL` 或 `@match`，除非安装地址或执行页面变化。

不要在页面没有广告时无条件调用 `document.body.remove()` 或清空大范围节点。不要通过
修改 `overflow` 猜测页面状态，除非已经验证京东关闭回调本身没有恢复滚动。

### 6. 验证矩阵

至少完成以下验证：

| 检查项 | 通过标准 |
| --- | --- |
| 首次加载 | 首页广告插入后立即隐藏，不出现全屏遮挡 |
| 原关闭逻辑 | 正确的关闭控件被点击一次 |
| 倒计时清理 | 广告关闭后没有遗留定时器造成的重新显示 |
| 页面滚动 | 首页可以正常上下滚动 |
| 页面点击 | 商品、搜索、导航和侧边栏可以正常点击 |
| 登录弹窗 | `#login2025-dialog-wrap` 没有被本脚本误关 |
| 路径限制 | 非首页的京东页面不执行脚本 |
| 重复执行 | 同一广告不会重复触发关闭处理器 |
| Console | 没有本脚本产生的异常或未捕获 Promise |
| 更新元数据 | raw 安装地址返回 HTTP 200，元数据可被 Tampermonkey 识别 |

建议用两种场景验证：

- 真实广告：使用新的 profile，重新打开首页，直到广告实际出现。
- 动态回归：在已经加载的首页中构造与线上相同的 `.umc-equity` 和
  `.umc-equity-close-wrap` 节点，给关闭控件绑定计数事件，确认脚本自动点击一次并移除。

动态回归只能证明脚本能处理给定结构，不能证明京东线上结构没有变化；线上真实广告仍是
最终验收标准。

## 故障排查

| 现象 | 优先检查 |
| --- | --- |
| 广告短暂闪现 | 脚本是否在 `document-start` 执行；CSS 是否在广告前插入 |
| 广告隐藏但页面不能滚动 | 是否跳过京东关闭回调；恢复点击正确的关闭控件，再考虑强制移除 |
| 点击后 Console 异常 | 关闭控件是否已变更；不要在错误节点触发 React 事件 |
| 登录弹窗也被关闭 | 立即回退选择器，禁止使用通用 `.close` 类 |
| 新 profile 仍无广告 | 广告可能有服务端频率限制；等待或更换网络/环境后测试 |
| Tampermonkey 未更新 | 检查 `@version`、`@updateURL` 和 raw URL 的分支是否为 `main` |

## 发布步骤

在仓库根目录执行：

```powershell
node --check .\userscripts\jd-home-ad-closer.user.js
git diff --check
git add userscripts/jd-home-ad-closer.user.js
git commit -m "Update JD homepage ad closer"
git push origin main
```

推送后检查 raw 文件：

```text
https://raw.githubusercontent.com/andy65007/Tampermonkey-Plugin-Collections/main/userscripts/jd-home-ad-closer.user.js
```

## Codex 交接清单

下次会话开始时按顺序确认：

- 读取本文件、通用流程和脚本源码。
- 使用独立 Chrome profile 打开 `https://www.jd.com/`。
- 确认广告是否出现；没有出现时不要立即判定脚本失效。
- 若广告变化，先记录根节点、关闭事件目标、视口尺寸和 z-index。
- 只修改最小选择器范围，并更新版本号。
- 完成真实广告和动态回归验证。
- 提交后确认远程 `main` 与安装 raw 地址。
