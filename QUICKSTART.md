# 🚀 Quick Start Guide

## First Time Setup (Run Once)

1. **Double-click** `install.bat` to install all dependencies
   - This will install both backend and frontend packages
   - Wait for the installation to complete (may take a few minutes)

## Running the Application

1. **Double-click** `start.bat` to start both servers
   - This will open 2 command windows:
     - Backend server (Port 5000)
     - Frontend dev server (Port 5173)

2. **Open your browser** and go to: `http://localhost:5173`

## Manual Start (Alternative)

If you prefer to start manually:

### Backend
```bash
cd backend
npm run dev
```

### Frontend (in a new terminal)
```bash
cd frontend
npm run dev
```

## What You'll See

1. **Home Page**
   - Beautiful landing page with hero section
   - Feature showcase
   - Interactive chat preview
   - Call-to-action buttons

2. **Chat Interface**
   - Click "Start Chat" button
   - Select AI model (GPT-4, Claude, Gemini, Llama)
   - Type your message and press Enter
   - View conversation history in sidebar
   - Create new conversations

3. **Admin Dashboard**
   - Click the settings icon ⚙️
   - View statistics
   - Manage AI bots
   - Update system data

## Navigation

- **Home**: Landing page with features
- **Start Chat**: Main chat interface
- **⚙️ Settings**: Admin dashboard

## Features to Try

✅ Switch between different AI models
✅ Start multiple conversations
✅ Toggle sidebar visibility
✅ View real-time typing indicators
✅ Browse conversation history
✅ Check admin statistics

## Troubleshooting

### Port Already in Use
If you get an error that port 5000 or 5173 is already in use:
1. Close the application
2. Kill any Node processes
3. Run `start.bat` again

### Dependencies Not Installed
If you see errors about missing modules:
1. Run `install.bat` again
2. Make sure you have Node.js installed
3. Check your internet connection

### Page Not Loading
1. Make sure both servers are running (2 command windows)
2. Check that backend shows "Server running on port 5000"
3. Check that frontend shows "Local: http://localhost:5173"
4. Refresh your browser

## Default URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Backend API Docs**: http://localhost:5000/api

## Stopping the Application

To stop the application:
1. Go to each command window
2. Press `Ctrl + C`
3. Confirm with `Y` when prompted

## Notes

- This is a **demo application** with simulated AI responses
- To connect real AI APIs, you'll need to integrate OpenAI, Anthropic, or Google APIs
- The UI is fully functional and responsive
- All animations and transitions work out of the box

## Need Help?

Check the full `README.md` for detailed documentation.

---

**Enjoy TalkSphere AI! 🎉**

