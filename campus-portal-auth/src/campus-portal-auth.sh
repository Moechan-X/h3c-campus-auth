#!/bin/sh
# Campus Network Portal Authentication Client
# Protocol: SCITC BRAS ME60 Portal (wlanacname + wlanuserip)

. /lib/functions.sh
. /lib/functions/network.sh

CONFIG="campus_portal_auth"
LOG_TAG="campus-portal-auth"
STATE_DIR="/tmp/campus-portal-auth"
PID_FILE="$STATE_DIR/auth.pid"
STATUS_FILE="$STATE_DIR/status"

mkdir -p "$STATE_DIR"

log_info()  { logger -t "$LOG_TAG" -p info "$*"; }
log_warn()  { logger -t "$LOG_TAG" -p warning "$*"; }
log_error() { logger -t "$LOG_TAG" -p err "$*"; }

# --- Get WAN IP ---
get_wan_ip() {
    local iface="${1:-wan}"
    local ip=""

    ip=$(ifstatus "$iface" 2>/dev/null | jsonfilter -e '@["ipv4-address"][0].address' 2>/dev/null)

    if [ -z "$ip" ]; then
        ip=$(ip -4 addr show dev "$iface" 2>/dev/null | grep -oP 'inet \K[0-9.]+' | head -1)
    fi

    echo "$ip"
}

# --- Generate stable fingerprint ---
get_fingerprint() {
    local mac
    mac=$(cat /sys/class/net/br-lan/address 2>/dev/null || echo "00:00:00:00:00:00")
    echo -n "${mac}" | md5sum | cut -d' ' -f1
}

# --- Config ---
get_auth_config() {
    local section="$1"
    config_get AUTH_URL "$section" auth_url "http://10.2.1.27/api/portal/webauth"
    config_get LOGOUT_URL "$section" logout_url "http://10.2.1.27/api/portal/user/logout"
    config_get HEARTBEAT_URL "$section" heartbeat_url "http://10.2.1.27/api/portal/user/info"
    config_get USERNAME "$section" username ""
    config_get PASSWORD "$section" password ""
    config_get WLAN_ACNAME "$section" wlanacname "SCITC-BRAS-ME60"
    config_get LOGIN_MODE "$section" login_mode "password"
    config_get RECORD_MAC "$section" record_terminal_mac "Y"
    config_get FINGERPRINT "$section" browser_fingerprint ""
    config_get CHECK_HOST "$section" check_host "https://connect.rom.miui.com/generate_204"
    config_get CHECK_INTERVAL "$section" check_interval "60"
    config_get MAX_RETRIES "$section" max_retries "3"
    config_get RETRY_DELAY "$section" retry_delay "10"
    config_get INTERFACE "$section" interface "wan"
    config_get ENABLED "$section" enabled "0"

    [ -z "$FINGERPRINT" ] && FINGERPRINT="$(get_fingerprint)"
}

# --- Protocol: Build login data ---
build_login_data() {
    local user="$1"
    local pass="$2"
    local wan_ip
    wan_ip="$(get_wan_ip "$INTERFACE")"

    if [ -z "$wan_ip" ]; then
        log_error "Cannot determine WAN IP on interface $INTERFACE"
        return 1
    fi

    echo "wlanacname=${WLAN_ACNAME}&wlanuserip=${wan_ip}&userId=${user}&passwd=${pass}&loginMode=${LOGIN_MODE}&recordTerminalMac=${RECORD_MAC}&browserFingerprint=${FINGERPRINT}"
}

# --- Protocol: Build logout data ---
build_logout_data() {
    local user="$1"
    local wan_ip
    wan_ip="$(get_wan_ip "$INTERFACE")"

    [ -z "$wan_ip" ] && return 1

    local distoken=""
    [ -f "$STATE_DIR/distoken" ] && distoken=$(cat "$STATE_DIR/distoken")

    local data="wlanacname=${WLAN_ACNAME}&wlanuserip=${wan_ip}&userId=${user}"
    [ -n "$distoken" ] && data="${data}&distoken=${distoken}"
    echo "$data"
}

# --- Protocol: Get referer URL ---
get_referer() {
    local wan_ip
    wan_ip="$(get_wan_ip "$INTERFACE")"
    local portal_base
    portal_base=$(echo "$AUTH_URL" | sed 's|/api/.*|/portal/webauth|')
    echo "${portal_base}?wlanacname=${WLAN_ACNAME}&wlanuserip=${wan_ip}"
}

# --- Perform login ---
do_login() {
    local user="$1"
    local pass="$2"
    local login_data
    login_data="$(build_login_data "$user" "$pass")" || return 1

    local referer
    referer="$(get_referer)"

    log_info "Login: user=$user wan_ip=$(echo "$login_data" | grep -oP 'wlanuserip=\K[^&]+')"

    local response_file="$STATE_DIR/.login_resp"
    local headers_file="$STATE_DIR/.login_headers"

    wget -q -O "$response_file" -S \
        --post-data="$login_data" \
        --header="Content-Type: application/x-www-form-urlencoded" \
        --header="User-Agent: Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/155.0.0.0 Mobile Safari/537.36" \
        --header="Referer: ${referer}" \
        --timeout=15 \
        --no-check-certificate \
        "$AUTH_URL" 2>"$headers_file"

    local exit_code=$?
    local body=""
    [ -f "$response_file" ] && body=$(cat "$response_file")

    local http_code
    http_code=$(grep -m1 "HTTP/" "$headers_file" 2>/dev/null | sed 's/.*HTTP\/[0-9.]* \([0-9]*\).*/\1/')
    [ -z "$http_code" ] && http_code="000"

    log_info "Response: HTTP $http_code body=$body"

    if [ "$http_code" = "200" ]; then
        # Parse JSON: {"success":true,"code":200,"result":{"token":"...","distoken":"...","message":"..."}}
        local success
        success=$(echo "$body" | jsonfilter -e '@.success' 2>/dev/null)
        local code
        code=$(echo "$body" | jsonfilter -e '@.code' 2>/dev/null)
        local msg
        msg=$(echo "$body" | jsonfilter -e '@.result.message' 2>/dev/null)
        local token
        token=$(echo "$body" | jsonfilter -e '@.result.token' 2>/dev/null)
        local distoken
        distoken=$(echo "$body" | jsonfilter -e '@.result.distoken' 2>/dev/null)

        if [ "$success" = "true" ] && [ "$code" = "200" ]; then
            log_info "Login OK: $user - $msg"
            echo "authenticated" > "$STATUS_FILE"
            echo "$(date +%s)" >> "$STATUS_FILE"
            # Save token for logout/heartbeat
            [ -n "$token" ] && echo "$token" > "$STATE_DIR/token"
            [ -n "$distoken" ] && echo "$distoken" > "$STATE_DIR/distoken"
            return 0
        fi

        log_warn "Login rejected: $user - $msg (success=$success code=$code)"
        return 1
    fi

    log_warn "Login failed: $user (HTTP $http_code)"
    return 1
}

# --- Perform logout ---
do_logout() {
    local user="$1"
    local logout_data
    logout_data="$(build_logout_data "$user")" || return 1

    local token=""
    [ -f "$STATE_DIR/token" ] && token=$(cat "$STATE_DIR/token")

    log_info "Logout: user=$user"

    local response_file="$STATE_DIR/.logout_resp"
    local headers_file="$STATE_DIR/.logout_headers"

    [ -n "$token" ] && local auth_header="Authorization: Bearer ${token}" || local auth_header=""

    wget -q -O "$response_file" -S \
        --post-data="$logout_data" \
        --header="Content-Type: application/x-www-form-urlencoded" \
        ${auth_header:+--header="$auth_header"} \
        --timeout=10 \
        --no-check-certificate \
        "$LOGOUT_URL" 2>"$headers_file"

    local body=""
    [ -f "$response_file" ] && body=$(cat "$response_file")

    local http_code
    http_code=$(grep -m1 "HTTP/" "$headers_file" 2>/dev/null | sed 's/.*HTTP\/[0-9.]* \([0-9]*\).*/\1/')
    [ -z "$http_code" ] && http_code="000"

    log_info "Logout response: HTTP $http_code body=$body"

    local success
    success=$(echo "$body" | jsonfilter -e '@.success' 2>/dev/null)

    if [ "$success" = "true" ]; then
        log_info "Logout OK: $user"
    else
        local msg
        msg=$(echo "$body" | jsonfilter -e '@.message' 2>/dev/null)
        log_warn "Logout response: $msg"
    fi

    rm -f "$STATE_DIR/token" "$STATE_DIR/distoken"
    echo "disconnected" > "$STATUS_FILE"
}

# --- Heartbeat ---
# Uses /api/portal/user/info with Bearer token to:
#   1. Verify session is still valid
#   2. Keep the BRAS session active
#   3. Detect session expiry early
#   4. Save session info for LuCI status display
do_heartbeat() {
    [ -z "$HEARTBEAT_URL" ] && return 0

    local token=""
    [ -f "$STATE_DIR/token" ] && token=$(cat "$STATE_DIR/token")
    [ -z "$token" ] && {
        log_warn "Heartbeat: no token, skipping"
        return 1
    }

    local response_file="$STATE_DIR/.heartbeat_resp"
    local headers_file="$STATE_DIR/.heartbeat_headers"

    wget -q -O "$response_file" -S \
        --header="Authorization: Bearer ${token}" \
        --timeout=10 \
        --no-check-certificate \
        "$HEARTBEAT_URL" 2>"$headers_file"

    local body=""
    [ -f "$response_file" ] && body=$(cat "$response_file")

    local http_code
    http_code=$(grep -m1 "HTTP/" "$headers_file" 2>/dev/null | sed 's/.*HTTP\/[0-9.]* \([0-9]*\).*/\1/')
    [ -z "$http_code" ] && http_code="000"

    if [ "$http_code" != "200" ]; then
        log_warn "Heartbeat: HTTP $http_code"
        return 1
    fi

    local success
    success=$(echo "$body" | jsonfilter -e '@.success' 2>/dev/null)
    if [ "$success" != "true" ]; then
        local msg
        msg=$(echo "$body" | jsonfilter -e '@.message' 2>/dev/null)
        log_warn "Heartbeat: session invalid - $msg"
        rm -f "$STATE_DIR/session_info"
        return 1
    fi

    # Extract key fields and save for LuCI display
    local auth_result used_flow used_time last_auth account_id
    auth_result=$(echo "$body" | jsonfilter -e '@.result.authResult' 2>/dev/null)
    used_flow=$(echo "$body" | jsonfilter -e '@.result.usedFlow' 2>/dev/null)
    used_time=$(echo "$body" | jsonfilter -e '@.result.usedTime' 2>/dev/null)
    last_auth=$(echo "$body" | jsonfilter -e '@.result.lastAuthTime' 2>/dev/null)
    account_id=$(echo "$body" | jsonfilter -e '@.result.accountId' 2>/dev/null)

    cat > "$STATE_DIR/session_info" <<EOJSON
{"authResult":"${auth_result}","usedFlow":${used_flow:-0},"usedTime":${used_time:-0},"lastAuthTime":"${last_auth}","accountId":"${account_id}"}
EOJSON

    log_info "Heartbeat: OK - $auth_result"
    return 0
}

# --- Connectivity Check ---
check_internet() {
    local check_host="${1:-$CHECK_HOST}"

    wget -q -O /dev/null \
        --timeout=8 \
        --no-check-certificate \
        "$check_host" 2>/dev/null
    return $?
}

check_portal_reachable() {
    wget -q -O /dev/null \
        --timeout=8 \
        --no-check-certificate \
        "$AUTH_URL" 2>/dev/null
    return $?
}

# --- Main Auth Loop ---
auth_loop() {
    local section="$1"
    get_auth_config "$section"

    [ "$ENABLED" != "1" ] && {
        log_info "Auth disabled for $section"
        return 0
    }

    [ -z "$USERNAME" ] || [ -z "$PASSWORD" ] && {
        log_error "Missing username or password for $section"
        return 1
    }

    local retries=0

    while true; do
        # Step 1: Check internet connectivity
        if check_internet; then
            # Step 2: Verify session via heartbeat
            if do_heartbeat; then
                log_info "Online, session valid"
                retries=0
                sleep "${CHECK_INTERVAL}"
                continue
            else
                log_warn "Online but session invalid, re-authenticating"
            fi
        fi

        # Step 3: Offline or session expired - re-authenticate
        if ! check_portal_reachable; then
            log_warn "Portal unreachable, waiting ${RETRY_DELAY}s"
            sleep "${RETRY_DELAY}"
            continue
        fi

        if [ "$retries" -ge "$MAX_RETRIES" ]; then
            log_error "Max retries ($MAX_RETRIES), cooldown ${RETRY_DELAY}s"
            sleep "${RETRY_DELAY}"
            retries=0
        fi

        if do_login "$USERNAME" "$PASSWORD"; then
            retries=0
            sleep "${CHECK_INTERVAL}"
        else
            retries=$((retries + 1))
            log_warn "Attempt $retries/$MAX_RETRIES failed, retry in ${RETRY_DELAY}s"
            sleep "${RETRY_DELAY}"
        fi
    done
}

# --- Daemon Control ---
start_daemon() {
    local section="$1"

    if [ -f "$PID_FILE" ]; then
        local old_pid
        old_pid=$(cat "$PID_FILE")
        if kill -0 "$old_pid" 2>/dev/null; then
            log_info "Already running (PID $old_pid)"
            return 0
        fi
        rm -f "$PID_FILE"
    fi

    ( auth_loop "$section" ) &
    local pid=$!
    echo "$pid" > "$PID_FILE"
    log_info "Started (PID $pid)"
}

stop_daemon() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            pkill -P "$pid" 2>/dev/null
            log_info "Stopped (PID $pid)"
        fi
        rm -f "$PID_FILE"
    fi
    echo "stopped" > "$STATUS_FILE"
}

status_daemon() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "running:$pid"
            [ -f "$STATUS_FILE" ] && cat "$STATUS_FILE"
            return 0
        fi
    fi
    echo "stopped"
    return 1
}

# --- Manual commands ---
do_login_manual() {
    local section="$1"
    get_auth_config "$section"
    do_login "$USERNAME" "$PASSWORD"
}

do_logout_manual() {
    local section="$1"
    get_auth_config "$section"
    do_logout "$USERNAME"
}

# --- CLI ---
case "${1:-}" in
    start)
        config_load "$CONFIG"
        config_foreach start_daemon auth
        ;;
    stop)
        stop_daemon
        ;;
    restart)
        stop_daemon
        sleep 1
        config_load "$CONFIG"
        config_foreach start_daemon auth
        ;;
    status)
        status_daemon
        ;;
    login)
        config_load "$CONFIG"
        config_foreach do_login_manual auth
        ;;
    logout)
        config_load "$CONFIG"
        config_foreach do_logout_manual auth
        ;;
    check)
        config_load "$CONFIG"
        config_foreach get_auth_config auth
        if check_internet; then
            echo "online"
        else
            echo "offline"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|login|logout|check}"
        exit 1
        ;;
esac
