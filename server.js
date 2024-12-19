const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const path = require('path');
const multer = require('multer');
const Post = require('./models/Post');


const upload = multer();
const app = express();
const PORT = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
  })
);

// Set View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// MongoDB Connection
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("Error connecting to MongoDB:", err));


// Routes
app.get('/', (req, res) => res.redirect('/login'));

// Signup route
app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
  });


app.post('/signup', async (req, res) => {
    const { name, lastName, username, password, dob } = req.body;
  
    try {
      // Check if username already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.render('signup', { error: 'Username already exists' });
      }
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create a new user
      const newUser = new User({
        name,
        lastName,
        username,
        password: hashedPassword,
        dob,
      });
  
      await newUser.save();
  
      res.redirect('/login');
    } catch (err) {
      console.error('Error during signup:', err);
      res.render('signup', { error: 'An error occurred. Please try again.' });
    }
  });
  

// Login Page
app.get('/login', (req, res) => {
    console.log('Login route hit');
    res.render('login', { error: null });
  });
  
  app.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      // Find the user by username
      const user = await User.findOne({ username });
      if (!user) {
        return res.render('login', { error: 'Invalid username or password' });
      }
  
      // Compare the password with the hashed password in the database
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.render('login', { error: 'Invalid username or password' });
      }
  
      // If valid, set the session and redirect to the dashboard
      req.session.userId = user._id;
      res.redirect('/dashboard');
    } catch (err) {
      console.error('Error during login:', err.message);
      res.status(500).send('An error occurred. Please try again.');
    }
  });

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
      next();
    } else {
      res.redirect('/login');
    }
}


//Dashboard route

app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).populate('friends').exec();

    // Calculate Social Leaderboard
    const friends = user.friends.map(friend => ({
      username: friend.username,
      caloriesBurned: friend.workouts.reduce((sum, w) => sum + w.calories, 0),
    }));

    // Include the current user in the leaderboard
    friends.push({
      username: user.username,
      caloriesBurned: user.workouts.reduce((sum, w) => sum + w.calories, 0),
    });

    // Sort by calories burned
    friends.sort((a, b) => b.caloriesBurned - a.caloriesBurned);

    const userIndex = friends.findIndex(f => f.username === user.username);

    // If user has 4 or fewer friends, show the full list
    const socialLeaderboard = friends.length <= 4
      ? friends
      : friends.slice(Math.max(0, userIndex - 2), userIndex + 3);

    // Find the latest workout date in the database
    const latestWorkoutDate = user.workouts.reduce((latest, workout) => {
      const workoutDate = new Date(workout.date);
      return workoutDate > latest ? workoutDate : latest;
    }, new Date(0)); // Initialize with the oldest possible date

    // Calculate the start and end of the latest week
    const startOfLatestWeek = new Date(latestWorkoutDate);
    startOfLatestWeek.setDate(startOfLatestWeek.getDate() - startOfLatestWeek.getDay()); // Move to Sunday
    startOfLatestWeek.setHours(0, 0, 0, 0);

    const endOfLatestWeek = new Date(startOfLatestWeek);
    endOfLatestWeek.setDate(startOfLatestWeek.getDate() + 7); // Move to the next Sunday
    endOfLatestWeek.setHours(0, 0, 0, 0);

    console.log("Start of Latest Week:", startOfLatestWeek);
    console.log("End of Latest Week:", endOfLatestWeek);

    // Filter workouts for the latest week
    const currentWeekWorkouts = user.workouts.filter(workout => {
      const workoutDate = new Date(workout.date);
      return workoutDate >= startOfLatestWeek && workoutDate < endOfLatestWeek;
    });

    console.log("Current Week Workouts:", currentWeekWorkouts);

    // Metrics for the latest week
    const weeklyMetrics = {
      totalWorkouts: currentWeekWorkouts.length,
      totalCalories: currentWeekWorkouts.reduce((sum, w) => sum + w.calories, 0),
      totalDuration: currentWeekWorkouts.reduce((sum, w) => sum + w.duration, 0),
    };

    console.log("Weekly Metrics Before Render:", weeklyMetrics);

    // Goals for the latest week
    const goals = {
      workoutFrequency: {
        name: "Workout Frequency (per week)",
        goal: user.goals?.workoutFrequency || 3,
        progress: currentWeekWorkouts.length, // Use weekly data
        percentage: Math.min((currentWeekWorkouts.length / (user.goals?.workoutFrequency || 3)) * 100, 100),
      },
      caloriesBurned: {
        name: "Calories Burned (weekly goal)",
        goal: user.goals?.caloriesBurned || 2000,
        progress: currentWeekWorkouts.reduce((sum, w) => sum + w.calories, 0), // Use weekly data
        percentage: Math.min(
          (currentWeekWorkouts.reduce((sum, w) => sum + w.calories, 0) / (user.goals?.caloriesBurned || 2000)) * 100,
          100
        ),
      },
    };

    console.log("Weekly Goals:", goals);

    const normalizedWorkouts = user.workouts.map(workout => {
      const workoutDate = workout.date ? new Date(workout.date) : null;
    
      return {
        type: workout.type,
        duration: workout.duration,
        calories: workout.calories,
        date: workoutDate && !isNaN(workoutDate)
          ? workoutDate.toISOString().split('T')[0]
          : 'N/A', // Format date or show 'N/A' for invalid dates
      };
    });
    

    const calculateAge = (dob) => {
      const birthDate = new Date(dob);
      const diff = Date.now() - birthDate.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    const activityData = user.workouts.reduce((acc, workout) => {
      if (workout.date) { // Ensure the date exists
        const workoutDate = new Date(workout.date);
        const weekStart = getWeekStart(workoutDate); // Get the start of the week

        const existingWeek = acc.find(a => a.date === weekStart);
        if (existingWeek) {
          existingWeek.totalDuration += workout.duration;
        } else {
          acc.push({ date: weekStart, totalDuration: workout.duration });
        }
      }
      return acc;
    }, []);

    console.log("Processed Activity Data:", activityData);

    res.render('dashboard', {
      user: user,
      workouts: normalizedWorkouts, // Pass normalized workouts for the list
      age: calculateAge(user.dob),
      progress: weeklyMetrics, // Updated to show weekly metrics
      streak: calculateStreak(user.workouts),
      workoutStats: weeklyMetrics, // Pass the latest week's metrics here
      stats: calculateWorkoutTypeStats(user.workouts), // Show types for the latest week
      activityData,
      socialLeaderboard,
      weeklyTrends: calculateWeeklyTrends(user.workouts),
      goals, // Pass weekly goals data
    });

  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('Error loading dashboard.');
  }
});


//edit goals route
app.post('/update-goals', isAuthenticated, async (req, res) => {
  try {
    const { workoutFrequency, caloriesBurned } = req.body;

    // Find the user and update their goals
    await User.findByIdAndUpdate(req.session.userId, {
      goals: {
        workoutFrequency: Number(workoutFrequency),
        caloriesBurned: Number(caloriesBurned),
      },
    });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error updating goals:', error);
    res.status(500).send('Error updating goals.');
  }
});



// Profile edit route
app.post('/update-profile', isAuthenticated, upload.single('profilePicture'), async (req, res) => {
  try {
    const { weight, height, goalWeight } = req.body;

    // Find the user in the database
    const user = await User.findById(req.session.userId);

    // Update fields if provided
    if (weight) user.weight = weight;
    if (height) user.height = height;
    if (goalWeight) user.goalWeight = goalWeight;

    // Update profile picture if uploaded
    if (req.file) {
      user.profilePicture = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    // Save the updated user document
    await user.save();

    console.log('Profile updated successfully:', user);
    res.redirect('/social');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('Error updating profile.');
  }
});


// Workouts

app.post('/workouts', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const { type, duration, calories, date, workoutIndex } = req.body;

    // Convert date input to a proper Date object
    const workoutDate = date ? new Date(date) : null;

    if (!workoutDate || isNaN(workoutDate)) {
      return res.status(400).send('Invalid date provided.');
    }

    if (workoutIndex !== undefined && workoutIndex !== '') {
      // Update existing workout
      const index = parseInt(workoutIndex, 10);
      user.workouts[index] = { type, duration, calories, date: workoutDate };
    } else {
      // Add new workout
      user.workouts.push({ type, duration, calories, date: workoutDate });
    }

    await user.save();
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error saving workout:', error);
    res.status(500).send('Error saving workout.');
  }
});

// Social Page Route
app.get('/social', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .populate('friends', 'username') // Populate friends' usernames
      .exec();

    // Default posts and search results
    const posts = user.posts || [];
    let searchResults = [];

    // Handle Search Query
    if (req.query.username) {
      searchResults = await User.find({
        username: { $regex: new RegExp(req.query.username, 'i') },
        _id: { $ne: req.session.userId }, // Exclude the logged-in user
      }).select('username');
    }

    console.log('Rendering social page. Search Results:', searchResults.length);

    // Render the social page
    res.render('social', {
      user,            // Logged-in user data
      posts,           // User's posts
      friends: user.friends, // User's friends list
      searchResults,   // Search results
    });
  } catch (error) {
    console.error('Error loading social page:', error);
    res.status(500).send('Error loading social page.');
  }
});







app.post('/add-post', isAuthenticated, upload.single('image'), async (req, res) => {
  try {
    const { caption } = req.body;

    // Check if an image file was uploaded
    if (!req.file) {
      return res.status(400).send('An image is required for every post.');
    }

    // Retrieve the logged-in user
    const user = await User.findById(req.session.userId);

    // Add the new post with the image
    user.posts.push({
      caption: caption || '', // Caption is optional
      image: {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      },
      createdAt: new Date(),
    });

    // Save the user document with the new post
    await user.save();

    res.redirect('/social'); // Redirect back to the social page
  } catch (error) {
    console.error('Error adding post:', error);
    res.status(500).send('Error adding post.');
  }
});


app.post('/delete-post/:postId', isAuthenticated, async (req, res) => {
  try {
    const { postId } = req.params;

    // Find the logged-in user and remove the post by its ID
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Filter out the post with the matching ID
    user.posts = user.posts.filter(post => post._id.toString() !== postId);

    // Save the updated user document
    await user.save();

    console.log(`Post with ID ${postId} deleted successfully.`);
    res.redirect('/social');
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).send('Error deleting post.');
  }
});





// Search for Users
app.get('/social/search', isAuthenticated, async (req, res) => {
  try {
    const { username } = req.query;
    const searchResults = await User.find({
      username: { $regex: username, $options: 'i' }, // Case-insensitive search
      _id: { $ne: req.session.userId } // Exclude logged-in user
    }).exec();

    const user = await User.findById(req.session.userId).populate('friends').exec();
    res.render('social', { user, friends: user.friends, searchResults, posts: user.posts });
  } catch (error) {
    console.error('Error searching for friends:', error);
    res.status(500).send('Error searching for friends.');
  }
});


// Find User by Username
app.get('/social/find-user', isAuthenticated, async (req, res) => {
  try {
    const { username } = req.query;

    const user = await User.findOne({ username });

    if (!user) {
      return res.json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, userId: user._id });
  } catch (error) {
    console.error('Error finding user:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// Add Friend
app.post('/social/add-friend', isAuthenticated, async (req, res) => {
  try {
    const { friendId } = req.body;
    const user = await User.findById(req.session.userId);

    if (friendId && !user.friends.includes(friendId)) {
      user.friends.push(friendId);
      await user.save();
      console.log("Friend added:", friendId);
    }

    res.redirect('/social');
  } catch (error) {
    console.error('Error adding friend:', error);
    res.status(500).send('Error adding friend.');
  }
});




// Remove Friend
app.post('/remove-friend/:friendId', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId; // Logged-in user's ID
    const friendId = req.params.friendId; // Friend's ID to be removed

    // Update the user's friends list to remove the friend
    await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });

    // Optional: Also remove the user from the friend's list
    await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });

    console.log(`Friend with ID ${friendId} removed successfully`);
    res.redirect('/social');
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).send('Error removing friend.');
  }
});


// View User Profile
app.get('/profile/:userId', isAuthenticated, async (req, res) => {
  try {
    const viewedUser = await User.findById(req.params.userId).populate('workouts').exec();

    if (!viewedUser) {
      return res.status(404).send('User not found');
    }

    // Calculate age based on the 'dob' field
    const calculateAge = (dob) => {
      const birthDate = new Date(dob);
      const diff = Date.now() - birthDate.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    const age = viewedUser.dob ? calculateAge(viewedUser.dob) : 'N/A';

    res.render('profile', { user: viewedUser, 
      age: age,
      posts: viewedUser.posts
     });
  } catch (error) {
    console.error('Error viewing user profile:', error);
    res.status(500).send('Error viewing profile.');
  }
});

app.get('/feed', isAuthenticated, async (req, res) => {
  try {
    // Fetch all users and their posts
    const users = await User.find().exec();

    // Collect all posts with their associated user details
    const posts = users.flatMap(user =>
      user.posts.map(post => ({
        ...post.toObject(),
        user: { username: user.username }, // Attach username to the post
      }))
    );

    // Sort posts by createdAt date (latest first)
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log("Posts for Feed:", posts); // Debugging to confirm posts data

    // Render the feed with all posts
    res.render('feed', { posts });
  } catch (error) {
    console.error('Error loading feed:', error);
    res.status(500).send('Error loading feed.');
  }
});

// Logout Route
app.get('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy(err => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).send('Error logging out');
    }
    res.clearCookie('connect.sid'); // Clear the session cookie
    res.redirect('/login'); // Redirect to login page
  });
});








// Helper Functions
function calculateStreak(workouts) {
    let streak = 0;
    if (workouts.length > 0) {
        const dates = workouts.map(w => new Date(w.date).toDateString()).sort((a, b) => new Date(b) - new Date(a));
        const today = new Date().toDateString();
        if (dates[0] === today) streak = 1;

        for (let i = 1; i < dates.length; i++) {
            const prevDate = new Date(dates[i - 1]);
            const currDate = new Date(dates[i]);
            if (prevDate - currDate === 86400000) streak++;
            else break;
        }
    }
    return streak;
}

function calculateWorkoutStats(workouts) {
    return {
        totalWorkouts: workouts.length,
        totalCalories: workouts.reduce((sum, w) => sum + w.calories, 0),
        totalDuration: workouts.reduce((sum, w) => sum + w.duration, 0),
    };
}



function calculateWorkoutTypeStats(workouts) {
    return workouts.reduce((acc, w) => {
        const index = acc.findIndex(s => s.type === w.type);
        if (index >= 0) acc[index].typeCount += 1;
        else acc.push({ type: w.type, typeCount: 1 });
        return acc;
    }, []);
}

function calculateActivityData(workouts) {
    return workouts.reduce((acc, w) => {
        const date = new Date(w.date).toDateString();
        const index = acc.findIndex(a => a.date === date);
        if (index >= 0) acc[index].totalDuration += w.duration;
        else acc.push({ date, totalDuration: w.duration });
        return acc;
    }, []);
}

function calculateWeeklyTrends(workouts) {
    const weeklyStats = workouts.reduce((weeks, workout) => {
        const date = new Date(workout.date);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay())).toDateString();
        if (!weeks[weekStart]) weeks[weekStart] = 0;
        weeks[weekStart] += workout.calories;
        return weeks;
    }, {});

    
}

// Helper function to get the start of the current week (Sunday)
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Get the start of the week (Sunday)
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().split('T')[0];
}



// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
