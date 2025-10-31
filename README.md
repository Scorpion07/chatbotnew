# 🌐 TalkSphere

A modern, mobile-responsive chat application with multiple AI models (GPT-4, Claude, Gemini) accessible from one beautiful interface.

**Live Demo:** [https://talk-sphere.com](https://talk-sphere.com)

## 🚀 One-Command Setup

```bash
curl -fsSL https://raw.githubusercontent.com/Scorpion07/chatbotnew/main/install.sh | bash
```

**That's it!** The script handles everything:
- ✅ System dependencies (Node.js, Nginx, SQLite)
- ✅ Build tools (bcrypt native compilation)
- ✅ Database setup and initialization
- ✅ Frontend build and deployment
- ✅ Backend with PM2 process management
- ✅ Nginx reverse proxy configuration
- ✅ SSL-ready setup
- ✅ Test account creation
- ✅ Mobile-responsive design

## 📱 Features

- **Multiple AI Models**: GPT-4, Claude, Gemini, Perplexity
- **Mobile Responsive**: Works perfectly on all devices
- **User Authentication**: JWT-based auth system
- **Premium Features**: Subscription model with usage limits
- **Admin Panel**: User management and analytics
- **Real-time Chat**: WebSocket-powered messaging
- **File Uploads**: Image and document support
- **Voice Input**: Speech-to-text integration

## 🔑 Default Login

After setup, use these test accounts:
- **Free User**: test1@test.com / password123
- **Premium User**: premium1@test.com / password123

## ⚙️ API Keys Setup

1. Edit the environment file:
   ```bash
   nano backend/.env
   ```

2. Add your API keys:
   ```env
   OPENAI_API_KEY=your_openai_key
   CLAUDE_API_KEY=your_claude_key
   GEMINI_API_KEY=your_gemini_key
   ```

3. Restart the backend:
   ```bash
   pm2 restart all
   ```

## 📁 Project Structure

```
chatbotapp-clone/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express server with Socket.IO
│   │   ├── models/            # Database models
│   │   ├── routes/            # API routes
│   │   └── services/          # Business logic
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # App entry point
│   │   ├── pages/
│   │   │   ├── App.jsx        # Main app component with navigation
│   │   │   ├── Home.jsx       # Landing page
│   │   │   ├── Chat.jsx       # Chat interface
│   │   │   └── Admin.jsx      # Admin dashboard
│   │   └── styles/
│   │       └── tailwind.css   # Tailwind styles
│   ├── index.html
│   └── package.json
└── README.md
```

## 🎨 Pages Overview

### Home Page
- Hero section with call-to-action
- Interactive chat preview
- Features showcase
- Footer with links

### Chat Page
- Multi-model selector (GPT-4, Claude, Gemini, Llama)
- Real-time chat interface
- Conversation history sidebar
- Message input with character counter
- Typing indicators

### Admin Dashboard
- View and manage AI bots
- Real-time statistics
- Add/remove bots
- Update system stats

## 🛠️ Technologies Used

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Socket.IO Client** - WebSocket communication

### Backend
- **Express** - Web framework
- **Socket.IO** - Real-time communication
- **Sequelize** - ORM
- **SQLite** - Database
- **CORS** - Cross-origin resource sharing

## 🎯 Usage

1. **Home Page**: Learn about the platform and its features
2. **Start Chat**: Click "Start Chat" to begin a conversation
3. **Select Model**: Choose your preferred AI model from the top bar
4. **Chat**: Type your message and press Enter or click Send
5. **New Conversation**: Click "New Chat" in the sidebar to start fresh
6. **Admin Panel**: Click the settings icon to access the admin dashboard

## 🔧 Configuration

The backend configuration can be modified in `backend/config.json`:
```json
{
  "server": {
    "port": 5000
  },
  "database": {
    "path": "./database.sqlite"
  }
}
```

## 📝 API Endpoints

### Bots
- `GET /api/bots` - Get all bots
- `POST /api/bots` - Create a new bot
- `DELETE /api/bots/:id` - Delete a bot

### Stats
- `GET /api/stats` - Get system statistics
- `POST /api/stats` - Update statistics

## 🌐 WebSocket Events

- `bots:update` - Bot list updated
- `stats:update` - Statistics updated

## 🎨 Customization

### Colors
The app uses Tailwind CSS. You can customize colors in `frontend/tailwind.config.cjs`.

### Models
Add or modify AI models in `frontend/src/pages/Chat.jsx`:
```javascript
const models = [
  { name: 'GPT-4', icon: '🤖', color: 'from-green-500 to-emerald-600', description: 'Most capable model' },
  // Add more models here
];
```

## 📱 Responsive Design

The interface is fully responsive and adapts to:
- Desktop (1920px+)
- Laptop (1024px - 1919px)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🚀 Deployment

### Frontend
```bash
cd frontend
npm run build
# Deploy the 'dist' folder to your hosting service
```

### Backend
```bash
cd backend
npm start
# Deploy to your Node.js hosting service
```

## 📄 License

This project is open source and available for educational purposes.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 💡 Tips

- Use **Shift+Enter** for new lines in the chat input
- The sidebar can be toggled using the menu button
- Demo mode shows simulated responses - integrate real AI APIs for production use
- Character counter helps manage message length

## 🔮 Future Enhancements

- [ ] Real AI API integration (OpenAI, Anthropic, Google)
- [ ] User authentication
- [ ] Message history persistence
- [ ] File upload support
- [ ] Voice input/output
- [ ] Code syntax highlighting
- [ ] Export conversations
- [ ] Dark mode toggle

## 📞 Support

For questions or issues, please open an issue on the repository.

---

Built with ❤️ using React, Vite, and Tailwind CSS

