const mongoose = require('mongoose');

const transportAidSchema = new mongoose.Schema({
    requestorName: {
        type: String,
        required: true
    },
    pickupLocation: {
        type: String,
        required: true
    },
    pickupCoordinates: {
        lat: Number,
        lng: Number
    },
    dropoffLocation: {
        type: String,
        required: true
    },
    dropoffCoordinates: {
        lat: Number,
        lng: Number
    },
    contactNumber: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^[0-9]{10}$/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    numPassengers: {
        type: Number,
        default: 1,
        min: 1
    },
    urgency: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    specialRequirements: String,
    status: {
        type: String,
        enum: ['pending', 'assigned', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    assignedVolunteer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Volunteer'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TransportAid', transportAidSchema);
