# H3C Campus Auth - 校园网认证插件

适用于 H3C NX30Pro / ImmortalWrt (OpenWrt 23.05+) 的校园网 Portal 认证插件。

## 功能

- **Portal Web 认证**：自动提交账号密码完成校园网登录
- **掉线自动重连**：定时检测网络状态，断线自动重新认证
- **LuCI 图形界面**：在路由器管理页面中管理认证账号和设置
- **WAN 热插拔**：WAN 接口恢复时自动重新认证
- **心跳保活**：支持可选的 keepalive 请求

## 软件包结构

```
h3c-campus-auth/
├── h3c-auth/                          # 核心认证包
│   ├── Makefile                       # OpenWrt 构建文件
│   ├── src/h3c-auth.sh               # 认证客户端脚本
│   └── root/
│       ├── etc/init.d/h3c-auth       # procd 服务脚本
│       ├── etc/config/h3c_auth       # UCI 默认配置
│       └── etc/hotplug.d/iface/99-h3c-auth  # WAN 热插拔
└── luci-app-h3c-auth/                 # LuCI 管理界面
    ├── Makefile
    ├── htdocs/luci-static/resources/view/h3c-auth.js  # 前端 JS
    ├── root/usr/share/luci/menu.d/    # LuCI 菜单
    ├── root/usr/share/rpcd/acl/       # 权限配置
    ├── root/usr/libexec/rpcd/         # RPCD 后端
    └── po/zh_Hans/                    # 中文翻译
```

## 构建方法

### 方法一：集成到 OpenWrt 构建系统

```bash
# 在 OpenWrt SDK 或完整源码树中
cp -r h3c-auth/ $(OPENWRT_DIR)/package/h3c-auth/
cp -r luci-app-h3c-auth/ $(OPENWRT_DIR)/package/luci-app-h3c-auth/

cd $(OPENWRT_DIR)
make menuconfig  # 选择 LuCI -> Applications -> luci-app-h3c-auth
make package/h3c-auth/compile V=s
make package/luci-app-h3c-auth/compile V=s
```

### 方法二：单独编译 ipk

```bash
# 需要 OpenWrt SDK
cd h3c-auth
make package/index  # 或直接构建
```

## 安装

```bash
# 在路由器上安装
opkg install h3c-auth_1.0.0_all.ipk
opkg install luci-app-h3c-auth_1.0.0_all.ipk
```

## 配置

安装后在 LuCI 中访问 **状态 → H3C Campus Auth** 进行配置。

或通过命令行：
```bash
uci set h3c_auth.main.enabled='1'
uci set h3c_auth.main.username='your_username'
uci set h3c_auth.main.password='your_password'
uci set h3c_auth.main.auth_url='http://10.0.0.1/portal/login'
uci commit h3c_auth
/etc/init.d/h3c-auth restart
```

## 适配你的校园网

核心认证脚本 `h3c-auth.sh` 中的 Protocol Adapter 部分需要根据你的校园网认证协议进行定制：

1. **`build_login_data()`** - 修改 POST 请求的字段名和格式
2. **`do_login()`** - 修改响应解析逻辑（成功/失败判断）
3. **`build_logout_data()`** - 修改登出请求格式
4. **URL 配置** - 通过 UCI 配置认证/登录/登出/心跳 URL

### 需要抓包获取的信息

- 认证页面 URL
- 登录 POST 请求的 URL 和参数格式
- 登录成功/失败的响应格式
- 是否需要额外的 Cookie 或 Header
- 心跳/保活机制（如果有）

## 安全说明

- 密码通过 UCI 配置存储，建议启用 `uhttpd` 的 HTTPS
- 不要在日志中输出密码
- 本项目不收集或传输任何凭据到外部服务器

## 待办

- [ ] 根据实际抓包数据适配具体校园网协议
- [ ] 添加多账号支持
- [ ] 添加认证日志查看界面
- [ ] 支持密码加密存储
- [ ] 支持 802.1X 认证模式
