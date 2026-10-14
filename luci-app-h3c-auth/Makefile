include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-h3c-auth
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=h3c-campus-auth
PKG_LICENSE:=MIT

LUCI_TITLE:=LuCI support for H3C Campus Auth
LUCI_DEPENDS:=+h3c-auth +luci-base
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

define Package/luci-app-h3c-auth
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for H3C Campus Network Auth
  DEPENDS:=+h3c-auth
  PKGARCH:=all
endef

define Package/luci-app-h3c-auth/description
  LuCI web interface for H3C campus network portal authentication.
  Provides account management, service status, and auto-reconnect controls.
endef

define Build/Compile
endef

define Package/luci-app-h3c-auth/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view
	$(INSTALL_DIR) $(1)/htdocs/luci-static/resources/view
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/h3c-auth.js \
		$(1)/htdocs/luci-static/resources/view/h3c-auth.js

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-h3c-auth.json \
		$(1)/usr/share/luci/menu.d/luci-app-h3c-auth.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl/luci-app-h3c-auth.json \
		$(1)/usr/share/rpcd/acl/luci-app-h3c-auth.json

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/luci.h3c_auth \
		$(1)/usr/libexec/rpcd/luci.h3c_auth

	$(INSTALL_DIR) $(1)/usr/share/locale/zh_CN/LC_MESSAGES
endef

define Package/luci-app-h3c-auth/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
    rm -rf /tmp/luci-indexcache
    rm -rf /tmp/luci-modulecache/*
    /etc/init.d/rpcd restart
fi
endef

$(eval $(call BuildPackage,luci-app-h3c-auth))
