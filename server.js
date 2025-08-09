require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const MedicalAid = require('./models/MedicalAid');
const TransportAid = require('./models/TransportAid');
const multer = require('multer');
const path = require('path');
const Volunteer = require('./models/Volunteer');
const { Vonage } = require('@vonage/server-sdk');
const { Messages } = require('@vonage/messages');
const { Auth } = require('@vonage/auth');
const Notification = require('./models/Notification');
const Feedback = require('./models/Feedback');
const { formatPhoneNumber } = require('./utils/phoneUtils');
const vonageWebhooks = require('./webhooks/vonage');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const upload = multer();

// Check MongoDB connection
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI from env:', process.env.MONGODB_URI ? 'Found (value hidden)' : 'Not found or undefined');

// Set a fallback MongoDB URI if the environment variable is undefined
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/disasterManagement';
console.log('Using MongoDB URI:', mongoURI.includes('localhost') ? mongoURI : 'Custom URI (value hidden)');

mongoose.connect(mongoURI)
    .then(() => {
        console.log('Connected to MongoDB');
        
        // Fix the problematic email index in volunteers collection
        fixVolunteerEmailIndex();
    })
    .catch(err => {
        console.error('Could not connect to MongoDB:', err);
        // Continue server startup even if MongoDB fails
    });

// Initialize Vonage client
let vonage;
let messagesClient;
try {
  if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET) {
    console.log('=== VONAGE SDK INITIALIZATION ===');
    console.log('Initializing Vonage client with:');
    console.log(`API Key: ${process.env.VONAGE_API_KEY.substring(0, 4)}...`);
    console.log(`API Secret: ${process.env.VONAGE_API_SECRET.substring(0, 4)}...`);
    
    // Ensure the virtual number has proper format with + sign
    let virtualNumber = process.env.VONAGE_VIRTUAL_NUMBER || '';
    
    // Clean any existing formatting first
    virtualNumber = virtualNumber.replace(/^\+/, '');
    
    // Add the + prefix
    const formattedVirtualNumber = '+' + virtualNumber;
    
    console.log(`Virtual Number: ${formattedVirtualNumber}`);
    
    // Debug - log complete configuration
    console.log(`Full Vonage configuration:`);
    console.log(`- API Key: ${process.env.VONAGE_API_KEY}`);
    console.log(`- Secret: ${process.env.VONAGE_API_SECRET.substring(0, 4)}... (partial)`);
    console.log(`- Virtual Number: ${formattedVirtualNumber}`);
    
    // Create the authentication object with proper credentials
    const auth = new Auth({
      apiKey: process.env.VONAGE_API_KEY,
      apiSecret: process.env.VONAGE_API_SECRET
    });
    
    // Create the Vonage client with authentication
    vonage = new Vonage(auth);
    
    // Create the Messages client with the same authentication
    messagesClient = new Messages(auth);
    
    // Store the formatted virtual number
    process.env.VONAGE_VIRTUAL_NUMBER = formattedVirtualNumber;
    
    // Verify the client was initialized correctly
    if (vonage && messagesClient) {
      console.log('Vonage client initialized successfully with message API available');
      console.log('Testing Vonage client capabilities:');
      console.log('- Has Vonage client:', !!vonage);
      console.log('- Has Messages client:', !!messagesClient);
      console.log('- Auth object created:', !!auth);
      console.log('- Virtual number to use:', process.env.VONAGE_VIRTUAL_NUMBER);
    } else {
      console.error('Vonage client initialized but message API not found. Check SDK compatibility.');
    }
    console.log('=== END VONAGE INITIALIZATION ===');
  } else {
    console.log('Vonage credentials not found in environment variables, SMS functionality will be simulated');
    console.log('Make sure VONAGE_API_KEY and VONAGE_API_SECRET are set in .env file');
  }
} catch (error) {
  console.error('Error initializing Vonage client:', error);
}

// Function to calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// KNN utility functions
function calculateEuclideanDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.lat - point2.lat, 2) + 
    Math.pow(point1.lng - point2.lng, 2)
  );
}

function findKNearestNeighbors(volunteers, targetLocation, k = 5) {
  // Add distance to each volunteer
  const volunteersWithDistance = volunteers.map(volunteer => ({
    ...volunteer,
    distance: calculateEuclideanDistance(
      { lat: volunteer.location.coordinates[1], lng: volunteer.location.coordinates[0] },
      targetLocation
    )
  }));

  // Sort by distance
  volunteersWithDistance.sort((a, b) => a.distance - b.distance);

  // Return k nearest neighbors
  return volunteersWithDistance.slice(0, k);
}

// Function to find nearby volunteers based on location
async function findNearbyVolunteers(location, maxDistance = 10) {
  try {
    console.log(`Finding volunteers for location: ${location.address}`);
    
    // Get all available volunteers
    const allVolunteers = await Volunteer.find({ availability: true });
    console.log(`Total available volunteers: ${allVolunteers.length}`);
    
    if (!allVolunteers.length) return [];

    let matchedVolunteers = [];
    
    // First, try KNN if we have coordinates
    if (location.lat && location.lng) {
      console.log('Using KNN algorithm for volunteer matching');
      const volunteersWithValidLocation = allVolunteers.filter(volunteer => 
        volunteer.location && 
        volunteer.location.coordinates && 
        Array.isArray(volunteer.location.coordinates) &&
        volunteer.location.coordinates.length === 2
      );

      if (volunteersWithValidLocation.length > 0) {
        matchedVolunteers = findKNearestNeighbors(
          volunteersWithValidLocation,
          { lat: location.lat, lng: location.lng }
        );
        console.log(`KNN found ${matchedVolunteers.length} nearest volunteers`);
      }
    }
    
    // If KNN didn't find enough volunteers, try location name matching
    if (matchedVolunteers.length < 5) {
      console.log('Falling back to location name matching');
      
      // Match volunteers by location name
      const nameMatchedVolunteers = allVolunteers.filter(volunteer => {
        if (!volunteer.locationText || !volunteer.locationText.name) return false;
        
        const volunteerLocation = volunteer.locationText.name.toLowerCase();
        const requestLocation = location.address.toLowerCase();
        
        return volunteerLocation.includes(requestLocation) || 
               requestLocation.includes(volunteerLocation);
      });
      
      console.log(`Name matching found ${nameMatchedVolunteers.length} volunteers`);
      
      // Add name-matched volunteers to the result
      if (nameMatchedVolunteers.length > 0) {
        // Avoid duplicates
        const existingIds = matchedVolunteers.map(v => v._id.toString());
        
        for (const volunteer of nameMatchedVolunteers) {
          if (!existingIds.includes(volunteer._id.toString())) {
            matchedVolunteers.push(volunteer);
            existingIds.push(volunteer._id.toString());
          }
        }
      }
    }
    
    // Now, rank volunteers by rating, response rate, and proximity
    matchedVolunteers.sort((a, b) => {
      // First priority: rating (higher is better)
      const ratingDiff = (b.averageRating || 0) - (a.averageRating || 0);
      if (Math.abs(ratingDiff) > 0.5) return ratingDiff;
      
      // Second priority: response rate (higher is better)
      const responseDiff = (b.responseRate || 0) - (a.responseRate || 0);
      if (Math.abs(responseDiff) > 0.1) return responseDiff;
      
      // Third priority: distance (lower is better)
      return (a.distance || 0) - (b.distance || 0);
    });
    
    // Cap the result
    return matchedVolunteers.slice(0, 10);
  } catch (error) {
    console.error('Error finding nearby volunteers:', error);
    return [];
  }
}

// Vonage SMS functions
async function sendVolunteerSMS(volunteer, message, aidId, aidType) {
  if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET || !vonage || !messagesClient) {
    console.log('Vonage not configured - would have sent SMS to:', volunteer.phone);
    console.log('SMS Content:', message);
    return { success: true, message: 'SMS notification would be sent (Vonage not configured)' };
  }

  // Format the phone number with proper international format
  let recipientNumber = volunteer.phone.trim();
  
  // Special debug logging for the specified number
  const isTestNumber = recipientNumber.includes('9704178229');
  if (isTestNumber) {
    console.log('=== DEBUGGING TEST NUMBER 9704178229 ===');
    console.log('Original phone from volunteer record:', volunteer.phone);
  }
  
  // Ensure it has the + prefix
  if (!recipientNumber.startsWith('+')) {
    // Add country code if needed - assuming India (+91) for default
    if (recipientNumber.length === 10) {
      recipientNumber = '+91' + recipientNumber;
      if (isTestNumber) {
        console.log('Added +91 prefix to 10-digit number:', recipientNumber);
      }
    } else {
      recipientNumber = '+' + recipientNumber;
      if (isTestNumber) {
        console.log('Added + prefix to number:', recipientNumber);
      }
    }
  } else if (isTestNumber) {
    console.log('Number already has + prefix:', recipientNumber);
  }
  
  // Additional safety check for specific test number
  if (isTestNumber && !recipientNumber.startsWith('+91')) {
    console.log('WARNING: Test number does not have +91 prefix, forcing format');
    recipientNumber = '+91' + recipientNumber.replace(/^\+/, '').replace(/^91/, '');
    console.log('Forced format for test number:', recipientNumber);
  }

  // Format the message to incorporate the trial/demo tag
  const formattedMessage = `Hey volunteer, you got aid request! Type YES to take request, NO for not.`;
  
  console.log(`Sending SMS to ${recipientNumber}: ${formattedMessage}`);
  
  if (isTestNumber) {
    console.log('Virtual number being used:', process.env.VONAGE_VIRTUAL_NUMBER);
    console.log('Full SMS details:');
    console.log('- From:', process.env.VONAGE_VIRTUAL_NUMBER);
    console.log('- To:', recipientNumber);
    console.log('- Message:', formattedMessage);
    console.log('- Type:', 'text');
  }

  try {
    // Create a notification record
    const notification = new Notification({
      volunteerId: volunteer._id,
      aidId: aidId,
      aidType: aidType,
      messageContent: formattedMessage,
      message: formattedMessage, // For backward compatibility
      status: 'queued'
    });
    
    await notification.save();
    console.log(`Created notification record: ${notification._id}`);

    try {
      // Using the new Vonage Messages API v1
      const resp = await messagesClient.send({
        message_type: 'text',
        from: process.env.VONAGE_VIRTUAL_NUMBER,
        to: recipientNumber,
        text: formattedMessage,
        channel: 'sms'
      });
      
      console.log('Vonage SMS Response:', resp);
      if (isTestNumber) {
        console.log('DETAILED RESPONSE FOR TEST NUMBER:', JSON.stringify(resp));
      }
      
      // Check for messageUUID (correct property name) in the response
      if (resp && resp.messageUUID) {
        notification.status = 'sent';
        notification.messageId = resp.messageUUID;
        await notification.save();
        console.log(`Updated notification with message ID: ${notification.messageId}`);
        return { 
          success: true, 
          message: 'SMS sent successfully', 
          messageId: resp.messageUUID,
          notificationId: notification._id
        };
      } else {
        const errorText = 'Unknown error - no messageUUID returned';
        notification.status = 'failed';
        notification.statusDetails = errorText;
        await notification.save();
        console.log(`Message failed with error: ${errorText}`);
        return { 
          success: false, 
          error: errorText
        };
      }
    } catch (error) {
      console.error('Vonage SMS Error:', error);
      if (isTestNumber) {
        console.error('DETAILED ERROR FOR TEST NUMBER:', JSON.stringify(error));
      }
      notification.status = 'failed';
      notification.statusDetails = error.message;
      await notification.save();
      return { success: false, error: error.message };
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
    if (isTestNumber) {
      console.error('DETAILED EXCEPTION FOR TEST NUMBER:', error);
    }
    return { success: false, error: error.message };
  }
}

// Notify volunteers about a new aid request
async function notifyNearbyVolunteers(requestType, requestData) {
  try {
    let location, details, urgency;
    
    // Extract location based on request type
    if (requestType === 'medical') {
      location = { 
        address: requestData.location,
        // Add coordinates if available, but don't require them
        lat: requestData.coordinates ? requestData.coordinates.lat : null,
        lng: requestData.coordinates ? requestData.coordinates.lng : null
      };
      details = `Medical condition: ${requestData.condition}`;
      urgency = requestData.urgency;
    } else if (requestType === 'transport') {
      location = { 
        address: requestData.pickupLocation, 
        // Add coordinates if available, but don't require them
        lat: requestData.pickupCoordinates ? requestData.pickupCoordinates.lat : null,
        lng: requestData.pickupCoordinates ? requestData.pickupCoordinates.lng : null
      };
      details = `Transport to: ${requestData.dropoffLocation}`;
      urgency = requestData.urgency;
    } else {
      return { success: false, message: 'Invalid request type' };
    }
    
    // Validate that we have at least a location address
    if (!location.address) {
      console.log('No location address provided');
      return { success: false, message: 'No location address provided for volunteer matching' };
    }
    
    console.log(`Looking for volunteers for ${requestType} aid at location: ${location.address}`);
    
    // Find matching volunteers based on location
    const matchedVolunteers = await findNearbyVolunteers(location);
    
    if (matchedVolunteers.length === 0) {
      return { success: false, message: 'No volunteers found for this location' };
    }
    
    console.log(`Sending notifications to ${matchedVolunteers.length} volunteers`);
    
    // Prepare a message that includes the full address
    const messageWithLocation = `${urgency.toUpperCase()} URGENCY ${requestType.toUpperCase()} AID REQUEST at ${location.address}. ${details}. Reply YES to confirm.`;
    
    // Send SMS to up to 5 closest volunteers
    const notificationPromises = matchedVolunteers
      .slice(0, 5) // Limit to 5 volunteers
      .map(volunteer => 
        sendVolunteerSMS(volunteer, messageWithLocation, requestData._id, requestType)
      );
    
    // Wait for all notifications to be sent
    const results = await Promise.allSettled(notificationPromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.length - successCount;
    
    return {
      success: true,
      message: `Notified ${successCount} volunteers (${failCount} failed)`,
      notifiedCount: successCount,
      failedCount: failCount
    };
  } catch (error) {
    console.error('Error notifying volunteers:', error);
    return { success: false, message: error.message };
  }
}

// Routes
app.post('/api/medical-aid', async (req, res) => {
    try {
        console.log('Received medical aid request:', req.body);
        // Create medical aid request from form data
        const medicalAid = new MedicalAid({
            patientName: req.body.patientName,
            condition: req.body.condition,
            location: req.body.location,
            contactNumber: req.body.contactNumber,
            urgency: req.body.urgency,
            additionalInfo: req.body.additionalInfo,
            // Add coordinates if available
            coordinates: req.body.coordinates || null
        });

        // Save to database
        await medicalAid.save();

        // Notify nearby volunteers
        const notificationResult = await notifyNearbyVolunteers('medical', medicalAid);
        console.log('Volunteer notification result:', notificationResult);

        // Send response
        res.status(201).json({ 
            message: 'Medical aid request submitted successfully', 
            data: medicalAid,
            volunteerNotification: notificationResult
        });
    } catch (error) {
        console.error('Server Error:', error);
        res.status(400).json({ 
            message: 'Error submitting medical aid request', 
            error: error.message 
        });
    }
});

// Get all medical aid requests
app.get('/api/medical-aid', async (req, res) => {
    try {
        const medicalAids = await MedicalAid.find().sort({ createdAt: -1 });
        res.json(medicalAids);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching medical aid requests', 
            error: error.message 
        });
    }
});

// Get medical aid request by patient name
app.get('/api/medical-aid/search/name/:name', async (req, res) => {
    try {
        const patientName = req.params.name;
        
        if (!patientName) {
            return res.status(400).json({ message: 'Patient name is required' });
        }
        
        // Case-insensitive search using regex
        const regex = new RegExp(patientName, 'i');
        const medicalAids = await MedicalAid.find({ 
            patientName: regex 
        }).sort({ createdAt: -1 });
        
        if (medicalAids.length === 0) {
            return res.status(404).json({ 
                message: 'No medical aid requests found for this patient',
                success: false
            });
        }
        
        res.json({
            success: true,
            count: medicalAids.length,
            data: medicalAids
        });
    } catch (error) {
        console.error('Error searching medical aid requests by name:', error);
        res.status(500).json({ 
            message: 'Error searching medical aid requests', 
            error: error.message,
            success: false
        });
    }
});

// Get medical aid request by ID
app.get('/api/medical-aid/:id', async (req, res) => {
    try {
        const medicalAid = await MedicalAid.findById(req.params.id);
        if (!medicalAid) {
            return res.status(404).json({ message: 'Medical aid request not found' });
        }
        res.json(medicalAid);
    } catch (error) {
        console.error('Error fetching medical aid request:', error);
        res.status(500).json({ 
            message: 'Error fetching medical aid request', 
            error: error.message 
        });
    }
});

// Transport Aid Routes
app.post('/api/transport-aid', async (req, res) => {
    try {
        console.log('Received transport aid request:', req.body);
        
        // Check for required fields
        const { requestorName, pickupLocation, dropoffLocation, contactNumber } = req.body;
        
        if (!requestorName || !pickupLocation || !dropoffLocation || !contactNumber) {
            return res.status(400).json({ 
                message: 'Missing required fields', 
                error: 'Please provide requestorName, pickupLocation, dropoffLocation, and contactNumber.' 
            });
        }
        
        const transportAid = new TransportAid(req.body);
        await transportAid.save();

        // Notify nearby volunteers
        const notificationResult = await notifyNearbyVolunteers('transport', transportAid);
        console.log('Volunteer notification result:', notificationResult);

        res.status(201).json({ 
            message: 'Transport aid request submitted successfully', 
            data: transportAid,
            volunteerNotification: notificationResult
        });
    } catch (error) {
        console.error('Server Error:', error);
        res.status(400).json({ 
            message: 'Error submitting transport aid request', 
            error: error.message 
        });
    }
});

app.get('/api/transport-aid', async (req, res) => {
    try {
        const transportAids = await TransportAid.find().sort({ createdAt: -1 });
        res.json(transportAids);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching transport aid requests', 
            error: error.message 
        });
    }
});

// Get transport aid request by ID
app.get('/api/transport-aid/:id', async (req, res) => {
    try {
        const transportAid = await TransportAid.findById(req.params.id);
        if (!transportAid) {
            return res.status(404).json({ message: 'Transport aid request not found' });
        }
        res.json(transportAid);
    } catch (error) {
        console.error('Error fetching transport aid request:', error);
        res.status(500).json({ 
            message: 'Error fetching transport aid request', 
            error: error.message 
        });
    }
});

// SMS Notification Route
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, body } = req.body;
    
    if (!to || !body) {
      return res.status(400).json({ success: false, message: 'Phone number and message body are required' });
    }

    // Twilio configuration
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

    // Skip actual SMS sending if Twilio credentials are not configured
    if (!accountSid || !authToken || !twilioNumber) {
      console.log('Twilio credentials not configured, skipping SMS sending');
      console.log('Would have sent SMS to:', to);
      console.log('Message:', body);
      return res.json({ success: true, message: 'SMS notification would be sent (Twilio not configured)' });
    }

    // Send SMS using Twilio
    const client = require('twilio')(accountSid, authToken);
    const message = await client.messages.create({
      body: body,
      from: twilioNumber,
      to: to.startsWith('+') ? to : `+${to}` // Ensure number has country code
    });

    console.log('SMS sent, SID:', message.sid);
    res.json({ success: true, message: 'SMS notification sent successfully' });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ success: false, message: 'Failed to send SMS notification' });
  }
});

// Volunteer routes
app.get('/api/volunteers', async (req, res) => {
  try {
    console.log('GET request received for /api/volunteers');
    const { lat, lng, radius } = req.query;
    let query = {};
    
    // If location parameters are provided, filter by radius
    if (lat && lng && radius) {
      // Convert to numbers
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const searchRadius = parseFloat(radius) / 111.32; // Convert km to degrees (approx)
      
      query = {
        'location.lat': { $gte: latitude - searchRadius, $lte: latitude + searchRadius },
        'location.lng': { $gte: longitude - searchRadius, $lte: longitude + searchRadius }
      };
      
      console.log('Location-based volunteer search:', query);
    }
    
    const volunteers = await Volunteer.find(query).sort({ createdAt: -1 });
    console.log(`Found ${volunteers.length} volunteers`);
    res.json(volunteers);
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch volunteers', error: error.message });
  }
});

app.post('/api/volunteers', async (req, res) => {
  try {
    console.log('POST request received for /api/volunteers with data:', req.body);
    const { name, phone, primaryLocation, additionalLocation, location, skillset, availability } = req.body;
    
    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    
    // Create new volunteer with our updated schema
    const volunteer = new Volunteer({
      name,
      phone,
      primaryLocation,
      additionalLocation,
      location,
      skillset,
      availability
    });
    
    const savedVolunteer = await volunteer.save();
    console.log('Volunteer saved:', savedVolunteer);
    res.status(201).json(savedVolunteer);
  } catch (error) {
    console.error('Error saving volunteer registration:', error);
    res.status(500).json({ success: false, message: 'Failed to save volunteer registration', error: error.message });
  }
});

// Get volunteer by ID
app.get('/api/volunteers/:id', async (req, res) => {
  try {
    const volunteer = await Volunteer.findById(req.params.id);
    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer not found' });
    }
    res.json(volunteer);
  } catch (error) {
    console.error('Error getting volunteer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update volunteer
app.put('/api/volunteers/:id', async (req, res) => {
  try {
    const { name, phone, primaryLocation, additionalLocation, location, skillset, availability } = req.body;
    
    const updatedVolunteer = await Volunteer.findByIdAndUpdate(
      req.params.id,
      {
        name,
        phone,
        primaryLocation,
        additionalLocation,
        location,
        skillset,
        availability
      },
      { new: true }
    );
    
    if (!updatedVolunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    res.json(updatedVolunteer);
  } catch (error) {
    console.error('Error updating volunteer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete volunteer
app.delete('/api/volunteers/:id', async (req, res) => {
  try {
    const deletedVolunteer = await Volunteer.findByIdAndDelete(req.params.id);
    
    if (!deletedVolunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Speech Processing Routes
app.post('/api/process-speech', async (req, res) => {
  try {
    const { text, type, summary, extractedData } = req.body;
    
    console.log('Received speech data:', { text, type, summary, extractedData });
    
    // Create a response with the processed data
    const processedData = {
      originalText: text,
      summary: summary || text.substring(0, 100) + "...",
      type: type,
      timestamp: new Date(),
      status: 'pending',
      extractedData: extractedData || {}
    };

    // Store in database based on extracted information (optional)
    if (type === 'medical' && extractedData) {
      // You could create a medical aid request with the extracted data
      // Example:
      // const medicalAid = new MedicalAid({
      //   patientName: 'Emergency Patient',
      //   condition: extractedData.condition || 'Unknown condition',
      //   location: extractedData.location || 'Unknown location',
      //   contactNumber: 'To be provided',
      //   urgency: extractedData.urgency || 'high',
      //   additionalInfo: text
      // });
      // await medicalAid.save();
      // processedData.requestId = medicalAid._id;
    } else if (type === 'transport' && extractedData) {
      // You could create a transport aid request with the extracted data
      // Example:
      // const transportAid = new TransportAid({
      //   pickupLocation: extractedData.pickupLocation || 'Unknown pickup',
      //   dropoffLocation: extractedData.dropoffLocation || 'Unknown destination',
      //   urgency: extractedData.urgency || 'high',
      //   description: text,
      //   status: 'pending'
      // });
      // await transportAid.save();
      // processedData.requestId = transportAid._id;
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Speech data processed successfully',
      data: processedData
    });
  } catch (error) {
    console.error('Error processing speech data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process speech data',
      error: error.message
    });
  }
});

// Now update the notify-volunteer endpoint to track notifications

app.post('/api/notify-volunteer', async (req, res) => {
  let responseHasBeenSent = false;
  
  try {
    // Validate required parameters
    const { volunteerId, aidId, aidType, message } = req.body;
    
    if (!volunteerId || !aidId || !aidType || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: volunteerId, aidId, aidType, message' 
      });
    }
    
    console.log(`Finding volunteer with ID: ${volunteerId}`);
    const volunteer = await Volunteer.findById(volunteerId);
    
    if (!volunteer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Volunteer not found' 
      });
    }
    
    console.log(`Volunteer found: ${volunteer.name}, phone: ${volunteer.phone}`);
    
    // Send a success response immediately, but continue processing
    res.status(200).json({ 
      success: true, 
      message: 'Notification is being processed',
      volunteer: {
        _id: volunteer._id,
        name: volunteer.name,
        phone: volunteer.phone
      }
    });
    responseHasBeenSent = true;
    
    // Construct customized message for volunteer
    const customMessage = message || 
      `Emergency aid request matched! Type: ${aidType}. Please respond with YES to confirm you can help.`;
      
    // Send the SMS asynchronously
    console.log('Sending SMS notification asynchronously...');
    sendVolunteerSMS(volunteer, customMessage, aidId, aidType)
      .then(result => {
        console.log('SMS notification completed:', result);
      })
      .catch(error => {
        console.error('Error sending SMS notification:', error);
      });
      
  } catch (error) {
    console.error('Error in volunteer notification:', error);
    if (!responseHasBeenSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Error processing notification',
        error: error.message 
      });
    }
  }
});

// Add an endpoint to retrieve notification history for an aid request
app.get('/api/notifications/:aidType/:aidId', async (req, res) => {
  try {
    const { aidType, aidId } = req.params;
    
    const notifications = await Notification.find({ 
      aidType, 
      aidId 
    }).populate('volunteerId', 'name phone skillset').sort({ createdAt: -1 });
    
    res.json(notifications);
  } catch (error) {
    console.error('Error retrieving notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve notification history',
      error: error.message 
    });
  }
});

// Get all notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Feedback API routes
// Submit feedback for a volunteer
app.post('/api/feedback', async (req, res) => {
  try {
    const { aidId, aidType, volunteerId, rating, comment, tags } = req.body;
    
    // Validate required fields
    if (!aidId || !aidType || !volunteerId || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate rating is between 1-5
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    // Check if volunteer exists
    const volunteer = await Volunteer.findById(volunteerId);
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    // Check if aid request exists
    let aidExists = false;
    if (aidType === 'medical') {
      aidExists = await MedicalAid.exists({ _id: aidId });
    } else if (aidType === 'transport') {
      aidExists = await TransportAid.exists({ _id: aidId });
    }
    
    if (!aidExists) {
      return res.status(404).json({ error: 'Aid request not found' });
    }
    
    // Create new feedback or update existing
    const feedback = await Feedback.findOneAndUpdate(
      { aidId, aidType, volunteerId },
      { rating, comment, tags },
      { new: true, upsert: true }
    );
    
    // Update volunteer's average rating
    await updateVolunteerRating(volunteerId);
    
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    
    // Handle duplicate key error (volunteer already has feedback for this aid)
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'Feedback already exists for this volunteer and aid request',
        existingFeedback: true
      });
    }
    
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get all feedback for a volunteer
app.get('/api/volunteers/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if volunteer exists
    const volunteer = await Volunteer.findById(id);
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    // Get all feedback for the volunteer
    const feedback = await Feedback.find({ volunteerId: id })
      .sort({ createdAt: -1 });
    
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching volunteer feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get feedback for a specific aid request
app.get('/api/feedback/:aidType/:aidId', async (req, res) => {
  try {
    const { aidType, aidId } = req.params;
    
    // Validate aid type
    if (aidType !== 'medical' && aidType !== 'transport') {
      return res.status(400).json({ error: 'Invalid aid type' });
    }
    
    // Get all feedback for the aid request
    const feedback = await Feedback.find({ aidId, aidType })
      .populate('volunteerId', 'name phone') // Include volunteer info
      .sort({ createdAt: -1 });
    
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching aid feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get a specific feedback by ID
app.get('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const feedback = await Feedback.findById(id)
      .populate('volunteerId', 'name phone email'); // Include volunteer info
    
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Update a feedback
app.put('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, tags } = req.body;
    
    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { rating, comment, tags },
      { new: true }
    );
    
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    // Update volunteer's average rating
    await updateVolunteerRating(feedback.volunteerId);
    
    res.json(feedback);
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// Delete a feedback
app.delete('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    // Store volunteer ID before deleting
    const volunteerId = feedback.volunteerId;
    
    // Delete the feedback
    await Feedback.findByIdAndDelete(id);
    
    // Update volunteer's average rating
    await updateVolunteerRating(volunteerId);
    
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Helper function to update volunteer's rating
async function updateVolunteerRating(volunteerId) {
  try {
    // Get all feedback for the volunteer
    const feedbacks = await Feedback.find({ volunteerId });
    
    if (feedbacks.length === 0) {
      // No feedback yet, reset ratings
      await Volunteer.findByIdAndUpdate(volunteerId, {
        averageRating: 0,
        totalRatings: 0
      });
      return;
    }
    
    // Calculate average rating
    const totalRating = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
    const averageRating = totalRating / feedbacks.length;
    
    // Group ratings by tags to calculate skill-specific ratings
    const skillRatings = {};
    feedbacks.forEach(feedback => {
      if (feedback.tags && feedback.tags.length > 0) {
        feedback.tags.forEach(tag => {
          if (!skillRatings[tag]) {
            skillRatings[tag] = { sum: 0, count: 0 };
          }
          skillRatings[tag].sum += feedback.rating;
          skillRatings[tag].count += 1;
        });
      }
    });
    
    // Calculate average for each skill
    const skillRatingAverages = {};
    Object.keys(skillRatings).forEach(skill => {
      skillRatingAverages[skill] = 
        skillRatings[skill].sum / skillRatings[skill].count;
    });
    
    // Update volunteer with new ratings
    await Volunteer.findByIdAndUpdate(volunteerId, {
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalRatings: feedbacks.length,
      skillRatings: skillRatingAverages
    });
  } catch (error) {
    console.error('Error updating volunteer rating:', error);
    throw error;
  }
}

// Add webhook handlers to server.js
app.post('/webhook/inbound-sms', (req, res) => {
  // Add vonage client to the request so webhook handler can use it
  req.vonageClient = vonage;
  vonageWebhooks.handleInboundSMS(req, res);
});

app.post('/webhook/delivery-receipt', (req, res) => {
  req.vonageClient = vonage;
  vonageWebhooks.handleDeliveryReceipt(req, res);
});

// Function to fix the email index issue
async function fixVolunteerEmailIndex() {
    try {
        const collections = await mongoose.connection.db.listCollections({ name: 'volunteers' }).toArray();
        if (collections.length > 0) {
            console.log('Found volunteers collection, checking for problematic index');
            
            // Check if the index exists
            const indexes = await mongoose.connection.db.collection('volunteers').indexes();
            const emailIndex = indexes.find(index => 
                index.name === 'email_1' || 
                (index.key && index.key.email && index.unique)
            );
            
            if (emailIndex) {
                console.log('Found problematic unique email index, dropping it');
                await mongoose.connection.db.collection('volunteers').dropIndex(emailIndex.name);
                console.log('Successfully dropped problematic email index');
            } else {
                console.log('No problematic email index found');
            }
        }
    } catch (error) {
        console.error('Error fixing volunteer email index:', error);
        // Continue operation even if index removal fails
    }
}

//=== TEST ENDPOINTS ===//

// Add a test endpoint for direct SMS sending
app.post('/api/test-vonage-sms', async (req, res) => {
  try {
    console.log('=== VONAGE SMS TEST ENDPOINT ===');
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ success: false, message: 'Phone number and message are required' });
    }
    
    // Verify Vonage is initialized
    if (!vonage || !messagesClient) {
      return res.status(500).json({ 
        success: false, 
        message: 'Vonage client not properly initialized', 
        vonageAvailable: !!vonage,
        messagesClientAvailable: !!messagesClient
      });
    }
    
    // Format the phone number
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+91' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    }
    
    // Process and clean the number to ensure it's in the proper format
    // Make sure it has +91 for the test number
    if (formattedPhone.includes('9704178229') && !formattedPhone.startsWith('+91')) {
      formattedPhone = '+91' + formattedPhone.replace(/^\+/, '').replace(/^91/, '');
    }
    
    // Format the message to incorporate the trial/demo tag
    const formattedMessage = `Hey volunteer, you got aid request! Type YES to take request, NO for not.`;
    
    console.log(`Test SMS - Sending to: ${formattedPhone}, Message: ${formattedMessage}`);
    console.log(`Using Vonage Virtual Number: ${process.env.VONAGE_VIRTUAL_NUMBER}`);
    
    try {
      // Using the new Vonage Messages API v1
      const resp = await messagesClient.send({
        message_type: 'text',
        from: process.env.VONAGE_VIRTUAL_NUMBER,
        to: formattedPhone,
        text: formattedMessage,
        channel: 'sms'
      });
      
      console.log('Test SMS Response:', resp);
      
      // Check for messageUUID (correct property name) in the response
      if (resp && resp.messageUUID) {
        return res.json({ 
          success: true, 
          message: 'Test SMS sent successfully', 
          messageId: resp.messageUUID,
          details: resp
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to send test SMS: No messageUUID returned',
          details: resp
        });
      }
    } catch (error) {
      console.error('Test SMS Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send test SMS', 
        error: error.message,
        details: error
      });
    }
  } catch (error) {
    console.error('Test SMS Exception:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Exception while sending test SMS', 
      error: error.message 
    });
  }
});

// Add a simple test route to check if server is running
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'build')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'build', 'index.html'));
    });
}

const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        // If port is in use, try the next port
        const newPort = PORT + 1;
        console.log(`Port ${PORT} is busy, trying port ${newPort}...`);
        
        // Close the first attempted server
        server.close();
        
        // Try with a new port
        const newServer = app.listen(newPort, '0.0.0.0', () => {
            console.log(`Server is running on alternative port ${newPort}`);
            console.log(`API URL: http://localhost:${newPort}`);
            // Update the environment variable so other parts of the app know which port to use
            process.env.PORT = newPort;
        });
    } else {
        console.error('Server error:', err);
    }
});
