const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  volunteerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Volunteer',
    required: true
  },
  aidId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  aidType: {
    type: String,
    enum: ['medical', 'transport'],
    required: true
  },
  messageContent: {
    type: String,
    required: true
  },
  message: {
    type: String
  },
  response: {
    type: String,
    default: null
  },
  messageId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'responded', 'failed'],
    default: 'queued'
  },
  statusDetails: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Set message field when messageContent is set (for backward compatibility)
notificationSchema.pre('save', function(next) {
  if (this.messageContent && !this.message) {
    this.message = this.messageContent;
  } else if (this.message && !this.messageContent) {
    this.messageContent = this.message;
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 