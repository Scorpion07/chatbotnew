# TalkSphere AI - Multi-Model AI Chat Interface

A beautiful, modern AI chatbot interface that allows you to interact with multiple AI models from a single, sleek platform.

## 🌟 Features

- **Multi-Model Support**: Switch between GPT-4, Claude, Gemini, and Llama with a single click
- **Beautiful UI**: Modern, gradient-based design with smooth animations
- **Real-time Chat**: Instant messaging with typing indicators
- **Conversation History**: Manage multiple conversations with sidebar navigation
- **Admin Dashboard**: Monitor stats and manage AI bots
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Real-time Updates**: WebSocket integration for live updates

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start the Backend Server** (from the `backend` directory)
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:5000`

2. **Start the Frontend** (from the `frontend` directory, in a new terminal)
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173` (or similar Vite port)

3. **Open your browser** and navigate to the frontend URL

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

App configuration (bots and stats) is stored in `backend/data/config.json` and managed by the backend at runtime. A minimal example shape:

```json
{
  "bots": [
    { "id": 1, "name": "ChatGPT-4o", "provider": "openai", "model": "gpt-4o", "status": "active" }
  ],
  "stats": { "totalChats": 0, "activeBots": 1, "usersOnline": 0 }
}
```

Notes:
- The file is created automatically if missing.
- Do not edit `dist/` frontend assets directly; prefer modifying `frontend/src/**` and rebuilding.

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

