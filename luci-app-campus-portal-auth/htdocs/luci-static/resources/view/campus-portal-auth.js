'use strict';
'require view';
'require form';
'require ui';
'require fs';

var AUTH_SCRIPT = '/usr/lib/campus-portal-auth/campus-portal-auth.sh';

function getPid() {
    return fs.trimmed('/tmp/campus-portal-auth/auth.pid').catch(function() { return ''; });
}

function getStatus() {
    return fs.trimmed('/tmp/campus-portal-auth/status').catch(function() { return 'unknown'; });
}

function getSessionInfo() {
    return fs.read('/tmp/campus-portal-auth/session_info').catch(function() { return ''; });
}

function isRunning(pid) {
    if (!pid) return Promise.resolve(false);
    return fs.stat('/proc/' + pid).then(function() { return true; }).catch(function() { return false; });
}

function doAction(action) {
    switch (action) {
        case 'restart':
            return fs.exec('/etc/init.d/campus-portal-auth', ['restart']).then(function(r) {
                return { result: r.code === 0, message: r.code === 0 ? 'restarted' : 'failed' };
            });
        case 'stop':
            return fs.exec('/etc/init.d/campus-portal-auth', ['stop']).then(function(r) {
                return { result: r.code === 0, message: r.code === 0 ? 'stopped' : 'failed' };
            });
        case 'check':
            return fs.exec(AUTH_SCRIPT, ['check']).then(function(r) {
                var online = (r.stdout || '').trim() === 'online';
                return { result: online, message: online ? 'online' : 'offline' };
            });
        case 'login':
            return fs.exec(AUTH_SCRIPT, ['login']).then(function(r) {
                return { result: r.code === 0 };
            });
        case 'logout':
            return fs.exec(AUTH_SCRIPT, ['logout']).then(function(r) {
                return { result: r.code === 0 };
            });
        default:
            return Promise.resolve({ result: false, message: 'unknown action' });
    }
}

function formatFlow(mb) {
    if (!mb && mb !== 0) return '-';
    mb = parseFloat(mb);
    if (mb >= 1048576) return (mb / 1048576).toFixed(2) + ' TB';
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(2) + ' MB';
}

function formatTime(hours) {
    if (!hours && hours !== 0) return '-';
    hours = parseFloat(hours);
    var d = Math.floor(hours / 24);
    var h = Math.floor(hours % 24);
    var m = Math.floor((hours * 60) % 60);
    if (d > 0) return d + '\u5929 ' + h + '\u5c0f\u65f6 ' + m + '\u5206';
    if (h > 0) return h + '\u5c0f\u65f6 ' + m + '\u5206';
    return m + '\u5206';
}

return view.extend({
    load: function() {
        return Promise.all([
            getPid(),
            getStatus(),
            getSessionInfo()
        ]);
    },

    render: function(data) {
        var pid = data[0] || '';
        var rawStatus = data[1] || 'unknown';
        var sessionJson = data[2] || '';

        var m, s, o;

        m = new form.Map('campus_portal_auth', '校园网 Portal 认证',
            '适用于校园网 Portal 认证的路由器插件（SCITC BRAS ME60 协议）。');

        // --- Status Section ---
        s = m.section(form.NamedSection, '__status__', '服务状态');
        s.anonymous = true;
        s.render = function() {
            return isRunning(pid).then(function(running) {
                var statusText, statusColor;
                if (!running) {
                    statusText = '已停止';
                    statusColor = '#999';
                } else if (rawStatus === 'authenticated') {
                    statusText = '已连接';
                    statusColor = '#4caf50';
                } else if (rawStatus === 'disconnected') {
                    statusText = '已断开';
                    statusColor = '#f44336';
                } else {
                    statusText = '运行中';
                    statusColor = '#ff980e';
                }

                var nodes = [];

                // Status indicator
                nodes.push(E('div', { 'class': 'cbi-value' }, [
                    E('label', { 'class': 'cbi-value-title' }, '状态'),
                    E('div', { 'class': 'cbi-value-field' }, [
                        E('span', { 'style': 'display:inline-block;width:14px;height:14px;border-radius:50%;background:' + statusColor + ';margin-right:8px;vertical-align:middle;' }),
                        E('strong', {}, statusText),
                        running ? E('span', { 'style': 'margin-left:12px;color:#888;font-size:12px;' }, 'PID: ' + pid) : ''
                    ])
                ]));

                // Action buttons
                nodes.push(E('div', { 'class': 'cbi-value' }, [
                    E('label', { 'class': 'cbi-value-title' }, '操作'),
                    E('div', { 'class': 'cbi-value-field' }, [
                        E('button', {
                            'class': 'btn cbi-button cbi-button-apply',
                            'click': function(ev) {
                                ev.target.disabled = true;
                                doAction('restart').then(function() {
                                    ui.addNotification(null, E('p', '服务已重启'), 'success');
                                    window.setTimeout(function() { location.reload(); }, 1500);
                                }).catch(function() {
                                    ev.target.disabled = false;
                                });
                            }
                        }, '重启'),
                        ' ',
                        E('button', {
                            'class': 'btn cbi-button cbi-button-negative',
                            'click': function(ev) {
                                ev.target.disabled = true;
                                doAction('stop').then(function() {
                                    ui.addNotification(null, E('p', '服务已停止'), 'warning');
                                    window.setTimeout(function() { location.reload(); }, 1500);
                                }).catch(function() {
                                    ev.target.disabled = false;
                                });
                            }
                        }, '停止'),
                        ' ',
                        E('button', {
                            'class': 'btn cbi-button cbi-button-action',
                            'click': function(ev) {
                                ev.target.disabled = true;
                                var orig = ev.target.textContent;
                                ev.target.textContent = '检测中...';
                                doAction('check').then(function(res) {
                                    ev.target.disabled = false;
                                    ev.target.textContent = orig;
                                    if (res.result) {
                                        ui.addNotification(null, E('p', '网络可达'), 'success');
                                    } else {
                                        ui.addNotification(null, E('p', '网络不可达'), 'warning');
                                    }
                                }).catch(function() {
                                    ev.target.disabled = false;
                                    ev.target.textContent = orig;
                                });
                            }
                        }, '检测连接')
                    ])
                ]));

                // Session info (from heartbeat)
                if (sessionJson) {
                    try {
                        var info = JSON.parse(sessionJson);
                        if (info.authResult) {
                            nodes.push(E('div', { 'style': 'margin-top:1em;border-top:1px solid #ddd;padding-top:0.5em;' }, [
                                E('h4', {}, '会话信息')
                            ]));

                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, '认证结果'),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, info.authResult))
                            ]));
                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, '账号'),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, info.accountId || '-'))
                            ]));
                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, '已用流量'),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, formatFlow(info.usedFlow)))
                            ]));
                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, '在线时长'),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, formatTime(info.usedTime)))
                            ]));
                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, '上次认证'),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, info.lastAuthTime || '-'))
                            ]));
                        }
                    } catch(e) {}
                }

                return E('div', { 'class': 'cbi-section-node' }, nodes);
            });
        };

        // --- Account Section ---
        s = m.section(form.NamedSection, 'main', '账号设置',
            '校园网认证凭据。');
        s.addremove = false;

        o = s.option(form.Flag, 'enabled', '启用');
        o.default = '0';
        o.rmempty = false;

        o = s.option(form.Value, 'username', '用户名', '校园网账号（如手机号）。');
        o.rmempty = false;
        o.placeholder = '17800000000';

        o = s.option(form.Value, 'password', '密码', '校园网账号密码。');
        o.password = true;
        o.rmempty = false;

        // --- Portal Section ---
        s = m.section(form.NamedSection, 'main', 'Portal 设置',
            'BRAS Portal 配置，默认值适配 SCITC 校园网。');
        s.addremove = false;

        o = s.option(form.Value, 'auth_url', '认证 API 地址', 'Portal 认证 API 端点。');
        o.placeholder = 'http://10.2.1.27/api/portal/webauth';
        o.rmempty = false;

        o = s.option(form.Value, 'logout_url', '登出地址', '登出 API 端点（需要 Bearer token）。');
        o.placeholder = 'http://10.2.1.27/api/portal/user/logout';

        o = s.option(form.Value, 'wlanacname', 'BRAS 名称 (wlanacname)', 'Portal URL 中的接入控制器名称。');
        o.placeholder = 'SCITC-BRAS-ME60';
        o.rmempty = false;

        o = s.option(form.Value, 'login_mode', '登录模式', '认证模式。');
        o.value('password', '密码');
        o.value('pin', 'PIN 码');
        o.default = 'password';

        o = s.option(form.Flag, 'record_terminal_mac', '上报终端 MAC', '向 Portal 上报 MAC 地址。');
        o.default = 'Y';
        o.enabled = 'Y';
        o.disabled = 'N';

        o = s.option(form.Value, 'browser_fingerprint', '浏览器指纹', '留空则根据路由器 MAC 自动生成。');
        o.optional = true;
        o.placeholder = '自动生成';

        o = s.option(form.Value, 'heartbeat_url', '心跳地址', '会话保活端点（使用 Bearer token）。留空则禁用。');
        o.optional = true;
        o.placeholder = 'http://10.2.1.27/api/portal/user/info';

        // --- Advanced Section ---
        s = m.section(form.NamedSection, 'main', '高级设置',
            '自动重连行为与网络监控。');
        s.addremove = false;

        o = s.option(form.Value, 'check_interval', '检测间隔（秒）', '网络连通性检测间隔（秒）。');
        o.datatype = 'uinteger';
        o.default = '60';
        o.rmempty = false;

        o = s.option(form.Value, 'max_retries', '最大重试次数', '冷却前最大登录重试次数。');
        o.datatype = 'uinteger';
        o.default = '3';
        o.rmempty = false;

        o = s.option(form.Value, 'retry_delay', '重试延迟（秒）', '重试间隔（秒）。');
        o.datatype = 'uinteger';
        o.default = '10';
        o.rmempty = false;

        o = s.option(form.Value, 'check_host', '连通性检测地址', '用于验证互联网连通的 URL。');
        o.default = 'https://connect.rom.miui.com/generate_204';
        o.rmempty = false;

        o = s.option(form.ListValue, 'interface', 'WAN 接口', '获取公网 IP 和监控链路变化的接口。');
        o.value('wan', 'WAN');
        o.value('wan6', 'WAN6');
        o.default = 'wan';

        return m.render();
    }
});
