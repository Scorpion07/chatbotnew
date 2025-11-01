# Google OAuth Setup Guide

## 🔧 **Quick Setup**

### 1. **Google Cloud Console Setup**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API:
   - Go to **APIs & Services > Library**
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to **APIs & Services > Credentials**
   - Click **Create Credentials > OAuth 2.0 Client IDs**
   - Select **Web application**
   - Add authorized origins:
     - `http://localhost:5001` (development)
     - `https://yourdomain.com` (production)
   - Copy the **Client ID**

### 2. **Frontend Configuration**

1. Copy the environment template:
```bash
cp frontend/.env.template frontend/.env.local
```

2. Edit `frontend/.env.local`:
```env
VITE_GOOGLE_CLIENT_ID=your_actual_google_client_id_here
VITE_API_BASE_URL=http://localhost:5000
```

3. Replace the client ID in both Login and Signup components with your actual Google Client ID.

### 3. **Backend Configuration**

The backend is already configured to handle Google OAuth tokens. No additional setup needed.

### 4. **Testing**

1. Start both frontend and backend:
```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

2. Open `http://localhost:5001`
3. Try Google Sign-In on login/signup pages

## 🐛 **Troubleshooting**

**Google Sign-In button not working?**
- Check browser console for errors
- Verify Google Client ID is correct
- Ensure your domain is in authorized origins

**"Google Sign-In not configured" error?**
- Make sure you've set the `VITE_GOOGLE_CLIENT_ID` in `.env.local`
- Restart the frontend server after changing .env files

**Backend not saving Google users?**
- Check backend logs: `pm2 logs` or console output
- Verify database is accessible and has latest schema

## 🔐 **Security Notes**

1. **Never commit the .env.local file** - it's in .gitignore
2. **Use different Client IDs** for development and production
3. **Configure CORS properly** for production deployment
4. **Validate Google tokens** on the backend (already implemented)

## 🚀 **Production Deployment**

For production, add your production domain to Google Cloud Console authorized origins:
- `https://yourdomain.com`
- `https://www.yourdomain.com`

Update the `.env.local` with production values:
```env
VITE_GOOGLE_CLIENT_ID=your_production_google_client_id
VITE_API_BASE_URL=https://yourdomain.com
```