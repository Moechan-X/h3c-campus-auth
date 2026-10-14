include $(TOPDIR)/rules.mk

PKG_NAME:=h3c-auth
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=h3c-campus-auth
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/h3c-auth
  SECTION:=net
  CATEGORY:=Network
  TITLE:=H3C Campus Network Portal Authentication Client
  DEPENDS:=+jshn
  PKGARCH:=all
endef

define Package/h3c-auth/description
  Campus network portal authentication client for H3C NX30Pro / ImmortalWrt.
  Supports Web Portal login/logout, auto-reconnect on disconnect,
  and heartbeat keepalive.
endef

define Build/Compile
endef

define Package/h3c-auth/install
	$(INSTALL_DIR) $(1)/usr/lib/h3c-auth
	$(INSTALL_BIN) ./src/h3c-auth.sh $(1)/usr/lib/h3c-auth/h3c-auth.sh

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/h3c-auth $(1)/etc/init.d/h3c-auth

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/h3c_auth $(1)/etc/config/h3c_auth

	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_BIN) ./root/etc/hotplug.d/iface/99-h3c-auth $(1)/etc/hotplug.d/iface/99-h3c-auth
endef

define Package/h3c-auth/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
    /etc/init.d/h3c-auth enable
fi
endef

$(eval $(call BuildPackage,h3c-auth))
