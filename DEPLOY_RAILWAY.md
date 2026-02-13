# Railway Deployment Guide

This application is configured to use SQLite with file persistence. Deployment on Railway is simple but requires setting up a Volume.

## Prerequisites
- GitHub account
- Railway account (https://railway.app/)

## Step-by-Step Deployment

1.  **Push to GitHub**
    - Ensure this project is pushed to a GitHub repository.

2.  **Create New Project on Railway**
    - Go to Railway Dashboard.
    - Click "New Project" -> "Deploy from GitHub repo".
    - Select your repository.

3.  **Configure Environment Variables**
    - Go to the "Variables" tab in your Railway service.
    - Add the following variables (copy values from your local `.env` if needed):
        - `SESSION_SECRET`: (Generate a random string)
        - `MASTER_PASS`: (Set a strong password for master admin)

4.  **Add a Volume (Crucial for Data Persistence)**
    - Go to the "Volumes" tab (or command palette `Cmd+K` -> "Add Volume").
    - Create a new volume.
    - **Mount Path**: `/app/data`
    - **Note**: The application now expects data to be in `data/`, so mounting a volume here ensures `db.sqlite` and uploaded images are saved permanently.

5.  **Deploy**
    - Railway usually deploys automatically on push. If not, click "Deploy".
    - Wait for the build to finish.

6.  **Access Your App**
    - Go to "Settings" -> "Networking" -> "Generate Domain" to get a public URL.
    - Visit the URL.
    - Access `/master` to log in with your `MASTER_PASS`.

## Troubleshooting
- **Data disappeared?** Check if the Volume is correctly mounted to `/app/data`.
- **Build failed?** Check the "Build Logs". Ensure `package.json` has the correct start script (`node server.js`).
