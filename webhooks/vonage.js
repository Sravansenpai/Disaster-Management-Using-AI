const Volunteer = require('../models/Volunteer');
const MedicalAid = require('../models/MedicalAid');
const TransportAid = require('../models/TransportAid');
const Notification = require('../models/Notification');

// Import phone number formatter
const { formatPhoneNumber } = require('../utils/phoneUtils');

// Handler for Vonage inbound SMS webhook
async function handleInboundSMS(req, res) {
  try {
    console.log('=== RECEIVED INBOUND SMS WEBHOOK ===');
    console.log('SMS webhook data:', JSON.stringify(req.body));
    
    // Extract message data
    const { msisdn, text = '', to = '' } = req.body;
    
    if (!msisdn || !text) {
      return res.status(400).json({ result: 'error', message: 'Missing required parameters' });
    }
    
    // Normalize and format phone number for matching
    const normalizedPhone = formatPhoneNumber(msisdn);
    console.log(`Searching for volunteer with phone number: ${normalizedPhone}`);
    
    // Find the volunteer by phone number - various formats
    let volunteer = null;
    
    // Try direct match first
    volunteer = await Volunteer.findOne({ phone: normalizedPhone });
    
    // If that fails, try ending digits match
    if (!volunteer) {
      // Get last 10 digits for comparison
      const last10Digits = msisdn.replace(/\D/g, '').slice(-10);
      console.log(`No direct match found, trying with last 10 digits: ${last10Digits}`);
      
      // Find all volunteers
      const allVolunteers = await Volunteer.find();
      
      // Find a volunteer whose phone number ends with the same 10 digits
      volunteer = allVolunteers.find(v => {
        const vDigits = v.phone.replace(/\D/g, '');
        return vDigits.endsWith(last10Digits);
      });
    }
    
    if (!volunteer) {
      console.log(`No volunteer found for phone number: ${normalizedPhone}`);
      return res.status(200).json({ result: 'success', message: 'No matching volunteer found, but webhook processed' });
    }
    
    console.log(`Found volunteer: ${volunteer.name} (${volunteer._id}) for response`);
    
    // Find the most recent notification sent to this volunteer
    const latestNotification = await Notification.findOne({ 
      'volunteerId': volunteer._id,
      'status': { $in: ['sent', 'delivered'] }
    }).sort({ createdAt: -1 });
    
    if (!latestNotification) {
      console.log('No pending notification found for this volunteer');
      return res.status(200).json({ result: 'success', message: 'No pending notification found' });
    }
    
    console.log(`Found latest notification: ${latestNotification._id} from ${new Date(latestNotification.createdAt).toLocaleString()}`);
    
    // Update the notification with the response
    latestNotification.response = text;
    
    // Log the notification structure for debugging
    console.log('Notification structure:', JSON.stringify({
      id: latestNotification._id,
      volunteerId: latestNotification.volunteerId,
      aidId: latestNotification.aidId,
      aidType: latestNotification.aidType,
      hasMessageContent: !!latestNotification.messageContent,
      hasMessage: !!latestNotification.message
    }));

    // The original message (check both potential field names)
    const originalMessage = latestNotification.messageContent || latestNotification.message || '';
    console.log(`Original message: ${originalMessage}`);
    
    // Check if the response is positive (YES, Y, CONFIRM, etc.)
    const positiveResponse = /^(yes|y|confirm|ok|sure|accept|agreed|yep|yeah|ya|yup|fine|positive|affirmative|will do)/i.test(text);
    
    if (positiveResponse) {
      console.log(`Positive response received: "${text}"`);
      latestNotification.status = 'responded';
      
      // Update the aid request status if needed
      if (latestNotification.aidType === 'medical') {
        const updatedAid = await MedicalAid.findByIdAndUpdate(
          latestNotification.aidId,
          { $set: { status: 'assigned', assignedVolunteer: volunteer._id } },
          { new: true }
        );
        console.log(`Updated medical aid ${latestNotification.aidId} status to assigned`);
      } else if (latestNotification.aidType === 'transport') {
        const updatedAid = await TransportAid.findByIdAndUpdate(
          latestNotification.aidId,
          { $set: { status: 'assigned', assignedVolunteer: volunteer._id } },
          { new: true }
        );
        console.log(`Updated transport aid ${latestNotification.aidId} status to assigned`);
      }
      
      // Send confirmation SMS to volunteer through the main server
      // This will be handled by the Vonage client in server.js
      if (req.vonageClient) {
        const confirmationMessage = 'Thank you for confirming. Details have been shared with the requester. Please proceed to the location provided.';
        console.log(`Sending confirmation SMS to ${normalizedPhone}: ${confirmationMessage}`);
        
        req.vonageClient.message.sendSms(
          process.env.VONAGE_VIRTUAL_NUMBER, 
          normalizedPhone, 
          confirmationMessage,
          { type: 'unicode' },
          (err, responseData) => {
            if (err) {
              console.error('Error sending confirmation SMS:', err);
            } else {
              console.log('Confirmation SMS sent successfully');
            }
          }
        );
      }
    } else {
      console.log(`Non-positive response received: "${text}"`);
      // Update status but don't assign volunteer
      latestNotification.status = 'responded';
    }
    
    await latestNotification.save();
    console.log(`Updated notification ${latestNotification._id} with response: ${text}`);
    
    res.status(200).json({ result: 'success' });
  } catch (error) {
    console.error('Error processing inbound SMS webhook:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
}

// Handler for Vonage delivery receipts
async function handleDeliveryReceipt(req, res) {
  try {
    console.log('=== RECEIVED DELIVERY RECEIPT WEBHOOK ===');
    console.log('Delivery receipt data:', JSON.stringify(req.body));
    
    // Extract message ID and status
    const { messageId, status, to, err_code } = req.body;
    
    if (!messageId) {
      return res.status(400).json({ result: 'error', message: 'Missing message ID' });
    }
    
    console.log(`Received delivery receipt for message ${messageId} with status: ${status}`);
    
    // Find the notification with this message ID
    const notification = await Notification.findOne({ messageId: messageId });
    
    if (!notification) {
      console.log(`No notification found with message ID: ${messageId}`);
      return res.status(200).json({ result: 'success', message: 'No matching notification found' });
    }
    
    console.log(`Found notification: ${notification._id} for volunteer: ${notification.volunteerId}`);
    
    // Map Vonage status to our status
    let newStatus = notification.status;
    let statusDetails = err_code ? `Error code: ${err_code}` : null;
    
    switch(status) {
      case 'delivered':
        newStatus = 'delivered';
        break;
      case 'accepted':
      case 'buffered':
        newStatus = 'sent';
        break;
      case 'expired':
      case 'failed':
      case 'rejected':
        newStatus = 'failed';
        statusDetails = `Vonage status: ${status}, Error code: ${err_code}`;
        break;
      default:
        // Keep current status
        break;
    }
    
    // Update notification status
    if (newStatus !== notification.status) {
      notification.status = newStatus;
      notification.statusDetails = statusDetails;
      await notification.save();
      console.log(`Updated notification ${notification._id} status to ${newStatus}`);
    }
    
    res.status(200).json({ result: 'success' });
  } catch (error) {
    console.error('Error processing delivery receipt webhook:', error);
    res.status(500).json({ result: 'error', message: error.message });
  }
}

// Export the webhook handlers
module.exports = {
  handleInboundSMS,
  handleDeliveryReceipt
}; 