// checkQuota.js
require('dotenv').config();

async function checkQuota() {
  const apiKey = process.env.GEMINI_API_KEY;
  const projectId = apiKey.split('-')[0]; // Extract project ID from key
  
  console.log("📊 Quota Status Check");
  console.log("Project ID:", projectId);
  console.log("Current time:", new Date().toLocaleTimeString());
  
  // Free tier typically resets at midnight UTC
  const resetTime = new Date();
  resetTime.setUTCHours(24, 0, 0, 0); // Next midnight UTC
  const hoursUntilReset = (resetTime - new Date()) / (1000 * 60 * 60);
  
  console.log(`⏰ Quota resets in: ${hoursUntilReset.toFixed(1)} hours (midnight UTC)`);
  
  // Test current status
  const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "test" }] }] })
    });
    
    if (response.status === 429) {
      console.log("❌ QUOTA EXHAUSTED - Free tier limits reached");
      console.log("💡 Solutions:");
      console.log("   1. Create new Google Cloud project (fastest)");
      console.log("   2. Wait until midnight UTC");
      console.log("   3. Enable paid tier with budget limits");
    } else if (response.ok) {
      console.log("✅ Quota available!");
    }
  } catch (error) {
    console.log("Status check error:", error.message);
  }
}

checkQuota();