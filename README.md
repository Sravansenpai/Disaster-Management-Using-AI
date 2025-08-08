# Disaster Management System

A comprehensive crowd-sourced disaster management platform that connects volunteers with people in need during emergencies. Built with React, Node.js, and MongoDB.

## 🌟 Features

### Core Functionality
- **Real-time Aid Requests**: Submit medical and transport aid requests
- **Volunteer Matching**: KNN algorithm for intelligent volunteer matching based on location
- **SMS Notifications**: Automated SMS alerts to nearby volunteers via Vonage API
- **Interactive Maps**: Google Maps integration for location-based services
- **AI Chatbot**: OpenAI-powered chatbot for emergency assistance
- **Voice Recognition**: Speech-to-text functionality for hands-free operation
- **Feedback System**: Rating and feedback mechanism for volunteers

### Technical Features
- **K-Nearest Neighbors (KNN) Algorithm**: Intelligent volunteer matching using Euclidean distance
- **Geolocation Services**: Haversine formula for accurate distance calculations
- **Real-time Notifications**: WebSocket-like communication for instant updates
- **File Upload**: Support for image and document uploads
- **Responsive Design**: Mobile-first approach with Bootstrap

## 🏗️ Architecture

### Frontend (React)
- **React 18** with modern hooks
- **React Router** for navigation
- **Google Maps API** for location services
- **Bootstrap** for responsive UI
- **React Icons** for consistent iconography

### Backend (Node.js/Express)
- **Express.js** server with RESTful APIs
- **MongoDB** with Mongoose ODM
- **Vonage API** for SMS services
- **OpenAI API** for chatbot functionality
- **Multer** for file uploads

### Database Models
- **Volunteer**: User profiles with skills, location, and availability
- **MedicalAid**: Medical emergency requests
- **TransportAid**: Transportation assistance requests
- **Notification**: SMS and system notifications
- **Feedback**: User ratings and reviews

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd exceed
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/disasterManagement
   PORT=5001
   
   # Vonage (SMS) Configuration
   VONAGE_API_KEY=your_api_key
   VONAGE_API_SECRET=your_api_secret
   VONAGE_VIRTUAL_NUMBER=your_virtual_number
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Start MongoDB**
   ```bash
   # Windows (as Administrator)
   net start MongoDB
   
   # Or start manually
   mongod --dbpath C:\data\db
   ```

5. **Run the application**
   ```bash
   # Development mode (both frontend and backend)
   npm run dev:both
   
   # Or run separately
   npm run server  # Backend only
   npm start       # Frontend only
   ```

## 📱 Usage

### For Aid Seekers
1. **Submit Aid Request**: Choose between medical or transport assistance
2. **Location Services**: Use GPS or enter address manually
3. **Real-time Updates**: Track volunteer responses and status
4. **Chat Support**: Use AI chatbot for immediate assistance

### For Volunteers
1. **Registration**: Create profile with skills and location
2. **Availability**: Set availability status
3. **Notifications**: Receive SMS alerts for nearby requests
4. **Response**: Accept or decline aid requests
5. **Feedback**: Rate and review completed assistance

## 🔧 API Endpoints

### Aid Requests
- `POST /api/medical-aid` - Submit medical aid request
- `POST /api/transport-aid` - Submit transport aid request
- `GET /api/aid-requests` - Get all aid requests

### Volunteers
- `POST /api/volunteers` - Register new volunteer
- `GET /api/volunteers` - Get volunteers (with location filtering)
- `PUT /api/volunteers/:id` - Update volunteer profile

### Notifications
- `POST /api/notify-volunteers` - Send notifications to volunteers
- `GET /api/notifications/:type/:id` - Get notification history

## 🧠 AI Features

### KNN Algorithm Implementation
```javascript
function findKNearestNeighbors(volunteers, targetLocation, k = 5) {
  const volunteersWithDistance = volunteers.map(volunteer => ({
    ...volunteer,
    distance: calculateEuclideanDistance(
      { lat: volunteer.location.coordinates[1], lng: volunteer.location.coordinates[0] },
      targetLocation
    )
  }));
  
  volunteersWithDistance.sort((a, b) => a.distance - b.distance);
  return volunteersWithDistance.slice(0, k);
}
```

### Distance Calculations
- **Euclidean Distance**: For KNN algorithm
- **Haversine Formula**: For geographical distance calculations

## 📊 Database Schema

### Volunteer Model
```javascript
{
  name: String,
  email: String,
  phone: String,
  location: {
    type: "Point",
    coordinates: [longitude, latitude]
  },
  skillset: [String],
  availability: Boolean,
  averageRating: Number,
  responseRate: Number
}
```

### Aid Request Models
```javascript
// MedicalAid
{
  condition: String,
  urgency: String,
  location: String,
  coordinates: { lat: Number, lng: Number },
  status: String
}

// TransportAid
{
  pickupLocation: String,
  dropoffLocation: String,
  pickupCoordinates: { lat: Number, lng: Number },
  urgency: String,
  status: String
}
```

## 🔒 Security Features
- CORS configuration for cross-origin requests
- Input validation and sanitization
- Environment variable protection
- Phone number formatting utilities

## 🚨 Emergency Features
- **SMS Alerts**: Instant notification to nearby volunteers
- **Voice Recognition**: Hands-free operation during emergencies
- **Real-time Location**: GPS tracking for accurate assistance
- **Urgency Levels**: Priority-based volunteer matching

## 🛠️ Development

### Available Scripts
- `npm start` - Start React development server
- `npm run server` - Start Express backend server
- `npm run dev:both` - Start both frontend and backend
- `npm run build` - Build for production

### Project Structure
```
exceed/
├── src/                    # React frontend
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── assets/           # Static assets
│   └── styles/           # CSS files
├── models/               # MongoDB schemas
├── webhooks/             # Vonage webhook handlers
├── utils/                # Utility functions
├── public/               # Public assets
└── server.js             # Express server
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Vonage** for SMS services
- **OpenAI** for AI chatbot functionality
- **Google Maps** for location services
- **Bootstrap** for responsive design

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Built with ❤️ for disaster management and community support**

