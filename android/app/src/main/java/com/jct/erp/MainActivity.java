package com.jct.erp;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final String ERP_GUARD_JS =
    "(function(){"
      + "if(window.__jctErpGuard)return;window.__jctErpGuard=1;"
      + "var P=['/login','/dashboard','/profile','/customers','/inquiries','/sales','/quotations',"
      + "'/agents','/my-verification','/bulk-upload','/vehicles','/auctions','/purchases','/invoices',"
      + "'/auction-invoices','/payments','/remittance-insights','/commissions','/expenses','/ledger',"
      + "'/shipments','/documents','/offices','/tasks','/suppliers','/notifications','/reports',"
      + "'/blog-admin','/users','/settings','/configuration','/admin','/audit','/permissions',"
      + "'/api','/_next','/icons','/images','/brand','/favicon','/manifest'];"
      + "function ok(p){if(!p||p==='/')return false;for(var i=0;i<P.length;i++){"
      + "var x=P[i];if(p===x||p.indexOf(x+'/')===0)return true;}"
      + "return p.indexOf('/favicon')===0||p.indexOf('/manifest')===0;}"
      + "function guard(){try{if(!ok(location.pathname))"
      + "location.replace('https://jctproject.vercel.app/login');}catch(e){}}"
      + "var ps=history.pushState,rs=history.replaceState;"
      + "history.pushState=function(){ps.apply(this,arguments);guard();};"
      + "history.replaceState=function(){rs.apply(this,arguments);guard();};"
      + "window.addEventListener('popstate',guard);guard();"
      + "})();";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (getBridge() == null) return;

    getBridge()
      .getWebView()
      .setWebViewClient(
        new ErpWebViewClient(getBridge()) {
          @Override
          public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            view.evaluateJavascript(ERP_GUARD_JS, null);
          }
        }
      );
  }
}
