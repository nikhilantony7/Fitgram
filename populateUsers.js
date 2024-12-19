const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/fitnessTracker", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// List of users to populate
const users = [
  {
    username: 'john_doe',
    password: 'password123',
    dob: '1995-06-15',
    height: 180,
    weight: 75,
    goalWeight: 70,
    workouts: [
      { type: 'Running', duration: 30, calories: 300, date: new Date('2024-06-10') },
      { type: 'Cycling', duration: 45, calories: 400, date: new Date('2024-06-12') }
    ]
  },
  {
    username: 'jane_doe',
    password: 'securepass',
    dob: '1998-04-20',
    height: 165,
    weight: 60,
    goalWeight: 55,
    workouts: [
      { type: 'Yoga', duration: 60, calories: 150, date: new Date('2024-06-11') },
      { type: 'Weightlifting', duration: 40, calories: 250, date: new Date('2024-06-13') }
    ]
  }
  // Add more users as needed
];

async function populateUsers() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connection;

    // Loop through users, check for duplicates before creating
    for (const userData of users) {
      const existingUser = await User.findOne({ username: userData.username });
      if (existingUser) {
        console.log(`User ${userData.username} already exists. Skipping...`);
        continue; // Skip existing users
      }

      console.log(`Creating user: ${userData.username}`);

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      console.log(`Password hashed for: ${userData.username}`);

      const user = new User({
        username: userData.username,
        password: hashedPassword,
        dob: userData.dob,
        height: userData.height,
        weight: userData.weight,
        goalWeight: userData.goalWeight,
        workouts: userData.workouts
      });

      await user.save();
      console.log(`User ${userData.username} saved successfully.`);
    }

    console.log("All new users have been populated successfully!");
  } catch (error) {
    console.error("Error populating users:", error);
  } finally {
    mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

populateUsers();

