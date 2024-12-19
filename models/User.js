const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  dob: Date,
  height: Number,
  weight: Number,
  goalWeight: Number,
  profilePicture: { data: Buffer, contentType: String },
  workouts: [
    {
      type: { type: String },
      duration: Number,
      calories: Number,
      date: Date,
    },
  ],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  posts: [
    {
      caption: String,
      image: {
        data: Buffer,
        contentType: String,
      },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model('User', userSchema);





