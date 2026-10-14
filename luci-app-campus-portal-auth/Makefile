include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/package.mk

PKG_NAME:=luci-app-campus-portal-auth
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=h3c-campus-auth
PKG_LICENSE:=MIT

define Package/luci-app-campus-portal-auth
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for Campus Network Portal Auth
  DEPENDS:=+campus-portal-auth
  PKGARCH:=all
endef

define Package/luci-app-campus-portal-auth/description
  LuCI web interface for campus network portal authentication.
  Provides account management, service status, and auto-reconnect controls.
endef

define Build/Compile
endef

define Package/luci-app-campus-portal-auth/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/campus-portal-auth.js \
		$(1)/www/luci-static/resources/view/campus-portal-auth.js

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-campus-portal-auth.json \
		$(1)/usr/share/luci/menu.d/luci-app-campus-portal-auth.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-campus-portal-auth.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-campus-portal-auth.json

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/luci.campus_portal_auth \
		$(1)/usr/libexec/rpcd/luci.campus_portal_auth
endef

define Package/luci-app-campus-portal-auth/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
    rm -rf /tmp/luci-indexcache
    rm -rf /tmp/luci-modulecache/*
    /etc/init.d/rpcd restart 2>/dev/null || true
fi
endef

$(eval $(call BuildPackage,luci-app-campus-portal-auth))
