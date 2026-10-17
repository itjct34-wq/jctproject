package com.jct.erp;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Arrays;
import java.util.List;

/**
 * Keeps the WebView on ERP / auth routes. Public marketing paths redirect to /login.
 * Client-side Next.js navigations are also guarded via injected JS in MainActivity.
 */
public class ErpWebViewClient extends BridgeWebViewClient {
  private static final String ERP_HOST = "jctproject.vercel.app";
  private static final String LOGIN_URL = "https://jctproject.vercel.app/login";

  /** Prefixes allowed for same-origin main-frame navigations. */
  private static final List<String> ALLOWED_PREFIXES = Arrays.asList(
    "/login",
    "/dashboard",
    "/profile",
    "/customers",
    "/inquiries",
    "/sales",
    "/quotations",
    "/agents",
    "/my-verification",
    "/bulk-upload",
    "/vehicles",
    "/auctions",
    "/purchases",
    "/invoices",
    "/auction-invoices",
    "/payments",
    "/remittance-insights",
    "/commissions",
    "/expenses",
    "/ledger",
    "/shipments",
    "/documents",
    "/offices",
    "/tasks",
    "/suppliers",
    "/notifications",
    "/reports",
    "/blog-admin",
    "/users",
    "/settings",
    "/configuration",
    "/admin",
    "/audit",
    "/permissions",
    "/api",
    "/_next",
    "/icons",
    "/images",
    "/brand",
    "/favicon",
    "/manifest"
  );

  public ErpWebViewClient(Bridge bridge) {
    super(bridge);
  }

  static boolean isAllowedPath(String path) {
    if (path == null || path.isEmpty()) return false;
    if ("/".equals(path)) return false;
    for (String prefix : ALLOWED_PREFIXES) {
      if (path.equals(prefix) || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) {
        return true;
      }
      // Exact file matches like /favicon.ico /manifest.webmanifest
      if (prefix.equals("/favicon") && path.startsWith("/favicon")) return true;
      if (prefix.equals("/manifest") && path.startsWith("/manifest")) return true;
    }
    return false;
  }

  @Override
  public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
    Uri url = request.getUrl();
    if (url == null) {
      return super.shouldOverrideUrlLoading(view, request);
    }

    String host = url.getHost();
    if (host != null && host.contains("supabase.co")) {
      return super.shouldOverrideUrlLoading(view, request);
    }

    if (ERP_HOST.equals(host) && request.isForMainFrame()) {
      String path = url.getPath();
      if (!isAllowedPath(path)) {
        view.loadUrl(LOGIN_URL);
        return true;
      }
    }

    return super.shouldOverrideUrlLoading(view, request);
  }
}
