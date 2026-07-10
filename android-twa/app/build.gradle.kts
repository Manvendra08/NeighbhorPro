plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // Uncomment for Firebase App Distribution (sharing APKs with reviewers):
    // id("com.google.firebase.appdistribution") version "5.0.0"
}

android {
    namespace = "com.proneighbor.twa"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.proneighbor.twa"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    // Signing config — generate your own keystore and replace these paths
    // See: https://developer.android.com/studio/publish/app-signing
    signingConfigs {
        create("release") {
            storeFile = file("keystore.jks")         // ← GENERATE YOUR OWN
            storePassword = System.getenv("KEYSTORE_PASSWORD") ?: "CHANGE_ME"
            keyAlias = System.getenv("KEY_ALIAS") ?: "proneighbor"
            keyPassword = System.getenv("KEY_PASSWORD") ?: "CHANGE_ME"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            // debug uses the default Android debug keystore
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.browser:browser:1.8.0")

    // Google's official TWA helper library — handles verification,
    // splash screen, offline fallback, and Custom Tabs lifecycle
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}
