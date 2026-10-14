include $(TOPDIR)/rules.mk

PKG_NAME:=campus-portal-auth
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=h3c-campus-auth
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/campus-portal-auth
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Campus Network Portal Authentication Client
  DEPENDS:=+jshn
  PKGARCH:=all
endef

define Package/campus-portal-auth/description
  Campus network portal authentication client for OpenWrt.
  Supports Web Portal login/logout, auto-reconnect on disconnect,
  and heartbeat keepalive.
endef

define Build/Compile
endef

define Package/campus-portal-auth/install
	$(INSTALL_DIR) $(1)/usr/lib/campus-portal-auth
	$(INSTALL_BIN) ./src/campus-portal-auth.sh $(1)/usr/lib/campus-portal-auth/campus-portal-auth.sh

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/campus-portal-auth $(1)/etc/init.d/campus-portal-auth

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/campus_portal_auth $(1)/etc/config/campus_portal_auth

	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_BIN) ./root/etc/hotplug.d/iface/99-campus-portal-auth $(1)/etc/hotplug.d/iface/99-campus-portal-auth
endef

define Package/campus-portal-auth/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
    /etc/init.d/campus-portal-auth enable
fi
endef

$(eval $(call BuildPackage,campus-portal-auth))
