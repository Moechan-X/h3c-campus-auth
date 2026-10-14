'use strict';
'require view';
'require form';
'require ui';
'require fs';

var AUTH_SCRIPT = '/usr/lib/h3c-auth/h3c-auth.sh';

function getPid() {
    return fs.trimmed('/tmp/h3c-auth/auth.pid').catch(function() { return ''; });
}

function getStatus() {
    return fs.trimmed('/tmp/h3c-auth/status').catch(function() { return 'unknown'; });
}

function getSessionInfo() {
    return fs.read('/tmp/h3c-auth/session_info').catch(function() { return ''; });
}

function isRunning(pid) {
    if (!pid) return Promise.resolve(false);
    return fs.stat('/proc/' + pid).then(function() { return true; }).catch(function() { return false; });
}

function doAction(action) {
    switch (action) {
        case 'restart':
            return fs.exec('/etc/init.d/h3c-auth', ['restart']).then(function(r) {
                return { result: r.code === 0, message: r.code === 0 ? 'restarted' : 'failed' };
            });
        case 'stop':
            return fs.exec('/etc/init.d/h3c-auth', ['stop']).then(function(r) {
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

        m = new form.Map('h3c_auth', _('H3C Campus Auth'),
            _('Campus network portal authentication for H3C NX30Pro (SCITC BRAS ME60).'));

        // --- Status Section ---
        s = m.section(form.NamedSection, '__status__', _('Service Status'));
        s.anonymous = true;
        s.render = function() {
            return isRunning(pid).then(function(running) {
                var statusText, statusColor;
                if (!running) {
                    statusText = _('Stopped');
                    statusColor = '#999';
                } else if (rawStatus === 'authenticated') {
                    statusText = _('Connected');
                    statusColor = '#4caf50';
                } else if (rawStatus === 'disconnected') {
                    statusText = _('Disconnected');
                    statusColor = '#f44336';
                } else {
                    statusText = _('Running');
                    statusColor = '#ff9800';
                }

                var nodes = [];

                // Status indicator
                nodes.push(E('div', { 'class': 'cbi-value' }, [
                    E('label', { 'class': 'cbi-value-title' }, _('Status')),
                    E('div', { 'class': 'cbi-value-field' }, [
                        E('span', { 'style': 'display:inline-block;width:14px;height:14px;border-radius:50%;background:' + statusColor + ';margin-right:8px;vertical-align:middle;' }),
                        E('strong', {}, statusText),
                        running ? E('span', { 'style': 'margin-left:12px;color:#888;font-size:12px;' }, 'PID: ' + pid) : ''
                    ])
                ]));

                // Action buttons
                nodes.push(E('div', { 'class': 'cbi-value' }, [
                    E('label', { 'class': 'cbi-value-title' }, _('Actions')),
                    E('div', { 'class': 'cbi-value-field' }, [
                        E('button', {
                            'class': 'btn cbi-button cbi-button-apply',
                            'click': function(ev) {
                                ev.target.disabled = true;
                                doAction('restart').then(function() {
                                    ui.addNotification(null, E('p', _('Service restarted')), 'success');
                                    window.setTimeout(function() { location.reload(); }, 1500);
                                }).catch(function() {
                                    ev.target.disabled = false;
                                });
                            }
                        }, _('Restart')),
                        ' ',
                        E('button', {
                            'class': 'btn cbi-button cbi-button-negative',
                            'click': function(ev) {
                                ev.target.disabled = true;
                                doAction('stop').then(function() {
                                    ui.addNotification(null, E('p', _('Service stopped')), 'warning');
                                    window.setTimeout(function() { location.reload(); }, 1500);
                                }).catch(function() {
                                    ev.target.disabled = false;
                                });
                            }
                        }, _('Stop')),
                        ' ',
                        E('button', {
                            'class': 'btn cbi-button cbi-button-action',
                            'click': function(ev) {
                                ev.target.disabled = true;
                                var orig = ev.target.textContent;
                                ev.target.textContent = _('Checking...');
                                doAction('check').then(function(res) {
                                    ev.target.disabled = false;
                                    ev.target.textContent = orig;
                                    if (res.result) {
                                        ui.addNotification(null, E('p', _('Internet is reachable')), 'success');
                                    } else {
                                        ui.addNotification(null, E('p', _('Internet is NOT reachable')), 'warning');
                                    }
                                }).catch(function() {
                                    ev.target.disabled = false;
                                    ev.target.textContent = orig;
                                });
                            }
                        }, _('Check Connection'))
                    ])
                ]));

                // Session info (from heartbeat)
                if (sessionJson) {
                    try {
                        var info = JSON.parse(sessionJson);
                        if (info.authResult) {
                            nodes.push(E('div', { 'style': 'margin-top:1em;border-top:1px solid #ddd;padding-top:0.5em;' }, [
                                E('h4', {}, _('Session Info'))
                            ]));

                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, _('Auth Result')),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, info.authResult))
                            ]));
                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, _('Account')),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, info.accountId || '-'))
                            ]));
                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, _('Used Traffic')),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, formatFlow(info.usedFlow)))
                            ]));
                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, _('Online Time')),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, formatTime(info.usedTime)))
                            ]));
                            nodes.push(E('div', { 'class': 'cbi-value' }, [
                                E('label', { 'class': 'cbi-value-title' }, _('Last Auth')),
                                E('div', { 'class': 'cbi-value-field' }, E('span', {}, info.lastAuthTime || '-'))
                            ]));
                        }
                    } catch(e) {}
                }

                return E('div', { 'class': 'cbi-section-node' }, nodes);
            });
        };

        // --- Account Section ---
        s = m.section(form.NamedSection, 'main', _('Account Settings'),
            _('Campus network authentication credentials.'));
        s.addremove = false;

        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.default = '0';
        o.rmempty = false;

        o = s.option(form.Value, 'username', _('Username'), _('Campus account (e.g. phone number).'));
        o.rmempty = false;
        o.placeholder = '17800000000';

        o = s.option(form.Value, 'password', _('Password'), _('Campus account password.'));
        o.password = true;
        o.rmempty = false;

        // --- Portal Section ---
        s = m.section(form.NamedSection, 'main', _('Portal Settings'),
            _('BRAS portal configuration. Defaults match SCITC campus network.'));
        s.addremove = false;

        o = s.option(form.Value, 'auth_url', _('Auth API URL'), _('Portal authentication API endpoint.'));
        o.placeholder = 'http://10.2.1.27/api/portal/webauth';
        o.rmempty = false;

        o = s.option(form.Value, 'logout_url', _('Logout URL'), _('Logout API endpoint (requires Bearer token).'));
        o.placeholder = 'http://10.2.1.27/api/portal/user/logout';

        o = s.option(form.Value, 'wlanacname', _('BRAS Name (wlanacname)'), _('Access controller name from portal URL.'));
        o.placeholder = 'SCITC-BRAS-ME60';
        o.rmempty = false;

        o = s.option(form.Value, 'login_mode', _('Login Mode'), _('Authentication mode.'));
        o.value('password', _('Password'));
        o.value('pin', _('PIN'));
        o.default = 'password';

        o = s.option(form.Flag, 'record_terminal_mac', _('Record Terminal MAC'), _('Send MAC address to portal.'));
        o.default = 'Y';
        o.enabled = 'Y';
        o.disabled = 'N';

        o = s.option(form.Value, 'browser_fingerprint', _('Browser Fingerprint'), _('Leave empty to auto-generate from router MAC.'));
        o.optional = true;
        o.placeholder = _('Auto-generated');

        o = s.option(form.Value, 'heartbeat_url', _('Heartbeat URL'), _('Session keepalive endpoint (uses Bearer token). Leave empty to disable.'));
        o.optional = true;
        o.placeholder = 'http://10.2.1.27/api/portal/user/info';

        // --- Advanced Section ---
        s = m.section(form.NamedSection, 'main', _('Advanced Settings'),
            _('Reconnection behavior and network monitoring.'));
        s.addremove = false;

        o = s.option(form.Value, 'check_interval', _('Check Interval (s)'), _('Seconds between connectivity checks.'));
        o.datatype = 'uinteger';
        o.default = '60';
        o.rmempty = false;

        o = s.option(form.Value, 'max_retries', _('Max Retries'), _('Max login attempts before cooldown.'));
        o.datatype = 'uinteger';
        o.default = '3';
        o.rmempty = false;

        o = s.option(form.Value, 'retry_delay', _('Retry Delay (s)'), _('Seconds between retry attempts.'));
        o.datatype = 'uinteger';
        o.default = '10';
        o.rmempty = false;

        o = s.option(form.Value, 'check_host', _('Connectivity Check Host'), _('URL to verify internet access.'));
        o.default = 'https://connect.rom.miui.com/generate_204';
        o.rmempty = false;

        o = s.option(form.ListValue, 'interface', _('WAN Interface'), _('Interface to get public IP from and monitor.'));
        o.value('wan', 'WAN');
        o.value('wan6', 'WAN6');
        o.default = 'wan';

        return m.render();
    }
});
