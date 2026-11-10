package com.carantin.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private WebView webView;
    private LanTransport lanTransport;
    private long lastBackPressMs = 0L;

    @SuppressWarnings("deprecation")
    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        if (Build.VERSION.SDK_INT >= 24) {
            try {
                ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                        return serveLocalAsset(request.getUrl());
                    }
                });
            } catch (Throwable ignored) {
            }
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#081012"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHapticFeedbackEnabled(false);
        webView.setOnLongClickListener(v -> true);
        webView.setLongClickable(false);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        lanTransport = new LanTransport(webView);
        webView.addJavascriptInterface(lanTransport, "CarantinLan");
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setUseWideViewPort(true);
        ws.setLoadWithOverviewMode(true);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setAllowFileAccess(true);
        ws.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !ASSET_HOST.equals(request.getUrl().getHost());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !ASSET_HOST.equals(Uri.parse(url).getHost());
            }
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse res = serveLocalAsset(request.getUrl());
                return res != null ? res : super.shouldInterceptRequest(view, request);
            }
        });

        setContentView(webView);
        hideSystemUI();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("https://" + ASSET_HOST + "/index.html");
        }
    }

    private WebResourceResponse serveLocalAsset(Uri url) {
        if (url == null || !ASSET_HOST.equals(url.getHost())) {
            return null;
        }
        String path = url.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) {
            path = "index.html";
        } else if (path.startsWith("/")) {
            path = path.substring(1);
        }
        if ("favicon.ico".equals(path)) {
            path = "icon-192.png";
        }
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-store");
        if (path.contains("..")) {
            return new WebResourceResponse(
                "text/plain", "UTF-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0])
            );
        }
        try {
            InputStream is = getAssets().open("www/" + path);
            String mime = guessMime(path);
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, is);
        } catch (IOException ignored) {
            return new WebResourceResponse(
                "text/plain", "UTF-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0])
            );
        }
    }

    private String guessMime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".css")) return "text/css";
        return "application/octet-stream";
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        hideSystemUI();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){var ids=['lanModal','mapModal','codexModal','shop','npcModal','pauseScreen'];" +
                "for(var i=0;i<ids.length;i++){var el=document.getElementById(ids[i]);" +
                "if(el&&el.style.display==='flex'){window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return 'closed';}}" +
                "return 'none';})()",
                value -> {
                    if (value != null && value.contains("closed")) {
                        return;
                    }
                    long now = System.currentTimeMillis();
                    if (now - lastBackPressMs < 1800) {
                        finish();
                    } else {
                        lastBackPressMs = now;
                        Toast.makeText(MainActivity.this, "Нажмите «Назад» ещё раз для выхода", Toast.LENGTH_SHORT).show();
                    }
                }
            );
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (lanTransport != null) lanTransport.close();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
