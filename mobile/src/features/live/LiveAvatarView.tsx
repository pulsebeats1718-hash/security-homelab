import type { RefObject } from "react";
import { StyleSheet } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { config, liveHostUrl } from "../../services/config";
import { colors } from "../../theme/tokens";

/** react-native-webview 14 types default P to `undefined`, which makes props `never`; pin it. */
export type HostWebView = WebView<object>;

/**
 * Hosts the provider's live avatar. The Nuance SDK is a browser SDK, so it runs
 * in a locked-down WebView pointing at our own Worker; the rest of the call UI
 * is native and talks to it over the JSON bridge.
 */
export function LiveAvatarView({
  webViewRef,
  onMessage,
  onLoadFailed,
  onCrashed,
}: {
  webViewRef: RefObject<HostWebView | null>;
  onMessage: (event: WebViewMessageEvent) => void;
  onLoadFailed: (message: string) => void;
  onCrashed: () => void;
}) {
  const origin = config.apiBaseUrl;
  return (
    <WebView<object>
      ref={webViewRef}
      source={{ uri: liveHostUrl() }}
      style={styles.webview}
      containerStyle={styles.webview}
      onMessage={onMessage}
      // Only our own host page may load in this view.
      originWhitelist={[`${origin}*`]}
      onShouldStartLoadWithRequest={(request) => request.url.startsWith(origin) || request.url.startsWith("about:") || request.url.startsWith("blob:")}
      setSupportMultipleWindows={false}
      javaScriptEnabled
      domStorageEnabled
      // Media: autoplay Sophie's audio/video, allow the microphone for our page only.
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
      allowsBackForwardNavigationGestures={false}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      androidLayerType="hardware"
      webviewDebuggingEnabled={__DEV__}
      onError={(event) => onLoadFailed(event.nativeEvent.description || "network error")}
      onHttpError={(event) => onLoadFailed(`HTTP ${event.nativeEvent.statusCode}`)}
      onRenderProcessGone={onCrashed}
      onContentProcessDidTerminate={onCrashed}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: colors.ink },
});
