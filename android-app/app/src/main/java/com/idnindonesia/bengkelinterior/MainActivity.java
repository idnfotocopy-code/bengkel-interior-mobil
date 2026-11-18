package com.idnindonesia.bengkelinterior;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Aplikasi Android Bengkel Interior Mobil — pembungkus WebView untuk server web bengkel.
 * Alamat server tidak dikunci: diisi saat pertama kali dibuka dan bisa diubah kapan saja
 * (tombol ⚙ di halaman login, halaman "Tidak dapat terhubung", atau tombol Menu HP).
 */
public class MainActivity extends Activity {
    private static final int FILE_REQ = 1001;
    private static final int PERM_REQ = 1002;
    private static final String PREFS = "bengkel";
    private static final String PAGE = "file:///android_asset/server.html";

    private WebView web;
    private ProgressBar bar;
    private TextView gear;
    private ValueCallback<Uri[]> fileCb;
    private Uri cameraUri;
    private volatile boolean onAssetPage = false;
    private volatile String pageMode = "setup";
    private String[] pendingDownload;
    private BroadcastReceiver dlReceiver;
    private final java.util.Set<Long> myDownloads = java.util.Collections.synchronizedSet(new java.util.HashSet<Long>());
    private boolean clearHistoryNext = false;

    // ---------- alamat server ----------
    private String savedUrl() {
        String u = getSharedPreferences(PREFS, MODE_PRIVATE).getString("base_url", null);
        return u == null ? null : u.replaceAll("/+$", "");
    }
    private String defaultUrl() { return getString(R.string.default_url).replaceAll("/+$", ""); }
    private String baseUrl() { String s = savedUrl(); return s != null ? s : defaultUrl(); }

    private boolean isOwnSite(Uri u) {
        Uri b = Uri.parse(baseUrl());
        if (u == null || b.getHost() == null || !b.getHost().equalsIgnoreCase(u.getHost())) return false;
        return b.getPort() == u.getPort() || b.getPort() == -1 || u.getPort() == -1;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#2a2019"));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        root.addView(bar, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4)));

        // Tombol ⚙ kecil (hanya tampil di halaman login) untuk mengubah alamat server
        gear = new TextView(this);
        gear.setText("⚙");
        gear.setTextSize(22);
        gear.setTextColor(Color.WHITE);
        gear.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor("#CC2a2019"));
        gear.setBackground(bg);
        gear.setContentDescription("Ubah alamat server");
        gear.setOnClickListener(v -> showServerPage("change"));
        FrameLayout.LayoutParams glp = new FrameLayout.LayoutParams(dp(46), dp(46), Gravity.BOTTOM | Gravity.END);
        glp.setMargins(0, 0, dp(14), dp(14));
        gear.setVisibility(View.GONE);
        root.addView(gear, glp);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " BengkelInteriorApp/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.addJavascriptInterface(new Bridge(), "App");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) { return handleUrl(req.getUrl()); }
            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) { return handleUrl(Uri.parse(url)); }
            @Override
            public void onPageStarted(WebView v, String url, Bitmap f) {
                onAssetPage = url != null && url.startsWith(PAGE);
                bar.setVisibility(View.VISIBLE);
                updateGear(url);
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                bar.setVisibility(View.GONE);
                updateGear(url);
                if (clearHistoryNext && url != null && !url.startsWith(PAGE)) { clearHistoryNext = false; v.clearHistory(); }
                CookieManager.getInstance().flush();
            }
            @Override
            public void doUpdateVisitedHistory(WebView v, String url, boolean reload) { updateGear(url); }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (Build.VERSION.SDK_INT >= 23 && req.isForMainFrame()) showServerPage("offline");
            }
            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView v, int code, String desc, String url) {
                if (Build.VERSION.SDK_INT < 23) showServerPage("offline");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) { bar.setProgress(p); }
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                return openChooser(cb, params);
            }
        });
        web.setDownloadListener((url, ua, disposition, mime, len) -> download(url, ua, disposition, mime));

        dlReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) { openDownloaded(i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)); }
        };
        IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(dlReceiver, f, Context.RECEIVER_EXPORTED);
        else registerReceiver(dlReceiver, f);

        if (state != null) web.restoreState(state);
        else if (savedUrl() == null) showServerPage("setup");
        else web.loadUrl(baseUrl() + "/");
    }

    private void updateGear(String url) {
        boolean show = false;
        if (url != null && !url.startsWith(PAGE)) {
            Uri u = Uri.parse(url);
            String p = u.getPath() == null ? "" : u.getPath();
            show = p.startsWith("/login");
        }
        gear.setVisibility(show ? View.VISIBLE : View.GONE);
    }

    private void showServerPage(String mode) {
        pageMode = mode;
        bar.setVisibility(View.GONE);
        web.loadUrl(PAGE);
    }

    private boolean handleUrl(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        if (("https".equals(scheme) || "http".equals(scheme)) && isOwnSite(u)) return false;
        if ("file".equals(scheme)) return false;
        // Tautan luar (WhatsApp, telepon, peta, situs lain) dibuka di aplikasi lain
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) {
            Toast.makeText(this, "Tidak dapat membuka tautan", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    // ---------- unggah file (foto progres, sampel jenis pekerjaan, logo, dll.) ----------
    private boolean openChooser(ValueCallback<Uri[]> cb, WebChromeClient.FileChooserParams params) {
        if (fileCb != null) fileCb.onReceiveValue(null);
        fileCb = cb;
        cameraUri = null;
        try {
            Intent pick = params.createIntent();
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
            Intent chooser = Intent.createChooser(pick, "Pilih file / foto");
            boolean wantsImage = false;
            for (String a : params.getAcceptTypes()) if (a == null || a.isEmpty() || a.startsWith("image")) wantsImage = true;
            if (wantsImage && Build.VERSION.SDK_INT >= 29) {
                try {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Images.Media.DISPLAY_NAME, "bengkel_" + System.currentTimeMillis() + ".jpg");
                    cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Bengkel");
                    cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                    if (cameraUri != null) {
                        Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                        cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
                    }
                } catch (Exception ignored) { cameraUri = null; }
            }
            startActivityForResult(chooser, FILE_REQ);
        } catch (ActivityNotFoundException e) {
            fileCb = null;
            Toast.makeText(this, "Tidak ada aplikasi pemilih file", Toast.LENGTH_SHORT).show();
            return false;
        }
        return true;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ && fileCb != null) {
            Uri[] result = null;
            if (res == RESULT_OK) {
                result = WebChromeClient.FileChooserParams.parseResult(res, data);
                if ((result == null || result.length == 0) && data != null && data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
                }
                if ((result == null || result.length == 0) && cameraUri != null) result = new Uri[]{cameraUri};
            }
            if ((result == null || result.length == 0) && cameraUri != null) {
                try { getContentResolver().delete(cameraUri, null, null); } catch (Exception ignored) {}
            }
            fileCb.onReceiveValue(result);
            fileCb = null;
            cameraUri = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    // ---------- unduh PDF / Excel / backup ----------
    private void download(String url, String ua, String disposition, String mime) {
        if (url.startsWith("blob:") || url.startsWith("data:")) {
            Toast.makeText(this, "Unduhan jenis ini belum didukung di aplikasi; buka lewat Chrome.", Toast.LENGTH_LONG).show();
            return;
        }
        if (Build.VERSION.SDK_INT >= 23 && Build.VERSION.SDK_INT <= 28
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingDownload = new String[]{url, ua, disposition, mime};
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, PERM_REQ);
            return;
        }
        try {
            String name = URLUtil.guessFileName(url, disposition, mime);
            if (mime != null && mime.contains("pdf") && !name.toLowerCase().endsWith(".pdf")) name = name.replaceAll("\\.[A-Za-z0-9]+$", "") + ".pdf";
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setMimeType(mime);
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) r.addRequestHeader("Cookie", cookie);
            r.addRequestHeader("User-Agent", ua);
            r.setTitle(name);
            r.setDescription("Mengunduh dari " + getString(R.string.app_name));
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            myDownloads.add(((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r));
            Toast.makeText(this, "Mengunduh " + name + " … (folder Download)", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
        }
    }

    private void openDownloaded(long id) {
        if (id < 0 || !myDownloads.remove(id)) return;
        try {
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            Uri u = dm.getUriForDownloadedFile(id);
            if (u == null) return;
            String type = dm.getMimeTypeForDownloadedFile(id);
            Intent v = new Intent(Intent.ACTION_VIEW);
            v.setDataAndType(u, type);
            v.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(v);
        } catch (Exception e) {
            Toast.makeText(this, "Unduhan selesai. Buka dari folder Download.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req == PERM_REQ && pendingDownload != null) {
            String[] d = pendingDownload; pendingDownload = null;
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) download(d[0], d[1], d[2], d[3]);
            else Toast.makeText(this, "Izin penyimpanan ditolak, file tidak bisa diunduh.", Toast.LENGTH_LONG).show();
            return;
        }
        super.onRequestPermissionsResult(req, perms, res);
    }

    /** Dipanggil hanya dari halaman bawaan aplikasi (assets/server.html). */
    private class Bridge {
        @JavascriptInterface public String getMode() { return onAssetPage ? pageMode : ""; }
        @JavascriptInterface public String getBaseUrl() { return onAssetPage ? (savedUrl() == null ? "" : savedUrl()) : ""; }
        @JavascriptInterface public String getDefaultUrl() { return onAssetPage ? defaultUrl() : ""; }
        @JavascriptInterface public String getVersion() { return BuildConfig.VERSION_NAME; }
        @JavascriptInterface public void retry() {
            if (!onAssetPage) return;
            runOnUiThread(() -> { if (savedUrl() == null) showServerPage("setup"); else { clearHistoryNext = true; web.loadUrl(baseUrl() + "/"); } });
        }
        @JavascriptInterface public String setBaseUrl(String u) {
            if (!onAssetPage) return "Tidak diizinkan";
            if (u == null || u.trim().isEmpty()) return "Alamat server belum diisi.";
            u = u.trim().replaceAll("/+$", "");
            Uri p = Uri.parse(u);
            String sc = p.getScheme() == null ? "" : p.getScheme().toLowerCase();
            if (!("https".equals(sc) || "http".equals(sc)) || p.getHost() == null || p.getHost().isEmpty())
                return "Alamat tidak valid. Contoh: https://xxxx.trycloudflare.com";
            String base = sc + "://" + p.getHost() + (p.getPort() > 0 ? ":" + p.getPort() : "");
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("base_url", base).apply();
            final String target = base + "/login";
            runOnUiThread(() -> { clearHistoryNext = true; web.loadUrl(target); });
            return "ok";
        }
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent e) {
        if (keyCode == KeyEvent.KEYCODE_MENU) { showServerPage("change"); return true; }
        return super.onKeyUp(keyCode, e);
    }

    @Override
    public void onBackPressed() {
        if (onAssetPage) {
            if ("change".equals(pageMode) && savedUrl() != null) { clearHistoryNext = true; web.loadUrl(baseUrl() + "/"); return; }
            super.onBackPressed();
            return;
        }
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(dlReceiver); } catch (Exception ignored) {}
        super.onDestroy();
    }
}
