# Jitsi Meet SDK
-keep class org.jitsi.** { *; }
-keep class org.webrtc.** { *; }
-dontwarn org.jitsi.**
-dontwarn org.webrtc.**

# React Native (usato internamente da Jitsi)
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.jni.**

# OkHttp (usato da Jitsi)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Facebook Fresco / Jitsi image pipeline
-dontwarn com.facebook.imagepipeline.nativecode.WebpTranscoder

# Kotlin coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
