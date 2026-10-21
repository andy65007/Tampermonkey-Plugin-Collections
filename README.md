# Tampermonkey Plugin Collections

一个持续维护的 Tampermonkey 用户脚本集合，用于改善日常网页浏览体验。每个脚本都
保持独立、尽量少依赖，并提供清晰的安装和使用说明。

## 用户脚本

| 脚本 | 适用页面 | 功能 | 安装 |
| --- | --- | --- | --- |
| 京东首页全屏广告自动关闭 | `jd.com` 桌面首页 | 自动关闭首页的 UMC 全屏广告 | [安装](https://raw.githubusercontent.com/andy65007/Tampermonkey-Plugin-Collections/main/userscripts/jd-home-ad-closer.user.js) |

## 安装脚本

1. 在 Chrome、Edge 或 Firefox 中安装并启用 [Tampermonkey](https://www.tampermonkey.net/)。
2. 点击上表中的“安装”链接。
3. Tampermonkey 打开安装页面后，点击“安装”。
4. 刷新目标网页使脚本生效。

如果浏览器没有自动打开 Tampermonkey，也可以在 Tampermonkey 管理面板中选择“添加
新脚本”，粘贴 [`userscripts/jd-home-ad-closer.user.js`](./userscripts/jd-home-ad-closer.user.js)
的完整内容并保存。

## 当前脚本

### 京东首页全屏广告自动关闭

打开 <https://www.jd.com/> 时，脚本会在广告节点插入页面后立即隐藏
`.umc-equity` 全屏广告，并点击实际绑定关闭事件的 `.umc-equity-close-wrap`。
这样可以保留京东页面自身的关闭逻辑，完成倒计时和页面状态清理。

该脚本已通过 Chrome DevTools 动态插入广告节点的回归验证。

## 仓库结构

```text
.
├── README.md
└── userscripts/
    └── jd-home-ad-closer.user.js
```

以后新增的脚本统一放在 `userscripts/` 目录，并在这里补充安装入口和功能说明。

## 更新

所有发布脚本都在 Tampermonkey 元数据中配置了 `@updateURL` 和 `@downloadURL`。
提交新版本并更新脚本的 `@version` 后，Tampermonkey 可以自动检查更新。
