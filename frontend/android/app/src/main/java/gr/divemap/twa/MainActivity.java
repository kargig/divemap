package gr.divemap.twa;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        this.registerPlugin(com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth.class);
    }

    @Override
    public void onResume() {
        super.onResume();
        
        if (this.bridge != null && this.bridge.getWebView() != null) {
            // Fix 1 & 5: Enable cookies and Third-Party Cookies
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(this.bridge.getWebView(), true);

            // Fix 4 & Setup: Apply specific WebSettings
            WebSettings webSettings = this.bridge.getWebView().getSettings();
            webSettings.setJavaScriptEnabled(true);
            webSettings.setDomStorageEnabled(true);
            
            // Adjust the User-Agent String as per the article to mimic Chrome
            // Add DivemapApp suffix to bypass backend Turnstile verification for native app users
            String chromeUserAgent = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36 DivemapApp";
            webSettings.setUserAgentString(chromeUserAgent);
        }
    }

    @Override
    public void onBackPressed() {
        if (this.bridge != null && this.bridge.getWebView() != null && this.bridge.getWebView().canGoBack()) {
            this.bridge.getWebView().goBack();
        } else {
            super.onBackPressed();
        }
    }
}
