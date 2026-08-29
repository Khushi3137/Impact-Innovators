// config/database.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1); // exit on failure
  }
};

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  try {
    await mongoose.connection.close();
    console.log(`Mongoose connection closed due to ${signal}`);
    process.exit(0);
  } catch (err) {
    console.error("Error during Mongoose shutdown:", err);
    process.exit(1);
  }
};

// Listen for process termination events
process.on("SIGINT", () => gracefulShutdown("SIGINT"));   // Ctrl+C
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Deployment stop

module.exports = connectDB;
