# Troubleshooting Guide

## Issue: Nothing Showing on Website

If you start the backend and frontend but nothing is showing, follow these steps:

### 1. Check Backend is Running
```bash
cd backend
npm start
# Should see: "Server running on port 5000"
# Should see: "MongoDB Connected" or similar
```

**Common Issues:**
- MongoDB not running - Start MongoDB service
- Port 5000 already in use - Change PORT in backend/.env
- Missing .env file - Create backend/.env with required variables

### 2. Check Frontend is Running
```bash
cd frontend
npm run dev
# Should see: "Local: http://localhost:5173"
```

**Common Issues:**
- Port 5173 already in use - Vite will auto-assign another port
- Missing dependencies - Run `npm install`

### 3. Check Browser Console
Open browser DevTools (F12) and check:
- **Console tab**: Look for errors (red messages)
- **Network tab**: Check if API requests are failing
- **Application tab**: Check if token is stored in localStorage

### 4. Verify Environment Variables

**Backend (.env):**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/telehealth
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:5173
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:5000/api
```

### 5. Expected Behavior

**When you visit http://localhost:5173:**
1. If NOT logged in → Should redirect to `/login` and show login form
2. If logged in → Should redirect to `/dashboard` and show dashboard

**If you see a blank page:**
- Check browser console for errors
- Verify both servers are running
- Check network tab for failed API calls
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### 6. Common Error Messages

**"Network Error" or "ECONNABORTED":**
- Backend is not running
- Wrong API URL in frontend/.env
- CORS issue (check backend CORS settings)

**"401 Unauthorized":**
- Token expired or invalid
- Should redirect to login page automatically

**"Cannot GET /auth/me":**
- Backend route not found
- Check backend routes are properly set up

**"MongoDB connection failed":**
- MongoDB not running
- Wrong MONGODB_URI in backend/.env

### 7. Quick Test

1. **Test Backend:**
   ```bash
   curl http://localhost:5000/
   # Should return: {"message":"Telehealth API Server is running"}
   ```

2. **Test Frontend:**
   - Open http://localhost:5173
   - Should see login page (if not logged in)
   - Should see dashboard (if logged in)

3. **Test API Connection:**
   - Open browser DevTools → Network tab
   - Try to login
   - Check if `/api/auth/login` request succeeds

### 8. Still Not Working?

1. **Clear browser cache and localStorage:**
   - Open DevTools → Application → Local Storage
   - Clear all items
   - Hard refresh (Ctrl+Shift+R)

2. **Check both terminal windows:**
   - Backend terminal should show no errors
   - Frontend terminal should show no errors

3. **Verify file structure:**
   - `frontend/src/App.jsx` exists
   - `frontend/src/main.jsx` exists
   - `frontend/index.html` exists

4. **Check for port conflicts:**
   - Backend: `netstat -ano | findstr :5000` (Windows)
   - Frontend: `netstat -ano | findstr :5173` (Windows)

### 9. Getting Started Checklist

- [ ] MongoDB is installed and running
- [ ] Backend `.env` file exists with correct values
- [ ] Frontend `.env` file exists with correct values
- [ ] Backend dependencies installed (`npm install` in backend/)
- [ ] Frontend dependencies installed (`npm install` in frontend/)
- [ ] Backend server is running (`npm start` in backend/)
- [ ] Frontend server is running (`npm run dev` in frontend/)
- [ ] Browser console shows no errors
- [ ] Can access http://localhost:5173

### 10. Need More Help?

Check the browser console for specific error messages and:
1. Copy the exact error message
2. Check which API endpoint is failing
3. Verify the backend route exists
4. Check network tab for request/response details
