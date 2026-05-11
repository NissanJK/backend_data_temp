# DataTrust-SC Backend - A Trusted and Privacy-Preserving Data Distribution Framework for Smart Cities

## 📋 Overview

Backend server for DataTrust-SC - a privacy-preserving smart city data sharing system with blockchain-inspired audit logging, attribute-based access control (ABAC), and real-time disaster monitoring.

## 🚀 Features

- ✅ **Privacy-Preserving Data Storage** - AES-256 encryption
- ✅ **Attribute-Based Access Control (ABAC)** - Fine-grained policy evaluation
- ✅ **Blockchain-Inspired Audit Logging** - Immutable transaction records
- ✅ **Real-Time Disaster Monitoring** - Smart threshold-based alerts
- ✅ **Live Data Generation** - Simulated sensor data with realistic distributions
- ✅ **CSV Import/Export** - Bulk data operations
- ✅ **RESTful API** - Clean, documented endpoints
- ✅ **MongoDB Integration** - Scalable NoSQL database

## 🛠️ Tech Stack

- **Runtime:** Node.js (v16+)
- **Framework:** Express.js
- **Database:** MongoDB (with Mongoose ODM)
- **Encryption:** Crypto (AES-256-CBC)
- **File Upload:** Multer
- **CSV Processing:** csv-parser

## 📁 Project Structure

```
DataTrust-SC_backend/
├── controllers
│   ├── accessController.js
│   ├── datasetController.js
│   ├── disasterController.js
│   └── systemController.js
├── middleware
│   └── apiKey.js
├── models
│   ├── BlockchainLog.js
│   └── Dataset.js
├── routes
│   ├── accessRoutes.js
│   ├── datasetRoutes.js
│   ├── disasterRoutes.js
│   └── systemRoutes.js
├── utils
│   ├── SmartContract.js
│   ├── chainVerifier.js
│   ├── crypto.js
│   └── disasterMonitoring.js
├── .gitignore
├── package-lock.json
├── package.json
├── readme.md
└── server.js
```

## 📦 Installation

### Prerequisites

- Node.js v16 or higher
- MongoDB (local or Atlas)
- npm or yarn

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/NissanJK/backend_data_temp.git
```

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
cp .env.example .env
```

4. **Configure environment variables**

Edit `.env`:
```env
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/DataTrust-SC
# OR for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/DataTrust-SC

# Encryption Secret (CHANGE THIS!)
SECRET_KEY=your-super-secret-encryption-key-change-this

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS (Frontend URL)
FRONTEND_URL=http://localhost:3000
```

5. **Start the server**
```bash
node server.js
```
Server runs at: `http://localhost:5000`

## 🔌 API Endpoints

### Dataset Management

#### Upload Data
```http
POST /api/dataset/upload
Content-Type: application/json

{
  "ownerRole": "CityAuthority",
  "Sector": "sector1",
  "Data_Provider_Type": "IoT Sensor",
  "Data_Category": "Environmental",
  "Temperature_C": 25.5,
  "Air_Quality_Index": 150,
  "Traffic_Density": null,
  "Energy_Consumption_kWh": null,
  "policy": "role:CityAuthority OR role:Researcher"
}

Response: { "message": "Upload successful", "hash": "abc123..." }
```

#### Import CSV
```http
POST /api/dataset/import
Content-Type: multipart/form-data

file: dataset.csv

Response: {
  "message": "CSV import completed",
  "imported": 500,
  "errors": 0,
  "total": 500
}
```

#### Get All Datasets
```http
GET /api/dataset

Response: [
  {
    "_id": "...",
    "metadata": { ... },
    "hash": "...",
    "policy": "...",
    "createdAt": "..."
  }
]
```

#### Export CSV
```http
GET /api/dataset/export

Response: CSV file download
```

### Access Control

#### Request Access
```http
POST /api/access/request
Content-Type: application/json

{
  "category": "Environmental",
  "role": "Researcher",
  "attribute": "sensitivity=public"
}

Response: {
  "category": "Environmental",
  "count": 10,
  "records": [
    {
      "hash": "...",
      "data": "{ decrypted JSON }"
    }
  ]
}
```

#### Get Audit Logs
```http
GET /api/access/logs

Response: [
  {
    "type": "ACCESS_REQUEST",
    "hash": "...",
    "role": "Researcher",
    "granted": true,
    "timestamp": "..."
  }
]
```

### Disaster Monitoring

#### Get All Alerts
```http
GET /api/disaster/alerts

Response: {
  "success": true,
  "totalAlerts": 12,
  "criticalAlerts": 3,
  "alerts": [
    {
      "type": "HEAT_WAVE",
      "severity": "CRITICAL",
      "sector": "sector1",
      "message": "...",
      "recommendation": "...",
      "actions": ["..."]
    }
  ]
}
```

#### Get Sector Alerts
```http
GET /api/disaster/alerts/:sector

Response: { sector-specific alerts }
```

#### Get Sector Statistics
```http
GET /api/disaster/sectors/stats

Response: {
  "sectors": {
    "sector1": {
      "status": "NORMAL",
      "latest": { ... },
      "averages": { ... }
    }
  }
}
```

#### Get Thresholds
```http
GET /api/disaster/thresholds

Response: { temperature: {...}, aqi: {...}, ... }
```

### System Management

#### Reset System
```http
POST /api/system/reset

Response: {
  "success": true,
  "deleted": {
    "datasets": 500,
    "logs": 1000
  }
}
```

#### Health Check
```http
GET /health

Response: {
  "status": "OK",
  "timestamp": "...",
  "services": {
    "database": "connected",
    "disasterMonitoring": "active"
  }
}
```

## 🔐 Security Features

### Data Encryption
- **Algorithm:** AES-256-CBC
- **Scope:** All sensitive dataset payloads
- **Key Management:** Environment variable (SECRET_KEY)

### Access Control (ABAC)
- **Policy Format:** `role:X AND/OR attribute:Y`
- **Evaluation:** Dynamic policy parsing and validation
- **Audit:** All access attempts logged

### Example Policies
```javascript
// Public access
"role:Citizen OR role:CityAuthority OR role:Researcher AND attribute:sensitivity=public"

// Private access
"role:CityAuthority OR role:Researcher AND attribute:sensitivity=private"

// Authority only
"role:CityAuthority"
```

## 🚨 Disaster Monitoring

### Thresholds

| Metric | Caution | Warning | Critical |
|--------|---------|---------|----------|
| Temperature (°C) | 32-34 | 35-37 | ≥38 |
| AQI | 150-199 | 200-249 | ≥250 |
| Traffic Density | 50-69 | 70-84 | ≥85 |
| Energy (kWh) | 350-449 | 450-499 | ≥500 |

### Alert Types
- Heat Wave / Cold Wave
- Air Pollution (Hazardous, Very Unhealthy, Unhealthy)
- Traffic Emergency
- Power Grid Failure
- Multi-factor disasters (e.g., Heat + Power)

## 📊 Data Models

### Dataset Schema
```javascript
{
  metadata: {
    Sector: String,
    Data_Provider_Type: String,
    Data_Category: String,
    Temperature_C: Number,
    Air_Quality_Index: Number,
    Traffic_Density: Number,
    Energy_Consumption_kWh: Number,
    Blockchain_Tx_Cost_Gas: Number,
    Authorization_Latency_sec: Number
  },
  encryptedPayload: String,
  hash: String (unique),
  policy: String,
  ownerRole: String,
  createdAt: Date
}
```

### BlockchainLog Schema
```javascript
{
  type: String, // DATA_REGISTER, ACCESS_REQUEST
  hash: String,
  owner: String,
  role: String,
  attribute: String,
  policy: String,
  granted: Boolean,
  timestamp: Date
}
```

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:**
- Check MongoDB is running: `mongod` or `sudo systemctl start mongod`
- Verify MONGO_URI in `.env`
- For Atlas: Check network access whitelist

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:**
```bash
# Find and kill process
lsof -i :5000
kill -9 <PID>

# Or change PORT in .env
PORT=5001
```

### Encryption/Decryption Error
```
Error: Invalid initialization vector
```
**Solution:**
- Ensure SECRET_KEY is consistent
- Don't change SECRET_KEY after encrypting data
- SECRET_KEY must be at least 32 characters

### CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:**
- Update FRONTEND_URL in `.env`
- Verify CORS configuration in `server.js`

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `SECRET_KEY` | Yes | - | Encryption key (32+ chars) |
| `PORT` | No | 5000 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `FRONTEND_URL` | No | http://localhost:3000 | CORS allowed origin |

## 📚 Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^7.0.0",
  "cors": "^2.8.5",
  "dotenv": "^16.0.3",
  "multer": "^1.4.5-lts.1",
  "csv-parser": "^3.0.0"
}
```

## 👨‍💻 Author

**Your Name**
- GitHub: [@NissanJK](https://github.com/NissanJK)
- Email: jawadul.karim78@gmail.com

