# R45 Holidays Backend

Backend API for the R45 Holidays travel management system. Built with Node.js, Express, and MongoDB.

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Multer for file uploads
- Bcrypt for password hashing

## Prerequisites

- Node.js (v16+)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. Clone the repository
2. Navigate to the backend folder: `cd backend`
3. Install dependencies: `npm install`
4. Create a `.env` file (see example below)
5. Start the server: `npm run dev`

## Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/r45holidays
JWT_SECRET=your_jwt_secret
BASE_URL=http://localhost:5000
```
