# Firebase Storage CORS Configuration

The residency proof upload failed due to a missing CORS configuration in your Firebase Storage bucket. This is required when uploading files directly from your web application (origin: https://neighbhorpro.web.app).

## How to Fix

You must configure your bucket to allow requests from your domain.

### Option 1: Using the provided scripts (Requires Google Cloud SDK / gsutil)

1. Open your terminal in the project root.
2. Ensure you are logged in to Google Cloud:
   ```bash
   gcloud auth login
   ```
3. Run the provided PowerShell script (Windows):
   ```powershell
   .\setup-storage-cors.ps1
   ```
   Or the raw gsutil command:
   ```bash
   gsutil cors set cors.json gs://neighbhorpro.firebasestorage.app
   ```

### Option 2: Using Cloudinary (Recommended)

1. Create a free account at [Cloudinary](https://cloudinary.com/).
2. Get your `Cloud Name` and create an `Unsigned Upload Preset` in the Cloudinary Dashboard (Settings -> Upload).
3. Add these to your `.env.local` file:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_preset_name
   ```
4. Restart your dev server. Cloudinary ignores storage-specific CORS and handles uploads seamlessly.

### Why this happened
The application was attempting to fall back to Firebase Storage because Cloudinary credentials were not found in your environment. Firebase Storage requires a manual CORS policy to allow uploads from non-Google domains.
