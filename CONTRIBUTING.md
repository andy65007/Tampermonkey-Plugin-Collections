# 添加新脚本

感谢为本仓库贡献实用的 Tampermonkey 用户脚本。

新脚本请遵循
[通用网页首页广告关闭脚本开发流程](./docs/tampermonkey-ad-closer-workflow.md)。
修改京东首页脚本时，同时参考
[京东首页广告脚本维护手册](./docs/jd-home-ad-maintenance.md)。

## 脚本约定

- 每个脚本使用独立的 `.user.js` 文件，统一放在 `userscripts/` 目录。
- 文件内必须包含完整的 Tampermonkey 元数据。
- `@namespace` 使用本仓库地址。
- `@downloadURL` 和 `@updateURL` 指向该脚本在 `main` 分支中的 raw 地址。
- 脚本应尽量使用精确的站点匹配，避免在无关页面运行。
- 修改已发布脚本时同步更新 `@version`。

## 提交前检查

- 在目标网站上实际测试脚本。
- 确认页面正常功能没有被破坏。
- 更新 `README.md` 中的脚本列表、安装入口和说明。
