const mongoose = require('mongoose');

// Define the Post schema
const postSchema = new mongoose.Schema({
  caption: { type: String, required: true },
  image: {
    data: Buffer, // Binary image data
    contentType: String, // MIME type of the image
  },
  createdAt: { type: Date, default: Date.now }, // Auto-set to current date
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user who created the post
});

// Export the model
module.exports = mongoose.model('Post', postSchema);
