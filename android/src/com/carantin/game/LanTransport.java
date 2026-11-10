package com.carantin.game;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Enumeration;

/** Two-player local-only transport. No cloud, matchmaking, or remote server. */
public final class LanTransport {
    private static final int PORT = 8765;
    private final WebView view;
    private volatile ServerSocket server;
    private volatile Socket peer;
    private volatile DataOutputStream output;
    private volatile boolean hosting;
    private volatile int generation;

    public LanTransport(WebView view) { this.view = view; }

    private void deliver(String kind, String text) {
        final String js = "window.lanReceive(" + JSONObject.quote(kind) + "," + JSONObject.quote(text) + ")";
        view.post(() -> view.evaluateJavascript(js, null));
    }

    @JavascriptInterface
    public String address() {
        String fallback = null;
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface net = interfaces.nextElement();
                if (!net.isUp() || net.isLoopback()) continue;
                Enumeration<InetAddress> addresses = net.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress ip = addresses.nextElement();
                    if (!(ip instanceof Inet4Address) || !ip.isSiteLocalAddress()) continue;
                    String value = ip.getHostAddress();
                    String name = net.getName().toLowerCase(java.util.Locale.ROOT);
                    if (name.startsWith("ap") || name.contains("softap") || name.startsWith("swlan")) return value;
                    if (fallback == null || value.endsWith(".1")) fallback = value;
                }
            }
        } catch (Exception ignored) { }
        return fallback != null ? fallback : "IP точки доступа";
    }

    @JavascriptInterface
    public synchronized void host() {
        close();
        try {
            server = new ServerSocket(PORT);
            hosting = true;
        } catch (IOException error) {
            deliver("error", "Не удалось открыть порт " + PORT + ": " + error.getMessage());
            return;
        }
        deliver("hosting", address() + ":" + PORT);
        final ServerSocket listener = server;
        final int session = generation;
        new Thread(() -> {
            while (hosting && session == generation) {
                try {
                    Socket socket = listener.accept();
                    synchronized (LanTransport.this) {
                        if (!hosting || session != generation) { socket.close(); break; }
                        if (peer != null && !peer.isClosed()) { socket.close(); continue; }
                        attach(socket);
                    }
                    read(socket, 8192);
                } catch (IOException e) {
                    if (hosting && session == generation) deliver("error", "Соединение прервано");
                }
            }
        }, "carantin-lan-host").start();
    }

    @JavascriptInterface
    public synchronized void join(String ip) {
        close();
        // Never connect outside a private LAN; port is fixed, so no arbitrary socket proxy.
        if (ip == null || !ip.matches("(?:10\\.(?:\\d{1,3}\\.){2}\\d{1,3}|192\\.168\\.(?:\\d{1,3}\\.)\\d{1,3}|172\\.(?:1[6-9]|2[0-9]|3[01])\\.(?:\\d{1,3}\\.)\\d{1,3})")) {
            deliver("error", "Введи локальный IP ведущего (например, 192.168.43.1)");
            return;
        }
        final int session = generation;
        new Thread(() -> {
            try {
                Socket socket = new Socket();
                socket.connect(new java.net.InetSocketAddress(ip, PORT), 5000);
                synchronized (LanTransport.this) {
                    if (session != generation) { socket.close(); return; }
                    attach(socket);
                }
                read(socket, 1048576);
            } catch (IOException e) {
                if (session == generation) deliver("error", "Не удалось подключиться. Проверь IP и точку доступа.");
            }
        }, "carantin-lan-join").start();
    }

    private void attach(Socket socket) throws IOException {
        socket.setTcpNoDelay(true);
        socket.setSoTimeout(30000);
        peer = socket;
        output = new DataOutputStream(socket.getOutputStream());
        deliver("connected", "Игрок подключён");
    }

    private void read(Socket socket, int maxSize) {
        try {
            DataInputStream input = new DataInputStream(socket.getInputStream());
            while (!socket.isClosed()) {
                int size = input.readInt();
                if (size < 1 || size > maxSize) throw new IOException("Invalid packet");
                byte[] payload = new byte[size];
                input.readFully(payload);
                deliver("data", new String(payload, java.nio.charset.StandardCharsets.UTF_8));
            }
        } catch (IOException ignored) {
        } finally {
            synchronized (this) {
                if (peer == socket) {
                    try { socket.close(); } catch (IOException ignored) { }
                    peer = null; output = null;
                    deliver("disconnected", "Другой игрок вышел из сети");
                }
            }
        }
    }

    @JavascriptInterface
    public synchronized void send(String message) {
        if (output == null || message == null) return;
        byte[] bytes = message.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (bytes.length > 1048576) return;
        try {
            output.writeInt(bytes.length);
            output.write(bytes);
            output.flush();
        } catch (IOException ignored) { closePeer(); }
    }

    private void closePeer() {
        Socket old = peer;
        peer = null; output = null;
        if (old != null) try { old.close(); } catch (IOException ignored) { }
    }

    @JavascriptInterface
    public synchronized void close() {
        generation++;
        hosting = false;
        ServerSocket old = server;
        server = null;
        if (old != null) try { old.close(); } catch (IOException ignored) { }
        closePeer();
    }
}
